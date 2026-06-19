/* TradeCheck UI:支持 CSV 或多张图片上传、AI诊断(后端)、报告下载。依赖 TC 与 Chart.js */
const $=s=>document.querySelector(s);
let fileDeal=null,fileMkt=null,images=[],charts=[],BACKEND={ok:false,tc:false};
const yuan=x=>(x<0?"-￥":"￥")+Math.abs(Math.round(x)).toLocaleString();
const yuan2=x=>(x<0?"-￥":"￥")+Math.abs(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
// 后端地址:Cloudflare Pages 部署时填入微信云托管公网域名;本地开发置空走相对路径
const BACKEND_BASE=(window.TRADECHECK_BACKEND||"").replace(/\/$/,"");
const apiURL=p=>BACKEND_BASE?BACKEND_BASE+p:p;

async function probeBackend(){
  // 1. 探测主后端 /api/health(TradeCheck 本地 server 或 mrdk 都接受这个路径)
  try{const r=await fetch(apiURL("/api/health"),{cache:"no-store",signal:AbortSignal.timeout(3000)});
    if(r.ok){const j=await r.json();BACKEND.ok=true;BACKEND.mock=j.mock;BACKEND.model=j.model;BACKEND.feature=j.feature||"local";}}
  catch(e){BACKEND.ok=false;}
  // 2. 单独探测 TradeCheck 子系统(mrdk 部署时存在 /api/tradecheck/health),并读取能力清单
  try{const r=await fetch(apiURL("/api/tradecheck/health"),{cache:"no-store",signal:AbortSignal.timeout(3000)});
    if(r.ok){const j=await r.json();BACKEND.tc=true;BACKEND.tcCaps=j.capabilities||{};BACKEND.tcLLM=j.llm||{};}}
  catch(e){BACKEND.tc=false;}
  const el=$("#beStatus");if(!el)return;
  // 只汇报对 TradeCheck 真正有意义的能力
  if(BACKEND.tc){
    const caps=[];
    caps.push("自动补行情");
    if(BACKEND.tcCaps&&BACKEND.tcCaps.ocr&&BACKEND.tcCaps.parse_csv)caps.push("图片 OCR 解析(分批)");
    else if(BACKEND.tcCaps&&BACKEND.tcCaps.extract_csv)caps.push("图片 OCR 解析");
    el.innerHTML="● 后端就绪 — "+caps.join(" · ");
    el.className="be on";
  } else {el.innerHTML="○ 离线模式 — 仅本地规则诊断可用";el.className="be off";}
}

const OCR_BATCH_SIZE=3; // 每批 3 张,绕开云托管网关单次请求超时/限流

/** 分批 OCR + 单次 LLM 解析(新架构,推荐) */
async function extractCsvBatched(imageUrls,broker){
  const allLines=[];let totalOcrLines=0;const perImage=[];
  const n=imageUrls.length;
  for(let i=0;i<n;i+=OCR_BATCH_SIZE){
    const batch=imageUrls.slice(i,i+OCR_BATCH_SIZE);
    const startIndex=i+1;
    const endIndex=Math.min(i+OCR_BATCH_SIZE,n);
    setBusy(true,`正在 OCR 图片 ${startIndex}-${endIndex}/${n}…`);
    const r=await fetch(apiURL("/api/tradecheck/ocr"),{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({images:batch,start_index:startIndex,broker:broker||""})
    });
    const j=await r.json();
    if(!r.ok)throw new Error(j.detail||j.error||("OCR 失败 HTTP "+r.status));
    if(j.lines&&j.lines.length)allLines.push(...j.lines);
    totalOcrLines+=j.ocr_lines||0;
    if(j.ocr_per_image)perImage.push(...j.ocr_per_image);
  }
  if(!allLines.length)throw new Error("OCR 未提取到任何文字,请检查图片是否清晰");
  setBusy(true,"正在 AI 解析交割单…");
  const r2=await fetch(apiURL("/api/tradecheck/parse_csv"),{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({lines:allLines,broker:broker||""})
  });
  const j2=await r2.json();
  if(!r2.ok)throw new Error(j2.detail||j2.error||("解析失败 HTTP "+r2.status));
  console.log("[parse_csv] OCR 行:",totalOcrLines,"解析交易笔数:",j2.n_rows,"批次数:",Math.ceil(n/OCR_BATCH_SIZE));
  return {csv:j2.csv,n_rows:j2.n_rows,ocr_lines:totalOcrLines,ocr_per_image:perImage};
}

/** 旧版一体接口(小图量或后端未升级时的回退) */
async function extractCsvLegacy(imageUrls,broker){
  setBusy(true,"正在 OCR + AI 解析图片中的交割单…");
  const r=await fetch(apiURL("/api/tradecheck/extract_csv"),{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({images:imageUrls,broker:broker||""})
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j.detail||j.error||("图片识别失败 HTTP "+r.status));
  if(j.n_rows!==undefined)console.log("[extract_csv] OCR 行:",j.ocr_lines,"解析交易笔数:",j.n_rows);
  return j;
}

/* 自动从后端拉行情:输入是已 parseDeals 后的交易明细数组,输出 CSV 字符串(供 TC.analyze 第二参) */
async function autoFetchMarket(deals){
  if(!BACKEND.tc)return null;
  const seen=new Set(),names=[],raws=[];let minDate=null,maxDate=null;
  for(const d of deals){
    const k=(d.code||"")+"|"+(d.name||"");
    if(!seen.has(k)){seen.add(k);names.push(d.name||"");raws.push(d.code||"");}
    const dt=d.date instanceof Date?d.date:new Date(d.date);
    const iso=dt.toISOString().slice(0,10);
    if(!minDate||iso<minDate)minDate=iso;
    if(!maxDate||iso>maxDate)maxDate=iso;
  }
  if(!names.length||!minDate||!maxDate)return null;
  // 终点 +7 天,为了能取到次日开盘 + 几个交易日的回看
  const endDt=new Date(maxDate);endDt.setDate(endDt.getDate()+7);
  const endStr=endDt.toISOString().slice(0,10);
  const r=await fetch(apiURL("/api/tradecheck/build_market_csv"),{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({names:names,raw_codes:raws,start_date:minDate,end_date:endStr})
  });
  if(!r.ok){const t=await r.text().catch(()=>"");throw new Error("行情服务返回 "+r.status+(t?": "+t.slice(0,200):""));}
  const j=await r.json();
  return {csv:j.csv,unresolved:j.unresolved||[],nRows:j.n_rows||0,nResolved:j.n_resolved||0};
}

function setCSV(which,file){const rd=new FileReader();rd.onload=()=>{
  fileDeal=rd.result;$("#dealName").textContent="✓ "+file.name;$("#dealZone").classList.add("ok");
  syncRun();};rd.readAsText(file,"utf-8");}
function addImages(files){[...files].forEach(f=>{if(!f.type.startsWith("image/"))return;const rd=new FileReader();
  rd.onload=()=>{images.push({name:f.name,url:rd.result});renderThumbs();syncRun();};rd.readAsDataURL(f);});}
function renderThumbs(){const w=$("#thumbs");w.innerHTML=images.map((im,i)=>
  `<div class=thumb><img src="${im.url}"><span class=x data-i=${i}>✕</span></div>`).join("");
  w.querySelectorAll(".x").forEach(b=>b.onclick=e=>{images.splice(+e.target.dataset.i,1);renderThumbs();syncRun();});
  $("#imgZone").classList.toggle("ok",images.length>0);
  $("#imgCount").textContent=images.length?`已选 ${images.length} 张(可继续添加,自动按顺序拼接)`:"";}
function syncRun(){$("#runBtn").disabled=!(fileDeal||images.length);}

function bindCSV(zone,input,which){const z=$("#"+zone),inp=$("#"+input);
  z.addEventListener("click",()=>inp.click());
  inp.addEventListener("change",e=>{if(e.target.files[0])setCSV(which,e.target.files[0]);});
  dnd(z,fs=>{if(fs[0])setCSV(which,fs[0]);});}
function bindImg(){const z=$("#imgZone"),inp=$("#imgInput");
  z.addEventListener("click",e=>{if(!e.target.classList.contains("x"))inp.click();});
  inp.addEventListener("change",e=>addImages(e.target.files));dnd(z,fs=>addImages(fs));}
function dnd(z,cb){["dragover","dragenter"].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();z.classList.add("drag");}));
  ["dragleave","drop"].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();z.classList.remove("drag");}));
  z.addEventListener("drop",e=>cb(e.dataTransfer.files));}

