/**
 * L2：生意诊断。吃 L1 的评论 + 主页笔记标题，产出诊断书需要的四段内容。
 *
 * 这一层是整条产线的差异化所在。同行只会报价和说自己技术好；这里做的是
 * 在对方付钱之前先把他的生意看一遍。所以 prompt 里最硬的一条要求是：
 * bottleneck 必须和「他自己以为的需求」不同 —— 他自己就知道他没网站，
 * 不需要我们告诉他。找不出这样一条就留空，宁可不发。
 *
 * 分析决定卖什么，不只是怎么卖：同行只能卖网站（一锤子），这里识别出
 * 这家健身房真正缺的是在线约课，就是预约系统 —— 客单价高一档，能收月费。
 */
import { ask, parseJson } from "./ai.js";
import { config, PRODUCT_LINES } from "./config.js";
import { getProfile, leadsNeedingDiagnosis, saveDiagnosis } from "./storage.js";

const RULE = `你是给建站/系统服务商做售前诊断的顾问。

下面这个人在**同行建站服务商的推广笔记下面**留了言，所以他有购买意向。
你的任务不是判断他要不要网站 —— 而是看清他在做什么生意，然后判断
那门生意**真正缺的是什么**。

产品线只能从这里选一个：
${PRODUCT_LINES.map((t) => `- ${t}`).join("\n")}

  官网      —— 只需要一个能被搜到、能展示的站
  预约系统  —— 生意靠排期（健身、美业、诊所、教育、上门服务）
  会员积分  —— 生意靠回头客（餐饮、零售、美业）
  重线索    —— 需要 CRM / ERP / 对接现有流程

⛔ 最硬的一条：bottleneck 必须**和他自己以为的需求不同**。
他自己就知道他没网站，不需要我们告诉他。要写的是他没意识到的那个 ——
比如「不是没网站，是排课占掉你每天 1 小时」。
如果看完资料确实找不出这样一条，bottleneck 留空，不要硬编。

⛔ 判断必须有依据。行业、规模、现有线上资产，都要能从昵称、评论原文或
主页笔记标题里找到出处。找不到就留空，不要猜。主页笔记与生意无关时
（比如全是追星、日常），说明这不是个生意号，industry 留空。

⛔ dm_draft 是私信第一句的草稿，由本人手动发送（本工具绝不代发）：
- 先具体回应他说的那件事，不许通用到换个人也能用
- ≤ 60 字，口语，像人随手打的
- 不承诺结果、不报价、不留联系方式、不出现身份头衔
- 不伪装成普通用户、不假装自己也遇到同样问题

只输出一个 JSON 对象，不要代码块、不要解释文字：
{
  "industry": "<具体行业，如「私教工作室」。看不出就留空>",
  "business_size": "<个人 / 单店 / 多店 / 公司。看不出就留空>",
  "online_assets": "<他现在有什么线上资产。看不出就留空>",
  "bottleneck": "<他没意识到的那个真正瓶颈。找不出就留空>",
  "product_line": "<从上面四个里选一个>",
  "reason": "<为什么是这条产品线，一句话>",
  "dm_draft": "<私信第一句草稿>"
}`;

function buildPrompt(lead, profile) {
  const notes = (profile?.recent_notes || []).slice(0, 10);
  return `${RULE}

---
昵称：${lead.author || "(无)"}
IP 属地：${lead.ip_location || "(未知)"}
他留言的那篇同行笔记：${lead.title || "(无标题)"}

他说的话：
${(lead.body || "").slice(0, 1500)}

他主页最近的笔记标题：
${notes.length ? notes.map((t) => `- ${t}`).join("\n") : "(无公开笔记)"}`;
}

export function normalizeDiagnosis(raw) {
  const line = PRODUCT_LINES.includes(raw.product_line) ? raw.product_line : "官网";
  const bottleneck = String(raw.bottleneck || "").trim();
  return {
    industry: String(raw.industry || "").trim(),
    business_size: String(raw.business_size || "").trim(),
    online_assets: String(raw.online_assets || "").trim(),
    bottleneck,
    product_line: line,
    reason: String(raw.reason || "").trim(),
    dm_draft: String(raw.dm_draft || "").trim(),
    // 重线索卡的是第二步（做 demo），不是第一步（诊断书）。诊断书成本 10 分钟，
    // 而重线索客单价最高 —— 更该发。这个标记只用来把它挑出来走人工跟进。
    is_heavy: line === "重线索",
    // 瓶颈是诊断书的核心那一行。没有它，这份诊断和同行的报价单没区别。
    valid: bottleneck.length > 0,
    model: `${config.provider}:${config.provider === "gemini" ? config.geminiModel : config.anthropicModel}`,
  };
}

export async function diagnoseOne(lead, profile) {
  const raw = parseJson(await ask(buildPrompt(lead, profile)));
  return raw ? normalizeDiagnosis(raw) : null;
}

export async function diagnosePending(limit = 8) {
  const todo = leadsNeedingDiagnosis(limit);
  if (!todo.length) return { ok: 0, weak: 0, failed: 0, total: 0 };

  let ok = 0;
  let weak = 0;
  let failed = 0;

  for (const [i, lead] of todo.entries()) {
    const label = `[${i + 1}/${todo.length}] @${lead.author}`;
    try {
      const d = await diagnoseOne(lead, getProfile(lead.author_user_id));
      if (!d) {
        failed++;
        console.log(`${label} → ⚠️ 模型输出解析不出 JSON`);
        continue;
      }
      saveDiagnosis(lead.id, { ...d, user_id: lead.author_user_id });
      if (d.valid) {
        ok++;
        console.log(
          `${label} → ✅ ${d.industry || "行业未知"} · ${d.product_line}${d.is_heavy ? "（重线索，走人工）" : ""}`
        );
      } else {
        weak++;
        console.log(`${label} → · 找不出瓶颈，不出诊断书`);
      }
    } catch (e) {
      failed++;
      // 撞周额度直接停整轮 —— 等到重置日才回来，继续跑只是空转。
      if (e.limit === "weekly") {
        console.log(`\n⛔ 撞【周额度】上限，重置前再试都是空转，停手。已完成 ${ok} 条。`);
        break;
      }
      console.log(`${label} → ⚠️ ${e.message.slice(0, 120)}`);
    }
  }
  return { ok, weak, failed, total: todo.length };
}
