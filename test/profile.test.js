import { test } from "node:test";
import assert from "node:assert";
import { toProfile } from "../src/profile.js";

const LEAD = { author: "造梦设计师01", author_user_id: "u1",
               profile_url: "https://www.xiaohongshu.com/user/profile/u1" };

test("主页笔记转成 profile", () => {
  // 2026-08-12 实测账号 66deb3cc000000001d03347c 的真实返回
  const rows = [
    { id: "n1", title: "喝到了 方逸伦奶茶", type: "video", likes: "55" },
    { id: "n2", title: "雪天独有的浪漫", type: "video", likes: "85" },
  ];
  const p = toProfile(rows, LEAD);
  assert.equal(p.status, "ok");
  assert.equal(p.user_id, "u1");
  assert.equal(p.nickname, "造梦设计师01");
  assert.equal(p.profile_url, "https://www.xiaohongshu.com/user/profile/u1");
  assert.deepEqual(p.recent_notes, ["喝到了 方逸伦奶茶", "雪天独有的浪漫"]);
});

test("无公开笔记标 empty 而不是丢掉 —— 不重试，重试改变不了对方的隐私设置", () => {
  const p = toProfile([], LEAD);
  assert.equal(p.status, "empty");
  assert.deepEqual(p.recent_notes, []);
});

test("空返回不炸", () => {
  assert.equal(toProfile(null, LEAD).status, "empty");
  assert.equal(toProfile(undefined, LEAD).status, "empty");
});

test("无标题的笔记不进列表 —— 空字符串喂给模型只是噪音", () => {
  const p = toProfile([{ id: "n1", title: "", likes: "1" }, { id: "n2", title: "真标题" }], LEAD);
  assert.deepEqual(p.recent_notes, ["真标题"]);
});

test("全是无标题笔记时算 empty —— 有笔记但读不出内容，等于没有判断依据", () => {
  const p = toProfile([{ id: "n1", title: "" }, { id: "n2", title: "  " }], LEAD);
  assert.equal(p.status, "empty");
});
