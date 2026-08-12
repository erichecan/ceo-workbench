/**
 * CEO 站点的静态服务器 — 零依赖，只用 node 内置模块。
 *
 * ⛔ 安全前提：这个站点上有财务数据（账本、应收、MRR）。
 *    没有配置 SITE_USER / SITE_PASS 就直接拒绝启动，不给「忘了配密码所以裸奔」留任何缝。
 *
 * 环境变量：
 *   SITE_USER / SITE_PASS   Basic Auth 凭据（必需，从 Secret Manager 注入）
 *   PORT                    监听端口（Cloud Run 注入，默认 8080）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 8080;
const USER = process.env.SITE_USER;
const PASS = process.env.SITE_PASS;

if (!USER || !PASS) {
  console.error('✗ 拒绝启动：未配置 SITE_USER / SITE_PASS。');
  console.error('  本站含财务数据，不允许无鉴权运行。请通过 Secret Manager 注入后重试。');
  process.exit(1);
}
const MIN_PASS = 10;
if (PASS.length < MIN_PASS) {
  console.error(`✗ 拒绝启动：SITE_PASS 太短（${PASS.length} 位），至少 ${MIN_PASS} 位。`);
  process.exit(1);
}

const EXPECTED = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

// 可接受的用户名写法：完整值，以及邮箱 @ 前那段（短名能避开浏览器的 Google 账号自动填充）
const USER_ALIASES = new Set([USER.toLowerCase(), USER.split('@')[0].toLowerCase()]);

// 定长比较，避免按字节提前返回泄露信息
function safeEqual(a, b) {
  const ba = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---------- 会话 ----------
// 为什么不只用 Basic Auth：浏览器一旦缓存过一次错误凭据就会静默重发、不再弹框，
// 手机上更是没法退出重来。所以主路径改成登录表单 + 签名 cookie，
// Basic Auth 保留给 curl / 脚本。
const SESSION_SECRET = crypto.createHash('sha256').update(`${USER}:${PASS}:ceo-site`).digest();
const SESSION_DAYS = 30;
const COOKIE = 'ceo_session';

function signSession(expMs) {
  const payload = String(expMs);
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

function validSession(token) {
  if (!token || !token.includes('.')) return false;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (!safeEqual(mac, expect)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function loginPage(msg) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>CEO 工作台</title><style>
:root{--bg:#f7f6f3;--card:#fff;--ink:#1a1a1a;--muted:#6b6b6b;--line:#e4e0d9;--accent:#b4442e}
@media(prefers-color-scheme:dark){:root{--bg:#16150f;--card:#1e1d16;--ink:#ece8df;--muted:#9b968c;--line:#33312a;--accent:#e07a5f}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;padding:22px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:34px 30px;width:100%;max-width:370px}
h1{font-size:21px;margin-bottom:6px}
p.sub{color:var(--muted);font-size:13.5px;margin-bottom:24px}
label{display:block;font-size:13px;color:var(--muted);margin:14px 0 6px}
input{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:16px}
input:focus{outline:2px solid var(--accent);outline-offset:1px}
button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:8px;background:var(--ink);color:var(--bg);font-size:15.5px;cursor:pointer}
.err{margin-top:16px;color:var(--accent);font-size:13.5px}
</style></head><body><div class="box">
<h1>CEO 工作台</h1><p class="sub">看板 · 账本 · 文档中心</p>
<form method="POST" action="/login">
<label for="u">用户名<span style="opacity:.6">（可只输 @ 前那段）</span></label><input id="u" name="u" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required>
<label for="p">密码</label><input id="p" name="p" type="password" autocomplete="current-password" required>
<button type="submit">进入</button>
${msg ? `<div class="err">${msg}</div>` : ''}
</form></div></body></html>`;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400); return res.end('Bad Request');
  }

  const html = (code, body, extra = {}) => {
    res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
    res.end(body);
  };

  // 登录表单提交
  if (urlPath === '/login' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 4096) { req.destroy(); }   // 别让人往这灌东西
    });
    req.on('end', () => {
      const form = new URLSearchParams(raw);
      // 用户名不是秘密，比较放宽：忽略大小写与前后空格，且邮箱可只输 @ 前那段。
      // 用邮箱当用户名会让 Chrome 误判成 Google 登录并自动填 Google 密码，
      // 允许短用户名是为了让人能绕开那个自动填充。密码仍然严格定长比较。
      const inUser = (form.get('u') || '').trim().toLowerCase();
      const okUser = USER_ALIASES.has(inUser);
      const okPass = safeEqual(form.get('p') || '', PASS);
      if (!okUser) return html(401, loginPage('用户名不对'));
      if (!okPass) return html(401, loginPage('密码不对。若是浏览器自动填的，请清空手动输入'));
      const token = signSession(Date.now() + SESSION_DAYS * 864e5);
      html(302, '', {
        'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`,
        Location: '/',
      });
    });
    return;
  }

  const authed = validSession(readCookie(req.headers.cookie, COOKIE))
    || safeEqual(req.headers.authorization, EXPECTED);   // Basic 保留给 curl / 脚本

  if (urlPath === '/login') return html(authed ? 302 : 200, authed ? '' : loginPage(''), authed ? { Location: '/' } : {});

  if (urlPath === '/logout') {
    return html(302, '', { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`, Location: '/login' });
  }

  if (!authed) {
    // 浏览器导航 → 给登录页；脚本/接口 → 401 + WWW-Authenticate。
    // realm 必须是纯 ASCII：HTTP header 不接受非 ASCII，放中文会抛 ERR_INVALID_CHAR 杀掉进程。
    if ((req.headers.accept || '').includes('text/html')) return html(401, loginPage(''));
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="CEO Workbench", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    return res.end('需要登录');
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  // 目录穿越防护：解析后必须仍在 ROOT 之内
  const filePath = path.join(ROOT, urlPath);
  if (path.relative(ROOT, filePath).startsWith('..')) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<meta charset="utf-8"><p style="font:16px sans-serif;padding:40px">没有这个页面。<a href="/">回工作台</a></p>');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',           // 看板与账本是会变的，别缓存
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log(`CEO 站点已启动 :${PORT}（Basic Auth 已启用）`));
