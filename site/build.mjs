#!/usr/bin/env node
/**
 * CEO 站点生成器 — 把看板、账本、docs/ 全部文档编译成一个可部署的静态站。
 *
 *   node site/build.mjs        生成到 site/dist/
 *
 * 数据源都是既有产物，本脚本不产生新的事实：
 *   tasks/board.json      任务看板真相
 *   finance/ledger.jsonl  账本真相
 *   docs/*.md             文档
 * 看板页与工作台页由各自的 report 命令生成，这里只做汇总与文档渲染。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

// 中文文档习惯单换行即断行（文首的「**日期**：…」多行元数据尤其明显），
// 按 CommonMark 会被合并成一段，所以开 breaks。
marked.setOptions({ breaks: true });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'site', 'dist');
const DOCS = path.join(ROOT, 'docs');

const read = (p) => fs.readFileSync(p, 'utf-8');
const readJson = (p) => JSON.parse(read(p));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 文档收集 ----------

function collectDocs() {
  if (!fs.existsSync(DOCS)) return [];
  return fs.readdirSync(DOCS)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = read(path.join(DOCS, file));
      const m = file.match(/^(\d{4})(\d{2})(\d{2})-(.+)\.md$/);
      const date = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
      const titleLine = raw.split('\n').find((l) => l.startsWith('# '));
      const title = titleLine ? titleLine.slice(2).trim() : (m ? m[4] : file.replace(/\.md$/, ''));
      // 摘要：标题之后第一段有实质内容的正文
      const body = raw.split('\n');
      let summary = '';
      for (let i = (titleLine ? body.indexOf(titleLine) + 1 : 0); i < body.length; i++) {
        const l = body[i].trim();
        if (!l || l.startsWith('#') || l.startsWith('>') || l.startsWith('|') || l.startsWith('---')) continue;
        // 跳过「**键**：值」这类文首元数据行，它们不是摘要
        if (/^\*\*[^*]+\*\*\s*[：:]/.test(l)) continue;
        summary = l.replace(/\*\*/g, '').replace(/`/g, '').slice(0, 110);
        break;
      }
      return { file, slug: file.replace(/\.md$/, '') + '.html', date, title, summary, raw, bytes: raw.length };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

// ---------- 看板 / 账本摘要 ----------

function boardSummary() {
  const p = path.join(ROOT, 'tasks', 'board.json');
  if (!fs.existsSync(p)) return null;
  const raw = readJson(p);
  const cards = Array.isArray(raw) ? raw : (raw.cards || []);
  const byStage = {};
  let blocked = 0;
  for (const c of cards) {
    byStage[c.stage] = (byStage[c.stage] || 0) + 1;
    if (c.blockedOn) blocked++;
  }
  return { total: cards.length, byStage, blocked, done: byStage.done || 0 };
}

function ledgerSummary() {
  const p = path.join(ROOT, 'finance', 'ledger.jsonl');
  const cfgPath = path.join(ROOT, 'finance', 'config.json');
  if (!fs.existsSync(p) || !fs.existsSync(cfgPath)) return null;
  const cfg = readJson(cfgPath);
  const txs = read(p).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const toCad = (a, c) => (c === cfg.baseCurrency ? a : a * (cfg.fx[c] || 1));
  const settled = new Set(txs.filter((t) => t.settles).map((t) => t.settles));
  const income = txs.filter((t) => t.type === 'income').reduce((a, t) => a + toCad(t.amount, t.currency), 0);
  const expense = txs.filter((t) => t.type === 'expense').reduce((a, t) => a + toCad(t.amount, t.currency), 0);
  const receivable = txs.filter((t) => t.type === 'receivable' && !settled.has(t.id))
    .reduce((a, t) => a + toCad(t.amount, t.currency), 0);
  return { income, expense, net: income - expense, receivable, count: txs.length };
}

// ---------- 页面骨架 ----------

const CSS = `
:root{
  --bg:#f7f6f3; --card:#fff; --ink:#1a1a1a; --muted:#6b6b6b; --line:#e4e0d9;
  --accent:#b4442e; --pos:#1f7a4d; --neg:#a33; --code:#f2efe9;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#16150f; --card:#1e1d16; --ink:#ece8df; --muted:#9b968c; --line:#33312a;
    --accent:#e07a5f; --pos:#5fbf8a; --neg:#e0796f; --code:#26241d;
  }
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:0 22px}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

nav{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:9}
nav .wrap{display:flex;align-items:center;gap:26px;height:56px}
nav .brand{font-weight:700;letter-spacing:.02em;color:var(--ink)}
nav a.item{font-size:14.5px;color:var(--muted)}
nav a.item.on{color:var(--ink);font-weight:600}

