#!/usr/bin/env node
/**
 * 入口。子命令：
 *   scrape    搜同行推广词，抓其评论区（--keyword / --url 可多次）
 *   analyze   L1 粗筛：地域过滤 + 这个人在做什么生意（--limit N）
 *   profiles  拉评论者主页笔记标题（--limit N，风控成本最高，有硬上限）
 *   diagnose  L2 生意诊断 + 生成诊断书（--limit N）
 *   report    生成日报（--since YYYY-MM-DD，--min-score N）
 *   daily     上面五步一条龙
 *   list      命令行看线索（--min-score，--status）
 *   status    改跟进状态：status <id> <new|contacted|replied|won|dropped> [备注]
 *   doctor    自检：opencli 通不通、登录态是否真的有效、provider、库存量
 */
import { analyzePending } from "./analyzer.js";
import { config, DEFAULT_KEYWORDS, ensureDirs, jitter, today } from "./config.js";
import { DIAG_DIR, writeDiagCards } from "./diagcard.js";
import { diagnosePending } from "./diagnose.js";
import * as opencli from "./opencli.js";
import { fetchProfiles } from "./profile.js";
import { generate } from "./reporter.js";
import * as scraper from "./scraper.js";
import { analyzedLeads, insertLead, open, setStatus, stats } from "./storage.js";

function parseArgs(argv) {
  const flags = { keyword: [], url: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keyword" || a === "-k") flags.keyword.push(argv[++i]);
    else if (a === "--url" || a === "-u") flags.url.push(argv[++i]);
    else if (a === "--limit") flags.limit = Number(argv[++i]);
    else if (a === "--min-score") flags.minScore = Number(argv[++i]);
    else if (a === "--since") flags.since = argv[++i];
    else if (a === "--status") flags.status = argv[++i];
    else if (a === "--today") flags.since = today();
    else rest.push(a);
  }
  return { flags, rest };
}

async function cmdScrape(flags) {
  ensureDirs();
  if (!(await opencli.alive())) {
    console.error(opencli.OPENCLI_HINT);
    return 1;
  }

  const urls = flags.url;
  let keywords = flags.keyword.length ? flags.keyword : urls.length ? [] : DEFAULT_KEYWORDS;
  if (keywords.length > config.maxKeywordsPerRun) {
    console.log(`单轮上限 ${config.maxKeywordsPerRun} 个词（反封控），截断`);
    keywords = keywords.slice(0, config.maxKeywordsPerRun);
  }

  let fresh = 0;
  let seen = 0;
  const raw = [];

  for (const [i, url] of urls.entries()) {
    console.log(`[链接 ${i + 1}/${urls.length}] ${url.slice(0, 70)}`);
    try {
      const r = await scraper.byUrl(url);
      raw.push(r);
      for (const l of r.leads) {
        if (insertLead(l)) fresh++;
        else seen++;
      }
      console.log(`   → ${r.leads.length} 条`);
    } catch (e) {
      if (e.risk) {
        console.error(`\n⛔ ${e.message}，本轮立即终止（不重试、不硬撑）。`);
        console.error(opencli.OPENCLI_HINT);
        break;
      }
      console.log(`   ⛔ ${e.message}`);
    }
    if (i < urls.length - 1) await jitter(config.delayBetweenCalls);
  }

  for (const [i, kw] of keywords.entries()) {
    console.log(`[词 ${i + 1}/${keywords.length}] ${kw}`);
    try {
      const r = await scraper.byKeyword(kw);
      raw.push(r);
      for (const l of r.leads) {
        if (insertLead(l)) fresh++;
        else seen++;
      }
      console.log(`   → ${r.notes} 篇同行笔记，${r.leads.length} 条线索`);
    } catch (e) {
      if (e.risk) {
        console.error(`\n⛔ ${e.message}，本轮立即终止（不重试、不换词硬撑）。`);
        console.error(opencli.OPENCLI_HINT);
        break;
      }
      console.log(`   ⛔ ${e.message}`);
    }
    if (i < keywords.length - 1) await jitter(config.delayBetweenKeywords);
  }

  if (raw.length) console.log(`原始数据已存 ${scraper.dumpRaw("scrape", raw)}`);
  console.log(`\n新增 ${fresh} 条，去重跳过 ${seen} 条。下一步：npm run analyze`);
  return 0;
}

async function cmdAnalyze(flags) {
  const r = await analyzePending(flags.limit || 20);
  if (!r.total) {
    console.log("没有待分析的线索。先跑 npm run scrape。");
    return 0;
  }
  console.log(
    `\n分析完成 ${r.ok}/${r.total}（非目标地区跳过 ${r.skipped}，失败 ${r.failed}）。` +
      `下一步：npm run profiles`
  );
  return r.failed ? 1 : 0;
}

async function cmdProfiles(flags) {
  if (!(await opencli.alive())) {
    console.error(opencli.OPENCLI_HINT);
    return 1;
  }
  const r = await fetchProfiles(flags.limit || config.maxProfilesPerRun);
  if (!r.total) {
    console.log("没有待抓主页的线索。先跑 npm run analyze。");
    return 0;
  }
  console.log(`\n主页抓取 ${r.ok}/${r.total}（无公开笔记 ${r.empty}，失败 ${r.failed}）`);
  return 0;
}

async function cmdDiagnose(flags) {
  const r = await diagnosePending(flags.limit || 8);
  if (!r.total) {
    console.log("没有待诊断的线索。先跑 npm run profiles。");
    return 0;
  }
  const w = writeDiagCards();
  console.log(`\n生意诊断 ${r.ok}/${r.total}（找不出瓶颈 ${r.weak}，失败 ${r.failed}）`);
  console.log(`诊断书 ${w.written} 份 → ${DIAG_DIR}`);
  console.log(`私信草稿见 npm run list —— 发送由你本人手动完成。`);
  return 0;
}

