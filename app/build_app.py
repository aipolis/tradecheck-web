# -*- coding: utf-8 -*-
import base64, os
eng=open("engine.js",encoding="utf-8").read()
ui=open("ui.js",encoding="utf-8").read()
def b64(p):return base64.b64encode(open(p,"rb").read()).decode()
demo_deal=b64("../samples/dabp/打板_交割单.csv")
demo_mkt=b64("../samples/dabp/打板_日线行情.csv")

# 量化新手村公众号二维码:把图片放到 app/assets/gzh-qr.{png,jpg,jpeg,webp} 即可自动嵌入
# 缺失时用 SVG 占位提示替换
_QR_MIME={"png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","webp":"image/webp"}
_qr_found=None
for ext,mime in _QR_MIME.items():
    p="assets/gzh-qr."+ext
    if os.path.exists(p):
        _qr_found=(p,mime); break
if _qr_found:
    QR_IMG='<img src="data:'+_qr_found[1]+';base64,'+b64(_qr_found[0])+'" alt="量化新手村公众号">'
else:
    QR_IMG=('<svg width=110 height=110 viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">'
            '<rect width=110 height=110 fill="#f5f7fb" stroke="#c7d2e0" stroke-dasharray="4 4"/>'
            '<text x=55 y=48 text-anchor=middle font-size=11 fill="#7a8699">公众号</text>'
            '<text x=55 y=64 text-anchor=middle font-size=11 fill="#7a8699">二维码</text>'
            '<text x=55 y=82 text-anchor=middle font-size=9 fill="#aab3c2">(待替换)</text></svg>')

