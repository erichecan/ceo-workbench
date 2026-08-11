/**
 * AI 调用层：一个 ask()，三种 provider。
 *
 * 默认 provider=cli，也就是 headless `claude -p`。为什么默认是它：
 * 它走 Claude Code 的订阅额度，**不产生 API 费用**；换成 anthropic/gemini
 * 就是按 token 真金白银计费。businessskills 近期几个 commit
 * （9a97876、671c06c）全在压这条链路的成本，这里沿用同一套参数。
 *
 * 两个抄自现有代码的关键做法：
 *  1. `--disallowedTools` + 空 cwd  —— 见 scripts/headless_cli.py。
 *     prompt 是自包含的，模型不需要任何工具；不禁掉它会去「找路」，
 *     每多一轮工具往返就多重写一次缓存。实测固定开销 46k → 38.7k token。
 *  2. 额度三分类           —— 见 scripts/claude_limits.py。
 *     weekly 立刻停手（要等到重置日，熬着纯空转），session/rate 才值得等。
 *     2026-08-10 曾因不分类而全天 112 次调用、0 产出。
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { config, sleep } from "./config.js";

const execFileAsync = promisify(execFile);

export const WEEKLY = "weekly";
export const SESSION = "session";
export const RATE = "rate";

// ⛔ 判定顺序即优先级，不能调换：weekly 和 session 的提示都带 "resets N am"，
//    泛匹配放前面会把 weekly 误判成 session，于是继续熬 5 小时。
const PATTERNS = [
  [WEEKLY, /weekly\s+limit|weekly\s+usage|limit.{0,20}\bthis\s+week\b/i],
  [SESSION, /session\s+limit|5[-\s]?hour\s+limit/i],
  [RATE, /\brate.?limit|\b429\b|too\s+many\s+requests|overloaded/i],
  // 兜底：只说「额度用完，X 点重置」没说窗口。归 SESSION（继续等）是保守选择——
  // 误等的代价是浪费半小时，误停的代价是当天不再产出。
  [SESSION, /usage\s+limit|hit\s+your\s+limit|resets?\s+\d+\s*(am|pm)/i],
];

export function classifyLimit(...texts) {
  const blob = texts.filter(Boolean).join("\n");
  if (!blob) return null;
  for (const [kind, re] of PATTERNS) if (re.test(blob)) return kind;
  return null;
}

const DISALLOWED = [
  "Bash", "Read", "Write", "Edit", "Glob", "Grep",
  "WebFetch", "WebSearch", "Task", "TodoWrite", "NotebookEdit",
].join(",");

/** 空工作目录：跳过项目 CLAUDE.md 与 skills 的自动发现，省掉一截固定 token。 */
function bareCwd() {
  const dir = path.join(os.homedir(), ".claude", "headless-cwd");
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return os.homedir(); // 建不出来就退回 home，宁可多花 token 也不能崩
  }
}

async function askCli(prompt) {
  if (!fs.existsSync(config.claudeCliPath)) {
    throw new Error(
      `找不到 claude CLI：${config.claudeCliPath}\n` +
        `装在别处的话，在 .env 里设 CLAUDE_CLI_PATH，或改用 AI_PROVIDER=anthropic`
    );
  }
  const { stdout, stderr } = await execFileAsync(
    config.claudeCliPath,
    ["--disallowedTools", DISALLOWED, "-p", prompt],
    { cwd: bareCwd(), timeout: 600000, maxBuffer: 32 * 1024 * 1024 }
  ).catch((e) => ({ stdout: e.stdout || "", stderr: e.stderr || String(e) }));

  // CLI 把额度提示当正常输出打到 stdout，returncode 仍是 0 —— 两个流都要看。
  const kind = classifyLimit(stdout, stderr);
  if (kind) throw Object.assign(new Error(`撞额度（${kind}）`), { limit: kind });
  const out = (stdout || "").trim();
  if (!out) throw new Error(`claude 无输出：${(stderr || "").slice(0, 300)}`);
  return out;
}

async function askAnthropic(prompt) {
  if (!config.anthropicKey) throw new Error("缺 ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status === 429) throw Object.assign(new Error("429"), { limit: RATE });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.content.find((c) => c.type === "text")?.text?.trim() || "";
}

async function askGemini(prompt) {
  if (!config.geminiKey) throw new Error("缺 GEMINI_API_KEY");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${config.geminiModel}:generateContent?key=${config.geminiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (res.status === 429) throw Object.assign(new Error("429"), { limit: RATE });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
}

const PROVIDERS = { cli: askCli, anthropic: askAnthropic, gemini: askGemini };

/**
 * 问一次模型，带额度退避。
 * weekly 直接抛出（调用方应停整轮），session/rate 等 30 分钟重试。
 */
export async function ask(prompt, { retries = 1, limitWait = 30 * 60 * 1000, maxLimitWait = 5 * 3600 * 1000 } = {}) {
  const fn = PROVIDERS[config.provider];
  if (!fn) throw new Error(`未知 AI_PROVIDER=${config.provider}（可选 cli / anthropic / gemini）`);

  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(prompt);
    } catch (e) {
      if (e.limit === WEEKLY) throw e; // 等到重置日才回来，熬着是空转
      if (e.limit) {
        if (waited + limitWait > maxLimitWait) throw e;
        waited += limitWait;
        console.log(`   ⏳ 撞额度（${e.limit}），等 ${limitWait / 60000} 分钟后重试`);
        await sleep(limitWait);
        attempt--; // 等额度不算失败，不消耗重试次数
        continue;
      }
      if (attempt >= retries) throw e;
      console.log(`   ⚠️ 第 ${attempt + 1} 次失败：${e.message.slice(0, 120)}`);
      await sleep(45000);
    }
  }
}

/** 模型偶尔在 JSON 外裹解释或代码块，兜住这两种。解不出返回 null。 */
export function parseJson(text) {
  if (!text) return null;
  const stripped = text.replace(/^```(?:json)?/gm, "").replace(/```$/gm, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const m = stripped.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
