/**
 * opencli 调用层。项目 CLAUDE.md 写死：小红书强制走 opencli，
 * 不用 Playwright / chrome-devtools-mcp —— 那些起的是独立 user-data-dir 的
 * 干净实例，登录态每次都要重新扫码；opencli 附着到日常那个 Chrome。
 *
 * 只调 read 命令。publish / follow / unfollow / ask 是 write 命令，
 * 本项目一律不碰 —— 见 docs/20260812-咨询式获客产线-design.md 第八节。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ⛔ 判定顺序即优先级，不能调换：未登录时列表也是空的，会同时命中
//    AUTH_REQUIRED 和 no data。泛匹配放前面会把登录失效误判成正常空结果，
//    于是整轮静默跑空 —— 而「抓到 0 条」和「本来就没有」长得一模一样。
const PATTERNS = [
  ["auth", /AUTH_REQUIRED|需要登录|not logged in|login required/i],
  ["risk", /安全验证|滑动验证|验证码|captcha|risk.?control/i],
  ["empty", /EMPTY_RESULT|returned no data|没有公开笔记/i],
];

export function classifyError(text) {
  if (!text) return null;
  for (const [kind, re] of PATTERNS) if (re.test(text)) return kind;
  return null;
}

export class OpencliError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
    this.risk = kind === "risk" || kind === "auth"; // 两者都要求停整轮
  }
}

/**
 * 跑一条 opencli 小红书只读命令，返回解析好的 JSON。
 * 失败时抛 OpencliError，调用方按 .kind 决定停整轮还是继续。
 */
export async function run(cmd, args = [], { timeout = 180000 } = {}) {
  const argv = ["xiaohongshu", cmd, ...args.map(String), "-f", "json"];
  const { stdout, stderr } = await execFileAsync("opencli", argv, {
    timeout,
    maxBuffer: 32 * 1024 * 1024,
  }).catch((e) => ({ stdout: e.stdout || "", stderr: e.stderr || String(e) }));

  // opencli 把结构化错误打到 stdout（ok: false / code: ...），退出码不一定非零，两个流都要看。
  const kind = classifyError(`${stdout}\n${stderr}`);
  if (kind) throw new OpencliError(`opencli ${cmd} 失败（${kind}）`, kind);

  const text = (stdout || "").trim();
  if (!text) throw new OpencliError(`opencli ${cmd} 无输出：${String(stderr).slice(0, 200)}`, null);
  try {
    return JSON.parse(text);
  } catch {
    throw new OpencliError(`opencli ${cmd} 输出不是 JSON：${text.slice(0, 200)}`, null);
  }
}

/** doctor 用：daemon 和扩展是否就绪。 */
export async function alive() {
  try {
    const { stdout } = await execFileAsync("opencli", ["doctor"], { timeout: 30000 });
    return /Everything looks good|\[OK\] Connectivity/i.test(stdout);
  } catch {
    return false;
  }
}

export const OPENCLI_HINT = `opencli 不可用。检查：
  opencli doctor                              # daemon + 浏览器扩展是否 connected
  opencli xiaohongshu search 测试 --limit 1    # 真实只读命令验登录态
⚠️ opencli auth status 只做 quick check（看 cookie 存不存在），不验有效性，
   实测出现过它报 logged_in: true 但真实请求直接 AUTH_REQUIRED。只能跑真实命令。`;