CSS = """
:root{--bg:#f0f4fa;--card:#fff;--ink:#1f2733;--mut:#7a8699;--line:#e6ebf2;--pos:#d83a3a;--neg:#178a5a;--warn:#d98a00;--accent:#1f4e79;--accent2:#2e75b6;--shadow:0 4px 24px rgba(31,78,121,.08);--shadow-lg:0 12px 40px rgba(31,78,121,.14);}
/* A 股惯例:盈利(--pos)红、亏损(--neg)绿。下方非 P&L 用途的红/绿用硬编码避免被翻转 */
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:linear-gradient(165deg,#e8eef6 0%,var(--bg) 45%,#f5f7fb 100%);background-attachment:fixed;color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:980px;margin:0 auto;padding:26px 20px 60px;width:100%;padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right));padding-bottom:max(60px,env(safe-area-inset-bottom))}
/* 上传页 */
.home{padding-top:8px}
.up-hero{text-align:center;padding:0 0 28px}
.hero-card{position:relative;overflow:hidden;background:linear-gradient(145deg,#1a4570 0%,#1f4e79 40%,#2e75b6 100%);color:#fff;border-radius:20px;padding:34px 28px 26px;box-shadow:var(--shadow-lg)}
.hero-card::before{content:"";position:absolute;width:320px;height:320px;right:-100px;top:-120px;background:radial-gradient(circle,rgba(255,255,255,.14) 0%,transparent 68%);pointer-events:none}
.hero-card::after{content:"";position:absolute;width:200px;height:200px;left:-60px;bottom:-80px;background:radial-gradient(circle,rgba(126,200,255,.15) 0%,transparent 70%);pointer-events:none}
.hero-card>*{position:relative;z-index:1}
.up-hero .logo{display:inline-flex;align-items:center;gap:10px;color:rgba(255,255,255,.95);font-weight:800;font-size:17px;letter-spacing:.02em}
.up-hero .logo .dot{width:11px;height:11px;border-radius:4px;background:#8fd0ff;box-shadow:0 0 10px rgba(143,208,255,.55)}
.hero-card h1{margin:18px 0 10px;font-size:clamp(22px,5vw,32px);font-weight:800;line-height:1.28;letter-spacing:-.02em}
.hero-card .lead{margin:0 auto;max-width:520px;color:rgba(255,255,255,.86);font-size:15px;line-height:1.65}
.hero-tags{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:18px 0 4px}
.htag{font-size:12px;padding:5px 13px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.95)}
.home .be{margin-top:16px;max-width:420px;margin-left:auto;margin-right:auto}
.home .be.on{background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.28)!important;color:#eafff3!important}
.home .be.off{background:rgba(255,255,255,.1)!important;border:1px solid rgba(255,255,255,.2)!important;color:rgba(255,255,255,.85)!important}
.sec-label{text-align:center;font-size:13px;font-weight:600;color:var(--mut);margin:0 0 14px;letter-spacing:.04em}
.zones{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:0 0 8px}
.zone{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px 20px 24px;text-align:center;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .15s;box-shadow:0 2px 12px rgba(31,39,51,.04)}
.zone:hover{border-color:#b8d4f0;box-shadow:0 10px 28px rgba(46,117,182,.12);transform:translateY(-2px)}
.zone.drag{border-color:var(--accent2);background:#f8fbff;box-shadow:0 10px 32px rgba(46,117,182,.16)}
.zone.ok{border-color:#7cc49a;background:linear-gradient(180deg,#f8fdf9,#f0faf3);box-shadow:0 4px 16px rgba(23,138,90,.1)}
.zone-icon{width:54px;height:54px;margin:0 auto 14px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:26px;line-height:1}
.zone-icon.file{background:linear-gradient(145deg,#eef5fc,#dceaf8)}
.zone-icon.img{background:linear-gradient(145deg,#fff8ef,#fdebd4)}
.zone .ic{font-size:26px}
.zone .ttl{font-weight:700;margin:0 0 6px;font-size:15px;color:var(--ink)}
.zone .hint{color:var(--mut);font-size:12.5px;line-height:1.55}
.zone .fname{margin-top:10px;color:#178a5a;font-size:13px;font-weight:600;word-break:break-all;padding:6px 10px;background:rgba(23,138,90,.08);border-radius:8px;display:inline-block;max-width:100%}
.req{color:#d83a3a;font-size:11px}.opt{color:var(--mut);font-size:11px;font-weight:400}
/* 公众号引导卡片 */
.promo{display:flex;align-items:center;gap:18px;justify-content:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 24px;margin:22px auto 0;max-width:520px;box-shadow:0 4px 20px rgba(31,39,51,.06)}
.promo .qr{flex:0 0 auto;width:104px;height:104px;display:flex;align-items:center;justify-content:center;border-radius:12px;overflow:hidden;background:#fff;border:1px solid var(--line)}
.promo .qr img,.promo .qr svg{width:100%;height:100%;display:block;object-fit:contain}
.promo .txt{flex:1;color:var(--ink);font-size:14px;line-height:1.55}
.promo .txt .ttl{font-weight:700;color:var(--accent);margin-bottom:4px;font-size:15px}
.promo .txt .sub{color:var(--mut);font-size:12.5px;margin-top:4px}
@media (max-width:520px){.promo{flex-direction:column;text-align:center;padding:16px 18px}}
.actions{text-align:center;margin-top:24px;padding:0 4px}
.btn{background:linear-gradient(135deg,#1a4570,#2e75b6);color:#fff;border:0;border-radius:12px;padding:14px 40px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(31,78,121,.28);transition:transform .15s,box-shadow .15s,opacity .15s;letter-spacing:.02em}
.btn:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(31,78,121,.32)}
.btn:not(:disabled):active{transform:translateY(0);box-shadow:0 3px 12px rgba(31,78,121,.25)}
.btn:disabled{background:linear-gradient(135deg,#b9c3d2,#c5ced9);box-shadow:none;cursor:not-allowed;opacity:.85}
.btn-ghost{background:#fff;color:var(--accent);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin-left:0}
.demo{display:inline-block;margin:16px auto 0;color:var(--accent2);background:rgba(46,117,182,.06);border:0;border-radius:999px;cursor:pointer;font-size:13px;padding:8px 16px;text-decoration:none;transition:background .15s}
.demo:hover{background:rgba(46,117,182,.12)}
.err{color:#d83a3a;text-align:center;margin-top:14px;font-size:14px;min-height:20px;padding:0 8px}
.privacy{margin:24px auto 0;max-width:620px;background:linear-gradient(180deg,#f8fbff,#eef5fc);border:1px solid #d7e6f6;border-radius:14px;padding:16px 20px;color:#33506e;font-size:13px;text-align:left;line-height:1.65;box-shadow:0 2px 12px rgba(51,80,110,.05)}
.cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:28px}
.feat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 16px;box-shadow:0 2px 10px rgba(31,39,51,.04);transition:box-shadow .2s,transform .15s}
.feat:hover{box-shadow:0 8px 24px rgba(31,39,51,.08);transform:translateY(-2px)}
.feat-num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#eef5fc,#dceaf8);color:var(--accent2);font-size:12px;font-weight:800;margin-bottom:10px}
.feat h4{margin:0 0 6px;font-size:14px;color:var(--accent);font-weight:700}.feat p{margin:0;color:var(--mut);font-size:12.5px;line-height:1.55}
/* 报告 */
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:12px;flex-wrap:wrap}
.topbar>div:last-child{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.brand{display:flex;align-items:center;gap:9px;color:var(--accent);font-weight:700;font-size:15px}
.brand .dot{width:10px;height:10px;border-radius:3px;background:var(--accent2)}
header.hero{background:linear-gradient(135deg,#1f4e79,#2e75b6);color:#fff;border-radius:16px;padding:22px 26px;margin:12px 0 16px}
header.hero h1{margin:6px 0 4px;font-size:24px}header.hero .meta{opacity:.92;font-size:13px}
.idtag{display:inline-flex;gap:6px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4);padding:4px 12px;border-radius:20px;font-size:12.5px;margin-top:10px}
.idbox{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent2);border-radius:12px;padding:13px 18px;margin-bottom:16px;font-size:13px}
.idbox b{color:var(--accent)}
.scorewrap{display:flex;gap:22px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 24px;margin-bottom:18px}
.gauge{position:relative;width:200px;height:110px;flex:none}.gauge .val{position:absolute;bottom:2px;left:0;right:0;text-align:center}
.gauge .num{font-size:38px;font-weight:800}.gauge .grade{font-size:12.5px;color:var(--mut)}
.score-txt h2{margin:0 0 6px;font-size:18px}.score-txt p{margin:0;color:var(--mut);font-size:13.5px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;margin-bottom:22px}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-top:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 13px}
.kpi .t{font-size:11.5px;color:var(--mut);margin-bottom:5px}.kpi .v{font-size:18px;font-weight:700}.kpi .s{font-size:11px;color:var(--mut);margin-top:4px}
.pos{color:var(--pos)}.neg{color:var(--neg)}.warn{color:var(--warn)}.muted{color:var(--mut)}
h2.sec{font-size:18px;margin:26px 0 13px;padding-left:11px;border-left:4px solid var(--accent2)}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px 17px;min-width:0}
.panel h4{margin:0 0 4px;font-size:14px}.panel .sub{margin:0 0 10px;font-size:12px;color:var(--mut)}
.panel canvas{display:block;max-width:100%;height:auto!important}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}
table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:480px}
.problem{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--mut);border-radius:12px;margin-bottom:13px;overflow:hidden}
.problem.sev-critical{border-left-color:#d83a3a}.problem.sev-high{border-left-color:var(--warn)}.problem.sev-medium{border-left-color:var(--accent2)}
.p-head{display:flex;align-items:center;gap:12px;padding:13px 18px;background:#fafbfd;border-bottom:1px solid var(--line)}
.p-id{font-weight:800;color:var(--mut)}.p-head h3{margin:0;font-size:15.5px;flex:1}
.sev{font-size:12px;padding:2px 10px;border-radius:20px;color:#fff}
.sev.sev-critical{background:#d83a3a}.sev.sev-high{background:var(--warn)}.sev.sev-medium{background:var(--accent2)}
.p-body{padding:12px 18px}.p-row{display:flex;gap:14px;padding:7px 0;align-items:flex-start}
.p-row+.p-row{border-top:1px dashed var(--line)}
.lab{flex:none;width:72px;font-size:12px;color:#fff;background:var(--accent);border-radius:6px;text-align:center;padding:3px 0;margin-top:2px}
.p-row p{margin:0;font-size:13.5px;word-break:break-word}.p-row ul{margin:0;padding-left:18px;font-size:13.5px}.p-row li{margin-bottom:4px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:11.5px}.code{color:var(--mut);font-size:11px}
.checklist{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ck{display:flex;align-items:center;gap:9px;font-size:13.5px}.ck input{width:16px;height:16px;accent-color:var(--accent2)}
.foot{margin-top:26px;color:var(--mut);font-size:12px;text-align:center;line-height:1.7}
@media(max-width:760px){
.wrap{padding:16px max(14px,env(safe-area-inset-right)) max(48px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))}
.up-hero{padding:0 0 20px}
.hero-card{padding:26px 18px 22px;border-radius:16px}
.hero-card h1{font-size:22px}
.hero-card .lead{font-size:14px}
.hero-tags{gap:6px;margin:14px 0 2px}
.htag{font-size:11px;padding:4px 10px}
.sec-label{font-size:12px;margin-bottom:12px}
.zones,.cols,.charts,.checklist{grid-template-columns:1fr}
.grid{grid-template-columns:repeat(2,1fr);gap:8px}
.kpi-row{grid-template-columns:repeat(2,1fr);gap:8px}
.scorewrap{flex-direction:column;text-align:center;padding:16px 14px;gap:14px}
.gauge{width:min(200px,100%)}
.score-txt h2{font-size:17px}
.score-txt p{font-size:13px}
header.hero{padding:18px 16px;border-radius:12px;margin:8px 0 14px}
header.hero h1{font-size:20px;line-height:1.3}
header.hero .meta{font-size:12px;line-height:1.55}
.idtag{font-size:11px;line-height:1.45;flex-wrap:wrap;justify-content:center;text-align:center;max-width:100%}
.idbox{padding:12px 14px;font-size:12.5px;line-height:1.55}
h2.sec{font-size:16px;margin:20px 0 10px}
.topbar{flex-direction:column;align-items:stretch}
.topbar>div:last-child{justify-content:stretch}
.topbar .btn-ghost{flex:1 1 calc(50% - 4px);text-align:center;padding:10px 8px;font-size:12px;min-height:40px}
.p-head{flex-wrap:wrap;padding:12px 14px;gap:8px}
.p-head h3{font-size:14px;line-height:1.45;flex:1 1 100%}
.p-body{padding:10px 14px}
.p-row{flex-direction:column;gap:6px;padding:8px 0}
.lab{width:auto;align-self:flex-start;padding:4px 10px;font-size:11px}
.panel{padding:12px 14px}
.panel h4{font-size:13.5px}
table{min-width:520px;font-size:11.5px}
th,td{padding:6px 8px}
.kpi{padding:10px 11px}
.kpi .v{font-size:16px}
.kpi .t,.kpi .s{font-size:11px}
.btn{display:block;width:100%;max-width:360px;margin:0 auto;padding:14px 20px;font-size:16px}
.demo{font-size:13px;padding:0 8px;line-height:1.5}
.privacy{font-size:12px;padding:12px 14px;text-align:left;line-height:1.6}
.be{font-size:12px;padding:8px 10px;line-height:1.5}
.zone{padding:22px 16px}
.aibox{padding:12px 14px;font-size:13px}
.thumb{width:56px;height:56px}
.thumb .x{width:22px;height:22px;line-height:22px;font-size:12px}
}
@media(max-width:420px){
.grid,.kpi-row{grid-template-columns:1fr}
.topbar .btn-ghost{flex:1 1 100%}
.up-hero h1{font-size:20px}
}
@media print{.topbar{display:none}body{background:#fff}}
/* 多图 + 后端状态 + AI */
.be{margin:14px auto 0;max-width:760px;text-align:center;font-size:12.5px;border-radius:999px;padding:8px 16px;transition:background .3s,border-color .3s}
.be.on{background:#f3fbf6;border:1px solid #bfe6cf;color:#1d6b45}
.be.off{background:#fff7ed;border:1px solid #f0d9b5;color:#8a5a14}
.be:not(.on):not(.off){animation:bePulse 1.4s ease-in-out infinite alternate}
@keyframes bePulse{from{opacity:.55}to{opacity:1}}
.imgzone .thumbs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px}
.thumb{position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;border:1px solid var(--line)}
.thumb img{width:100%;height:100%;object-fit:cover}
.thumb .x{position:absolute;top:1px;right:3px;color:#fff;background:rgba(0,0,0,.5);border-radius:10px;width:18px;height:18px;line-height:18px;text-align:center;font-size:11px;cursor:pointer}
.imgcount{color:var(--mut);font-size:12px;margin-top:6px}
.orsep{display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:13px;font-weight:700}
.aibox{background:#eef5fc;border:1px solid #d7e6f6;border-radius:12px;padding:14px 18px;margin-bottom:14px;font-size:13.5px}
.aibox p{margin:6px 0 0}.aibox.warnbox{background:#fff7ed;border-color:#f0d9b5;color:#8a5a14}
.ai-tag{font-weight:700;color:var(--accent)}
.ai-tag .mock{background:#9aa6b6;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:6px}
.ai-tag .real{background:#178a5a;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:6px}
.disc{margin-top:14px;color:var(--mut);font-size:12px;text-align:center;font-style:italic}
.btn-busy{opacity:.8}
"""

