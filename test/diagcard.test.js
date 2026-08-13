import { test } from "node:test";
import assert from "node:assert";
import { makeSlug, buildDiagHtml } from "../src/diagcard.js";

test("slug 用昵称加 id，可读且唯一", () => {
  assert.equal(makeSlug("Bing Fitness", 42), "bing-fitness-42");
  assert.equal(makeSlug("Bing  Fitness!!", 42), "bing-fitness-42");
});

test("纯中文昵称退化成 id，不产出空 slug", () => {
  assert.equal(makeSlug("美甲小店", 7), "lead-7");
  assert.equal(makeSlug("", 7), "lead-7");
  assert.equal(makeSlug(null, 7), "lead-7");
});

test("中英混合只留英文部分", () => {
  assert.equal(makeSlug("Bing健身工作室", 3), "bing-3");
});

test("诊断书四段齐全", () => {
  const html = buildDiagHtml(
    { author: "Bing Fitness", ip_location: "加拿大" },
    { industry: "私教工作室", business_size: "个人", online_assets: "只有 IG",
      bottleneck: "排课靠 DM 手动排", product_line: "预约系统",
      reason: "生意靠排期" });
  assert.match(html, /你的生意/);
  assert.match(html, /我看到的/);
  assert.match(html, /真正的瓶颈/);
  assert.match(html, /建议方案/);
  assert.match(html, /私教工作室/);
  assert.match(html, /排课靠 DM 手动排/);
});

test("缺失的段落整段不渲染 —— 留空壳等于告诉对方这是模板填空", () => {
  const html = buildDiagHtml({ author: "a" }, { bottleneck: "x", product_line: "官网" });
  assert.ok(!html.includes("我看到的"));
  assert.match(html, /真正的瓶颈/);
});

test("HTML 转义 —— 昵称里的尖括号不能变成标签", () => {
  const html = buildDiagHtml(
    { author: "<script>alert(1)</script>" },
    { bottleneck: "x", product_line: "官网" });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("诊断书里不出现报价和承诺 —— 这是产品定位，不是措辞偏好", () => {
  const html = buildDiagHtml({ author: "a" },
    { bottleneck: "x", product_line: "官网", reason: "y" });
  assert.ok(!/[¥$]\s*\d|保证|一定能|包过/.test(html));
});

test("自包含：无外链、无 CDN —— 对方可能在墙内打开", () => {
  const html = buildDiagHtml({ author: "a" }, { bottleneck: "x", product_line: "官网" });
  assert.ok(!/<script\s+src=|<link[^>]+href="http|@import|https?:\/\/(?!www\.w3)/.test(html));
});
