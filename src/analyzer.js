/**
 * 逐条线索的 AI 分析：是不是潜在客户 → 需求是什么 → 做什么 demo → 怎么跟进。
 *
 * 两个从 businessskills 现有实践里搬过来的约束：
 *
 * 1. **评分规则写死在 prompt 里，不让模型自由发挥**（学 auto_analyze.py 的
 *    DISPOSITION_RULE）。评分要直接决定「今天先联系谁」，每次跑的口径必须一样，
 *    否则昨天的 80 分和今天的 80 分不是一回事，排序就没有意义。
 *
 * 2. **跟进话术只出草稿，绝不自动发送**。小红书 2026-03-10《关于打击AI托管
 *    运营账号的治理公告》禁止「利用技术手段模拟真人、进行虚假互动」，
 *    2026-06-10 公告进一步禁止「通过评论区配合、账号矩阵联动人为制造口碑」，
 *    处置为降权、下架、封禁。所以这里做的是不模拟真人的那部分——读、判断、
 *    写草稿；最后点发送的必须是本人。和 scripts/xhs-comment/draft_comments.py
 *    是同一个形状。
 */
import { ask, parseJson } from "./ai.js";
import { config, PRODUCT_LINES } from "./config.js";
import { isTargetRegion } from "./geo.js";
import { pendingLeads, saveAnalysis } from "./storage.js";

/**
 * 地域过滤。放在 AI 调用之前，因为它免费而 score 要花一次调用 ——
 * 属地来自评论的 time 字段，抓取时就已经在手里了。
 */
export const shouldSkipByRegion = (lead) => !isTargetRegion(lead.ip_location);

const SCORING_RULE = `评分规则（严格执行，不要自由发挥）：

这条评论来自**同行建站服务商的推广笔记下面**。也就是说：能在那儿留言的人，
购买意向已经默认存在，而且多半正在比价。所以不要再问「他想不想做网站」——
要问的是「**他在做什么生意，那门生意缺什么**」。

90-100  能看出具体生意（行业 + 大致规模），且明确在问价 / 问周期 / 问能不能做
70-89   能看出具体生意，表达了需求但没谈到细节
50-69   有需求信号但看不出做什么生意（只说「我也想要一个」这类）
30-49   围观、评价同行、替别人问 —— 本人不是买方
15-29   招聘帖 / 求职帖 / 课程广告
0-14    另一个同行在下面抢客 —— 竞争对手不是客户

硬约束：
- is_lead 只有 score >= 50 时才能是 true。
- 判断依据必须能在原文里找到。evidence 必须逐字引用原文的一句话，不许改写、
  不许总结。找不到可引用的原句，说明依据不足，score 不得高于 40。
- ⛔ 不许因为「拿不准」就给中间分。拿不准时按更低的那一档给，并在
  risk_flags 里写 "信息不足"。宁可漏掉一条，不要让人白花时间去联系。`;

const FOLLOWUP_RULE = `跟进话术的硬要求：

dm_angle 是**私信第一句的切入角度**，由本人手动发送（本工具绝不代发）。

⛔ 不产出公开评论草稿。本产线的线索全部来自同行笔记的评论区，
在那儿留评论既是挖墙脚，又撞在小红书禁止「评论区配合」的规定上。
只走私信这一条路。

dm_angle 必须：
- 先具体回应对方说的那件事（引一个他提到的细节），不许通用到换个帖子也能用
- ≤ 50 字，口语，像人随手回的
- 不承诺结果（「保证」「一定能」「包过」），不报价，不留联系方式
- 不出现身份头衔（资深 / 专家 / 十年经验 / 前某某）
- 不伪装成普通用户、不假装自己也遇到了同样的问题 —— 说话的人就是服务提供者本人`;

