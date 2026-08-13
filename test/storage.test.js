import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as store from "../src/storage.js";

function freshDb() {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "leads-")), "t.db");
  store.close();
  store.open(p);
  return p;
}

test("leads 新增 author_user_id / ip_location / profile_url", () => {
  freshDb();
  store.insertLead({
    source: "comment", body: "我也想做个网站", note_id: "n1",
    author: "Bing Fitness", author_user_id: "u123", ip_location: "美国",
    profile_url: "https://www.xiaohongshu.com/user/profile/u123",
  });
  const raw = store.open().prepare("SELECT * FROM leads").get();
  assert.equal(raw.author_user_id, "u123");
  assert.equal(raw.ip_location, "美国");
  assert.equal(raw.profile_url, "https://www.xiaohongshu.com/user/profile/u123");
});

test("profile 可存可取，扑空状态也要留痕", () => {
  freshDb();
  store.saveProfile({ user_id: "u1", nickname: "造梦设计师01", status: "ok",
    recent_notes: ["喝到了方逸伦奶茶", "雪天独有的浪漫"], profile_url: "https://x/u1" });
  const got = store.getProfile("u1");
  assert.equal(got.nickname, "造梦设计师01");
  assert.deepEqual(got.recent_notes, ["喝到了方逸伦奶茶", "雪天独有的浪漫"]);

  store.saveProfile({ user_id: "u2", nickname: "谁", status: "empty", recent_notes: [] });
  assert.equal(store.getProfile("u2").status, "empty");
});

test("重复保存 profile 是更新不是报错", () => {
  freshDb();
  store.saveProfile({ user_id: "u1", nickname: "旧", status: "ok", recent_notes: [] });
  store.saveProfile({ user_id: "u1", nickname: "新", status: "ok", recent_notes: ["a"] });
  assert.equal(store.getProfile("u1").nickname, "新");
});

test("找不到的 profile 返回 null 而不是抛错", () => {
  freshDb();
  assert.equal(store.getProfile("nope"), null);
});

test("待抓主页的线索：要有 user_id、北美、is_lead、且还没抓过", () => {
  freshDb();
  const mk = (n, uid, loc) => store.insertLead({
    source: "comment", body: `内容${n}`, note_id: "n1", author: `a${n}`,
    author_user_id: uid, ip_location: loc,
  });
  mk(1, "u1", "美国");
  mk(2, "u2", "广东");     // 非北美，不该出现
  mk(3, null, "美国");      // 无 uid，抓不了
  mk(4, "u4", "加拿大");
  const ids = store.open().prepare("SELECT id FROM leads ORDER BY id").all().map((r) => r.id);
  for (const id of ids) store.saveAnalysis(id, { score: 60, is_lead: true });
  store.saveProfile({ user_id: "u1", nickname: "x", status: "ok", recent_notes: [] });

  const todo = store.leadsNeedingProfile(10);
  assert.deepEqual(todo.map((l) => l.author_user_id), ["u4"]);
});

test("低分线索不进 L2 —— 主页配额只花在值得的人身上", () => {
  freshDb();
  store.insertLead({ source: "comment", body: "围观", note_id: "n1",
    author: "a", author_user_id: "u9", ip_location: "美国" });
  const id = store.open().prepare("SELECT id FROM leads").get().id;
  store.saveAnalysis(id, { score: 30, is_lead: false });
  assert.equal(store.leadsNeedingProfile(10).length, 0);
});

test("待诊断的线索：主页抓到内容(ok)的才算，扑空(empty)的不进", () => {
  freshDb();
  const mk = (n, uid) => store.insertLead({
    source: "comment", body: `内容${n}`, note_id: "n1", author: `a${n}`,
    author_user_id: uid, ip_location: "美国",
  });
  mk(1, "u1");
  mk(2, "u2");
  for (const r of store.open().prepare("SELECT id FROM leads").all())
    store.saveAnalysis(r.id, { score: 70, is_lead: true });
  store.saveProfile({ user_id: "u1", nickname: "x", status: "ok", recent_notes: ["卖甲油胶"] });
  store.saveProfile({ user_id: "u2", nickname: "y", status: "empty", recent_notes: [] });

  const todo = store.leadsNeedingDiagnosis(10);
  assert.deepEqual(todo.map((l) => l.author_user_id), ["u1"]);
});

test("诊断可存，slug 唯一，reason 留得住", () => {
  freshDb();
  store.insertLead({ source: "comment", body: "b", note_id: "n1", author_user_id: "u1" });
  const id = store.open().prepare("SELECT id FROM leads").get().id;
  store.saveDiagnosis(id, {
    user_id: "u1", industry: "私教工作室", business_size: "个人",
    online_assets: "只有 IG", bottleneck: "排课靠 DM 手动排",
    product_line: "预约系统", reason: "生意靠排期", is_heavy: false,
    diag_html: "<p>x</p>", diag_slug: "bing-fitness-7f3a", dm_draft: "草稿",
  });
  const row = store.open().prepare("SELECT * FROM diagnoses").get();
  assert.equal(row.product_line, "预约系统");
  assert.equal(row.reason, "生意靠排期");
  assert.equal(row.diag_slug, "bing-fitness-7f3a");
  assert.equal(row.is_heavy, 0);
});

test("重复诊断同一条是更新，不是插两行", () => {
  freshDb();
  store.insertLead({ source: "comment", body: "b", note_id: "n1", author_user_id: "u1" });
  const id = store.open().prepare("SELECT id FROM leads").get().id;
  store.saveDiagnosis(id, { product_line: "官网", bottleneck: "旧" });
  store.saveDiagnosis(id, { product_line: "预约系统", bottleneck: "新" });
  const rows = store.open().prepare("SELECT * FROM diagnoses").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bottleneck, "新");
});
