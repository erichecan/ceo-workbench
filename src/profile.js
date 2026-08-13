/**
 * L2 的前置：把评论者的主页笔记标题拉回来。
 *
 * 为什么值得单独一层：2026-08-12 实测账号 66deb3cc000000001d03347c，
 * 昵称叫「造梦设计师01」—— 只看昵称，L1 大概率判成设计/建站从业者；
 * 6 篇笔记标题全是追星内容（方逸伦、柳眼），实际是粉丝号，根本不是生意。
 * **昵称会骗人，笔记标题不会。**
 *
 * 反过来 README 记录的另一条实测也成立：同一条评论「我也想搭建一个网站」，
 * 给了昵称 `Bing Fitness` 后判断从「其他」变成「预约系统」。
 * 昵称能让判断变好，也能让判断变坏 —— 两边都指向同一个结论：必须看主页。
 *
 * opencli user 不返回简介和粉丝数。不为这两个字段回退 CDP —— 笔记标题
 * 已经足够判断行业，那两个只是锦上添花。
 */
import * as opencli from "./opencli.js";
import { config, jitter } from "./config.js";
import { leadsNeedingProfile, saveProfile } from "./storage.js";

/**
 * opencli user 的返回 → profile 记录。
 * 读不出任何标题就算 empty：有笔记但没标题，等于没有判断依据。
 */
export function toProfile(rows, lead) {
  const titles = (rows || []).map((r) => String(r.title || "").trim()).filter(Boolean);
  return {
    user_id: lead.author_user_id,
    nickname: lead.author || null,
    profile_url: lead.profile_url || null,
    recent_notes: titles,
    status: titles.length ? "ok" : "empty",
  };
}

/**
 * 批量抓主页。这是整条链路里风控成本最高的动作，所以有硬上限
 * （config.maxProfilesPerRun）。撞 auth/risk 立刻停整轮 —— 硬撑是把账号
 * 推向封禁的最快方式，而这个账号是本人日常在用的那个。
 */
export async function fetchProfiles(limit = config.maxProfilesPerRun) {
  const todo = leadsNeedingProfile(Math.min(limit, config.maxProfilesPerRun));
  let ok = 0;
  let empty = 0;
  let failed = 0;

  for (const [i, lead] of todo.entries()) {
    if (i) await jitter(config.delayBetweenCalls);
    const label = `[${i + 1}/${todo.length}] @${lead.author}`;
    try {
      const rows = await opencli.run("user", [lead.author_user_id, "--limit", 10]);
      const p = toProfile(rows, lead);
      saveProfile(p);
      if (p.status === "ok") {
        ok++;
        console.log(`${label} → ${p.recent_notes.length} 篇笔记`);
      } else {
        empty++;
        console.log(`${label} → 无可读标题`);
      }
    } catch (e) {
      // EMPTY_RESULT 是业务常态（销号/私密/全删），不是失败也不重试 ——
      // 重试改变不了对方的隐私设置。留痕是为了不反复去撞同一个空账号。
      if (e.kind === "empty") {
        saveProfile(toProfile([], lead));
        empty++;
        console.log(`${label} → 无公开笔记（不重试）`);
        continue;
      }
      if (e.risk) {
        console.log(`\n⛔ ${e.message}，本轮立即终止（不重试、不硬撑）。已完成 ${ok} 个。`);
        break;
      }
      failed++;
      console.log(`${label} → ⚠️ ${e.message.slice(0, 100)}`);
    }
  }
  return { ok, empty, failed, total: todo.length };
}
