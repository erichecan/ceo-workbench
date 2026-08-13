/**
 * 小红书抓取，全部走 opencli（项目 CLAUDE.md 强制）。
 *
 * 与旧版（CDP Proxy + 手写选择器）的根本差别：**xsec_token 不再是我们的问题**。
 * opencli 的 search 返回的 url 本身带 token，comments 直接吃这个 url。
 * README 里那一大段「详情页不能直连、必须在搜索页内 click a.cover」的踩坑
 * 记录，连同那些手写选择器一起，由适配器兜住了。站点改版也不用自己修 DOM。
 *
 * 抓取目标也变了：不再搜「找人做网站」这类需求词，而是搜**同行推广词**，
 * 抓他们的评论区 —— 在同行帖下留言的人意向已经默认存在，且正在比价。
 */
import fs from "node:fs";
import path from "node:path";
import * as opencli from "./opencli.js";
import { parseCommentTime } from "./geo.js";
import { config, jitter, RAW_DIR, today } from "./config.js";

const NOTE_ID_RE = /\/(?:explore|search_result|discovery\/item)\/([0-9a-zA-Z]+)/;

/**
 * 爆款笔记不是同行推广帖，评论区里没有客户。
 *
 * 2026-08-12 实测「帮客户做网站」：同行推广帖 6 / 6 / 36 赞，而混进来的
 * 4597 赞是一篇「请不要再做 App、网站、小程序了」的唱反调技术讨论帖 ——
 * 它一篇就贡献了当轮 47 条线索里的大多数，评论区全是开发者聊 agent，
 * 一个客户都没有。抓它等于拿风控预算和 AI 调用去换噪音。
 */
export const isPromoNote = (n) => (n.likes ?? 0) <= config.maxNoteLikes;