UPLOAD = """
<div id=upload class="wrap home">
  <div class=up-hero>
    <div class=hero-card>
      <div class=logo><span class=dot></span>TradeCheck · 交易诊断助手</div>
      <h1>上传交割单，生成交易诊断报告</h1>
      <p class=lead>AI 帮你复盘交易行为：识别风格、找出问题、给出整改建议。交割单在本地解析，数据不外传。</p>
      <div class=hero-tags>
        <span class=htag>🔒 本地解析</span>
        <span class=htag>📊 确定性指标</span>
        <span class=htag>🎯 风格感知</span>
      </div>
      <div class=be id=beStatus>检测后端中…</div>
    </div>
  </div>
  <p class=sec-label>选择上传方式</p>
  <div class=zones>
    <div class=zone id=dealZone>
      <div class="zone-icon file"><span class=ic>📄</span></div>
      <div class=ttl>交割单 CSV / Excel</div>
      <div class=hint>券商导出的成交记录（.csv / .xlsx / .xls）<br>含日期、代码、买卖、价格、数量</div>
      <div class=fname id=dealName></div>
      <input type=file id=dealInput accept=".csv,.txt,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    </div>
    <div class=zone imgzone id=imgZone>
      <div class="zone-icon img"><span class=ic>🖼️</span></div>
      <div class=ttl>交割单截图 <span class=opt>支持多张</span></div>
      <div class=hint>手机截的交割单图片，一张拍不全可传多张<br>系统识别并按顺序拼接（需后端）</div>
      <div class=thumbs id=thumbs></div>
      <div class=imgcount id=imgCount></div>
      <input type=file id=imgInput accept="image/*" multiple hidden>
    </div>
  </div>
  <!-- 日线行情上传区已删除:行情由后端 /api/tradecheck/build_market_csv 自动补齐,用户无需上传 -->
  <div class=actions>
    <button class=btn id=runBtn disabled>生成诊断报告</button>
    <button class=demo id=demoBtn>没有文件？用示例账户（打板接力）体验 →</button>
  </div>
  <div class=err id=err></div>
  <div class=promo>
    <div class=qr>"""+QR_IMG+"""</div>
    <div class=txt><div class=ttl>关注「量化新手村」公众号</div>
      <div>获取更多散户量化复盘技巧、TradeCheck 使用案例与策略迭代笔记。</div>
      <div class=sub>扫码或在微信搜「量化新手村」</div></div>
  </div>
  <div class=privacy>🔒 <b>隐私说明</b>：① CSV / Excel 交割单<b>仅在本地解析</b>，不外传；② 图片识别需将截图发送至后端 OCR；③ 诊断数字均由确定性引擎计算，AI 仅作文字润色（如已启用）。</div>
  <div class=cols>
    <div class=feat><div class=feat-num>1</div><h4>自动识别风格</h4><p>超短 / 打板接力 / 低吸 / 波段 / 价投，自动判定并采用对应评价标尺。</p></div>
    <div class=feat><div class=feat-num>2</div><h4>确定性指标</h4><p>FIFO 配对重建每笔交易，胜率、盈亏比、持有周期、成本全部由代码算出。</p></div>
    <div class=feat><div class=feat-num>3</div><h4>规则 + AI 诊断</h4><p>规则引擎找出核心问题；接入后端时 AI 可润色小结与建议。</p></div>
  </div>
</div>
<div id=report class=wrap style=display:none></div>
"""

