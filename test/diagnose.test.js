import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
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

// 这五个字段一字不改地印在发给客户看的那页纸上，所以有两条硬要求：
// 用第二人称、不含推理过程。2026-08-13 首批真实诊断两条都违反了 ——
// 「他却把力气全花在月度促销拉新上」「无员工/分店痕迹」都出现在了客户页上。
test("发给客户的字段必须用第二人称，不许出现「他」", () => {
  const src = fs.readFileSync(new URL("../src/diagnose.js", import.meta.url), "utf-8");
  assert.match(src, /一律用第二人称/, "prompt 里必须写死人称要求");
  assert.match(src, /不许出现「他」/);
});

test("business_size 限定四个词，industry 限长 —— 免得推理过程漏到客户页上", () => {
  const src = fs.readFileSync(new URL("../src/diagnose.js", import.meta.url), "utf-8");
  assert.match(src, /只填「个人」「单店」「多店」「公司」/);
  assert.match(src, /不要写你的推理过程/);
});
