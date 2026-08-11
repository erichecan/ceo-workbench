/**
 * 小红书抓取。两种入口：
 *   byKeyword(kw)  搜索词 → 前排笔记 → 点开前 N 篇取正文和评论
 *   byUrl(url)     直接抓一篇（链接必须带 xsec_token，见下）
 *
 * 页面里的取数 JS 移植自 scripts/xhs-probe/probe.py，那些选择器是在真页面上
 * 一个个试出来的，不是照 DOM 猜的。三条踩过的坑照抄过来：
 *
 *  1. 详情页**不能直连**。卡片 href 是 /search_result/<id>?xsec_token=…，
 *     xsec_token 是访问详情的必需参数；直接开 /explore/<id> 返回空壳。
 *     所以搜索模式下必须在搜索 tab 内 click a.cover。
 *  2. 正文和评论**一次取完**。详情页已经打开了，多跑一个 querySelector 是
 *     零成本；单独为正文再点开一次等于把反封控的点击预算翻倍。
 *  3. 撞验证码**立刻停整轮**，不重试、不换词硬撑。
 */
import fs from "node:fs";
import path from "node:path";
import * as cdp from "./cdp.js";
import { config, jitter, sleep, RAW_DIR, SHOT_DIR, today } from "./config.js";

const SEARCH_URL = (kw) =>
  `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(kw)}&source=web_search_result_notes`;

const JS_PAGE_STATE = `(()=>{const t=document.body.innerText||"";return JSON.stringify({
 n:document.querySelectorAll("section.note-item").length,
 captcha:/安全验证|验证码|滑动验证/.test(t),
 empty:/没找到相关内容|暂无相关|换个关键词/.test(t),
 login:/\\/login/.test(location.href)})})()`;

const JS_CARDS = `(()=>JSON.stringify([...document.querySelectorAll("section.note-item")].map((s,i)=>{
 const a=s.querySelector("a.cover")||s.querySelector("a[href*='/explore/']");
 const href=a?a.getAttribute("href"):null;
 const m=href?href.match(/\\/(?:explore|search_result|discovery\\/item)\\/([0-9a-zA-Z]+)/):null;
 const lines=(s.innerText||"").split("\\n").map(x=>x.trim()).filter(Boolean);
 const dl=lines.find(x=>/^\\d{2}-\\d{2}$/.test(x)||/^\\d{4}-\\d{2}-\\d{2}$/.test(x));
 return {rank:i+1,note_id:m?m[1]:null,href:href,
  title:s.querySelector(".title")?.innerText||null,
  author:s.querySelector(".author .name")?.innerText||null,
  likes_raw:s.querySelector(".count")?.innerText||null,
  date_raw:dl||null}})))()`;

const JS_DETAIL = `(()=>{const out=[];
 document.querySelectorAll("[class*=comment-item]").forEach(e=>{
  if(e.className.includes("comment-item-sub"))return;
  const txt=(e.innerText||"").replace(/\\s+/g," ").trim();
  const c=e.querySelector(".note-text")||e.querySelector("[class*=content] .note-text")||e.querySelector("[class*=content]");
  const au=e.querySelector("[class*=author]")||e.querySelector(".name");
  out.push({raw:txt,content:c?(c.innerText||"").trim():null,
   author:au?(au.innerText||"").trim():null,
   is_author:/\\s作者\\s/.test(" "+txt+" ")});});
 const dc=document.querySelector("#detail-desc")||document.querySelector(".note-content")
   ||document.querySelector("[class*=note-scroller] [class*=desc]");
 const de=dc?(dc.querySelector(".note-text")||dc):null;
 const tt=document.querySelector("#detail-title")||document.querySelector(".note-content .title");
 const an=document.querySelector(".author-container .name")||document.querySelector("[class*=author] .name");
 return JSON.stringify({url:location.href,comments:out.slice(0,${config.maxCommentsPerNote}),
  note_title:tt?(tt.innerText||"").trim():null,
  note_author:an?(an.innerText||"").trim():null,
  note_body:de?(de.innerText||"").trim():null})})()`;

/** '1361' → 1361；'1.3万' → 13000；'赞' → null。 */
export function parseLikes(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const wan = s.match(/^([\d.]+)\s*万$/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** '03-11' → 本年；'2025-01-31' → 原样。 */
export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const md = s.match(/^(\d{2})-(\d{2})$/);
  return md ? `${new Date().getFullYear()}-${md[1]}-${md[2]}` : null;
}

const META_TAIL = /\s*(?:\d{4}-)?\d{2}-\d{2}\s*[一-龥]{2,4}(?:\s*(?:赞|回复|展开|\d+))*\s*$/;
const PURE_META = /^[\d\s赞回复展开条]*$/;

/** 剥掉「日期+地区 赞 回复」尾巴。只做格式清洗，有没有价值交给 analyzer 判。 */
export function cleanComment(text) {
  if (!text) return "";
  let s = String(text).replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    const next = s.replace(META_TAIL, "").trim();
    if (next === s) break;
    s = next;
  }
  return PURE_META.test(s) ? "" : s;
}

function noteUrl(href, noteId) {
  if (!href || !noteId) return null;
  const query = href.includes("?") ? href.split("?")[1] : "";
  const base = `https://www.xiaohongshu.com/explore/${noteId}`;
  return query ? `${base}?${query}` : base;
}