import os
# 后端 API 地址:可通过环境变量 TRADECHECK_BACKEND 覆盖,默认指向 mrdk 微信云托管
BACKEND_URL = os.environ.get("TRADECHECK_BACKEND",
    "https://mingri-api-260693-8-1435576840.sh.run.tcloudbase.com")

html = ("<!DOCTYPE html><html lang=zh-CN><head><meta charset=utf-8>"
"<meta name=viewport content=\"width=device-width, initial-scale=1, viewport-fit=cover\">"
"<title>TradeCheck · 交易诊断助手</title>"
"<script src=\"https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js\"></script>"
"<script src=\"https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js\"></script>"
"<style>"+CSS+"</style></head><body>"+UPLOAD+
"<script>window.TRADECHECK_BACKEND="+repr(BACKEND_URL)+";</script>"
"<script>"+eng+"</script>"
"<script>function __b64u(b){return decodeURIComponent(Array.prototype.map.call(atob(b),c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));}"
"const DEMO_DEAL=__b64u(\""+demo_deal+"\");const DEMO_MKT=__b64u(\""+demo_mkt+"\");</script>"
"<script>"+ui+"</script></body></html>")

open("../TradeCheck.html","w",encoding="utf-8").write(html)
# 同步生成 index.html(Cloudflare Pages 默认入口);两个文件内容完全一致
open("../index.html","w",encoding="utf-8").write(html)
print("TradeCheck.html / index.html bytes:",len(html))
