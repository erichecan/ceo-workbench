/**
 * 集中配置 + .env 加载。所有模块的常量只在这里出现一次。
 *
 * 不引 dotenv：这个项目只有一个真依赖（better-sqlite3），
 * 一个 12 行的解析器换掉一整棵依赖树是划算的。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DATA_DIR = path.join(ROOT, "data");
export const REPORTS_DIR = path.join(ROOT, "reports");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const SHOT_DIR = path.join(DATA_DIR, "screenshots");
export const DB_PATH = path.join(DATA_DIR, "leads.db");

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    // 已存在的环境变量优先：命令行 `AI_PROVIDER=gemini npm run analyze` 要能压过 .env
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnv();

const num = (key, fallback) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  provider: process.env.AI_PROVIDER || "cli",
  claudeCliPath:
    process.env.CLAUDE_CLI_PATH ||
    path.join(process.env.HOME || "", ".local", "bin", "claude"),
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-pro",

  proxy: process.env.CDP_PROXY || "http://localhost:3456",
  captureScreenshot: process.env.CAPTURE_SCREENSHOT === "1",

  // ⛔ 反封控参数。抄自 scripts/xhs-probe/probe.py 的实测值，不是拍脑袋定的：
  //    单轮 5 个词、词间随机停 45–90 秒、每词只点开 3 篇笔记。
  //    probe.py 的记录显示，触发「安全验证」后正确做法是立刻停整轮，
  //    不重试、不换词硬撑 —— 硬撑会把账号推向封禁。
  maxKeywordsPerRun: num("MAX_KEYWORDS_PER_RUN", 5),
  notesPerKeyword: num("NOTES_PER_KEYWORD", 3),
  delayBetweenKeywords: [
    num("DELAY_BETWEEN_KEYWORDS_MIN", 45) * 1000,
    num("DELAY_BETWEEN_KEYWORDS_MAX", 90) * 1000,
  ],
  delayInPage: [2000, 5000],
  pageLoadWait: 4000,
  maxCommentsPerNote: 30,
};

/** 默认搜索词。用 `--keyword` 可覆盖，长期维护建议直接改这里。 */
export const DEFAULT_KEYWORDS = [
  "帮北美客户做网站",
  "帮客户做网站",
  "需要做网站",
  "求推荐做网站",
  "找人做网站",
  "独立站搭建",
  "北美 建站",
  "海外 官网 制作",
];

/** demo 方向枚举。analyzer 必须从这里选，自由发挥的分类没法聚合成看板。 */
export const DEMO_TRACKS = [
  "餐饮门店官网",
  "电商独立站",
  "个人作品集",
  "本地服务商官网(装修/搬家/清洁)",
  "专业服务官网(律师/会计/诊所)",
  "SaaS/产品落地页",
  "预约系统",
  "品牌展示站",
  "多语言站点",
  "其他",
];

export function ensureDirs() {
  for (const d of [DATA_DIR, REPORTS_DIR, RAW_DIR, SHOT_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = ([lo, hi]) => sleep(lo + Math.random() * (hi - lo));
export const today = () => new Date().toISOString().slice(0, 10);
