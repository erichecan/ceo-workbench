/**
 * 登录表单 + 签名 cookie 的极简鉴权，抄自 site/server.cjs 的方案：
 * 纯 Basic Auth 会被浏览器缓存错误凭据后静默重发、手机上没法退出重来，
 * 所以主路径走登录表单 + cookie，Basic Auth 留给 curl / 脚本。
 *
 * 没配用户名/密码时返回 null（调用方决定：本地演示模式放行，还是拒绝启动）。
 */
import crypto from "node:crypto";

const MIN_PASS = 10;

export function createAuth({ user, pass, cookieName, title = "登录" }) {
  if (!user || !pass) return null;
  if (pass.length < MIN_PASS) {
    console.error(`✗ 拒绝启动：密码太短（${pass.length} 位），至少 ${MIN_PASS} 位。`);
    process.exit(1);
  }

  const EXPECTED = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const USER_ALIASES = new Set([user.toLowerCase(), user.split("@")[0].toLowerCase()]);
  const SESSION_SECRET = crypto.createHash("sha256").update(`${user}:${pass}:${cookieName}`).digest();
  const SESSION_DAYS = 30;

  const safeEqual = (a, b) => {
    const ba = Buffer.from(a || "");
    const bb = Buffer.from(b || "");
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };
  const signSession = (expMs) => {
    const payload = String(expMs);
    return `${payload}.${crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url")}`;
  };
  const validSession = (token) => {
    if (!token || !token.includes(".")) return false;
    const idx = token.lastIndexOf(".");
    const payload = token.slice(0, idx);
    const expect = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    if (!safeEqual(token.slice(idx + 1), expect)) return false;
    const exp = Number(payload);
    return Number.isFinite(exp) && exp > Date.now();
  };
  const readCookie = (header, name) => {
    for (const part of (header || "").split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === name) return decodeURIComponent(v.join("="));
    }
    return null;
  };

  function loginPage(msg = "") {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title}</title><style>
:root{--bg:#F7F5F1;--card:#fff;--ink:#2B2320;--muted:#8A7A6E;--line:#E3DCD3;--accent:#B8863B}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,"Noto Sans SC",sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;padding:22px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:34px 30px;width:100%;max-width:370px}
h1{font-size:21px;margin-bottom:6px}
p.sub{color:var(--muted);font-size:13.5px;margin-bottom:24px}
label{display:block;font-size:13px;color:var(--muted);margin:14px 0 6px}
input{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:16px}
button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:15.5px;cursor:pointer}
.err{margin-top:16px;color:#B5432A;font-size:13.5px}
</style></head><body><div class="box">
<h1>${title}</h1><p class="sub">登录后才能看到预约信息</p>
<form method="POST" action="/login">
<label for="u">用户名</label><input id="u" name="u" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required>
<label for="p">密码</label><input id="p" name="p" type="password" autocomplete="current-password" required>
<button type="submit">进入</button>
${msg ? `<div class="err">${msg}</div>` : ""}
</form></div></body></html>`;
  }

  function isAuthed(req) {
    return validSession(readCookie(req.headers.cookie, cookieName)) || safeEqual(req.headers.authorization, EXPECTED);
  }

  /**
   * 拦在路由分发之前调用；处理了请求就返回 true，调用方直接 return。
   * 调用方要先自己处理完 `POST /login` 再调这个——这里只管「挡未登录的请求」。
   */
  function guard(req, res) {
    if (isAuthed(req)) return false;
    if ((req.headers.accept || "").includes("text/html")) {
      res.writeHead(401, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(loginPage(""));
    } else {
      // realm 必须是纯 ASCII——HTTP header 不接受非 ASCII，放中文标题会抛
      // ERR_INVALID_CHAR 杀掉进程（2026-09-13 实测），跟 title 分开、固定用英文。
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="Booking Portal", charset="UTF-8"',
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("需要登录");
    }
    return true;
  }

  function handleLogin(form) {
    const inUser = (form.get("u") || "").trim().toLowerCase();
    if (!USER_ALIASES.has(inUser)) return { ok: false, msg: "用户名不对" };
    if (!safeEqual(form.get("p") || "", pass)) return { ok: false, msg: "密码不对" };
    return { ok: true, cookie: `${cookieName}=${encodeURIComponent(signSession(Date.now() + SESSION_DAYS * 864e5))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` };
  }

  const logoutCookie = () => `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

  return { guard, loginPage, handleLogin, logoutCookie };
}
