/* TradeCheck 诊断引擎(纯函数;Node 可测、浏览器可用)
   流程:解析交割单(+可选行情) → FIFO 配对 → 风格识别 → 指标 → 规则化诊断 */
(function(root){
"use strict";
const TC={};

// ---------- 工具 ----------
function r2(x){return Math.round(x*100)/100;}
function r0(x){return Math.round(x);}
function normHeader(h){return String(h||"").trim().replace(/\|+$/,"").replace(/^﻿/,"");}
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
  const header=rows[0].map(normHeader);
  return rows.slice(1).map(r=>{const o={};header.forEach((h,i)=>o[h]=r[i]);return o;});
}
function pick(o,names){for(const n of names)if(o[n]!=null&&o[n]!=="")return o[n];return null;}
function isExcelTimeOnly(v){
  if(v==null||v==="")return false;
  const n=parseFloat(v);
  return !isNaN(n)&&n>0&&n<1;
}
function pickDate(r){
  const v=pick(r,["成交日期","交易日期","日期","发生日期","清算日期"]);
  if(v!=null&&v!=="")return v;
  for(const k of Object.keys(r)){
    if(/^成交日期|^交易日期/.test(k)&&r[k]!=null&&r[k]!=="")return r[k];
  }
  const tm=pick(r,["成交时间","交易时间"]);
  if(tm!=null&&tm!==""&&!isExcelTimeOnly(tm))return tm;
  return null;
}
function pdate(s){
  s=String(s).trim();
  const digits=s.replace(/\D/g,"");
  if(/^\d{8}$/.test(digits)){
    return new Date(+digits.slice(0,4),+digits.slice(4,6)-1,+digits.slice(6,8));
  }
  s=s.split(" ")[0].replace(/\//g,"-");
  const parts=s.split("-");
  if(parts.length===3){const[a,b,c]=parts;return new Date(+a,+b-1,+c);}
  return new Date(NaN);
}
function ldate(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function daysBetween(a,b){return Math.round((b-a)/86400000);}
function median(xs){if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);const n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;}
function pctOf(xs,f){return xs.length?r2(xs.filter(f).length/xs.length*100):0;}
function normCode(raw){
  if(raw==null||raw==="")return "";
  let c=String(raw).trim().toUpperCase();
  if(/^\d+\.0+$/.test(c))c=c.replace(/\.0+$/,"");
  if(/^\d+$/.test(c))return c.length<=6?c.padStart(6,"0"):c;
  return c;
}
function normSide(raw){
  if(raw==null||raw==="")return null;
  const s=String(raw).trim();
  if(/^(1|B|BUY)$/i.test(s))return "买入";
  if(/^(2|S|-1|SELL)$/i.test(s))return "卖出";
  if(/银证|转账|分红|派息|转托管|申购|赎回|配号|质押|解冻|利息|扣税|信息费|汇总|小计|合计/.test(s))return null;
  const hasBuy=/买/.test(s),hasSell=/卖/.test(s);
  if(hasBuy&&!hasSell)return "买入";
  if(hasSell&&!hasBuy)return "卖出";
  return null;
}

// ---------- 解析 ----------
TC.parseDeals=function(text){
  const rows=parseCSV(text);const deals=[];
  for(const r of rows){
    const dt=pickDate(r);
    let side=pick(r,["操作","买卖","方向","业务名称","委托方向","交易类型","买卖方向"]);
    const code=pick(r,["证券代码","代码","股票代码","品种代码"]);
    const price=pick(r,["成交价格","价格","成交均价","成交价","均价"]);
    const qty=pick(r,["成交数量","数量","成交股数","成交量","发生数量"]);
    side=normSide(side);
    const nc=normCode(code);
    const pd=pdate(dt);
    if(!dt||!side||!nc||price==null||qty==null||isNaN(pd.getTime()))continue;
    const pq=Math.round(Math.abs(parseFloat(qty)));
    const pp=parseFloat(price);
    if(!pq||!pp||isNaN(pp))continue;
    const name=pick(r,["证券名称","名称","股票名称","品种名称"])||nc;
    const fee=["佣金","印花税","过户费","手续费","规费","其他费"].reduce((s,k)=>s+(parseFloat(r[k])||0),0);
    deals.push({date:pd,code:nc,name,side,price:pp,qty:pq,fee});
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
    for(const t of trips){const m=mk[t.code+"|"+ldate(t.buy_date)];if(!m)continue;tot++;
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
  const monthly={};trips.forEach(t=>{const k=ldate(t.sell_date).slice(0,7);monthly[k]=(monthly[k]||0)+t.pnl;});
  const dailyMap={};trips.forEach(t=>{const k=ldate(t.sell_date);dailyMap[k]=(dailyMap[k]||0)+t.pnl;});
  const dailyKeys=Object.keys(dailyMap).sort();
  // 峰值占用资金:重放 deals 跟踪同时持仓的最大成本和(FIFO 配对)
  const inv2={};let peakCap=0,curCap=0;
  for(const dl of deals){
    if(dl.side==="买入"){
      (inv2[dl.code]=inv2[dl.code]||[]).push({qty:dl.qty,cost:dl.qty*dl.price+(dl.fee||0)});
      curCap+=dl.qty*dl.price+(dl.fee||0);
    }else{
      let rem=dl.qty;
      while(rem>0&&inv2[dl.code]&&inv2[dl.code].length){
        const lot=inv2[dl.code][0];const take=Math.min(rem,lot.qty);
        const portion=take/lot.qty*lot.cost;curCap-=portion;
        lot.qty-=take;lot.cost-=portion;rem-=take;
        if(lot.qty<=0)inv2[dl.code].shift();
      }
    }
    if(curCap>peakCap)peakCap=curCap;
  }
  let cum=0;const equity_curve=dailyKeys.map(k=>{cum+=dailyMap[k];return{date:k,cum_pnl:r2(cum),cum_ret:peakCap>0?r2(cum/peakCap*100):0};});
  let peak=-Infinity,maxDD=0,maxDDPct=0;equity_curve.forEach(p=>{if(p.cum_pnl>peak)peak=p.cum_pnl;const dd=peak-p.cum_pnl;if(dd>maxDD)maxDD=dd;});
  if(peakCap>0)maxDDPct=r2(maxDD/peakCap*100);
  const total_return_pct=peakCap>0?r2(total_pnl/peakCap*100):0;
  Object.keys(monthly).forEach(k=>monthly[k]=r2(monthly[k]));
  const buckets={"1天":0,"2-3天":0,"4-7天":0,"8-14天":0,"15天+":0};
  trips.forEach(t=>{const h=t.hold;buckets[h<=1?"1天":h<=3?"2-3天":h<=7?"4-7天":h<=14?"8-14天":"15天+"]++;});
  let score=50;score-=Math.min((de-1)*6,22);score+=(plr-1)*18;score+=(win_rate-50)*0.4;
  score-=Math.min(cvg*0.25,15);score+=total_pnl>0?8:-8;score=Math.max(5,Math.min(95,r0(score)));
  const grade=score>=80?"优秀":score>=65?"良好":score>=50?"及格":score>=35?"偏弱":"差";
  const ds=trips.map(t=>t.sell_date.getTime());
  return{period_start:ldate(new Date(Math.min(...trips.map(t=>t.buy_date)))),
    period_end:ldate(new Date(Math.max(...ds))),
    n_trades:n,n_orders:deals.length,n_wins:wins.length,n_losses:losses.length,win_rate,total_pnl,
    gross_profit,gross_loss,avg_win,avg_loss,profit_loss_ratio:plr,profit_factor:pf,
    max_loss:r2(Math.min(...trips.map(t=>t.pnl))),max_win:r2(Math.max(...trips.map(t=>t.pnl))),
    avg_hold_win:ahw,avg_hold_loss:ahl,de_ratio:de,loss_over_10d_pct:lossOver10,
    total_cost:total_comm,turnover,cost_vs_turnover:cvt,cost_vs_grossprofit:cvg,
    monthly,equity_curve,max_drawdown:r2(maxDD),max_drawdown_pct:maxDDPct,peak_capital:r2(peakCap),total_return_pct,buckets,avg_position:n?r2(sum(trips.map(t=>t.buy_amt))/n):0,score,grade};
};

// ---------- 打板专属指标(需行情) ----------
function bgroup(b){return b===1?"首板":b===2?"二板":b===3?"三板":b>=4?"四板+":"非板";}
TC.dabp=function(trips,mk){
  function addTD(d,k){let c=new Date(d);let n=k;while(n>0){c.setDate(c.getDate()+1);if(c.getDay()!==0&&c.getDay()!==6)n--;}return c;}
  const sum=a=>a.reduce((x,y)=>x+y,0);const enr=[];
  for(const t of trips){const bm=mk[t.code+"|"+ldate(t.buy_date)];if(!bm)continue;
    const nd=addTD(t.buy_date,1);const ndm=mk[t.code+"|"+ldate(nd)];
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

// ---------- 低吸专属指标(需行情) ----------
TC.dipbuy=function(trips,mk){
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const enr=[];
  for(const t of trips){
    const bm=mk[t.code+"|"+ldate(t.buy_date)];if(!bm||!bm.open)continue;
    if(t.buy_price>bm.open*1.002)continue; // 低吸:买入价贴近或低于开盘
    const nearLow=bm.low&&t.buy_price<=bm.low*1.03;
    enr.push({...t,nearLow,ret:t.ret||(t.pnl/t.buy_amt*100)});
  }
  if(!enr.length)return null;
  const n=enr.length,wins=enr.filter(t=>t.pnl>0),losses=enr.filter(t=>t.pnl<=0);
  const midLoss=losses.filter(t=>!t.nearLow); // 未贴近当日低点仍亏损 → 半山腰
  const quickWin=wins.filter(t=>t.hold<=2&&(t.ret||0)<8);
  return{n,win_rate:r2(wins.length/n*100),pnl:r2(sum(enr.map(t=>t.pnl))),
    midair_rate:losses.length?r2(midLoss.length/losses.length*100):0,
    quick_win_share:wins.length?r2(quickWin.length/wins.length*100):0,
    avg_hold_win:wins.length?r2(sum(wins.map(t=>t.hold))/wins.length):0};
};

// ---------- 波段/价投行为洞察(交割单即可) ----------
TC.swingInsight=function(trips,m,style,f){
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const wins=trips.filter(t=>t.pnl>0),losses=trips.filter(t=>t.pnl<=0);
  const months=Math.max(1,Object.keys(m.monthly||{}).length);
  const tpm=r2(m.n_trades/months);
  const quickWins=wins.filter(t=>t.hold<=3);
  const quickProfit=wins.length?r2(sum(quickWins.map(t=>t.pnl))/sum(wins.map(t=>t.pnl))*100):0;
  const longLoss=losses.filter(t=>t.hold>10);
  const longLossPnl=losses.length?r2(sum(longLoss.map(t=>t.pnl))):0;
  return{tpm,quick_profit_share:quickProfit,long_loss_pnl:longLossPnl,
    long_loss_n:longLoss.length,n_loss:losses.length};
};

// ---------- 诊断辅助 ----------
function _lossShare(pnl,totalPnl){
  if(!totalPnl||totalPnl>=0||!pnl||pnl>=0)return 0;
  return r2(Math.abs(pnl)/Math.abs(totalPnl)*100);
}
function _evShare(evidence,pnl,totalPnl){
  const sh=_lossShare(pnl,totalPnl);
  return sh?evidence+` 约占区间净亏损的 ${sh}%。`:evidence;
}
function _overtradeThreshold(style){
  if(style.refined==="打板接力"||style.primary==="超短")return 25;
  if(style.primary==="短线")return 20;
  if(style.primary==="波段")return 12;
  if(style.primary==="中长线/价投")return 8;
  if(style.primary==="混合")return 15;
  return 15;
}
function _shouldDisposition(m,style){
  if(style.primary==="中长线/价投")return m.de_ratio>=3&&m.avg_hold_loss>m.avg_hold_win;
  if(style.primary==="波段")return m.de_ratio>=2.2&&m.avg_hold_loss>m.avg_hold_win;
  return m.de_ratio>=1.8&&m.avg_hold_loss>m.avg_hold_win;
}
function _shouldStopLoss(m,style){
  if(style.primary==="中长线/价投")return false;
  if(style.primary==="波段")return m.loss_over_10d_pct>=55;
  return m.loss_over_10d_pct>=40;
}
function _estDispositionLoss(trips,m){
  const thr=Math.max(m.avg_hold_win,7);
  return r2(trips.filter(t=>t.pnl<0&&t.hold>thr).reduce((s,t)=>s+t.pnl,0));
}
function _fallbackDiagnose(m,style){
  const yuan=x=>(x<0?"-￥":"￥")+Math.abs(Math.round(x)).toLocaleString();
  if(m.total_pnl>0&&m.profit_factor>=1.2&&m.profit_loss_ratio>=1)
    return{sev:"medium",title:"整体结构尚可 — 保持纪律、防回吐",
      evidence:`区间净盈利 ${yuan(m.total_pnl)},胜率 ${m.win_rate}%、盈亏比 ${m.profit_loss_ratio}、盈利因子 ${m.profit_factor}。未触发单项严重问题,但需防盈利后放松纪律。`,
      harm:"结构健康时最容易加大仓位或降标准,一次回撤可抹平多个盈利区间。",
      fixes:["维持现有入场标准,不因盈利而随手加单","定期复核盈亏比是否仍>1","把本区间交易计划写下来,下区间对照执行"]};
  if(m.total_pnl>0&&(m.profit_factor<1.1||m.profit_loss_ratio<1))
    return{sev:"high",title:"账面盈利但结构偏脆 — 赢小亏大隐患",
      evidence:`区间净${yuan(m.total_pnl)},但盈亏比 ${m.profit_loss_ratio}、盈利因子 ${m.profit_factor}。靠少数大单盈利,整体期望并不稳固。`,
      harm:"少数大赚掩盖多数小亏,一旦运气回落,净值容易快速回吐。",
      fixes:["复盘最大盈利单是否可复制,不可复制则降预期","收紧止损,避免小亏累积","降低单笔仓位,先稳住盈亏比"]};
  if(m.win_rate>=55&&m.profit_loss_ratio<1)
    return{sev:"critical",title:"胜率高但期望为负 — 典型「赢次数、输金额」",
      evidence:`胜率 ${m.win_rate}% 不低,但平均每笔赚 ${yuan(m.avg_win)}、亏 ${yuan(m.avg_loss)},盈亏比仅 ${m.profit_loss_ratio},区间净${yuan(m.total_pnl)}。`,
      harm:"频繁小赢掩盖偶尔大亏,交易次数越多越亏,是超短/低吸常见陷阱。",
      fixes:["先砍最大亏损来源的几笔交易复盘","设定单笔最大亏损上限","在盈亏比>1.2 之前减少出手频率"]};
  if(m.total_pnl<0&&m.profit_factor<1)
    return{sev:"critical",title:"区间负期望 — 需先降频再谈优化",
      evidence:`区间净亏损 ${yuan(m.total_pnl)},${m.n_trades} 笔交易、胜率 ${m.win_rate}%、盈利因子 ${m.profit_factor}。`,
      harm:"当前模式下继续交易,统计期望为负,越多做越亏。",
      fixes:["立即减少出手,先找出亏损最多的 3 笔复盘","暂停新开仓,直到写出明确入场/止损规则","用小仓位验证新规则,再恢复正常频率"]};
  return{sev:"medium",title:"暂无明显单项警报 — 建议对照计划复盘",
    evidence:`区间净${yuan(m.total_pnl)},胜率 ${m.win_rate}%、盈亏比 ${m.profit_loss_ratio}。指标未触发专项规则,仍建议逐笔对照原计划检查执行偏差。`,
    harm:"没有警报不等于没有问题,隐性偏差(仓位、时机)往往要逐笔复盘才看得见。",
    fixes:["导出交割单逐笔标注「计划内/冲动单」","下区间只做一个方面的改进(止损或降频)","保留交易日志,便于下月对比"]};
}

// ---------- 规则化诊断 ----------
TC.diagnose=function(m,style,ctx){
  ctx=ctx||{};
  const trips=ctx.trips||[];
  const dabp=ctx.dabp||null;
  const dip=ctx.dip||null;
  const swing=ctx.swing||null;
  const yuan=x=>(x<0?"-￥":"￥")+Math.abs(Math.round(x)).toLocaleString();
  const P=[];
  const tpm=m.n_trades/Math.max(1,Object.keys(m.monthly||{}).length);
  const otThr=_overtradeThreshold(style);

  // 处置效应(风格感知阈值)
  if(_shouldDisposition(m,style)){
    const dispLoss=_estDispositionLoss(trips,m);
    P.push({sev:m.de_ratio>=3?"critical":"high",title:"处置效应 — 盈利拿不住、亏损死扛",
      loss_pnl:dispLoss,
      evidence:_evShare(`盈利单平均持有 ${m.avg_hold_win} 天就兑现,亏损单平均扛 ${m.avg_hold_loss} 天,是盈利的 ${m.de_ratio} 倍;亏损单中 ${m.loss_over_10d_pct}% 持有超 10 天。`,dispLoss,m.total_pnl),
      harm:"赚一点就跑、亏了死扛,单笔亏损被放大,长期持续拉低盈亏比。",
      fixes:["买入即设止损位并机械执行","盈利单改用移动止盈,不情绪性了结","每周跟踪盈/亏单持有天数差作为纪律KPI"]});
  }
  // 盈亏比/负期望
  if(m.profit_loss_ratio<1||m.profit_factor<1)
    P.push({sev:"critical",title:"盈亏结构为负期望 — 赢小钱亏大钱",
      loss_pnl:m.total_pnl<0?m.total_pnl:0,
      evidence:_evShare(`平均每笔赚 ${yuan(m.avg_win)}、亏 ${yuan(m.avg_loss)},盈亏比仅 ${m.profit_loss_ratio};叠加 ${m.win_rate}% 胜率,盈利因子 ${m.profit_factor}(<1 为负期望)。`,m.total_pnl,m.total_pnl),
      harm:"统计上每笔交易都是负收益,交易越多亏得越多。",
      fixes:["严格止损,让平均亏损低于平均盈利","胜率难升则靠盈亏比取胜,宁可少做","单笔最大亏损不超过本金1%~2%"]});
  // 止损纪律(风格感知)
  if(_shouldStopLoss(m,style))
    P.push({sev:"high",title:style.primary==="波段"?"波段止损拖太久 — 亏损单长期挂账":"止损纪律弱 — 亏损单长期挂账",
      loss_pnl:swing?swing.long_loss_pnl:m.max_loss,
      evidence:_evShare(`${m.loss_over_10d_pct}% 的亏损单持有超 10 天,最大单笔亏损 ${yuan(m.max_loss)}。`,swing?swing.long_loss_pnl:m.max_loss,m.total_pnl),
      harm:"小亏拖成大亏、占用资金、错失机会,风险敞口失控。",
      fixes:style.primary==="波段"?["波段也应设最大持有天数,到期未达预期即减仓","亏损达阈值当日处理,不等待「回本」","复盘是否买在趋势末端"]:["触及止损位当日无条件卖出","禁止向下补仓摊薄成本","收盘检查持仓,超周期且亏损的强制复核"]});
  // 过度交易/成本(风格感知频率阈值)
  if(m.cost_vs_grossprofit>=8||tpm>=otThr)
    P.push({sev:"medium",title:"交易频繁 — 成本持续侵蚀",
      loss_pnl:-m.total_cost,
      evidence:`区间 ${m.n_trades} 笔交易、${m.n_orders} 次成交(约 ${r2(tpm)} 笔/月,${style.label} 参考上限 ${otThr}),总成交额 ${yuan(m.turnover)},费用合计 ${yuan(m.total_cost)},${m.cost_vs_grossprofit?`吃掉总盈利的 ${m.cost_vs_grossprofit}%`: "成本占成交额 "+m.cost_vs_turnover+"%"}。`,
      harm:"在不占优时,高频只会放大负期望并被固定成本抽血。",
      fixes:style.primary==="中长线/价投"?["价投应重质不重量,降低换股频率","单笔研究透再出手,减少「看看再说」的试单","关注佣金费率"]:["提高入场标准,减少随手单","复盘砍掉冲动型交易","关注佣金费率,必要时与券商协商下调"]});

  // 打板专属
  if(dabp){
    const bs=dabp.board_stats,lo=bs["首板"],hi=bs["四板+"];
    if(dabp.senti_stats["退潮(情绪<40)"]&&dabp.senti_stats["退潮(情绪<40)"].pnl<0){
      const t=dabp.senti_stats["退潮(情绪<40)"];
      P.unshift({sev:"critical",title:"退潮期硬刚 — 亏损主要来自逆势接力",
        loss_pnl:t.pnl,
        evidence:_evShare(`退潮期(情绪<40)做了 ${t.n} 笔、胜率 ${t.win_rate}%、${yuan(t.pnl)}。`,t.pnl,m.total_pnl),
        harm:"退潮期赚钱效应消失、连板批量炸板,满仓接力等于逆势送钱。",
        fixes:["退潮期(炸板率高/梯队断裂)直接空仓或降频","用涨停家数+连板高度做情绪温度计开关","只在主升/修复期出手"]});
    }
    if(hi&&lo&&hi.win_rate<lo.win_rate-15)
      P.push({sev:"high",title:"越追高板越亏 — 连板高度与胜率负相关",
        loss_pnl:hi.pnl<0?hi.pnl:0,
        evidence:_evShare(`分项胜率:首板 ${lo.win_rate}%、四板+ 仅 ${hi.win_rate}%;四板+ 合计 ${yuan(hi.pnl)}。`,hi.pnl,m.total_pnl),
        harm:"高位连板容错率极低,越往上打越是给情绪买单。",
        fixes:["收缩高度:以首板/二板为主,回避四板+","打高板必须更小仓位+更严止损","每月复盘连板分项胜率,只做正期望高度"]});
    if(dabp.n_underwater>0&&dabp.cut_rate<50)
      P.push({sev:"high",title:"几乎不核按钮 — 水下死扛放大亏损",
        loss_pnl:dabp.avg_hold_uw?null:0,
        evidence:`次日水下 ${dabp.n_underwater} 笔仅 ${dabp.n_cut} 笔(${dabp.cut_rate}%)开盘止损;果断核按钮均收益 ${dabp.avg_cut}%,死扛均收益 ${dabp.avg_hold_uw}%。`,
        harm:"打板的生命线是错了立刻走,不核按钮等于把短线做成被动中线。",
        fixes:["次日不及预期,集合竞价/开盘无条件核按钮","禁止等反弹、回本再走","把水下核按钮执行率当纪律KPI"]});
  }

  // P1: 低吸专属
  if(dip&&dip.n>=3){
    if(dip.win_rate<42&&dip.pnl<0)
      P.push({sev:"critical",title:"低吸期望为负 — 抄底策略需暂停验证",
        loss_pnl:dip.pnl,
        evidence:_evShare(`标记为低吸的 ${dip.n} 笔,胜率 ${dip.win_rate}%、合计 ${yuan(dip.pnl)}。`,dip.pnl,m.total_pnl),
        harm:"反复在下跌途中接飞刀,小反弹不足以覆盖趋势亏损。",
        fixes:["暂停低吸,先等大盘/个股企稳信号","只在「跌不动+放量」结构出现后再试","低吸单必须更小仓位+更紧止损"]});
    if(dip.midair_rate>=45&&dip.n>=4)
      P.push({sev:"high",title:"低吸常买在半山腰 — 未贴近低点仍入场",
        loss_pnl:dip.pnl<0?dip.pnl:0,
        evidence:`低吸亏损单中 ${dip.midair_rate}% 买入价未贴近当日低点(>低点 3%),说明多数抄在下跌中继而非真正企稳。`,
        harm:"以为在低吸,实际在趋势中段,稍微反弹后继续阴跌。",
        fixes:["等二次探底或分时背离再入场","禁止「跌多少买多少」的网格冲动","对照当日 K 线,只在前低附近挂单"]});
    if(dip.quick_win_share>=55&&dip.avg_hold_win<=2)
      P.push({sev:"medium",title:"反弹即走 — 盈利单兑现过快",
        evidence:`低吸盈利单中 ${dip.quick_win_share}% 持有≤2 天就卖出,平均盈利持有 ${dip.avg_hold_win} 天。`,
        harm:"反弹利润吃不满,一次大亏即可抵消多次小赢,盈亏比难抬升。",
        fixes:["设定分批止盈,留底仓博趋势延续","用移动止盈替代「见红就走」","复盘卖飞的大肉,总结持有规则"]});
  }

  // P1: 波段/价投专属
  if(swing){
    if(style.primary==="波段"&&m.avg_hold_win<=4&&swing.quick_profit_share>=65&&m.gross_profit>0)
      P.push({sev:"high",title:"波段盈利拿不住 — 大肉卖太早",
        evidence:`盈利单中 ${swing.quick_profit_share}% 的利润来自持有≤3 天的交易;盈利单平均仅持 ${m.avg_hold_win} 天。`,
        harm:"波段靠趋势利润,过早兑现会错过主浪,只剩小赢大亏结构。",
        fixes:["盈利达 1R 后留半仓,余仓用均线/前低跟踪止盈","设定最小持有目标(如至少 5 天)再评估","复盘最大盈利单,看是否卖在启动初期"]});
    if(style.primary==="中长线/价投"&&swing.tpm>8)
      P.push({sev:"medium",title:"价投型账户交易过频 — 换股太多",
        evidence:`约 ${swing.tpm} 笔完整交易/月(价投参考上限 8),${m.n_trades} 笔区间交易、${m.n_orders} 次成交。`,
        harm:"频繁换股叠加成本与误判,价投应靠少数高质量决策,不是高频试错。",
        fixes:["缩小股票池,深度研究后再建仓","设定最小持有周期(如 20 个交易日)","新增标的需写投资逻辑,冲动单禁止"]});
    if(style.primary==="波段"&&m.avg_hold_loss>=12&&m.loss_over_10d_pct>=35)
      P.push({sev:"high",title:"波段亏损拖成「被动长线」",
        loss_pnl:swing.long_loss_pnl,
        evidence:_evShare(`亏损单平均持有 ${m.avg_hold_loss} 天,${m.loss_over_10d_pct}% 超 10 天;长持亏损单合计 ${yuan(swing.long_loss_pnl)}。`,swing.long_loss_pnl,m.total_pnl),
        harm:"波段本应截断亏损,拖成长线会占用资金且心态变形。",
        fixes:["波段单设硬止损(如 -8%)与最长持有天数","亏损单不复盘出改进方案则禁止补仓","每周清理「超期亏损」持仓清单"]});
  }

  // P0: 兜底 — 无专项规则命中时仍给一条总评
  if(!P.length)P.push(_fallbackDiagnose(m,style));

  // 按严重度 + 亏损贡献排序,标注优先级
  const order={critical:0,high:1,medium:2};
  P.sort((a,b)=>{
    const d=order[a.sev]-order[b.sev];if(d)return d;
    return (b.loss_pnl||0)-(a.loss_pnl||0);
  });
  return P.slice(0,6).map((p,i)=>{
    const rank=i===0&&P.length>1?"【优先改进】":"";
    return{id:String(i+1).padStart(2,"0"),...p,title:rank+p.title};
  });
};

// ---------- 总入口 ----------
TC.analyze=function(dealText,marketText){
  const deals=TC.parseDeals(dealText);
  if(deals.length<2)throw new Error("交割单解析为空或过少,请检查文件格式。需要包含:成交日期/时间、证券代码、操作(买入/卖出)、成交价格、成交数量。");
  const mk=TC.parseMarket(marketText||"");
  const trips=TC.fifo(deals);
  if(!trips.length){
    const buys=deals.filter(d=>d.side==="买入"),sells=deals.filter(d=>d.side==="卖出");
    const nb=buys.length,ns=sells.length;
    const buyCodes=new Set(buys.map(d=>d.code)),sellCodes=new Set(sells.map(d=>d.code));
    const inter=[...buyCodes].filter(c=>sellCodes.has(c));
    const onlyBuy=[...buyCodes].filter(c=>!sellCodes.has(c));
    const onlySell=[...sellCodes].filter(c=>!buyCodes.has(c));
    const sample=arr=>arr.slice(0,5).map(c=>{
      const d=deals.find(x=>x.code===c);return c+(d&&d.name?"("+d.name+")":"");
    }).join("、");
    let diag="";
    if(ns===0){diag="导出区间内只有买入(未平仓),需要包含已平仓的卖出记录。";}
    else if(nb===0){diag="未识别到任何买入,可能是『操作』列被识别成了其他名称。";}
    else if(inter.length===0){diag="买入和卖出的股票代码完全对不上 — 通常是 OCR 把代码识别错了(数字看花)。买入的代码示例:"+sample(onlyBuy)+"; 卖出的代码示例:"+sample(onlySell)+"。建议直接上传券商 CSV/Excel,或重拍清晰一些的截图。";}
    else if(inter.length<Math.min(buyCodes.size,sellCodes.size)/3){diag="只有少量代码("+inter.length+"/"+Math.min(buyCodes.size,sellCodes.size)+")在买入和卖出里都出现,OCR 可能识别错了部分代码。买入独有:"+sample(onlyBuy)+"; 卖出独有:"+sample(onlySell);}
    else{
      // 代码大体对得上,可能是时间顺序问题 — 卖出排在买入之前
      let outOfOrder=0;const firstBuy={},firstSell={};
      deals.forEach(d=>{const k=d.code;if(d.side==="买入"&&!(k in firstBuy))firstBuy[k]=d.date;else if(d.side==="卖出"&&!(k in firstSell))firstSell[k]=d.date;});
      inter.forEach(c=>{if(firstSell[c]&&firstBuy[c]&&firstSell[c]<firstBuy[c])outOfOrder++;});
      if(outOfOrder>0)diag="有 "+outOfOrder+" 只股票的首次卖出排在买入之前,可能是 OCR 把日期识别错了,或者交易记录里包含『先前持仓』。";
      else diag="无法定位具体原因,请尝试上传券商 CSV/Excel。";
    }
    throw new Error("未能配对出完整交易: 已解析 "+deals.length+" 条("+nb+" 买 / "+ns+" 卖)。"+diag);
  }
  const f=TC.features(trips,deals,mk);
  const style=TC.classify(f);
  const m=TC.metrics(trips,deals);
  const ctx={trips};
  if(f.has_market&&(style.refined==="打板接力"||(f.db_ratio!=null&&f.db_ratio>=35)))
    ctx.dabp=TC.dabp(trips,mk);
  if(f.has_market&&(style.refined==="低吸"||(f.lo_ratio!=null&&f.lo_ratio>=50)))
    ctx.dip=TC.dipbuy(trips,mk);
  if(style.primary==="波段"||style.primary==="中长线/价投")
    ctx.swing=TC.swingInsight(trips,m,style,f);
  const diagnoses=TC.diagnose(m,style,ctx);
  let dabp=ctx.dabp||null;
  return{style,features:f,metrics:m,dabp,diagnoses,n_trips:trips.length};
};

root.TC=TC;
if(typeof module!=="undefined"&&module.exports)module.exports=TC;
})(typeof self!=="undefined"?self:this);
