import { test } from "node:test";
import assert from "node:assert";
import { parseCommentTime, isTargetRegion } from "../src/geo.js";

test("拆开日期和属地（2026-08-12 实测格式）", () => {
  assert.deepEqual(parseCommentTime("03-02美国"), { date: "03-02", ip_location: "美国" });
  assert.deepEqual(parseCommentTime("02-28广东"), { date: "02-28", ip_location: "广东" });
  assert.deepEqual(parseCommentTime("03-01陕西"), { date: "03-01", ip_location: "陕西" });
});

test("带年份的完整日期", () => {
  assert.deepEqual(parseCommentTime("2025-03-02美国"), { date: "2025-03-02", ip_location: "美国" });
});

test("缺一半时另一半仍要拿到", () => {
  assert.deepEqual(parseCommentTime("03-02"), { date: "03-02", ip_location: null });
  assert.deepEqual(parseCommentTime("美国"), { date: null, ip_location: "美国" });
});

test("空值不炸", () => {
  assert.deepEqual(parseCommentTime(""), { date: null, ip_location: null });
  assert.deepEqual(parseCommentTime(null), { date: null, ip_location: null });
  assert.deepEqual(parseCommentTime(undefined), { date: null, ip_location: null });
});

// 2026-08-12 实测：同一轮抓取里出现了「5天前安徽」「7天前广东」。
// 不剥这个前缀，「5天前美国」就判不出是美国，会漏掉真客户。
test("相对时间前缀要剥掉，否则属地判不出来", () => {
  assert.deepEqual(parseCommentTime("5天前安徽"), { date: null, ip_location: "安徽" });
  assert.deepEqual(parseCommentTime("7天前广东"), { date: null, ip_location: "广东" });
  assert.deepEqual(parseCommentTime("昨天美国"), { date: null, ip_location: "美国" });
  assert.deepEqual(parseCommentTime("刚刚加拿大"), { date: null, ip_location: "加拿大" });
  assert.deepEqual(parseCommentTime("3小时前美国"), { date: null, ip_location: "美国" });
});

test("相对时间剥完是北美的，必须能过地域过滤", () => {
  assert.equal(isTargetRegion(parseCommentTime("5天前美国").ip_location), true);
  assert.equal(isTargetRegion(parseCommentTime("5天前安徽").ip_location), false);
});

test("只有相对时间没有属地", () => {
  assert.deepEqual(parseCommentTime("昨天"), { date: null, ip_location: null });
});

// 2026-08-13 实测：当天发的评论显示 HH:MM 而不是 MM-DD，出现「04:26广东」。
// 这是同一个坑第二次踩到 —— 时间前缀写法不止一种。
test("当天评论用时刻，同样要剥掉", () => {
  assert.deepEqual(parseCommentTime("04:26广东"), { date: null, ip_location: "广东" });
  assert.deepEqual(parseCommentTime("4:26美国"), { date: null, ip_location: "美国" });
  assert.deepEqual(parseCommentTime("23:59加拿大"), { date: null, ip_location: "加拿大" });
  assert.deepEqual(parseCommentTime("04:26"), { date: null, ip_location: null });
});

test("三种时间写法剥完，北美都要能过地域过滤", () => {
  for (const raw of ["03-02美国", "5天前美国", "04:26美国", "美国"]) {
    assert.equal(isTargetRegion(parseCommentTime(raw).ip_location), true, raw);
  }
});

test("北美是目标市场，中国各省不是", () => {
  assert.equal(isTargetRegion("美国"), true);
  assert.equal(isTargetRegion("加拿大"), true);
  assert.equal(isTargetRegion("广东"), false);
  assert.equal(isTargetRegion("北京"), false);
  assert.equal(isTargetRegion("陕西"), false);
});

test("属地未知时放行 —— 宁可多花一次主页访问，不可漏掉北美客户", () => {
  assert.equal(isTargetRegion(null), true);
  assert.equal(isTargetRegion(""), true);
});
