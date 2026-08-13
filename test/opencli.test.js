import { test } from "node:test";
import assert from "node:assert";
import { classifyError } from "../src/opencli.js";

test("EMPTY_RESULT 是业务情况不是风控", () => {
  assert.equal(classifyError("code: EMPTY_RESULT\nmessage: returned no data"), "empty");
});

test("AUTH_REQUIRED 归为登录失效", () => {
  assert.equal(classifyError("error: AUTH_REQUIRED"), "auth");
  assert.equal(classifyError("需要登录后才能访问"), "auth");
});

test("安全验证归为风控，调用方必须停整轮", () => {
  assert.equal(classifyError("触发安全验证，请滑动验证"), "risk");
  assert.equal(classifyError("captcha detected"), "risk");
});

test("普通错误不误判成风控", () => {
  assert.equal(classifyError("ETIMEDOUT connect failed"), null);
  assert.equal(classifyError(""), null);
  assert.equal(classifyError(null), null);
});

test("auth 优先于 empty —— 未登录时列表也是空的，会同时命中两个词", () => {
  assert.equal(classifyError("AUTH_REQUIRED: returned no data"), "auth");
});