async function maybeScreenshot(target, noteId) {
  if (!config.captureScreenshot) return null;
  try {
    const b64 = await cdp.screenshot(target);
    if (!b64) return null;
    const rel = path.join("screenshots", `${noteId}.png`);
    fs.writeFileSync(path.join(SHOT_DIR, `${noteId}.png`), Buffer.from(b64, "base64"));
    return rel;
  } catch {
    return null; // 截图失败不该拖垮抓取本身
  }
}

/**
 * 详情页的标题兜底。
 *
 * `#detail-title` 不是每篇都有 —— 小红书图文笔记的标题是可选的，没填时
 * 第一行正文就充当标题。2026-08-11 实测两篇首页笔记都取不到 #detail-title，
 * 标题整个落进了 note_body，报告里显示成「(无标题)」。
 * 搜索模式不受影响（标题取自搜索卡片的 .title），只有 --url 模式会暴露。
 */
export function fallbackTitle(body) {
  const line = (body || "").split("\n").map((s) => s.trim()).find(Boolean) || "";
  const stripped = line.replace(/#\S+/g, "").trim(); // 纯标签行不是标题
  return stripped.slice(0, 30);
}

/** 把一个详情页的返回摊平成若干条线索（笔记本体 1 条 + 每条评论 1 条）。 */
function toLeads(detail, card, keyword, shot) {
  const leads = [];
  const url = detail.url || card?.url || null;
  const body = (detail.note_body || "").trim();
  const title = (detail.note_title || card?.title || "").trim() || fallbackTitle(body);
  if (body) {
    leads.push({
      source: "note",
      keyword,
      note_id: card?.note_id || null,
      url,
      title,
      author: detail.note_author || card?.author || null,
      body: body.slice(0, 4000),
      likes: card?.likes ?? null,
      published_at: card?.published_at ?? null,
      screenshot: shot,
    });
  }
  for (const c of detail.comments || []) {
    if (c.is_author) continue; // 博主自己的回复不是线索
    const text = cleanComment(c.content || c.raw);
    if (text.length < 8) continue;
    leads.push({
      source: "comment",
      keyword,
      note_id: card?.note_id || null,
      url,
      title,
      author: c.author || null,
      body: text,
      likes: null,
      published_at: null,
      screenshot: null,
    });
  }
  return leads;
}

export class CaptchaError extends Error {
  constructor() {
    super("触发安全验证");
    this.captcha = true;
  }
}

/** 搜索一个关键词，返回该词带出的全部线索。 */
export async function byKeyword(keyword) {
  const target = await cdp.openTab(SEARCH_URL(keyword));
  try {
    await sleep(config.pageLoadWait);
    const state = await cdp.evaluate(target, JS_PAGE_STATE);
    if (state.captcha) throw new CaptchaError();
    if (state.login) throw new Error("跳到了登录页 —— 那个 Chrome 里需要先扫码登录小红书");
    if (!state.n) return { keyword, leads: [], note: state.empty ? "无结果" : "前排为空（可能被拦）" };

    const cards = (await cdp.evaluate(target, JS_CARDS)).map((c) => ({
      ...c,
      likes: parseLikes(c.likes_raw),
      published_at: parseDate(c.date_raw),
      url: noteUrl(c.href, c.note_id),
    }));

    // 按点赞降序挑，不按 rank —— 低赞笔记通常没有评论，评论区颗粒无收。
    const picked = cards
      .filter((c) => c.note_id)
      .sort((a, b) => (b.likes ?? -1) - (a.likes ?? -1))
      .slice(0, config.notesPerKeyword);

    const leads = [];
    for (const card of picked) {
      await jitter(config.delayInPage);
      try {
        await cdp.click(target, `section.note-item a.cover[href*="${card.note_id}"]`);
        await sleep(config.pageLoadWait);
        const detail = await cdp.evaluate(target, JS_DETAIL);
        if (!(detail.url || "").includes("/explore/")) continue; // 没真的打开详情页
        leads.push(...toLeads(detail, card, keyword, await maybeScreenshot(target, card.note_id)));
        await cdp.back(target);
        await sleep(config.pageLoadWait);
      } catch (e) {
        console.log(`   ⚠️ ${card.note_id} 详情抓取中断：${e.message.slice(0, 80)}`);
        break; // 连续失败多半是被拦了，不硬撑
      }
    }
    return { keyword, leads };
  } finally {
    await cdp.closeTab(target);
  }
}

/** 直接抓一篇。链接必须带 xsec_token —— 从小红书「复制链接」出来的都带。 */
export async function byUrl(url) {
  const target = await cdp.openTab(url);
  try {
    await sleep(config.pageLoadWait);
    const detail = await cdp.evaluate(target, JS_DETAIL);
    if (!detail.note_body) {
      throw new Error(
        `拿不到正文。多半是链接缺 xsec_token（直连 /explore/<id> 返回空壳）。\n` +
          `      请在小红书里用「分享 → 复制链接」得到带 xsec_token 的完整链接。`
      );
    }
    const noteId = (url.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-zA-Z]+)/) || [])[1] || null;
    return {
      keyword: null,
      leads: toLeads(detail, { note_id: noteId, url }, null, await maybeScreenshot(target, noteId || "unknown")),
    };
  } finally {
    await cdp.closeTab(target);
  }
}

/** 每轮抓取的原始返回都落盘，分析出问题时能回看，也不必重抓。 */
export function dumpRaw(tag, payload) {
  const file = path.join(RAW_DIR, `${today().replace(/-/g, "")}_${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  return file;
}
