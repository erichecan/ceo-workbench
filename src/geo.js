/**
 * 评论时间戳的解析与地域判定。
 *
 * opencli `comments` 的 time 字段实测长这样：「03-02美国」「02-28广东」。
 * 属地是白捡的 —— 不必抓主页就能知道对方在哪，所以地域过滤能放在 L1
 * 这一层做掉，把 L2 的主页访问配额全留给北美 IP 的人。
 */

const DATE_RE = /^((?:\d{4}-)?\d{2}-\d{2})/;

/** 「03-02美国」→ { date: "03-02", ip_location: "美国" }。 */
export function parseCommentTime(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { date: null, ip_location: null };
  const m = s.match(DATE_RE);
  if (!m) return { date: null, ip_location: s };
  const rest = s.slice(m[1].length).trim();
  return { date: m[1], ip_location: rest || null };
}

/**
 * 目标市场：北美。
 *
 * 属地为空时返回 true —— 这是刻意的不对称。漏掉一个北美客户的代价，
 * 远高于对一个属地未知的人多花一次主页访问。
 */
const TARGET = new Set(["美国", "加拿大"]);
export const isTargetRegion = (loc) => !loc || TARGET.has(String(loc).trim());
