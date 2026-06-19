/* TradeCheck 诊断引擎(纯函数;Node 可测、浏览器可用)
   流程:解析交割单(+可选行情) → FIFO 配对 → 风格识别 → 指标 → 规则化诊断 */
(function(root){
"use strict";
const TC={};

// ---------- 工具 ----------
function r2(x){return Math.round(x*100)/100;}
function r0(x){return Math.round(x);}
function parseCSV(text){
  text=text.replace(/^﻿/,"");
  const lines=text.split(/\r?\n/).filter(l=>l.trim().length);
  const rows=lines.map(line=>{
    const out=[];let cur="",q=false;
    for(let i=0;i<line.length;i++){const c=line[i];
      if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
      else{if(c===','){out.push(cur);cur="";}else if(c==='"')q=true;else cur+=c;}}
    out.push(cur);return out.map(s=>s.trim());
  });
  const header=rows[0];
  return rows.slice(1).map(r=>{const o={};header.forEach((h,i)=>o[h]=r[i]);return o;});
}
function pick(o,names){for(const n of names)if(o[n]!=null&&o[n]!=="")return o[n];return null;}
function pdate(s){s=String(s).split(" ")[0].replace(/\//g,"-");const[a,b,c]=s.split("-");return new Date(+a,+b-1,+c);}
function daysBetween(a,b){return Math.round((b-a)/86400000);}
function median(xs){if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);const n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;}
function pctOf(xs,f){return xs.length?r2(xs.filter(f).length/xs.length*100):0;}

// ---------- 解析 ----------
TC.parseDeals=function(text){
  const rows=parseCSV(text);const deals=[];
  for(const r of rows){
    const dt=pick(r,["成交时间","成交日期","日期","时间"]);
    const side=pick(r,["操作","买卖","方向","业务名称"]);
    const code=pick(r,["证券代码","代码","股票代码"]);
    const price=pick(r,["成交价格","价格","成交均价","成交价"]);
    const qty=pick(r,["成交数量","数量","成交股数","成交量"]);
    if(!dt||!side||!code||price==null||qty==null)continue;
    const name=pick(r,["证券名称","名称","股票名称"])||code;
    const fee=["佣金","印花税","过户费","手续费","规费"].reduce((s,k)=>s+(parseFloat(r[k])||0),0);
    deals.push({date:pdate(dt),code:String(code),name,side:String(side).includes("买")?"买入":"卖出",
      price:parseFloat(price),qty:Math.round(parseFloat(qty)),fee});
  }
  deals.sort((a,b)=>a.date-b.date||((a.side!=="买入")-(b.side!=="买入")));
  return deals;
};
TC.parseMarket=function(text){
  const mk={};if(!text)return mk;
  const rows=parseCSV(text);
  for(const r of rows){
    const d=pick(r,["日期","成交日期","交易日期"]);const code=pick(r,["代码","证券代码","股票代码"]);
    if(!d||!code)continue;
    mk[code+"|"+String(d).split(" ")[0]]={
      open:parseFloat(pick(r,["开盘","开盘价"])||0),high:parseFloat(pick(r,["最高","最高价"])||0),
      low:parseFloat(pick(r,["最低","最低价"])||0),close:parseFloat(pick(r,["收盘","收盘价"])||0),
      limit:parseFloat(pick(r,["涨停价"])||0),board:parseInt(pick(r,["连板数"])||0),
      senti:pick(r,["市场情绪"])!=null?parseInt(r["市场情绪"]):null};
  }
  return mk;
};

// ---------- FIFO ----------
TC.fifo=function(deals){
  const inv={};const trips=[];
  for(const d of deals){
    if(d.side==="买入"){(inv[d.code]=inv[d.code]||[]).push({qty:d.qty,price:d.price,date:d.date,feePer:d.fee/d.qty});}
    else{let rem=d.qty;const sellFeePer=d.fee/d.qty;
      while(rem>0&&inv[d.code]&&inv[d.code].length){
        const lot=inv[d.code][0];const take=Math.min(rem,lot.qty);
        const buyCost=take*lot.price+take*lot.feePer;
        const sellNet=take*d.price-take*sellFeePer;
        trips.push({code:d.code,name:d.name,qty:take,buy_price:lot.price,buy_date:lot.date,
          sell_date:d.date,sell_price:d.price,hold:daysBetween(lot.date,d.date),
          pnl:r2(sellNet-buyCost),buy_amt:r2(buyCost),ret:(sellNet-buyCost)/buyCost*100});
        lot.qty-=take;rem-=take;if(lot.qty===0)inv[d.code].shift();
      }}
  }
  return trips;
};

// ---------- 风格识别 ----------
TC.features=function(trips,deals,mk){
  const holds=trips.map(t=>t.hold);const n=trips.length;
  const dates=deals.map(d=>d.date);const span=Math.max(1,daysBetween(new Date(Math.min(...dates)),new Date(Math.max(...dates))));
  const months=Math.max(span/30,0.5);
  const f={n_trades:n,median_hold:median(holds),mean_hold:n?r2(holds.reduce((a,b)=>a+b,0)/n):0,
    pct_le2:pctOf(holds,h=>h<=2),pct_3_7:pctOf(holds,h=>h>=3&&h<=7),
    pct_8_25:pctOf(holds,h=>h>=8&&h<=25),pct_gt25:pctOf(holds,h=>h>25),
    trades_per_month:r2(n/months),distinct_codes:new Set(trips.map(t=>t.code)).size,
    avg_position:n?r0(trips.reduce((a,t)=>a+t.buy_amt,0)/n):0,has_market:Object.keys(mk).length>0};
  if(f.has_market){let db=0,lo=0,tot=0;
    for(const t of trips){const m=mk[t.code+"|"+t.buy_date.toISOString().slice(0,10)];if(!m)continue;tot++;
      if(m.limit&&t.buy_price>=m.limit*0.997)db++;else if(t.buy_price<=m.open*1.001)lo++;}
    f.db_ratio=tot?r2(db/tot*100):null;f.lo_ratio=tot?r2(lo/tot*100):null;}
  return f;
};
TC.classify=function(f){
  const h=f.median_hold;let primary,conf,reasons=[];
  if(h<=2){primary="超短";conf=f.pct_le2;}
  else if(h<7){primary="短线";conf=f.pct_3_7+f.pct_le2*0.4;}
  else if(h<=25){primary="波段";conf=f.pct_8_25;}
  else{primary="中长线/价投";conf=f.pct_gt25;}
  conf=Math.min(99,r0(conf));
  reasons.push("持有周期中位数 "+h+" 天","频率 "+f.trades_per_month+" 笔/月");
  const ps=f.pct_le2+f.pct_3_7,pl=f.pct_8_25+f.pct_gt25;
  if(ps>=30&&pl>=30)return{label:"通用/混合(持有周期两极分化)",primary:"混合",refined:null,confidence:r0(Math.max(ps,pl)),
    reasons:["持有周期中位数 "+h+" 天","短持(≤7天)"+ps+"% 与 长持(≥8天)"+pl+"% 并存,风格不统一",
    "常见于处置效应:盈利短持兑现、亏损死扛拉长 → 按通用标尺并提示纪律问题"]};
  let refined=null;
  if(f.has_market&&(primary==="超短"||primary==="短线")){
    if(f.db_ratio!=null&&f.db_ratio>=35){refined="打板接力";reasons.push("打板入场占比 "+f.db_ratio+"%(买入价贴近涨停价)");conf=Math.min(99,r0((conf+f.db_ratio)/2+10));}
    else if(f.lo_ratio!=null&&f.lo_ratio>=50){refined="低吸";reasons.push("低吸入场占比 "+f.lo_ratio+"%(买入价≤当日开盘)");conf=Math.min(99,r0((conf+f.lo_ratio)/2));}
  }
  let label=refined||primary;
  if(conf<50){label="通用/混合(疑似"+label+")";reasons.push("主带占比仅 "+conf+"% → 风格不集中,兜底为通用");}
  return{label,primary,refined,confidence:conf,reasons};
};

// ---------- 通用指标 ----------
TC.metrics=function(trips,deals){
  const n=trips.length;const wins=trips.filter(t=>t.pnl>0),losses=trips.filter(t=>t.pnl<=0);
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const total_pnl=r2(sum(trips.map(t=>t.pnl)));
  const gross_profit=r2(sum(wins.map(t=>t.pnl))),gross_loss=r2(sum(losses.map(t=>t.pnl)));
  const win_rate=r2(wins.length/n*100);
  const avg_win=wins.length?r2(gross_profit/wins.length):0,avg_loss=losses.length?r2(gross_loss/losses.length):0;
  const plr=avg_loss?r2(avg_win/Math.abs(avg_loss)):0,pf=gross_loss?r2(gross_profit/Math.abs(gross_loss)):0;
  const ahw=wins.length?r2(sum(wins.map(t=>t.hold))/wins.length):0,ahl=losses.length?r2(sum(losses.map(t=>t.hold))/losses.length):0;
  const de=ahw?r2(ahl/ahw):0;
  const lossOver10=losses.length?r2(losses.filter(t=>t.hold>10).length/losses.length*100):0;
  const total_comm=r2(sum(deals.map(d=>d.fee)));
  const turnover=r2(sum(deals.map(d=>d.price*d.qty)));
  const cvt=turnover?r2(total_comm/turnover*100):0,cvg=gross_profit?r2(total_comm/gross_profit*100):0;
  const monthly={};trips.forEach(t=>{const k=t.sell_date.toISOString().slice(0,7);monthly[k]=(monthly[k]||0)+t.pnl;});
  Object.keys(monthly).forEach(k=>monthly[k]=r2(monthly[k]));
  const buckets={"1天":0,"2-3天":0,"4-7天":0,"8-14天":0,"15天+":0};
  trips.forEach(t=>{const h=t.hold;buckets[h<=1?"1天":h<=3?"2-3天":h<=7?"4-7天":h<=14?"8-14天":"15天+"]++;});
  let score=50;score-=Math.min((de-1)*6,22);score+=(plr-1)*18;score+=(win_rate-50)*0.4;
  score-=Math.min(cvg*0.25,15);score+=total_pnl>0?8:-8;score=Math.max(5,Math.min(95,r0(score)));
  const grade=score>=80?"优秀":score>=65?"良好":score>=50?"及格":score>=35?"偏弱":"差";
  const ds=trips.map(t=>t.sell_date.getTime());
  return{period_start:new Date(Math.min(...trips.map(t=>t.buy_date))).toISOString().slice(0,10),
    period_end:new Date(Math.max(...ds)).toISOString().slice(0,10),
    n_trades:n,n_orders:deals.length,n_wins:wins.length,n_losses:losses.length,win_rate,total_pnl,
    gross_profit,gross_loss,avg_win,avg_loss,profit_loss_ratio:plr,profit_factor:pf,
    max_loss:r2(Math.min(...trips.map(t=>t.pnl))),max_win:r2(Math.max(...trips.map(t=>t.pnl))),
    avg_hold_win:ahw,avg_hold_loss:ahl,de_ratio:de,loss_over_10d_pct:lossOver10,
    total_cost:total_comm,turnover,cost_vs_turnover:cvt,cost_vs_grossprofit:cvg,
    monthly,buckets,avg_position:n?r2(sum(trips.map(t=>t.buy_amt))/n):0,score,grade};
};

// ---------- 打板专属指标(需行情) ----------
function bgroup(b){return b===1?"首板":b===2?"二板":b===3?"三板":b>=4?"四板+":"非板";}
TC.dabp=function(trips,mk){
  function addTD(d,k){let c=new Date(d);let n=k;while(n>0){c.setDate(c.getDate()+1);if(c.getDay()!==0&&c.getDay()!==6)n--;}return c;}
  const sum=a=>a.reduce((x,y)=>x+y,0);const enr=[];
  for(const t of trips){const bm=mk[t.code+"|"+t.buy_date.toISOString().slice(0,10)];if(!bm)continue;
    const nd=addTD(t.buy_date,1);const ndm=mk[t.code+"|"+nd.toISOString().slice(0,10)];
    const board=bm.board||0;const buyClose=bm.close||t.buy_price;
    const entry=t.buy_price>=(bm.limit||1e9)*0.997?"打板":t.buy_price>bm.open?"半路":"低吸";
    const premium=ndm?r2((ndm.open/buyClose-1)*100):0;const ndOpen=ndm?ndm.open:buyClose;
    const soldNext=daysBetween(t.buy_date,t.sell_date)===daysBetween(t.buy_date,nd);
    enr.push({...t,board,bg:bgroup(board),entry,premium,ndOpen,senti:bm.senti,
      high_open:premium>=2,realized:premium>=2&&t.sell_price>=ndOpen*0.99,
      underwater:premium<=0,cut:premium<=0&&soldNext&&t.sell_price>=ndOpen*0.985});}
  if(!enr.length)return null;
  const n=enr.length;
  const board_stats={};["首板","二板","三板","四板+"].forEach(g=>{const s=enr.filter(t=>t.bg===g);
    if(s.length)board_stats[g]={n:s.length,win_rate:r2(s.filter(t=>t.pnl>0).length/s.length*100),
      avg_ret:r2(sum(s.map(t=>t.ret))/s.length),pnl:r2(sum(s.map(t=>t.pnl)))};});
  const ho=enr.filter(t=>t.high_open),uw=enr.filter(t=>t.underwater);
  const cut=uw.filter(t=>t.cut),hold=uw.filter(t=>!t.cut);
  const entry_dist={};enr.forEach(t=>entry_dist[t.entry]=(entry_dist[t.entry]||0)+1);
  const senti_stats={};const sg=t=>t.senti==null?null:(t.senti>=60?"主升(情绪≥60)":t.senti<40?"退潮(情绪<40)":"中性(40-60)");
  ["主升(情绪≥60)","中性(40-60)","退潮(情绪<40)"].forEach(g=>{const s=enr.filter(t=>sg(t)===g);
    if(s.length)senti_stats[g]={n:s.length,win_rate:r2(s.filter(t=>t.pnl>0).length/s.length*100),pnl:r2(sum(s.map(t=>t.pnl)))};});
  const ex=t=>({name:t.name,code:t.code,board:t.bg,entry:t.entry,premium:t.premium,ret:r2(t.ret),pnl:r2(t.pnl),senti:t.senti});
  return{n,entry_dist,board_stats,
    high_open_rate:r2(enr.filter(t=>t.premium>0).length/n*100),
    underwater_rate:r2(uw.length/n*100),
    realize_rate:ho.length?r2(ho.filter(t=>t.realized).length/ho.length*100):0,n_highopen:ho.length,
    cut_rate:uw.length?r2(cut.length/uw.length*100):0,n_underwater:uw.length,n_cut:cut.length,
    avg_cut:cut.length?r2(sum(cut.map(t=>t.ret))/cut.length):0,
    avg_hold_uw:hold.length?r2(sum(hold.map(t=>t.ret))/hold.length):0,
    senti_stats,db_share:r2((entry_dist["打板"]||0)/n*100),
    worst:enr.filter(t=>t.pnl<=0).sort((a,b)=>a.pnl-b.pnl).slice(0,4).map(ex),
    best:enr.filter(t=>t.pnl>0).sort((a,b)=>b.pnl-a.pnl).slice(0,4).map(ex)};
};

// ---------- 规则化诊断 ----------
TC.diagnose=function(m,style,d){
  const yuan=x=>(x<0?"-￥":"￥")+Math.abs(Math.round(x)).toLocaleString();
  const P=[];
  // 处置效应
  if(m.de_ratio>=1.8&&m.avg_hold_loss>m.avg_hold_win)
    P.push({sev:m.de_ratio>=3?"critical":"high",title:"处置效应 — 盈利拿不住、亏损死扛",
      evidence:`盈利单平均持有 ${m.avg_hold_win} 天就兑现,亏损单平均扛 ${m.avg_hold_loss} 天,是盈利的 ${m.de_ratio} 倍;亏损单中 ${m.loss_over_10d_pct}% 持有超 10 天。`,
      harm:"赚一点就跑、亏了死扛,单笔亏损被放大,长期持续拉低盈亏比。",
      fixes:["买入即设止损位并机械执行","盈利单改用移动止盈,不情绪性了结","每周跟踪盈/亏单持有天数差作为纪律KPI"]});
  // 盈亏比/负期望
  if(m.profit_loss_ratio<1||m.profit_factor<1)
    P.push({sev:"critical",title:"盈亏结构为负期望 — 赢小钱亏大钱",
      evidence:`平均每笔赚 ${yuan(m.avg_win)}、亏 ${yuan(m.avg_loss)},盈亏比仅 ${m.profit_loss_ratio};叠加 ${m.win_rate}% 胜率,盈利因子 ${m.profit_factor}(<1 为负期望)。`,
      harm:"统计上每笔交易都是负收益,交易越多亏得越多。",
      fixes:["严格止损,让平均亏损低于平均盈利","胜率难升则靠盈亏比取胜,宁可少做","单笔最大亏损不超过本金1%~2%"]});
  // 不止损
  if(m.loss_over_10d_pct>=40&&style.primary!=="中长线/价投")
    P.push({sev:"high",title:"止损纪律弱 — 亏损单长期挂账",
      evidence:`${m.loss_over_10d_pct}% 的亏损单持有超 10 天,最大单笔亏损 ${yuan(m.max_loss)}。`,
      harm:"小亏拖成大亏、占用资金、错失机会,风险敞口失控。",
      fixes:["触及止损位当日无条件卖出","禁止向下补仓摊薄成本","收盘检查持仓,超周期且亏损的强制复核"]});
  // 成本
  if(m.cost_vs_grossprofit>=8||m.n_trades/Math.max(1,Object.keys(m.monthly).length)>=15)
    P.push({sev:"medium",title:"交易频繁 — 成本持续侵蚀",
      evidence:`区间 ${m.n_trades} 笔交易、${m.n_orders} 次成交,总成交额 ${yuan(m.turnover)},费用合计 ${yuan(m.total_cost)},吃掉总盈利的 ${m.cost_vs_grossprofit}%。`,
      harm:"在不占优时,高频只会放大负期望并被固定成本抽血。",
      fixes:["提高入场标准,减少随手单","复盘砍掉冲动型交易","关注佣金费率,必要时与券商协商下调"]});
  // 打板专属
  if(d){
    const bs=d.board_stats,lo=bs["首板"],hi=bs["四板+"];
    if(d.senti_stats["退潮(情绪<40)"]&&d.senti_stats["退潮(情绪<40)"].pnl<0){
      const t=d.senti_stats["退潮(情绪<40)"],share=m.total_pnl<0?r2(Math.abs(t.pnl)/Math.abs(m.total_pnl)*100):0;
      P.unshift({sev:"critical",title:"退潮期硬刚 — 亏损主要来自逆势接力",
        evidence:`退潮期(情绪<40)做了 ${t.n} 笔、胜率 ${t.win_rate}%、${yuan(t.pnl)},约占净亏损的 ${share}%。`,
        harm:"退潮期赚钱效应消失、连板批量炸板,满仓接力等于逆势送钱。",
        fixes:["退潮期(炸板率高/梯队断裂)直接空仓或降频","用涨停家数+连板高度做情绪温度计开关","只在主升/修复期出手"]});
    }
    if(hi&&lo&&hi.win_rate<lo.win_rate-15)
      P.push({sev:"high",title:"越追高板越亏 — 连板高度与胜率负相关",
        evidence:`分项胜率:首板 ${lo.win_rate}%、四板+ 仅 ${hi.win_rate}%;四板+ 合计 ${yuan(hi.pnl)}。`,
        harm:"高位连板容错率极低,越往上打越是给情绪买单。",
        fixes:["收缩高度:以首板/二板为主,回避四板+","打高板必须更小仓位+更严止损","每月复盘连板分项胜率,只做正期望高度"]});
    if(d.n_underwater>0&&d.cut_rate<50)
      P.push({sev:"high",title:"几乎不核按钮 — 水下死扛放大亏损",
        evidence:`次日水下 ${d.n_underwater} 笔仅 ${d.n_cut} 笔(${d.cut_rate}%)开盘止损;果断核按钮均收益 ${d.avg_cut}%,死扛 ${d.avg_hold_uw}%。`,
        harm:"打板的生命线是错了立刻走,不核按钮等于把短线做成被动中线。",
        fixes:["次日不及预期,集合竞价/开盘无条件核按钮","禁止等反弹、回本再走","把水下核按钮执行率当纪律KPI"]});
  }
  const order={critical:0,high:1,medium:2};
  P.sort((a,b)=>order[a.sev]-order[b.sev]);
  return P.slice(0,6).map((p,i)=>({id:String(i+1).padStart(2,"0"),...p}));
};

// ---------- 总入口 ----------
TC.analyze=function(dealText,marketText){
  const deals=TC.parseDeals(dealText);
  if(deals.length<2)throw new Error("交割单解析为空或过少,请检查文件格式。需要包含:成交日期/时间、证券代码、操作(买入/卖出)、成交价格、成交数量。");
  const mk=TC.parseMarket(marketText||"");
  const trips=TC.fifo(deals);
  if(!trips.length)throw new Error("未能从交割单配对出完整交易(可能只有买入没有卖出)。");
  const f=TC.features(trips,deals,mk);
  const style=TC.classify(f);
  const m=TC.metrics(trips,deals);
  let dabp=null;
  if(f.has_market&&(style.refined==="打板接力"||(f.db_ratio!=null&&f.db_ratio>=35)))dabp=TC.dabp(trips,mk);
  const diagnoses=TC.diagnose(m,style,dabp);
  return{style,features:f,metrics:m,dabp,diagnoses,n_trips:trips.length};
};

root.TC=TC;
if(typeof module!=="undefined"&&module.exports)module.exports=TC;
})(typeof self!=="undefined"?self:this);
