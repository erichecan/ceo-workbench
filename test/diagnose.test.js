import { test } from "node:test";
import assert from "node:assert";
import { normalizeDiagnosis } from "../src/diagnose.js";

test("重线索标记出来，不走 48h 产线", () => {
  const d = normalizeDiagnosis({ product_line: "重线索", industry: "连锁超市", bottleneck: "x" });
  assert.equal(d.is_heavy, true);
  assert.equal(d.product_line, "重线索");
});

test("普通产品线不是重线索", () => {
  assert.equal(normalizeDiagnosis({ product_line: "预约系统", bottleneck: "x" }).is_heavy, false);
});

test("产品线不在枚举内落到官网", () => {
  assert.equal(normalizeDiagnosis({ product_line: "元宇宙", bottleneck: "x" }).product_line, "官网");
});

test("瓶颈缺失时不算有效诊断 —— 诊断书的核心就是这一行", () => {
  assert.equal(normalizeDiagnosis({ product_line: "官网", bottleneck: "" }).valid, false);
  assert.equal(normalizeDiagnosis({ product_line: "官网", bottleneck: "   " }).valid, false);
  assert.equal(normalizeDiagnosis({ product_line: "官网", bottleneck: "排课靠 DM 手动排" }).valid, true);
});

test("字段缺失不炸", () => {
  const d = normalizeDiagnosis({});
  assert.equal(d.industry, "");
  assert.equal(d.valid, false);
  assert.equal(d.product_line, "官网");
});

// 重线索卡的是第二步（做 demo），不是第一步（诊断书）。诊断书成本 10 分钟，
// 而重线索客单价最高 —— 更该发。is_heavy 只用来把它从 48h 产线里挑出来走人工。
test("重线索照样出诊断书，只是标记出来走人工跟进", () => {
  const d = normalizeDiagnosis({ product_line: "重线索", bottleneck: "库存和门店对不上" });
  assert.equal(d.is_heavy, true);
  assert.equal(d.valid, true);
});