function setBusy(b,msg){const btn=$("#runBtn");btn.disabled=b||!(fileDeal||images.length);btn.textContent=b?(msg||"处理中…"):"生成诊断报告";}

async function run(){$("#err").textContent="";
  try{
    let dealText=fileDeal;
    if(!dealText&&images.length){
      // 公网部署:优先分批 OCR(/ocr) + 单次 LLM(/parse_csv),绕开网关超时
      // 回退:旧版一体 /api/tradecheck/extract_csv;本地开发:/api/extract(视觉模型)
      const useBatchOcr=BACKEND.tc&&BACKEND.tcCaps&&BACKEND.tcCaps.ocr&&BACKEND.tcCaps.parse_csv;
      const useTcOcr=useBatchOcr||(BACKEND.tc&&BACKEND.tcCaps&&BACKEND.tcCaps.extract_csv);
      if(!useTcOcr&&!BACKEND.ok){
        throw new Error("图片识别需要后端:管理员请在 mrdk 容器里配置 DEEPSEEK_API_KEY 或 ZHIPU_API_KEY,或改用 CSV 交割单上传。");
      }
      const urls=images.map(i=>i.url);
      let j;
      if(useBatchOcr){
        j=await extractCsvBatched(urls);
      }else if(useTcOcr){
        j=await extractCsvLegacy(urls);
      }else{
        setBusy(true,"正在 OCR + AI 解析图片中的交割单…");
        const r=await fetch(apiURL("/api/extract"),{method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({images:urls})});
        j=await r.json();if(!r.ok)throw new Error(j.detail||j.error||("图片识别失败 HTTP "+r.status));
      }
      dealText=j.csv;
    }
    if(!dealText)throw new Error("请上传交割单(CSV 或图片)。");

    // 若用户没手工提供行情 CSV 且 TradeCheck 行情服务可用,自动从后端拉
    let mktText=fileMkt,mktNote=null;
    if(!mktText&&BACKEND.tc){
      setBusy(true,"正在从后端获取行情数据…");
      try{
        const probe=TC.parseDeals(dealText);
        const fetched=await autoFetchMarket(probe);
        if(fetched&&fetched.csv){
          mktText=fetched.csv;
          mktNote={nRows:fetched.nRows,nResolved:fetched.nResolved,unresolved:fetched.unresolved};
        }
      }catch(e){mktNote={error:e.message};}
    }

    setBusy(true,"正在计算指标…");
    const R=TC.analyze(dealText,mktText);
    if(mktNote)R.marketFetch=mktNote;

    if(BACKEND.ok){
      setBusy(true,"正在生成 AI 诊断…");
      try{
        const r=await fetch(apiURL("/api/diagnose"),{method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({style:R.style,metrics:R.metrics,dabp:R.dabp,ruleDiagnoses:R.diagnoses})});
        const j=await r.json();if(!r.ok)throw new Error(j.error||"AI诊断失败");
        R.ai=j;
        if(Array.isArray(j.problems)&&j.problems.length)
          R.diagnoses=j.problems.map((p,i)=>({id:p.id||String(i+1).padStart(2,"0"),
            sev:(R.diagnoses[i]&&R.diagnoses[i].sev)||"high",title:p.title,evidence:p.evidence,harm:p.harm,fixes:p.fixes||[]}));
      }catch(e){R.aiError=e.message;}
    }
    $("#upload").style.display="none";$("#report").style.display="block";renderReport(R);window.scrollTo(0,0);
  }catch(e){$("#err").textContent="⚠ "+e.message;}
  finally{setBusy(false);}
}
function loadDemo(){fileDeal=DEMO_DEAL;fileMkt=DEMO_MKT;run();}
function reset(){location.reload();}

