# -*- coding: utf-8 -*-
"""
TradeCheck 后端(DeepSeek 版)
- GET  /                : 提供前端页面(TradeCheck.html)
- GET  /api/health      : 后端状态(是否mock、模型)
- POST /api/extract     : 多张交割单图片 → 标准交割单CSV(等待 DeepSeek V4 Pro 视觉模型;当前未开放)
- POST /api/diagnose    : 确定性指标 → 自然语言诊断(DeepSeek 文本模型)

设计红线:
- 数字一律由前端确定性引擎计算;大模型只负责(1)图片转结构化数据 (2)把指标写成人话。
- diagnose 严格要求只能引用传入的数字,不得编造;不得荐股、不预测涨跌。
- 未配置 DEEPSEEK_API_KEY 时自动进入 mock 模式,流程可演示。

运行:
    # 真实模式(DeepSeek)
    export DEEPSEEK_API_KEY=sk-xxxxxxxx
    python3 server.py            # 打开 http://127.0.0.1:8000
    # 离线演示(mock)
    python3 server.py            # 未设密钥即 mock
"""
import os, json, re, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API_KEY    = os.environ.get("DEEPSEEK_API_KEY", "").strip()
API_BASE   = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com").rstrip("/")
MODEL      = os.environ.get("TRADECHECK_MODEL", "deepseek-chat")
VISION_MODEL = os.environ.get("TRADECHECK_VISION_MODEL", "").strip()  # 留空 = 视觉未启用
MOCK       = not API_KEY
HERE       = os.path.dirname(os.path.abspath(__file__))
PAGE       = os.path.join(os.path.dirname(HERE), "TradeCheck.html")

STD_HEADER = "成交日期,证券代码,证券名称,操作,成交价格,成交数量,佣金,印花税,过户费"

