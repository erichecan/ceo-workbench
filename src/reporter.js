/**
 * 每日报告：一个自包含的 HTML（无外链、无 CDN，断网也能看）+ 一份 Markdown 摘要。
 *
 * 报告的排序就是「今天先联系谁」的顺序，所以只放能支撑那个决定的信息：
 * 分数、需求、做什么 demo、第一句话怎么说、以及**引自原文的那句证据**。
 * 证据必须在场 —— 没有它，读报告的人无从判断这条是不是模型编出来的。
 */
import fs from "node:fs";
import path from "node:path";
import { REPORTS_DIR, ensureDirs, today } from "./config.js";
import { analyzedLeads, stats } from "./storage.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const tier = (score) => (score >= 90 ? "hot" : score >= 70 ? "warm" : score >= 50 ? "mild" : "cold");

function card(l) {
  const risks = l.risk_flags.map((r) => `<span class="flag">${esc(r)}</span>`).join("");
  const line = (label, value) =>
    value ? `<div class="row"><span class="k">${label}</span><p>${esc(value)}</p></div>` : "";
  return `<article class="card ${tier(l.score)}">
  <header>
    <span class="score">${l.score}</span>
    <div class="head">
      <h3>${esc(l.title || "(无标题)")}</h3>
      <div class="meta">
        <span class="track">${esc(l.product_line)}</span>
        <span>${l.source === "note" ? "笔记" : "评论"}</span>
        ${l.author ? `<span>@${esc(l.author)}</span>` : ""}
        ${l.ip_location ? `<span>${esc(l.ip_location)}</span>` : ""}
        ${l.is_heavy ? `<span class="heavy">重线索·走人工</span>` : ""}
        ${l.likes != null ? `<span>${l.likes} 赞</span>` : ""}
        ${l.keyword ? `<span>词：${esc(l.keyword)}</span>` : ""}
        <span class="status s-${esc(l.status)}">${esc(l.status)}</span>
        ${risks}
      </div>
    </div>
    ${l.url ? `<a class="open" href="${esc(l.url)}" target="_blank" rel="noreferrer">打开 ↗</a>` : ""}
  </header>
  <blockquote>${esc((l.body || "").slice(0, 260))}${(l.body || "").length > 260 ? "…" : ""}</blockquote>
  ${line("生意", [l.industry, l.business_size].filter(Boolean).join(" · ") || l.need_summary)}
  ${l.bottleneck ? `<div class="row"><span class="k">真正的瓶颈</span><p class="bn">${esc(l.bottleneck)}</p></div>` : ""}
  ${line("建议方案", [l.product_line, l.reason].filter(Boolean).join(" —— "))}
  ${line("做什么 demo", l.demo_pitch)}
  ${line("私信草稿", l.dm_draft || l.dm_angle)}
  ${l.diag_slug ? `<div class="row"><span class="k">诊断书</span><p>${esc(l.diag_slug)}.html</p></div>` : ""}
  ${l.evidence ? `<div class="row"><span class="k">原文证据</span><p class="ev">「${esc(l.evidence)}」</p></div>` : ""}
  <footer>id ${l.id} · 抓取 ${esc((l.scraped_at || "").slice(0, 16).replace("T", " "))}</footer>
</article>`;
}

