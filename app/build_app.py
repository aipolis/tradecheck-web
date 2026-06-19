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
body{margin:0;background:#f3f5f9;color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:980px;margin:0 auto;padding:26px 20px 60px;width:100%;padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right));padding-bottom:max(60px,env(safe-area-inset-bottom))}
/* 上传页 */
.home{max-width:680px;padding-top:10px}
.site-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:36px}
.brand-mark{display:inline-flex;align-items:center;gap:9px;color:var(--accent);font-weight:800;font-size:15px;letter-spacing:.04em}
.brand-mark .dot{width:8px;height:8px;border-radius:2px;background:var(--accent2);box-shadow:0 0 0 3px rgba(46,117,182,.15)}
.site-head .be{margin:0;max-width:none;flex:0 1 auto;font-size:11.5px;padding:5px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero-copy{text-align:center;margin-bottom:32px}
.hero-copy h1{margin:0 0 10px;font-size:clamp(28px,6vw,38px);font-weight:800;line-height:1.2;letter-spacing:-.03em;color:var(--ink)}
.hero-copy p{margin:0;color:var(--mut);font-size:15px;line-height:1.65;letter-spacing:.01em}
.upload-sec{margin-top:0}
.zones{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0}
.zone{background:var(--card);border:1.5px dashed #cfd8e6;border-radius:14px;padding:26px 18px 22px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s,box-shadow .2s,transform .15s}
.zone:hover{border-color:var(--accent2);border-style:solid;background:#fcfdff;box-shadow:0 8px 28px rgba(31,78,121,.08);transform:translateY(-1px)}
.zone.drag{border-color:var(--accent2);border-style:solid;background:#f8fbff;box-shadow:0 8px 24px rgba(46,117,182,.12)}
.zone.ok{border-color:#7cc49a;border-style:solid;background:#f8fdf9;box-shadow:0 4px 16px rgba(23,138,90,.08)}
.zone-icon{width:46px;height:46px;margin:0 auto 12px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1}
.zone-icon.file{background:#eef4fb;color:var(--accent2)}
.zone-icon.img{background:#f7f2ea;color:#b8860b}
.zone .ic{font-size:22px;line-height:1}
.zone .ttl{font-weight:700;margin:0 0 4px;font-size:15px;color:var(--ink)}
.zone .hint{color:var(--mut);font-size:12px;line-height:1.5}
.zone .fname{margin-top:10px;color:#178a5a;font-size:12.5px;font-weight:600;word-break:break-all;padding:5px 10px;background:rgba(23,138,90,.07);border-radius:8px;display:inline-block;max-width:100%}
.req{color:#d83a3a;font-size:11px}.opt{color:var(--mut);font-size:11px;font-weight:400}
.home-foot{margin-top:36px;padding-top:24px;border-top:1px solid var(--line);text-align:center}
.promo-mini{display:inline-flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 16px 10px 10px;max-width:100%;text-align:left}
.promo-mini .qr{flex:0 0 auto;width:72px;height:72px;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden;background:#fff;border:1px solid var(--line)}
.promo-mini .qr img,.promo-mini .qr svg{width:100%;height:100%;display:block;object-fit:contain}
.promo-mini .txt{font-size:13px;color:var(--ink);line-height:1.5}
.promo-mini .txt b{color:var(--accent);font-weight:700}
.foot-note{margin:14px 0 0;color:#9aa6b6;font-size:11.5px;line-height:1.6}
.actions{text-align:center;margin-top:24px;padding:0;display:flex;flex-direction:column;align-items:center;gap:10px}
.btn{background:linear-gradient(135deg,#1a4570,#2e75b6);color:#fff;border:0;border-radius:999px;padding:14px 48px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(31,78,121,.22);transition:transform .15s,box-shadow .15s,opacity .15s;letter-spacing:.03em;min-width:220px}
.btn:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(31,78,121,.32)}
.btn:not(:disabled):active{transform:translateY(0);box-shadow:0 3px 12px rgba(31,78,121,.25)}
.btn:disabled{background:linear-gradient(135deg,#b9c3d2,#c5ced9);box-shadow:none;cursor:not-allowed;opacity:.85}
.btn-ghost{background:#fff;color:var(--accent);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin-left:0}
.demo{display:inline-block;margin:0;color:var(--accent2);background:transparent;border:0;border-radius:999px;cursor:pointer;font-size:13px;padding:6px 14px;text-decoration:none;transition:color .15s,background .15s}
.demo:hover{color:var(--accent);background:rgba(46,117,182,.08)}
.err{color:#d83a3a;text-align:center;margin-top:12px;font-size:13px;min-height:18px;padding:0}
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
.chart-box{position:relative;width:100%;height:200px;margin-top:4px}
.chart-box.sm{height:170px}
.chart-box.lg{height:220px}
@media(max-width:760px){.chart-box{height:185px}.chart-box.lg{height:200px}}
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
.site-head{margin-bottom:24px;flex-wrap:wrap}
.site-head .be{flex:1 1 100%;text-align:center;white-space:normal}
.hero-copy{margin-bottom:24px}
.hero-copy h1{font-size:26px}
.hero-copy p{font-size:14px}
.promo-mini{flex-direction:column;text-align:center;padding:12px}
.zones,.charts,.checklist{grid-template-columns:1fr}
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
.demo{font-size:12.5px;padding:4px 10px;line-height:1.5;max-width:100%}
.be{font-size:11px;padding:6px 10px;line-height:1.45}
.zone{padding:22px 16px}
.aibox{padding:12px 14px;font-size:13px}
.thumb{width:56px;height:56px}
.thumb .x{width:22px;height:22px;line-height:22px;font-size:12px}
}
@media(max-width:420px){
.grid,.kpi-row{grid-template-columns:1fr}
.topbar .btn-ghost{flex:1 1 100%}
.hero-copy h1{font-size:24px}
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
  <header class=site-head>
    <div class=brand-mark><span class=dot></span>TradeCheck</div>
    <div class=be id=beStatus>检测后端中…</div>
  </header>
  <div class=hero-copy>
    <h1>交易诊断报告</h1>
    <p>上传交割单，识别风格、定位问题、给出改进方向</p>
  </div>
  <div class=upload-sec>
  <div class=zones>
    <div class=zone id=dealZone>
      <div class="zone-icon file"><span class=ic>📄</span></div>
      <div class=ttl>文件上传</div>
      <div class=hint>CSV · Excel<br>券商导出的成交记录</div>
      <div class=fname id=dealName></div>
      <input type=file id=dealInput accept=".csv,.txt,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    </div>
    <div class=zone imgzone id=imgZone>
      <div class="zone-icon img"><span class=ic>🖼</span></div>
      <div class=ttl>截图上传</div>
      <div class=hint>支持多张 · OCR 识别<br>一张拍不全可分批上传</div>
      <div class=thumbs id=thumbs></div>
      <div class=imgcount id=imgCount></div>
      <input type=file id=imgInput accept="image/*" multiple hidden>
    </div>
  </div>
  <div class=actions>
    <button class=btn id=runBtn disabled>生成诊断报告</button>
    <button class=demo id=demoBtn>暂无文件？试用示例账户 →</button>
  </div>
  <div class=err id=err></div>
  </div>
  <footer class=home-foot>
    <div class=promo-mini>
      <div class=qr>"""+QR_IMG+"""</div>
      <div class=txt>关注 <b>量化新手村</b> · 复盘技巧与使用案例</div>
    </div>
    <p class=foot-note>CSV / Excel 仅本地解析；截图 OCR 需联网。指标由规则引擎计算，数据不外传。</p>
  </footer>
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
