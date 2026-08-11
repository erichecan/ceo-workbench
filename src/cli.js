#!/usr/bin/env node
/**
 * 入口。子命令：
 *   scrape   抓取（--keyword 可多次，--url 可多次，默认用 config 里的词表）
 *   analyze  分析未处理的线索（--limit N）
 *   report   生成日报（--since YYYY-MM-DD，--min-score N）
 *   daily    scrape → analyze → report 一条龙
 *   list     命令行看线索（--min-score，--status）
 *   status   改跟进状态：status <id> <new|contacted|replied|won|dropped> [备注]
 *   doctor   自检：CDP Proxy 通不通、AI provider 配没配、库里有多少
 */
import * as cdp from "./cdp.js";
import { analyzePending } from "./analyzer.js";
import { config, DEFAULT_KEYWORDS, ensureDirs, jitter, today } from "./config.js";
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
  if (!(await cdp.alive())) {
    console.error(cdp.PROXY_HINT);
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
      console.log(`   ⛔ ${e.message}`);
    }
    if (i < urls.length - 1) await jitter(config.delayInPage);
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
      console.log(`   → ${r.leads.length} 条${r.note ? `（${r.note}）` : ""}`);
    } catch (e) {
      if (e.captcha) {
        console.error(`\n⛔ 触发安全验证，本轮立即终止（不重试、不换词硬撑）。`);
        console.error(`   去那个 Chrome 里手动过一次验证，隔一段时间再跑。`);
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
  console.log(`\n分析完成 ${r.ok}/${r.total}（失败 ${r.failed}）。下一步：npm run report`);
  return r.failed ? 1 : 0;
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
      `\n[${l.id}] ${l.score} 分 · ${l.demo_track} · ${l.status}${
        l.risk_flags.length ? ` · ⚠️ ${l.risk_flags.join("/")}` : ""
      }`
    );
    console.log(`     ${(l.title || l.body).slice(0, 46)}`);
    if (l.need_summary) console.log(`     需求：${l.need_summary.slice(0, 70)}`);
    if (l.first_comment) console.log(`     首评草稿：${l.first_comment}`);
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
  const proxyOk = await cdp.alive();
  console.log(`CDP Proxy   ${proxyOk ? "✅ 通" : "⛔ 不通"}  ${config.proxy}`);
  if (!proxyOk) console.log(cdp.PROXY_HINT);

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
  return proxyOk ? 0 : 1;
}

const HELP = `建站线索发现器

  npm run scrape  [-- --keyword "帮客户做网站" --url "https://..."]
  npm run analyze [-- --limit 20]
  npm run report  [-- --today --min-score 50]
  npm run daily                       # 三步一条龙
  npm run list    [-- --min-score 70 --status new]
  npm run doctor                      # 自检
  node src/cli.js status <id> contacted "已私信"

详见 README.md`;

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  const { flags, rest } = parseArgs(argv);
  switch (cmd) {
    case "scrape":
      return cmdScrape(flags);
    case "analyze":
      return cmdAnalyze(flags);
    case "report":
      return cmdReport(flags);
    case "daily": {
      const code = await cmdScrape(flags);
      if (code) return code;
      await cmdAnalyze(flags);
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
