import { test } from "node:test";
import assert from "node:assert";
import { notesToBusinessLeads, extractUserId } from "../src/scraper.js";

// 2026-08-12 实测的 search 真实返回形状
const NOTES = [
  {
    note_id: "n1", title: "多伦多美甲｜法式渐变新款", author: "Bella Nails TO",
    author_url: "https://www.xiaohongshu.com/user/profile/5e8fe279000000000100196b?channel_type=web_search_result_notes&xsec_token=AB41v&xsec_source=pc_search",
    url: "https://www.xiaohongshu.com/search_result/n1?xsec_token=t", likes: 36, published_at: "2026-04-07",
  },
  {
    note_id: "n2", title: "本周还有空位｜私信预约", author: "Bella Nails TO",
    author_url: "https://www.xiaohongshu.com/user/profile/5e8fe279000000000100196b?channel_type=x",
    url: "https://www.xiaohongshu.com/search_result/n2?xsec_token=t", likes: 12, published_at: "2026-04-09",
  },
  {
    note_id: "n3", title: "多伦多美甲店推荐合集", author: "枫叶生活君",
    author_url: "https://www.xiaohongshu.com/user/profile/64390df6000000000f005cd1",
    url: "https://www.xiaohongshu.com/search_result/n3?xsec_token=t", likes: 500, published_at: "2026-03-01",
  },
];

test("从 author_url 里取出 uid", () => {
  assert.equal(
    extractUserId("https://www.xiaohongshu.com/user/profile/5e8fe279000000000100196b?channel_type=x"),
    "5e8fe279000000000100196b"
  );
  assert.equal(extractUserId("https://www.xiaohongshu.com/user/profile/abc123"), "abc123");
  assert.equal(extractUserId(null), null);
  assert.equal(extractUserId("https://www.xiaohongshu.com/explore/xxx"), null);
});

test("一个商家一条线索，同一人的多篇笔记合并", () => {
  const leads = notesToBusinessLeads(NOTES, "多伦多 美甲");
  assert.equal(leads.length, 2); // Bella 两篇合成一条
  const bella = leads.find((l) => l.author === "Bella Nails TO");
  assert.equal(bella.author_user_id, "5e8fe279000000000100196b");
  assert.equal(bella.source, "author");
  assert.match(bella.body, /法式渐变新款/);
  assert.match(bella.body, /本周还有空位/);
});

test("线索带上主页链接，L2 直接能用", () => {
  const leads = notesToBusinessLeads(NOTES, "多伦多 美甲");
  const bella = leads.find((l) => l.author === "Bella Nails TO");
  assert.equal(bella.profile_url, "https://www.xiaohongshu.com/user/profile/5e8fe279000000000100196b");
});

test("取该作者最高赞和最新的笔记做代表", () => {
  const leads = notesToBusinessLeads(NOTES, "多伦多 美甲");
  const bella = leads.find((l) => l.author === "Bella Nails TO");
  assert.equal(bella.likes, 36); // 两篇里的最高赞
  assert.equal(bella.note_count, 2);
});

test("拿不到 uid 的丢掉 —— 没有 uid 就进不了 L2，留着只是噪音", () => {
  const leads = notesToBusinessLeads(
    [{ note_id: "x", title: "t", author: "a", author_url: null, url: "u" }], "kw");
  assert.equal(leads.length, 0);
});

test("空输入不炸", () => {
  assert.deepEqual(notesToBusinessLeads(null, "kw"), []);
  assert.deepEqual(notesToBusinessLeads([], "kw"), []);
});

test("搜索词记下来 —— 它是这条线索唯一的地域凭据", () => {
  const leads = notesToBusinessLeads(NOTES, "多伦多 美甲");
  assert.ok(leads.every((l) => l.keyword === "多伦多 美甲"));
});