function cmdReport(flags) {
  const r = generate({ since: flags.since || null, minScore: flags.minScore ?? 0 });
  console.log(`报告已生成（${r.count} 条线索）：`);
  console.log(`  ${r.html}`);
  console.log(`  ${r.md}`);
  return 0;
}

function cmdList(flags) {
  const rows = analyzedLeads({ since: flags.since || null, minScore: flags.minScore ?? 50 }).filter(
    (l) => !flags.status || l.status === flags.status
  );
  if (!rows.length) {
    console.log("没有符合条件的线索。");
    return 0;
  }
  for (const l of rows) {
    console.log(
      `\n[${l.id}] ${l.score} 分 · ${l.product_line} · ${l.status}${
        l.risk_flags.length ? ` · ⚠️ ${l.risk_flags.join("/")}` : ""
      }`
    );
    console.log(`     @${l.author || "?"}${l.ip_location ? ` [${l.ip_location}]` : ""} ${l.body.slice(0, 40)}`);
    if (l.need_summary) console.log(`     生意：${l.need_summary.slice(0, 70)}`);
    if (l.bottleneck) console.log(`     瓶颈：${l.bottleneck}`);
    if (l.dm_draft) console.log(`     私信草稿：${l.dm_draft}`);
    else if (l.dm_angle) console.log(`     私信切入：${l.dm_angle}`);
    if (l.diag_slug) console.log(`     诊断书：${l.diag_slug}.html`);
    if (l.url) console.log(`     ${l.url}`);
  }
  console.log(`\n共 ${rows.length} 条。改状态：node src/cli.js status <id> contacted "备注"`);
  return 0;
}

function cmdStatus(rest) {
  const [id, status, ...note] = rest;
  if (!id || !status) {
    console.error("用法：node src/cli.js status <id> <new|contacted|replied|won|dropped> [备注]");
    return 1;
  }
  const ok = setStatus(Number(id), status, note.join(" ") || null);
  console.log(ok ? `[${id}] → ${status}` : `找不到 id=${id}`);
  return ok ? 0 : 1;
}

async function cmdDoctor() {
  const cliOk = await opencli.alive();
  console.log(`opencli     ${cliOk ? "✅ 通" : "⛔ 不通"}`);
  if (!cliOk) console.log(opencli.OPENCLI_HINT);

  // ⚠️ 不能用 opencli auth status —— 它只 quick check cookie 存不存在，
  //    不验有效性。项目 CLAUDE.md 记录过它报 logged_in: true 而真实请求
  //    直接 AUTH_REQUIRED。自检报绿、产线跑空，是最坏的一种失败。
  if (cliOk) {
    try {
      await opencli.run("search", ["测试", "--limit", 1]);
      console.log(`小红书登录  ✅ 有效（已用真实只读命令验证）`);
    } catch (e) {
      console.log(
        `小红书登录  ⛔ ${e.kind === "auth" ? "已失效 —— 跑 opencli xiaohongshu login 扫码" : e.message}`
      );
    }
  }

  const key = { cli: "订阅额度，零 API 费用", anthropic: config.anthropicKey, gemini: config.geminiKey };
  const v = key[config.provider];
  console.log(
    `AI provider ${v ? "✅" : "⛔"} ${config.provider}` +
      (config.provider === "cli" ? `（${v}；CLI: ${config.claudeCliPath}）` : v ? "（已配 key）" : "（缺 key，见 .env.example）")
  );

  open();
  const s = stats();
  console.log(`数据库      ✅ ${s.leads} 条线索 / ${s.analyzed} 条已分析 / ${s.qualified} 条值得联系`);
  if (s.byStatus.length) console.log(`            ${s.byStatus.map((r) => `${r.status}:${r.n}`).join("  ")}`);
  return cliOk ? 0 : 1;
}

const HELP = `咨询式获客产线 —— 挖同行评论区，判断生意缺什么，出诊断书

  npm run scrape   [-- --keyword "帮客户做网站" --url "https://..."]
                   # 搜同行推广词，抓其评论区
  npm run analyze  [-- --limit 20]     # L1 粗筛：地域过滤 + 是什么生意
  npm run profiles [-- --limit 8]      # 拉评论者主页（风控成本最高，有硬上限）
  npm run diagnose [-- --limit 8]      # L2 生意诊断 + 出诊断书
  npm run report   [-- --today --min-score 50]
  npm run daily                        # 五步一条龙
  npm run list     [-- --min-score 70 --status new]
  npm run doctor                       # 自检（含真实只读命令验登录态）
  node src/cli.js status <id> contacted "已私信"

⛔ 私信永不代发。草稿由你本人点发送。

详见 README.md`;

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  const { flags, rest } = parseArgs(argv);
  switch (cmd) {
    case "scrape":
      return cmdScrape(flags);
    case "analyze":
      return cmdAnalyze(flags);
    case "profiles":
      return cmdProfiles(flags);
    case "diagnose":
      return cmdDiagnose(flags);
    case "report":
      return cmdReport(flags);
    case "daily": {
      const code = await cmdScrape(flags);
      if (code) return code;
      await cmdAnalyze(flags);
      await cmdProfiles(flags);
      await cmdDiagnose(flags);
      return cmdReport({ ...flags, since: flags.since || today() });
    }
    case "list":
      return cmdList(flags);
    case "status":
      return cmdStatus(rest);
    case "doctor":
      return cmdDoctor();
    default:
      console.log(HELP);
      return cmd ? 1 : 0;
  }
}

main().then(
  (code) => process.exit(code || 0),
  (e) => {
    console.error(`⛔ ${e.stack || e.message}`);
    process.exit(1);
  }
);
