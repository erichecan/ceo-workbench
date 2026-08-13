import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { normalize, shouldSkipByRegion } from "../src/analyzer.js";

test("非北美直接跳过，不花 AI 调用", () => {
  assert.equal(shouldSkipByRegion({ ip_location: "广东" }), true);
  assert.equal(shouldSkipByRegion({ ip_location: "美国" }), false);
  assert.equal(shouldSkipByRegion({ ip_location: "加拿大" }), false);
  assert.equal(shouldSkipByRegion({ ip_location: null }), false);
});

test("产品线不在枚举内时落到「官网」而不是编一个", () => {
  assert.equal(normalize({ score: 70, product_line: "区块链" }).product_line, "官网");
  assert.equal(normalize({ score: 70, product_line: "预约系统" }).product_line, "预约系统");
  assert.equal(normalize({ score: 70, product_line: "重线索" }).product_line, "重线索");
});

test("is_lead 由分数兜底 —— 模型偶尔给 30 分却标 true", () => {
  assert.equal(normalize({ score: 30, is_lead: true }).is_lead, false);
  assert.equal(normalize({ score: 60, is_lead: true }).is_lead, true);
  assert.equal(normalize({ score: 60, is_lead: false }).is_lead, false);
});

test("分数夹在 0-100", () => {
  assert.equal(normalize({ score: 999 }).score, 100);
  assert.equal(normalize({ score: -5 }).score, 0);
  assert.equal(normalize({ score: "abc" }).score, 0);
});

test("risk_flags 不是数组时归零，不让脏数据流进报告", () => {
  assert.deepEqual(normalize({ score: 10, risk_flags: "同行" }).risk_flags, []);
  assert.deepEqual(normalize({ score: 10, risk_flags: ["同行"] }).risk_flags, ["同行"]);
});

// design 第九节：绝不在同行笔记下留评论。线索现在全部来自同行的评论区，
// 留着一个产出公开评论草稿的字段，等于给自己留一个随手违规的口子。
test("不再产出公开评论草稿 —— 在同行帖下留评论既是挖墙脚也是违规", () => {
  const src = fs.readFileSync(new URL("../src/analyzer.js", import.meta.url), "utf-8");
  assert.ok(!src.includes("first_comment"), "analyzer 里不该再有 first_comment");
  // storage 里唯一允许提到它的地方是把这列删掉的那条迁移语句。
  const store = fs.readFileSync(new URL("../src/storage.js", import.meta.url), "utf-8");
  const lines = store.split("\n").filter((l) => l.includes("first_comment"));
  assert.ok(
    lines.every((l) => l.includes("DROP COLUMN")),
    `storage 里 first_comment 只应出现在 DROP COLUMN 语句中，实际：\n${lines.join("\n")}`
  );
  const rep = fs.readFileSync(new URL("../src/reporter.js", import.meta.url), "utf-8");
  assert.ok(!rep.includes("first_comment"), "reporter 里不该再有 first_comment");
});