header.page{padding:38px 0 24px}
header.page h1{font-size:29px;letter-spacing:-.01em;line-height:1.3}
header.page .sub{color:var(--muted);font-size:13.5px;margin-top:9px}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:6px 0 30px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:15px 17px}
.kpi .label{font-size:12px;color:var(--muted);letter-spacing:.06em}
.kpi .value{font-size:25px;font-weight:650;margin-top:5px;font-variant-numeric:tabular-nums}
.kpi .hint{font-size:12px;color:var(--muted);margin-top:3px}
.pos{color:var(--pos)} .neg{color:var(--neg)}

.doclist{display:grid;gap:11px;margin-bottom:36px}
.doc{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;display:block}
.doc:hover{border-color:var(--accent);text-decoration:none}
.doc .t{font-size:16.5px;font-weight:600;color:var(--ink);line-height:1.45}
.doc .s{font-size:13.5px;color:var(--muted);margin-top:6px}
.doc .m{font-size:12px;color:var(--muted);margin-top:9px;letter-spacing:.04em}

.grouphead{font-size:12.5px;color:var(--muted);letter-spacing:.1em;margin:26px 0 10px;text-transform:uppercase}

/* 文档正文 */
article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:34px 38px;margin-bottom:40px;overflow-wrap:break-word}
article h1{font-size:27px;line-height:1.35;margin:0 0 18px}
article h2{font-size:21px;margin:34px 0 12px;padding-top:14px;border-top:1px solid var(--line)}
article h3{font-size:17px;margin:24px 0 9px}
article h4{font-size:15.5px;margin:18px 0 7px}
article p{margin:12px 0}
article ul,article ol{margin:12px 0 12px 24px}
article li{margin:5px 0}
article blockquote{border-left:3px solid var(--accent);padding:2px 0 2px 16px;margin:16px 0;color:var(--muted)}
article code{background:var(--code);padding:2px 6px;border-radius:4px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
article pre{background:var(--code);padding:15px 17px;border-radius:8px;overflow-x:auto;margin:16px 0}
article pre code{background:none;padding:0;font-size:12.5px;line-height:1.6}
article hr{border:0;border-top:1px solid var(--line);margin:28px 0}
article table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13.5px;display:block;overflow-x:auto}
article th,article td{border:1px solid var(--line);padding:8px 11px;text-align:left;vertical-align:top}
article th{background:var(--code);font-weight:600;white-space:nowrap}
article img{max-width:100%}
article del{color:var(--muted)}

.backlink{display:inline-block;margin:8px 0 20px;font-size:14px}
footer{padding:26px 0 46px;font-size:12.5px;color:var(--muted)}
@media(max-width:640px){
  article{padding:22px 18px}
  nav .wrap{gap:16px;overflow-x:auto}
}
`;

function shell({ title, active, body, breadcrumb }) {
  const nav = [
    ['/', '概览', 'home'],
    ['/board.html', '任务看板', 'board'],
    ['/finance.html', '财务工作台', 'finance'],
    ['/docs/', '文档中心', 'docs'],
  ].map(([href, label, key]) =>
    `<a class="item${active === key ? ' on' : ''}" href="${href}">${label}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<nav><div class="wrap"><span class="brand">CEO 工作台</span>${nav}</div></nav>