/** '1361' → 1361；'1.3万' → 13000；'赞' → null。 */
export function parseLikes(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  const wan = s.match(/^([\d.]+)\s*万$/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  return /^\d+$/.test(s) ? Number(s) : null;
}

const USER_ID_RE = /\/user\/profile\/([0-9a-zA-Z]+)/;

/** 从 author_url 里取 uid。search 不单独返回 userId，只能从链接里抠。 */
export function extractUserId(authorUrl) {
  return (String(authorUrl || "").match(USER_ID_RE) || [])[1] || null;
}

/**
 * 商家模式：**搜索结果里的笔记作者本身就是线索**，不再抓评论区。
 *
 * 这是 2026-08-13 转向后的主力路径。北美华人商家不会在小红书上讨论建站，
 * 但她们在小红书上做生意 —— 搜「多伦多 美甲」出来的作者就是一个个真商家。
 *
 * 同一个商家常在搜索结果里出现多篇笔记，按 uid 合并成一条线索：
 * 一个商家一条，body 是她笔记标题的合集 —— 那正是判断她做什么生意的依据。
 *
 * ⚠️ search 的返回**没有 IP 属地**（属地只在 comments 里有），所以地域
 * 完全靠搜索词保证。keyword 因此不只是元数据，是这条线索唯一的地域凭据。
 */
export function notesToBusinessLeads(notes, keyword) {
  const byUser = new Map();
  for (const n of notes || []) {
    const uid = extractUserId(n.author_url);
    if (!uid) continue; // 没有 uid 就进不了 L2，留着只是噪音
    const cur = byUser.get(uid);
    if (cur) {
      cur.titles.push(n.title);
      cur.likes = Math.max(cur.likes ?? 0, n.likes ?? 0);
      cur.published_at = [cur.published_at, n.published_at].filter(Boolean).sort().pop();
    } else {
      byUser.set(uid, {
        uid,
        author: n.author || null,
        titles: [n.title],
        likes: n.likes ?? null,
        published_at: n.published_at || null,
        url: n.url || null,
        note_id: n.note_id || null,
      });
    }
  }

  return [...byUser.values()].map((b) => ({
    source: "author",
    keyword,
    note_id: b.note_id,
    url: b.url,
    title: b.titles[0] || null,
    author: b.author,
    author_user_id: b.uid,
    profile_url: `https://www.xiaohongshu.com/user/profile/${b.uid}`,
    ip_location: null, // search 不给属地，靠 keyword 里的地名兜底
    body: b.titles.filter(Boolean).join("\n"),
    likes: b.likes,
    published_at: b.published_at,
    note_count: b.titles.length,
    is_reply: 0,
    screenshot: null,
  }));
}

/** 搜一个词，返回前排笔记。url 带 xsec_token，可直接喂给 comments。 */
export async function searchNotes(keyword) {
  const rows = await opencli.run("search", [keyword, "--limit", 20]);
  return rows
    .filter((r) => r.url)
    .map((r) => ({
      note_id: (r.url.match(NOTE_ID_RE) || [])[1] || null,
      title: r.title || null,
      author: r.author || null,
      author_url: r.author_url || null,
      url: r.url,
      likes: parseLikes(r.likes),
      published_at: r.published_at || null,
    }));
}

/**
 * 把一篇笔记的评论摊平成线索。
 *
 * 笔记正文本身不再作为线索 —— 那是同行的推广文案，不是客户说的话。
 * 这是与旧版 toLeads 的关键差别。
 */
export function commentsToLeads(comments, note, keyword) {
  const leads = [];
  for (const c of comments || []) {
    const text = String(c.text || "").replace(/\s+/g, " ").trim();
    if (text.length < 8) continue; // 「沙发」「6」不值得花一次 AI 调用
    if (note.author && c.author === note.author) continue; // 同行在自己帖下回复
    const { date, ip_location } = parseCommentTime(c.time);
    leads.push({
      source: "comment",
      keyword,
      note_id: note.note_id || null,
      url: note.url || null,
      title: note.title || null,
      author: c.author || null,
      author_user_id: c.userId || null,
      profile_url: c.profileUrl || null,
      ip_location,
      body: text,
      likes: parseLikes(c.likes),
      published_at: date,
      is_reply: c.is_reply ? 1 : 0,
      screenshot: null,
    });
  }
  return leads;
}

const commentArgs = (url) => [
  url,
  "--limit",
  Math.min(config.commentsPerNote, 50), // opencli 的硬上限就是 50
  "--with-replies",
];

/**
 * 商家模式（主力）：搜一个生意品类词，把搜索结果里的作者变成线索。
 *
 * 只花 **1 次** opencli 调用 —— 比评论区模式（1 次搜索 + N 次 comments）
 * 便宜得多，风控预算能铺到更多品类和城市上。
 * 产量来自「铺开品类 × 城市」，不是靠单个词挖更深（翻页是高风控动作）。
 */
export async function byBusiness(keyword) {
  const notes = await searchNotes(keyword);
  return { keyword, leads: notesToBusinessLeads(notes, keyword), notes: notes.length };
}

/** 评论区模式：搜一个同行推广词，抓其前 N 篇笔记的评论区。 */
export async function byKeyword(keyword) {
  const notes = (await searchNotes(keyword))
    .filter((n) => n.note_id)
    .filter(isPromoNote)
    // ⛔ 按搜索相关性（rank）取前 N，**不要**按点赞降序。
    //
    //    旧版按赞排，因为搜的是需求词，高赞需求帖评论多。搜同行推广词时这条
    //    正好反过来：推广帖是广告，赞数天然低。2026-08-12 实测「帮客户做网站」，
    //    rank 1-3 是三篇同行推广帖（6 / 6 / 36 赞），rank 4 是一篇 4597 赞的
    //    唱反调技术讨论帖。按赞排就只会抓到 rank 4 那篇 —— 评论区全是聊 agent
    //    的开发者，一个客户都没有，等于系统性避开真正要挖的帖子。
    .slice(0, config.notesPerKeyword);

  const leads = [];
  for (const [i, note] of notes.entries()) {
    if (i) await jitter(config.delayBetweenCalls);
    const rows = await opencli.run("comments", commentArgs(note.url));
    leads.push(...commentsToLeads(rows, note, keyword));
  }
  return { keyword, leads, notes: notes.length };
}

/** 抓单篇笔记的评论区。url 必须带 xsec_token（小红书「复制链接」出来的都带）。 */
export async function byUrl(url) {
  const noteId = (url.match(NOTE_ID_RE) || [])[1] || null;
  const rows = await opencli.run("comments", commentArgs(url));
  return { keyword: null, leads: commentsToLeads(rows, { note_id: noteId, url }, null) };
}

/** 每轮抓取的原始返回都落盘，分析出问题时能回看，也不必重抓。 */
export function dumpRaw(tag, payload) {
  const file = path.join(RAW_DIR, `${today().replace(/-/g, "")}_${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  return file;
}
