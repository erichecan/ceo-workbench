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
import { config, DEMO_TRACKS } from "./config.js";
import { pendingLeads, saveAnalysis } from "./storage.js";

const SCORING_RULE = `评分规则（严格执行，不要自由发挥）：

90-100  本人明确在找人做网站，且给了可落地的细节（行业 / 预算 / 时间 / 参考站点）
70-89   本人明确表达了建站需求或对现有网站不满，但细节不全
50-69   有相关需求的苗头（在问怎么做、比较工具、抱怨没有官网），但没说要外包
30-49   话题相关，本人没有需求（在分享经验、看热闹、替别人问）
15-29   招聘帖 / 求职帖 / 课程广告 —— 话题撞上了，但不是买方
0-14    同行或建站服务商的自我推广（在拉客、晒案例、发报价）—— 这是竞争对手不是客户

硬约束：
- is_lead 只有 score >= 50 时才能是 true。
- 判断依据必须能在原文里找到。evidence 必须逐字引用原文的一句话，不许改写、
  不许总结。找不到可引用的原句，说明依据不足，score 不得高于 40。
- ⛔ 不许因为「拿不准」就给中间分。拿不准时按更低的那一档给，并在
  risk_flags 里写 "信息不足"。宁可漏掉一条，不要让人白花时间去联系。`;

const FOLLOWUP_RULE = `跟进话术的硬要求：

first_comment 是**公开评论区的第一句话**，由本人手动发送（本工具绝不代发）。
dm_angle 是**私信第一句的切入角度**，同样由本人发送。

两者都必须：
- 先具体回应对方说的那件事（引一个他提到的细节），不许通用到换个帖子也能用
- ≤ 50 字，口语，像人随手回的
- 不承诺结果（「保证」「一定能」「包过」），不报价，不留联系方式
- 不出现身份头衔（资深 / 专家 / 十年经验 / 前某某）
- 不伪装成普通用户、不假装自己也遇到了同样的问题 —— 说话的人就是服务提供者本人`;

function buildPrompt(lead) {
  const kind = lead.source === "note" ? "一篇小红书笔记" : "小红书笔记下的一条评论";
  return `你是给独立建站服务商做线索筛选的分析员。目标客户是**在北美、需要做网站的人**
（华人商家、留学生创业者、本地服务商、想开独立站的卖家等）。

下面是${kind}。判断发这段话的人是不是潜在客户，只输出 JSON。

${SCORING_RULE}

demo_track 必须从这个列表里选一个，不许自创：
${DEMO_TRACKS.map((t) => `- ${t}`).join("\n")}

选 demo_track 时**要看作者昵称**。小红书商家号的昵称经常直接写明行业
（「XX Fitness」是健身房、「XX 甲油胶」是美甲、「XX 地产」是经纪），
正文没提行业时，昵称往往是唯一的线索。但昵称只是线索不是确证：
昵称看不出行业、或与正文明显冲突时，才选「其他」。

${FOLLOWUP_RULE}

输出要求（严格遵守）：只输出一个 JSON 对象，不要代码块、不要任何解释文字。
{
  "score": <0-100 整数>,
  "is_lead": <true|false>,
  "need_summary": "<一段话说清这个人要什么、卡在哪。没有需求就写「无建站需求」>",
  "demo_track": "<从上面列表里选一个>",
  "demo_pitch": "<针对这个人做什么样的 demo 最能打动他：做哪几个页面、突出什么。两三句话。is_lead 为 false 时留空>",
  "first_comment": "<公开评论区第一句的草稿。is_lead 为 false 时留空>",
  "dm_angle": "<私信第一句的切入角度。is_lead 为 false 时留空>",
  "evidence": "<逐字引用原文里最能支撑这个判断的一句话>",
  "risk_flags": [<可选，从 "同行" "招聘" "广告" "信息不足" "疑似过期" 里挑，没有就空数组>]
}

---
${lead.author ? `作者昵称：${lead.author}\n` : ""}${lead.title ? `所在笔记标题：${lead.title}\n` : ""}${
    lead.keyword ? `搜索词：${lead.keyword}\n` : ""
  }${lead.likes != null ? `点赞：${lead.likes}\n` : ""}${
    lead.published_at ? `发布日期：${lead.published_at}\n` : ""
  }
正文：
${(lead.body || "").slice(0, 3000)}`;
}

function normalize(raw) {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
  const track = DEMO_TRACKS.includes(raw.demo_track) ? raw.demo_track : "其他";
  // is_lead 由分数兜底判定 —— 模型偶尔会给 30 分却标 true，
  // 让它自相矛盾地流进报告，等于让人去联系一个已经被判低分的人。
  return {
    ...raw,
    score,
    demo_track: track,
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
  if (!todo.length) return { ok: 0, failed: 0, total: 0 };

  let ok = 0;
  let failed = 0;
  for (const [i, lead] of todo.entries()) {
    const label = `[${i + 1}/${todo.length}] ${(lead.title || lead.body).slice(0, 28)}`;
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
      console.log(`${label} → ${mark} ${result.score} 分 | ${result.demo_track}`);
    } catch (e) {
      failed++;
      if (e.limit === "weekly") {
        console.log(`\n⛔ 撞【周额度】上限，重置前再试都是空转，停手。已完成 ${ok} 条。`);
        break;
      }
      console.log(`${label} → ⚠️ ${e.message.slice(0, 120)}`);
    }
  }
  return { ok, failed, total: todo.length };
}
