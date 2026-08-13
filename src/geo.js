/**
 * 评论时间戳的解析与地域判定。
 *
 * opencli `comments` 的 time 字段实测长这样：「03-02美国」「02-28广东」。
 * 属地是白捡的 —— 不必抓主页就能知道对方在哪，所以地域过滤能放在 L1
 * 这一层做掉，把 L2 的主页访问配额全留给北美 IP 的人。
 */

const DATE_RE = /^((?:\d{4}-)?\d{2}-\d{2})/;

/**
 * 时间前缀有三种写法，属地跟在后面。三种都得剥，否则属地判不出来。
 *
 * 实测踩到两次，都是同一个形状的坑：
 *   2026-08-12  「5天前安徽」「7天前广东」—— 相对时间
 *   2026-08-13  「04:26广东」           —— 当天评论显示 HH:MM 而非 MM-DD
 * 漏掉任何一种，对应的「…美国」就判不出是北美，直接丢掉一个真客户。
 * 加新格式时先想清楚：漏判的代价是静默的，报表上只会少一条，不会报错。
 */
const RELATIVE_RE = /^(刚刚|今天|昨天|前天|\d+\s*(?:分钟|小时|天|周|个月)前)/;
const CLOCK_RE = /^(\d{1,2}:\d{2})/;

/** 「03-02美国」→ { date: "03-02", ip_location: "美国" }；相对时间与时刻同样剥离。 */
export function parseCommentTime(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { date: null, ip_location: null };

  const abs = s.match(DATE_RE);
  if (abs) return { date: abs[1], ip_location: s.slice(abs[1].length).trim() || null };

  // 当天的评论没有日期，只有时刻 —— date 留 null，日期信息本来就不在这串里。
  for (const re of [RELATIVE_RE, CLOCK_RE]) {
    const m = s.match(re);
    if (m) return { date: null, ip_location: s.slice(m[1].length).trim() || null };
  }

  return { date: null, ip_location: s };
}

/**
 * 目标市场：北美。
 *
 * 属地为空时返回 true —— 这是刻意的不对称。漏掉一个北美客户的代价，
 * 远高于对一个属地未知的人多花一次主页访问。
 */
const TARGET = new Set(["美国", "加拿大"]);
export const isTargetRegion = (loc) => !loc || TARGET.has(String(loc).trim());