const CSS = `
:root{--bg:#fbfbfa;--fg:#1a1a19;--dim:#6b6b66;--line:#e5e4e0;--card:#fff;
      --hot:#c0392b;--warm:#d68910;--mild:#7d8c3f;--cold:#9a9a95}
@media(prefers-color-scheme:dark){:root{--bg:#16161a;--fg:#e8e8e6;--dim:#9a9a95;
      --line:#2c2c32;--card:#1e1e23;--hot:#e8705f;--warm:#e5a94a;--mild:#a8bd63;--cold:#77776f}}
*{box-sizing:border-box}
body{margin:0;padding:2rem 1rem 4rem;background:var(--bg);color:var(--fg);
     font:15px/1.65 -apple-system,"PingFang SC","Helvetica Neue",sans-serif}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:1.5rem;margin:0 0 .3rem}
.sub{color:var(--dim);margin:0 0 1.5rem;font-size:.9rem}
.tally{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:2rem}
.tally div{background:var(--card);border:1px solid var(--line);border-radius:8px;
           padding:.6rem .9rem;min-width:92px}
.tally b{display:block;font-size:1.4rem;line-height:1.2}
.tally span{color:var(--dim);font-size:.78rem}
.card{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--cold);
      border-radius:10px;padding:1rem 1.1rem;margin-bottom:1rem}
.card.hot{border-left-color:var(--hot)} .card.warm{border-left-color:var(--warm)}
.card.mild{border-left-color:var(--mild)}
header{display:flex;gap:.85rem;align-items:flex-start}
.score{font-size:1.5rem;font-weight:700;min-width:2.2rem;text-align:center}
.hot .score{color:var(--hot)} .warm .score{color:var(--warm)}
.mild .score{color:var(--mild)} .cold .score{color:var(--cold)}
.head{flex:1;min-width:0}
h3{margin:.1rem 0 .35rem;font-size:1rem;word-break:break-word}
.meta{display:flex;flex-wrap:wrap;gap:.4rem;color:var(--dim);font-size:.78rem}
.meta span{background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:.05rem .4rem}
.track{font-weight:600}
.flag{color:var(--hot)!important;border-color:var(--hot)!important}
.s-contacted,.s-replied{color:var(--warm)!important} .s-won{color:var(--mild)!important}
.open{color:var(--dim);text-decoration:none;font-size:.8rem;white-space:nowrap}
.open:hover{color:var(--fg)}
blockquote{margin:.8rem 0;padding:.55rem .8rem;background:var(--bg);border-radius:6px;
           color:var(--dim);font-size:.86rem;white-space:pre-wrap;word-break:break-word}
.row{display:flex;gap:.7rem;margin:.5rem 0;font-size:.9rem}
.k{color:var(--dim);font-size:.78rem;min-width:5.2rem;padding-top:.15rem;flex-shrink:0}
.row p{margin:0;word-break:break-word}
.ev{font-style:italic;color:var(--dim)}
.bn{font-weight:600}
.heavy{color:var(--warm)!important;border-color:var(--warm)!important}
footer{margin-top:.8rem;padding-top:.6rem;border-top:1px solid var(--line);
       color:var(--dim);font-size:.72rem}
.note{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--warm);
      border-radius:8px;padding:.8rem 1rem;margin-bottom:2rem;font-size:.85rem;color:var(--dim)}
.empty{color:var(--dim);text-align:center;padding:3rem 0}`;

export function buildHtml(leads, s, day) {
  const hot = leads.filter((l) => l.score >= 70).length;
  const tally = [
    ["今日线索", leads.length],
    ["值得联系", leads.filter((l) => l.is_lead).length],
    ["已出诊断书", leads.filter((l) => l.diag_slug).length],
    ["高分(≥70)", hot],
    ["库内累计", s.leads],
  ];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>建站线索日报 ${day}</title><style>${CSS}</style></head><body><div class="wrap">
<h1>建站线索日报</h1>
<p class="sub">${day} · 按潜在价值排序，从上往下联系</p>
<div class="tally">${tally.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>
<div class="note">私信全是<b>草稿</b>。小红书禁止 AI 托管账号与自动化互动，
发送这一步必须由你本人手动完成 —— 本工具不代发，也不该代发。<br>
线索来自同行笔记的评论区，<b>不要在那些笔记下留评论</b>，只走私信。</div>
${leads.length ? leads.map(card).join("\n") : '<p class="empty">今天没有线索。先跑 scrape 和 analyze。</p>'}
</div></body></html>`;
}

function buildMarkdown(leads, day) {
  const rows = leads
    .filter((l) => l.is_lead)
    .map(
      (l) =>
        `| ${l.score} | ${(l.title || l.body).slice(0, 20).replace(/\|/g, "/")} | ${l.product_line} | ${
          l.url ? `[打开](${l.url})` : "—"
        } |`
    );
  return `# 建站线索日报 ${day}

共 ${leads.length} 条，其中值得联系 ${rows.length} 条。

| 分 | 线索 | 产品线 | 链接 |
|---|---|---|---|
${rows.join("\n") || "| — | 今天没有值得联系的线索 | — | — |"}

> 首评与私信均为草稿，发送由本人手动完成。
`;
}

/** 生成报告，返回 { html, md } 两个绝对路径。 */
export function generate({ since = null, minScore = 0 } = {}) {
  ensureDirs();
  const day = today();
  const leads = analyzedLeads({ since, minScore });
  const stamp = day.replace(/-/g, "");
  const html = path.join(REPORTS_DIR, `${stamp}-leads.html`);
  const md = path.join(REPORTS_DIR, `${stamp}-leads.md`);
  fs.writeFileSync(html, buildHtml(leads, stats(), day), "utf-8");
  fs.writeFileSync(md, buildMarkdown(leads, day), "utf-8");
  return { html, md, count: leads.length };
}
