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

  // ⛔ 反封控参数。走 opencli 后浏览器节奏由适配器管理，但**命令调用频率
  //    仍然是我们的责任** —— 而且这个账号是本人日常在用的那个，不是小号。
  //    触发「安全验证」时正确做法是立刻停整轮，不重试、不换词硬撑。
  maxKeywordsPerRun: num("MAX_KEYWORDS_PER_RUN", 5),
  notesPerKeyword: num("NOTES_PER_KEYWORD", 3),
  commentsPerNote: num("COMMENTS_PER_NOTE", 30),
  // 超过这个赞数的不是同行推广帖，是爆款讨论帖 —— 评论区没有客户。
  // 实测推广帖 6–36 赞，混进来的噪音帖 250–4597 赞，200 这条线中间很空。
  maxNoteLikes: num("MAX_NOTE_LIKES", 200),
  delayBetweenKeywords: [
    num("DELAY_BETWEEN_KEYWORDS_MIN", 45) * 1000,
    num("DELAY_BETWEEN_KEYWORDS_MAX", 90) * 1000,
  ],
  delayBetweenCalls: [
    num("DELAY_BETWEEN_CALLS_MIN", 20) * 1000,
    num("DELAY_BETWEEN_CALLS_MAX", 45) * 1000,
  ],
  // 主页访问是整条链路里风控成本最高的动作，单独立一个更紧的上限。
  maxProfilesPerRun: num("MAX_PROFILES_PER_RUN", 8),
};

/**
 * 默认搜索词 = **同行推广词**，不是需求词。
 *
 * 转向的理由：在同行推广帖下留言的人，购买意向已经默认存在，而且多半
 * 正在比价 —— 比满世界找「我想做网站」这种零散喊话精准得多。
 * 旧口径（需求词）的实测命中率：31 条线索里只有 2 条值得联系，6%。
 * 2026-08-12 实测「帮客户做网站」搜索结果前 3 条全是同行推广帖。
 */
export const DEFAULT_KEYWORDS = [
  "帮客户做网站",
  "北美 建站服务",
  "海外华人 建站",
  "帮商家做网站",
  "独立站搭建服务",
];

/**
 * 产品线枚举。模型必须从这里选 —— 自由发挥的分类没法聚合成看板。
 * 行业不做枚举（长尾，聚合不了也没必要），由模型自由填。
 *
 * 「重线索」= CRM/ERP/定制系统：客单价最高，但要对接对方现有流程，
 * 48 小时出不了 demo，所以标记出来单独排队，不走 48h 产线。
 */
export const PRODUCT_LINES = ["官网", "预约系统", "会员积分", "重线索"];

export function ensureDirs() {
  for (const d of [DATA_DIR, REPORTS_DIR, RAW_DIR, SHOT_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = ([lo, hi]) => sleep(lo + Math.random() * (hi - lo));
export const today = () => new Date().toISOString().slice(0, 10);