function downloadReport(){
  const rep=$("#report").cloneNode(true);
  const live=$("#report").querySelectorAll("canvas"),cl=rep.querySelectorAll("canvas");
  cl.forEach((c,i)=>{const img=document.createElement("img");try{img.src=live[i].toDataURL("image/png");}catch(e){}
    img.style.width="100%";img.style.maxWidth=live[i].style.width||"100%";c.replaceWith(img);});
  const tb=rep.querySelector(".topbar");if(tb)tb.remove();
  const css=document.querySelector("style").textContent;
  const html="<!DOCTYPE html><html lang=zh-CN><head><meta charset=utf-8><title>交易诊断报告</title><style>"+css+"</style></head><body>"+rep.outerHTML+"</body></html>";
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));
  a.download="交易诊断报告_"+new Date().toISOString().slice(0,10)+".html";a.click();
}

function kpiCard(t,v,cls,s){return `<div class=kpi><div class=t>${t}</div><div class="v ${cls}">${v}</div><div class=s>${s}</div></div>`;}

function renderReport(R){
  const m=R.metrics,st=R.style,d=R.dabp;charts.forEach(c=>c.destroy());charts=[];
  const pos=m.total_pnl>=0?"pos":"neg";
  const cards=[
    ["区间净盈亏",yuan2(m.total_pnl),pos,`${m.n_trades} 笔完整交易`],
    ["胜率",m.win_rate+"%",m.win_rate>=50?"pos":"warn",`${m.n_wins}胜/${m.n_losses}负`],
    ["盈亏比",m.profit_loss_ratio,m.profit_loss_ratio>=1?"pos":"neg","平均盈利÷平均亏损"],
    ["盈利因子",m.profit_factor,m.profit_factor>=1?"pos":"neg","总盈利÷总亏损"],
    ["平均盈利",yuan2(m.avg_win),"pos","每笔盈利单"],
    ["平均亏损",yuan2(m.avg_loss),"neg","每笔亏损单"],
    ["盈利单持有",m.avg_hold_win+" 天",m.de_ratio>=1.8?"warn":"muted","盈利持有时长"],
    ["亏损单持有",m.avg_hold_loss+" 天",m.de_ratio>=1.8?"neg":"muted","亏损持有时长"],
    ["总交易成本",yuan2(-m.total_cost),"warn",`占成交额 ${m.cost_vs_turnover}%`],
    ["总成交额",yuan(m.turnover),"muted",`户均仓位 ${yuan(m.avg_position)}`],
  ];
  const sevTxt={critical:"严重",high:"较高",medium:"中等"};
  const probHtml=R.diagnoses.map(p=>`<div class="problem sev-${p.sev}"><div class=p-head><span class=p-id>${p.id}</span>
    <h3>${p.title}</h3><span class="sev sev-${p.sev}">${sevTxt[p.sev]||""}</span></div><div class=p-body>
    <div class=p-row><span class=lab>数据证据</span><p>${p.evidence}</p></div>
    <div class=p-row><span class=lab>危害</span><p>${p.harm}</p></div>
    <div class=p-row><span class=lab>整改建议</span><ul>${(p.fixes||[]).map(x=>`<li>${x}</li>`).join("")}</ul></div></div></div>`).join("");
  const fixes=[...new Set([].concat(...R.diagnoses.map(p=>p.fixes||[])))];
  const checkHtml=fixes.map(c=>`<label class=ck><input type=checkbox>${c}</label>`).join("");
  // AI 小结
  let aiHtml="";
  if(R.ai&&R.ai.summary){aiHtml=`<div class="aibox"><div class=ai-tag>🤖 AI 诊断小结 ${R.ai.mock?"<span class=mock>mock</span>":"<span class=real>大模型</span>"}</div><p>${R.ai.summary}</p></div>`;}
  else if(R.aiError){aiHtml=`<div class="aibox warnbox">AI 诊断暂不可用(${R.aiError}),以下为规则引擎诊断。</div>`;}

  let dabpHtml="";
  if(d){const sr=g=>d.senti_stats[g]||{n:0,win_rate:0,pnl:0};const tide=sr("退潮(情绪<40)");
    const wr=d.worst.map(t=>`<tr><td>${t.name} <span class=code>${t.code}</span></td><td>${t.board}·${t.entry}</td><td>情绪${t.senti==null?"-":t.senti}</td><td class=neg>${t.premium}%</td><td class=neg>${t.ret}%</td><td class=neg>${yuan(t.pnl)}</td></tr>`).join("");
    const br=d.best.map(t=>`<tr><td>${t.name} <span class=code>${t.code}</span></td><td>${t.board}·${t.entry}</td><td>情绪${t.senti==null?"-":t.senti}</td><td class=pos>+${t.premium}%</td><td class=pos>+${t.ret}%</td><td class=pos>${yuan(t.pnl)}</td></tr>`).join("");
    dabpHtml=`<h2 class=sec>打板接力 · 专属画像</h2>
    <div class=charts><div class=panel><h4>连板高度 · 分项胜率</h4><p class=sub>板越高、胜率越低则高板接力缺乏正期望</p><canvas id=boardChart height=180></canvas></div>
      <div class=panel><h4>市场情绪周期 · 净盈亏</h4><p class=sub>退潮期 ${tide.n} 笔、胜率 ${tide.win_rate}%、${yuan(tide.pnl)}</p><canvas id=sentiChart height=180></canvas></div></div>
    <div class=kpi-row>${kpiCard("打板占比",d.db_share+"%","muted","打板/半路/低吸")}
      ${kpiCard("次日高开率",d.high_open_rate+"%",d.high_open_rate>=40?"pos":"neg","接力成功前提")}
      ${kpiCard("次日水下率",d.underwater_rate+"%","neg","买在情绪高点")}
      ${kpiCard("核按钮执行率",d.cut_rate+"%",d.cut_rate>=50?"pos":"neg",`水下${d.n_underwater}笔仅${d.n_cut}笔止损`)}</div>
    <div class=charts style=margin-top:16px><div class=panel><h4 class=neg>亏损最重的接力</h4><table><tr><th>标的</th><th>高度·方式</th><th>情绪</th><th>次日溢价</th><th>收益率</th><th>盈亏</th></tr>${wr}</table></div>
      <div class=panel><h4 class=pos>盈利最好的接力</h4><table><tr><th>标的</th><th>高度·方式</th><th>情绪</th><th>次日溢价</th><th>收益率</th><th>盈亏</th></tr>${br}</table></div></div>`;}

  $("#report").innerHTML=`
  <div class=topbar><div class=brand><span class=dot></span>TradeCheck · 交易诊断助手</div>
    <div><button class=btn-ghost onclick=downloadReport()>⬇ 下载报告</button>
    <button class=btn-ghost onclick=window.print()>打印 / 导出PDF</button>
    <button class=btn-ghost onclick=reset()>重新上传</button></div></div>
  <header class=hero><div class=meta>复盘区间 ${m.period_start} 至 ${m.period_end} · ${m.n_trades} 笔完整交易 / ${m.n_orders} 次成交 · 本地解析</div>
    <h1>交易行为诊断报告</h1><span class=idtag>● 已识别交易风格：<b>${st.label}</b> &nbsp;置信度 ${st.confidence}%</span></header>
  <div class=idbox>📌 <b>风格识别判据</b>:${st.reasons.join(";")}。系统据此采用${d?"<b>打板接力专属标尺</b>":"对应评价标尺"}进行诊断。</div>
  <div class=scorewrap><div class=gauge><svg viewBox="0 0 200 110" width=200 height=110>
      <path d="M15 100 A85 85 0 0 1 185 100" fill=none stroke=#e9eef5 stroke-width=16 stroke-linecap=round/>
      <path d="M15 100 A85 85 0 0 1 185 100" fill=none stroke=${m.score>=65?"#178a5a":m.score>=50?"#d98a00":"#d83a3a"} stroke-width=16 stroke-linecap=round stroke-dasharray="${267*m.score/100} 400"/>
      </svg><div class=val><div class=num style=color:${m.score>=65?"#178a5a":m.score>=50?"#d98a00":"#d83a3a"}>${m.score}</div><div class=grade>健康分/100 · 等级：${m.grade}</div></div></div>
    <div class=score-txt><h2>整体评价：${m.grade}</h2><p>区间净${m.total_pnl>=0?"盈利":"亏损"} ${yuan2(m.total_pnl)}。下方为按你的交易风格生成的逐项诊断与整改建议,所有数字均由系统对交割单确定性计算得出。</p></div></div>
  <div class=grid>${cards.map(c=>kpiCard(...c)).join("")}</div>
  <h2 class=sec>行为画像</h2>
  <div class=charts><div class=panel><h4>持有周期分布(笔数)</h4><canvas id=holdChart height=170></canvas></div>
    <div class=panel><h4>月度净盈亏(元)</h4><canvas id=monthChart height=170></canvas></div></div>
  <div class=charts style=margin-top:16px><div class=panel><h4>盈利单 vs 亏损单 · 平均持有天数</h4><canvas id=deChart height=150></canvas></div>
    <div class=panel><h4>盈亏金额结构(元)</h4><canvas id=pnlChart height=150></canvas></div></div>
  ${dabpHtml}
  <h2 class=sec>问题诊断与整改建议</h2>${aiHtml}${probHtml}
  <h2 class=sec>整改清单(可逐项打勾)</h2><div class=checklist>${checkHtml}</div>
  ${R.ai&&R.ai.disclaimer?`<div class=disc>${R.ai.disclaimer}</div>`:""}
  <div class=foot>本报告由 TradeCheck 在本地生成,交割单数据未上传第三方;AI 诊断仅对已算好的指标做自然语言解读,数字由确定性引擎计算。<br>本工具仅提供交易行为复盘与教育性分析,不构成投资建议,不预测涨跌、不推荐个股。</div>`;
  initCharts(m,d);
}
function initCharts(m,d){const G={neg:"#178a5a",pos:"#d83a3a",warn:"#d98a00",ac:"#2e75b6"}; /* A股:pos=红 neg=绿 */
  Chart.defaults.font.family="Microsoft YaHei, PingFang SC, sans-serif";Chart.defaults.animation=false;
  const mk=(id,cfg)=>{const el=document.getElementById(id);if(el)charts.push(new Chart(el,cfg));};
  mk("holdChart",{type:"bar",data:{labels:Object.keys(m.buckets),datasets:[{data:Object.values(m.buckets),backgroundColor:["#9bd2b0","#7cc49a","#f0c36b","#e89a5a","#d83a3a"]}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
  const mo=Object.keys(m.monthly),mv=Object.values(m.monthly);
  mk("monthChart",{type:"bar",data:{labels:mo,datasets:[{data:mv,backgroundColor:mv.map(v=>v>=0?G.pos:G.neg)}]},options:{plugins:{legend:{display:false}}}});
  mk("deChart",{type:"bar",data:{labels:["盈利单","亏损单"],datasets:[{data:[m.avg_hold_win,m.avg_hold_loss],backgroundColor:[G.pos,G.neg]}]},options:{indexAxis:"y",plugins:{legend:{display:false}}}});
  mk("pnlChart",{type:"bar",data:{labels:["总盈利","总亏损","净盈亏"],datasets:[{data:[m.gross_profit,m.gross_loss,m.total_pnl],backgroundColor:[G.pos,G.neg,G.warn]}]},options:{plugins:{legend:{display:false}}}});
  if(d){const bk=["首板","二板","三板","四板+"].filter(b=>d.board_stats[b]);
    mk("boardChart",{type:"bar",data:{labels:bk,datasets:[{data:bk.map(b=>d.board_stats[b].win_rate),backgroundColor:["#7cc49a","#f0c36b","#e8915a","#d83a3a"]}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:"胜率%"}}}}});
    const sk=["主升(情绪≥60)","中性(40-60)","退潮(情绪<40)"].filter(g=>d.senti_stats[g]);
    mk("sentiChart",{type:"bar",data:{labels:sk.map(s=>s.split("(")[0]),datasets:[{data:sk.map(g=>d.senti_stats[g].pnl),backgroundColor:sk.map(g=>d.senti_stats[g].pnl>=0?G.pos:G.neg)}]},options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:"净盈亏 元"}}}}});}
}
document.addEventListener("DOMContentLoaded",()=>{
  bindCSV("dealZone","dealInput","deal");bindImg();
  $("#runBtn").addEventListener("click",run);$("#demoBtn").addEventListener("click",loadDemo);
  probeBackend();
});
