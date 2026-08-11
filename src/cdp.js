/**
 * web-access skill 的 CDP Proxy 客户端。
 *
 * Proxy 是一个 HTTP 服务（默认 :3456），转发 Chrome DevTools Protocol，
 * 所以语言无关 —— businessskills 里现有的调用方是 Python，这里是 Node，
 * 打的是同一个接口、共用同一个浏览器和同一份登录态。
 *
 * 启动 proxy：node ~/.claude/skills/web-access/scripts/cdp-proxy.mjs
 */
import { config } from "./config.js";

async function call(path, { body, timeout = 40000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(config.proxy + path, {
      method: body === undefined ? "GET" : "POST",
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`CDP ${path} → HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function alive() {
  try {
    await call("/targets", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const openTab = async (url) =>
  (await call(`/new?url=${encodeURIComponent(url)}`)).targetId;

export const closeTab = (target) =>
  call(`/close?target=${target}`).catch(() => {});

export const click = (target, selector) =>
  call(`/click?target=${target}`, { body: selector });

export const back = (target) => evaluate(target, `(()=>{history.back();return 1})()`);

export async function screenshot(target) {
  const r = await call(`/screenshot?target=${target}`, { timeout: 60000 });
  return r.data || r.screenshot || null;
}

/**
 * proxy 按**表达式**求值，多语句必须自己包 IIFE。
 * 页面里的 JS 返回 JSON 字符串时这里再解一层，调用方直接拿到对象。
 */
export async function evaluate(target, js, timeout = 30000) {
  const raw = await call(`/eval?target=${target}`, { body: js, timeout });
  if (raw.error) throw new Error(`eval failed: ${raw.error}`);
  const value = raw.value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const PROXY_HINT = `⛔ CDP Proxy 未就绪（${config.proxy}）。

  先在另一个终端启动：
    node ~/.claude/skills/web-access/scripts/cdp-proxy.mjs

  再确认那个 Chrome 里已登录 www.xiaohongshu.com（扫码一次即可，cookie 会留着）。
  未登录时搜索结果页多半直接空白或跳登录页 —— 抓到 0 条和「本来就没结果」
  长得一模一样，是这条链路最容易的静默失败。`;