function buildPrompt(lead) {
  return `你是给独立建站/系统服务商做线索筛选的分析员。目标客户是**在北美做生意的人**
（华人商家、本地服务商、留学生创业者、想开独立站的卖家等）。

下面是一条小红书评论，来自同行服务商的推广笔记下面。只输出 JSON。

${SCORING_RULE}

product_line 必须从这个列表里选一个，不许自创：
${PRODUCT_LINES.map((t) => `- ${t}`).join("\n")}

  官网      —— 只需要一个能被搜到、能展示的站
  预约系统  —— 生意靠排期（健身、美业、诊所、教育、上门服务）
  会员积分  —— 生意靠回头客（餐饮、零售、美业）
  重线索    —— 明显需要 CRM / ERP / 对接现有流程，48 小时做不出 demo

选的时候**要看作者昵称**。小红书商家号的昵称经常直接写明行业
（「XX Fitness」是健身房、「XX 甲油胶」是美甲、「XX 地产」是经纪）。
但昵称只是线索不是确证 —— 这一层拿不准很正常，主页数据会在下一层补上。

${FOLLOWUP_RULE}

输出要求（严格遵守）：只输出一个 JSON 对象，不要代码块、不要任何解释文字。
{
  "score": <0-100 整数>,
  "is_lead": <true|false>,
  "need_summary": "<一段话说清这个人在做什么生意、缺什么。看不出生意就写「看不出做什么生意」>",
  "product_line": "<从上面列表里选一个>",
  "demo_pitch": "<针对这门生意做什么样的 demo 最能打动他。两三句话。is_lead 为 false 时留空>",
  "dm_angle": "<私信第一句的切入角度。is_lead 为 false 时留空>",
  "evidence": "<逐字引用原文里最能支撑这个判断的一句话>",
  "risk_flags": [<可选，从 "同行" "招聘" "广告" "信息不足" "非目标地区" 里挑，没有就空数组>]
}

---
${lead.author ? `作者昵称：${lead.author}\n` : ""}${lead.ip_location ? `IP 属地：${lead.ip_location}\n` : ""}${
    lead.title ? `他留言的那篇同行笔记：${lead.title}\n` : ""
  }${lead.likes != null ? `这条评论的点赞：${lead.likes}\n` : ""}
他说的话：
${(lead.body || "").slice(0, 3000)}`;
}

export function normalize(raw) {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
  // 不在枚举内就落到「官网」而不是让模型编一个：自由发挥的分类没法聚合成看板。
  const line = PRODUCT_LINES.includes(raw.product_line) ? raw.product_line : "官网";
  // is_lead 由分数兜底判定 —— 模型偶尔会给 30 分却标 true，
  // 让它自相矛盾地流进报告，等于让人去联系一个已经被判低分的人。
  return {
    ...raw,
    score,
    product_line: line,
    is_lead: score >= 50 && raw.is_lead !== false,
    risk_flags: Array.isArray(raw.risk_flags) ? raw.risk_flags : [],
    model: `${config.provider}:${config.provider === "gemini" ? config.geminiModel : config.anthropicModel}`,
  };
}

/** 分析一条。返回 normalize 后的结果，解析失败返回 null。 */
export async function analyzeOne(lead) {
  const out = await ask(buildPrompt(lead));
  const raw = parseJson(out);
  if (!raw || typeof raw.score === "undefined") return null;
  return normalize(raw);
}

/**
 * 批量分析未处理的线索。
 * 撞周额度直接停整轮 —— 等到重置日才回来，继续跑只是空转。
 */
export async function analyzePending(limit = 20) {
  const todo = pendingLeads(limit);
  if (!todo.length) return { ok: 0, failed: 0, skipped: 0, total: 0 };

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  for (const [i, lead] of todo.entries()) {
    const label = `[${i + 1}/${todo.length}] ${(lead.author || "").slice(0, 14)} ${lead.body.slice(0, 24)}`;

    // 免费的过滤先做。属地抓取时就在手里，score 要花一次 AI 调用。
    if (shouldSkipByRegion(lead)) {
      saveAnalysis(
        lead.id,
        normalize({
          score: 25,
          is_lead: false,
          need_summary: `属地 ${lead.ip_location}，不在目标市场（北美）`,
          risk_flags: ["非目标地区"],
        })
      );
      skipped++;
      continue;
    }

    try {
      const result = await analyzeOne(lead);
      if (!result) {
        failed++;
        console.log(`${label} → ⚠️ 模型输出解析不出 JSON`);
        continue;
      }
      saveAnalysis(lead.id, result);
      ok++;
      const mark = result.is_lead ? "✅" : "·";
      console.log(`${label} → ${mark} ${result.score} 分 | ${result.product_line}`);
    } catch (e) {
      failed++;
      if (e.limit === "weekly") {
        console.log(`\n⛔ 撞【周额度】上限，重置前再试都是空转，停手。已完成 ${ok} 条。`);
        break;
      }
      console.log(`${label} → ⚠️ ${e.message.slice(0, 120)}`);
    }
  }
  return { ok, failed, skipped, total: todo.length };
}