# ---------------- DeepSeek 调用(OpenAI 兼容协议,urllib 即可) ----------------
def call_deepseek(messages, system, max_tokens=4096, json_mode=False, model=None):
    payload = {
        "model": model or MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "system", "content": system}] + messages,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API_BASE + "/chat/completions",
        data=body,
        headers={
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"]

# ---------------- /api/extract ----------------
EXTRACT_SYS = (
"你是交割单OCR助手。用户会上传一张或多张券商交割单/成交记录的手机截图(可能一张显示不全,多张需按顺序拼接)。"
"请逐行转写所有成交记录,合并多张图片为一份完整数据,严格按CSV输出,表头固定为:\n" + STD_HEADER + "\n"
"规则:操作只填『买入』或『卖出』;金额/费用无法识别时填0;日期统一为YYYY-MM-DD;"
"只转写图片中真实可见的行,绝不编造或推测任何数字;不要输出表格以外的解释文字,只输出CSV。")

def extract_real(images):
    # DeepSeek V4 Pro 视觉模型上线后,把 TRADECHECK_VISION_MODEL 设成对应模型名即可启用
    if not VISION_MODEL:
        raise RuntimeError("图片识别尚未启用:DeepSeek 视觉模型(V4 Pro)上线后,设置环境变量 TRADECHECK_VISION_MODEL=<模型名> 后重启。当前请改用 CSV 上传。")
    content = [{"type": "text", "text": "以下是交割单截图,请按顺序拼接并输出完整CSV:"}]
    for d in images:
        # OpenAI 兼容格式:image_url 携带 data:URL
        if not d.startswith("data:image/"):
            continue
        content.append({"type": "image_url", "image_url": {"url": d}})
    text = call_deepseek([{"role": "user", "content": content}], EXTRACT_SYS, 8192, model=VISION_MODEL)
    text = re.sub(r"^```[a-z]*\n?|```$", "", text.strip(), flags=re.M).strip()
    return text

def extract_mock(images):
    p = os.path.join(os.path.dirname(HERE), "samples", "dabp", "打板_交割单.csv")
    return open(p, encoding="utf-8-sig").read()

# ---------------- /api/diagnose ----------------
DIAGNOSE_SYS = (
"你是专业的交易行为复盘教练。系统已通过确定性计算得到该账户的指标与初步问题列表。"
"你的任务:把这些问题改写成通俗、有温度、可执行的诊断,并写一段整体小结。\n"
"硬性要求(必须遵守):\n"
"1) 只能引用输入JSON中已给出的数字,绝对不得编造、估算或更改任何数值;\n"
"2) 不得推荐买卖任何具体股票,不得预测涨跌,不得做收益承诺;\n"
"3) 用中文;聚焦交易行为与纪律,而非个股观点;\n"
"4) 严格输出如下JSON(不要多余文字):\n"
'{"summary":"整体小结","problems":[{"id":"01","title":"...","evidence":"...","harm":"...","fixes":["...","..."]}]}\n'
"problems 与输入的问题一一对应,可润色标题与措辞,但 evidence 中的数字必须与输入一致。")

def diagnose_real(payload):
    user = ("账户风格:%s(置信度%s%%)\n指标:%s\n初步问题(含已算好的数字,请据此润色):%s"
            % (payload["style"]["label"], payload["style"]["confidence"],
               json.dumps(payload["metrics"], ensure_ascii=False),
               json.dumps(payload["ruleDiagnoses"], ensure_ascii=False)))
    text = call_deepseek([{"role": "user", "content": user}], DIAGNOSE_SYS, 4096, json_mode=True)
    text = re.sub(r"^```[a-z]*\n?|```$", "", text.strip(), flags=re.M).strip()
    return json.loads(text)

def diagnose_mock(payload):
    rd = payload["ruleDiagnoses"]
    style = payload["style"]["label"]; m = payload["metrics"]
    summ = ("【AI小结·mock】识别为「%s」。区间净%s,共 %d 笔交易、胜率 %s%%。"
            "核心问题集中在:%s。以下逐项给出诊断与整改建议(真实接入大模型后此段将更自然)。"
            % (style, ("盈利" if m["total_pnl"]>=0 else "亏损"), m["n_trades"], m["win_rate"],
               "、".join(p["title"].split(" ")[0] for p in rd[:3])))
    return {"summary": summ, "problems": [
        {"id": p["id"], "title": p["title"], "evidence": p["evidence"],
         "harm": p["harm"], "fixes": p["fixes"]} for p in rd]}

# ---------------- HTTP ----------------
class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if "json" in ctype or "html" in ctype else ""))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
    def do_OPTIONS(self): self._send(204, b"", "text/plain")
    def do_GET(self):
        if self.path.startswith("/api/health"):
            return self._send(200, {
                "ok": True, "mock": MOCK,
                "model": (None if MOCK else MODEL),
                "vision": (None if MOCK or not VISION_MODEL else VISION_MODEL),
                "provider": "deepseek",
            })
        if self.path in ("/", "/index.html", "/TradeCheck.html"):
            try: return self._send(200, open(PAGE, "rb").read(), "text/html")
            except FileNotFoundError: return self._send(404, {"error": "页面未找到"})
        return self._send(404, {"error": "not found"})
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        try: payload = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e: return self._send(400, {"error": "无效JSON: %s" % e})
        try:
            if self.path.startswith("/api/extract"):
                imgs = payload.get("images", [])
                if not imgs: return self._send(400, {"error": "未收到图片"})
                csv = extract_mock(imgs) if MOCK else extract_real(imgs)
                rows = max(0, len([l for l in csv.splitlines() if l.strip()]) - 1)
                return self._send(200, {"csv": csv, "rows": rows, "mock": MOCK})
            if self.path.startswith("/api/diagnose"):
                out = diagnose_mock(payload) if MOCK else diagnose_real(payload)
                out["mock"] = MOCK
                out["disclaimer"] = "本诊断仅为交易行为复盘,不构成投资建议,不预测涨跌、不推荐个股。"
                return self._send(200, out)
        except Exception as e:
            return self._send(500, {"error": "处理失败: %s" % e})
        return self._send(404, {"error": "not found"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    mode = "MOCK 离线演示" if MOCK else "DeepSeek " + MODEL + (" + 视觉:" + VISION_MODEL if VISION_MODEL else " (视觉未启用)")
    print("TradeCheck 后端启动: http://127.0.0.1:%d  (模式: %s)" % (port, mode))
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
