import { test } from "node:test";
import assert from "node:assert";
import { commentsToLeads, isPromoNote, parseLikes } from "../src/scraper.js";

const NOTE = { note_id: "n1", title: "帮您打造会赚钱的网站", author: "FlamingoTech",
               url: "https://www.xiaohongshu.com/explore/n1?xsec_token=t" };

// 2026-08-12 实测的真实字段形状
const COMMENTS = [
  { rank: 1, author: "Bing Fitness", userId: "u1",
    profileUrl: "https://www.xiaohongshu.com/user/profile/u1",
    text: "我也想搭建一个网站，多少钱", likes: 3, time: "03-02美国", is_reply: false, reply_to: "" },
  { rank: 2, author: "路人", userId: "u2", profileUrl: "https://x/u2",
    text: "沙发党路过看看热闹", likes: 0, time: "02-28广东", is_reply: false, reply_to: "" },
];

test("评论摊平成线索，带上 uid、主页链接和属地", () => {
  const leads = commentsToLeads(COMMENTS, NOTE, "帮客户做网站");
  assert.equal(leads.length, 2);
  assert.equal(leads[0].author_user_id, "u1");
  assert.equal(leads[0].profile_url, "https://www.xiaohongshu.com/user/profile/u1");
  assert.equal(leads[0].ip_location, "美国");
  assert.equal(leads[0].source, "comment");
  assert.equal(leads[0].title, "帮您打造会赚钱的网站");
  assert.equal(leads[0].note_id, "n1");
  assert.equal(leads[0].published_at, "03-02");
  assert.equal(leads[1].ip_location, "广东");
});

test("太短的评论丢掉 —— 「沙发」这类不值得花一次 AI 调用", () => {
  const leads = commentsToLeads(
    [{ author: "a", userId: "u", text: "6", time: "03-02美国" }], NOTE, null);
  assert.equal(leads.length, 0);
});

test("楼中楼回复也收 —— 回复里常有「多少钱」这种真信号", () => {
  const leads = commentsToLeads(
    [{ author: "a", userId: "u", text: "请问大概什么价位能做", time: "03-02美国",
       is_reply: true, reply_to: "楼主" }], NOTE, null);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].is_reply, 1);
});

test("笔记作者本人的评论不是线索 —— 那是同行在自己帖子下回复", () => {
  const leads = commentsToLeads(
    [{ author: "FlamingoTech", userId: "uAuthor", text: "有需要私信我详聊哦", time: "03-02美国" }],
    NOTE, null);
  assert.equal(leads.length, 0);
});

test("缺 userId 仍然保留 —— 评论内容本身还有价值，只是进不了 L2", () => {
  const leads = commentsToLeads(
    [{ author: "a", userId: null, text: "我也需要做一个网站", time: "03-02美国" }], NOTE, null);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].author_user_id, null);
});

test("空输入不炸", () => {
  assert.deepEqual(commentsToLeads(null, NOTE, null), []);
  assert.deepEqual(commentsToLeads([], NOTE, null), []);
});

test("笔记正文不再作为线索 —— 那是同行的推广文案，不是客户说的话", () => {
  const leads = commentsToLeads(COMMENTS, NOTE, "kw");
  assert.ok(leads.every((l) => l.source === "comment"));
});

// 2026-08-12 实测「帮客户做网站」的真实赞数
test("爆款讨论帖滤掉，同行推广帖留下", () => {
  assert.equal(isPromoNote({ likes: 6 }), true);      // FlamingoTech北美商家帮
  assert.equal(isPromoNote({ likes: 36 }), true);     // 文文的分享
  assert.equal(isPromoNote({ likes: 250 }), false);   // 「0到1帮客户搭系统」科普
  assert.equal(isPromoNote({ likes: 4597 }), false);  // 「请不要再做App」讨论帖
});

test("赞数缺失当 0 处理 —— 宁可多抓一篇，不可漏掉刚发的推广帖", () => {
  assert.equal(isPromoNote({ likes: null }), true);
  assert.equal(isPromoNote({}), true);
});

test("赞数解析：万单位与非数字", () => {
  assert.equal(parseLikes("1.3万"), 13000);
  assert.equal(parseLikes("4597"), 4597);
  assert.equal(parseLikes("赞"), null);
  assert.equal(parseLikes(null), null);
});
