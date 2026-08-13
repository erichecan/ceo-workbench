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

test("相对时间没有日期但可能有属地", () => {
  assert.deepEqual(parseCommentTime("昨天美国"), { date: null, ip_location: "昨天美国" });
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