<div class="wrap">
${breadcrumb || ''}
${body}
<footer>本页由 <code>site/build.mjs</code> 生成，数据源 tasks/board.json · finance/ledger.jsonl · docs/。不要手改生成产物。</footer>
</div>
</body>
</html>`;
}

// ---------- 构建 ----------

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'docs'), { recursive: true });

  const docs = collectDocs();
  const board = boardSummary();
  const led = ledgerSummary();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const money = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // 概览页
  const kpis = [];
  if (board) {
    kpis.push(`<div class="kpi"><div class="label">任务卡</div><div class="value">${board.total}</div><div class="hint">完成 ${board.done} ・ 阻塞 ${board.blocked}</div></div>`);
    kpis.push(`<div class="kpi"><div class="label">在制品</div><div class="value">${(board.byStage.dev || 0) + (board.byStage.test || 0)}</div><div class="hint">开发中 ${board.byStage.dev || 0} ・ 测试中 ${board.byStage.test || 0}</div></div>`);
  }
  if (led) {
    kpis.push(`<div class="kpi"><div class="label">累计净现金流</div><div class="value ${led.net >= 0 ? 'pos' : 'neg'}">${money(led.net)}</div><div class="hint">收入 ${money(led.income)} ／ 支出 ${money(led.expense)}</div></div>`);
    kpis.push(`<div class="kpi"><div class="label">应收未收</div><div class="value">${money(led.receivable)}</div><div class="hint">未结清，不计入收入</div></div>`);
  }
  kpis.push(`<div class="kpi"><div class="label">文档</div><div class="value">${docs.length}</div><div class="hint">全部可点击阅读</div></div>`);

  const recent = docs.slice(0, 6).map((d) => `<a class="doc" href="/docs/${encodeURIComponent(d.slug)}">
      <div class="t">${esc(d.title)}</div>
      ${d.summary ? `<div class="s">${esc(d.summary)}</div>` : ''}
      <div class="m">${esc(d.date)}</div>
    </a>`).join('\n');

  fs.writeFileSync(path.join(DIST, 'index.html'), shell({
    title: 'CEO 工作台',
    active: 'home',
    body: `<header class="page"><h1>CEO 工作台</h1>
      <div class="sub">生成于 ${now}　·　看板、账本、全部文档都在这里</div></header>
      <div class="cards">${kpis.join('')}</div>
      <div class="grouphead">最近文档</div>
      <div class="doclist">${recent}</div>
      <p><a href="/docs/">查看全部 ${docs.length} 份文档 →</a></p>`,
  }));

  // 文档索引
  const groups = {};
  for (const d of docs) (groups[d.date || '未标日期'] ??= []).push(d);
  const indexBody = Object.entries(groups).map(([date, list]) => `
    <div class="grouphead">${esc(date)}</div>
    <div class="doclist">${list.map((d) => `<a class="doc" href="/docs/${encodeURIComponent(d.slug)}">
        <div class="t">${esc(d.title)}</div>
        ${d.summary ? `<div class="s">${esc(d.summary)}</div>` : ''}
        <div class="m">${esc(d.file)}　·　${(d.bytes / 1024).toFixed(1)} KB</div>
      </a>`).join('\n')}</div>`).join('\n');

  fs.writeFileSync(path.join(DIST, 'docs', 'index.html'), shell({
    title: '文档中心',
    active: 'docs',
    body: `<header class="page"><h1>文档中心</h1>
      <div class="sub">${docs.length} 份文档　·　按日期倒序　·　源文件在仓库 docs/ 下</div></header>${indexBody}`,
  }));

  // 每篇文档
  for (const d of docs) {
    fs.writeFileSync(path.join(DIST, 'docs', d.slug), shell({
      title: d.title,
      active: 'docs',
      breadcrumb: `<a class="backlink" href="/docs/">← 文档中心</a>`,
      body: `<article>${marked.parse(d.raw)}</article>`,
    }));
  }

  // 看板与工作台：直接搬运既有生成产物
  const copies = [
    ['tasks/workbench.html', 'board.html'],
    ['finance/workbench.html', 'finance.html'],
  ];
  for (const [src, dst] of copies) {
    const p = path.join(ROOT, src);
    if (fs.existsSync(p)) {
      const html = read(p).replace(
        /<body([^>]*)>/i,
        `<body$1><div style="background:#1e1d16;color:#ece8df;font:14px/1 -apple-system,sans-serif;padding:11px 22px">
          <a href="/" style="color:#e07a5f;text-decoration:none">← CEO 工作台</a>
          <span style="opacity:.5;margin:0 10px">|</span>
          <a href="/board.html" style="color:#ece8df;text-decoration:none">任务看板</a>
          <span style="opacity:.5;margin:0 10px">·</span>
          <a href="/finance.html" style="color:#ece8df;text-decoration:none">财务工作台</a>
          <span style="opacity:.5;margin:0 10px">·</span>
          <a href="/docs/" style="color:#ece8df;text-decoration:none">文档中心</a>
        </div>`);
      fs.writeFileSync(path.join(DIST, dst), html);
    } else {
      fs.writeFileSync(path.join(DIST, dst), shell({
        title: dst,
        active: dst.startsWith('board') ? 'board' : 'finance',
        body: `<header class="page"><h1>还没有生成</h1><div class="sub">先运行 <code>npm run ${dst.startsWith('board') ? 'board -- report' : 'ledger -- report'}</code></div></header>`,
      }));
    }
  }

  console.log(`✓ 站点已生成: ${DIST}`);
  console.log(`  ${docs.length} 份文档 ・ 看板 ${board ? board.total + ' 张卡' : '缺'} ・ 账本 ${led ? led.count + ' 笔' : '缺'}`);
}

build();
