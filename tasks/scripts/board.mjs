#!/usr/bin/env node
/**
 * 任务流水线（Trello 式看板）— 零依赖，Node 20+
 *
 * 用法：npm run board -- <command> [options]
 *
 *   idea    收一个想法进收件箱
 *   judge   CEO 判断：立项 / 冷藏 / 否决
 *   split   把一张卡拆成子任务（子卡进 ready）
 *   move    流转阶段（按 config 的合法流转表校验，dev/test 有 WIP 上限）
 *   next    调度：告诉执行者现在该干哪张卡（完成优先于开工：deploy > test > dev > ready > backlog）
 *   check   不变量校验
 *   report  重新生成看板 tasks/workbench.html
 *   status  终端概况
 *
 * 数据目录可用 TASKS_DIR 覆盖（测试用），默认 tasks/
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.TASKS_DIR || path.join(__dirname, '..');
const BOARD = path.join(DIR, 'board.json');
const CONFIG = path.join(DIR, 'config.json');
const WORKBENCH = path.join(DIR, 'workbench.html');

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const STAGES = Object.keys(cfg.stages);

function die(msg) { console.error(`⛔ ${msg}`); process.exit(1); }
function nowIso() { return new Date().toISOString(); }
function today() { return nowIso().slice(0, 10); }

function readBoard() {
  if (!fs.existsSync(BOARD)) return [];
  return JSON.parse(fs.readFileSync(BOARD, 'utf8'));
}
function writeBoard(cards) {
  fs.writeFileSync(BOARD, JSON.stringify(cards, null, 2) + '\n');
}
function newId() { return `c-${crypto.randomBytes(3).toString('hex')}`; }

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      // --sub 可重复
      const next = argv[i + 1];
      const val = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
      if (key === 'sub') (flags.sub ??= []).push(val);
      else flags[key] = val;
    } else flags._.push(argv[i]);
  }
  return flags;
}

function findCard(cards, id) {
  const c = cards.find((c) => c.id === id);
  if (!c) die(`没有这张卡: ${id}`);
  return c;
}

function pushHistory(card, action, note) {
  card.history.push({ at: nowIso(), action, note: note || '' });
}

function prioRank(p) { return cfg.priorities.indexOf(p); }
function sortCards(list) {
  return [...list].sort((a, b) => prioRank(a.priority) - prioRank(b.priority) || a.createdAt.localeCompare(b.createdAt));
}
function isBlocked(c) { return Boolean(c.blockedOn); }

// ---------- check ----------

function runCheck({ silent = false } = {}) {
  const cards = readBoard();
  const problems = [];
  const ids = new Set();
  for (const c of cards) {
    const tag = `${c.id}「${c.title}」`;
    if (!c.id || ids.has(c.id)) problems.push(`id 缺失或重复: ${c.id}`);
    ids.add(c.id);
    if (!c.title) problems.push(`${c.id}: 缺标题`);
    if (!STAGES.includes(c.stage)) problems.push(`${tag}: 阶段非法 ${c.stage}`);
    if (!cfg.projects.includes(c.project)) problems.push(`${tag}: 项目非法 ${c.project}`);
    if (!cfg.priorities.includes(c.priority)) problems.push(`${tag}: 优先级非法 ${c.priority}`);
    if (!Array.isArray(c.history) || c.history.length === 0) problems.push(`${tag}: 没有历史记录`);
    if (c.parent && !cards.some((p) => p.id === c.parent)) problems.push(`${tag}: 父卡 ${c.parent} 不存在`);
    // 立项后的卡必须有验收标准
    if (!['inbox', 'icebox', 'rejected'].includes(c.stage) && !c.acceptance) {
      problems.push(`${tag}: 已立项但没有验收标准`);
    }
    // 完成必须有证据
    if (c.stage === 'done' && !c.evidence) problems.push(`${tag}: 完成但没有产出物证据`);
    if (c.stage === 'rejected' && !c.verdictReason) problems.push(`${tag}: 否决但没写理由`);
    // 父卡不能在子卡都没完成时 done
    if (c.stage === 'done') {
      const kids = cards.filter((k) => k.parent === c.id);
      const openKids = kids.filter((k) => !['done', 'rejected'].includes(k.stage));
      if (openKids.length) problems.push(`${tag}: 已完成但还有 ${openKids.length} 张子卡未完成`);
    }
  }
  // WIP 上限
  for (const [stage, limit] of Object.entries(cfg.wipLimits)) {
    const n = cards.filter((c) => c.stage === stage && !isBlocked(c)).length;
    if (n > limit) problems.push(`${cfg.stages[stage].name} WIP ${n} 超上限 ${limit} —— 先完成再开工`);
  }
  if (problems.length) {
    problems.forEach((p) => console.error(`✗ ${p}`));
    die(`check 未通过：${problems.length} 个问题`);
  }
  if (!silent) {
    const byStage = Object.fromEntries(STAGES.map((s) => [s, cards.filter((c) => c.stage === s).length]));
    console.log(`✓ check 通过：${cards.length} 张卡 ` + STAGES.filter((s) => byStage[s]).map((s) => `${cfg.stages[s].name}${byStage[s]}`).join(' / '));
  }
  return cards;
}

// ---------- 命令 ----------

function cmdIdea(flags) {
  const title = flags._.join(' ');
  if (!title) die('用法: npm run board -- idea "想法一句话" [--note 补充] [--source 来源] [--project xx] [--priority P1]');
  const cards = readBoard();
  const card = {
    id: newId(), title, stage: 'inbox',
    project: flags.project || 'shared',
    priority: flags.priority || 'P1',
    source: flags.source || '用户想法',
    note: flags.note || '', acceptance: null, parent: null,
    blockedOn: null, ref: flags.ref || null, evidence: null, verdictReason: null,
    createdAt: nowIso(), doneAt: null,
    history: [{ at: nowIso(), action: 'idea', note: flags.note || '' }],
  };
  cards.push(card);
  writeBoard(cards);
  console.log(`✓ 想法已收: ${card.id}「${title}」→ 收件箱，等判断`);
  runCheck({ silent: true }); cmdReport({ silent: true });
}

function cmdJudge(flags) {
  const [id] = flags._;
  const verdict = flags.verdict;
  if (!id || !['accept', 'icebox', 'reject'].includes(verdict)) {
    die('用法: npm run board -- judge <id> --verdict accept|icebox|reject --reason "判断理由" [--acceptance "验收标准"] [--project xx] [--priority P0]');
  }
  if (!flags.reason) die('判断必须写理由（四条标准对着过）');
  const cards = readBoard();
  const card = findCard(cards, id);
  if (card.stage !== 'inbox' && card.stage !== 'icebox') die(`${id} 在「${cfg.stages[card.stage].name}」，只有收件箱/冷藏里的卡能判断`);
  card.verdictReason = flags.reason;
  if (flags.project) card.project = flags.project;
  if (flags.priority) card.priority = flags.priority;
  if (verdict === 'accept') {
    if (!flags.acceptance) die('立项必须给验收标准（写不出验收标准 = 想法还没想清楚）');
    card.acceptance = flags.acceptance;
    card.stage = 'backlog';
    pushHistory(card, 'judge:accept', flags.reason);
    console.log(`✓ 立项: ${id} → 待办`);
  } else if (verdict === 'icebox') {
    card.stage = 'icebox';
    pushHistory(card, 'judge:icebox', flags.reason);
    console.log(`✓ 冷藏: ${id}（理由已留档）`);
  } else {
    card.stage = 'rejected';
    pushHistory(card, 'judge:reject', flags.reason);
    console.log(`✓ 否决: ${id}（理由已留档）`);
  }
  writeBoard(cards);
  runCheck({ silent: true }); cmdReport({ silent: true });
}

function cmdSplit(flags) {
  const [id] = flags._;
  if (!id || !flags.sub?.length) die('用法: npm run board -- split <id> --sub "子任务1（验收：…）" --sub "子任务2（验收：…）"');
  const cards = readBoard();
  const parentCard = findCard(cards, id);
  if (!['backlog', 'ready'].includes(parentCard.stage)) die(`只能拆待办/已拆解里的卡（${id} 在 ${cfg.stages[parentCard.stage].name}）`);
  for (const s of flags.sub) {
    const m = s.match(/^(.*?)（验收[:：](.*)）$/) || s.match(/^(.*?)\(验收[:：](.*)\)$/);
    const kid = {
      id: newId(), title: m ? m[1].trim() : s, stage: 'ready',
      project: parentCard.project, priority: parentCard.priority,
      source: `拆自 ${parentCard.id}`, note: '', acceptance: m ? m[2].trim() : parentCard.acceptance,
      parent: parentCard.id, blockedOn: null, ref: null, evidence: null, verdictReason: null,
      createdAt: nowIso(), doneAt: null,
      history: [{ at: nowIso(), action: 'split', note: `从「${parentCard.title}」拆出` }],
    };
    cards.push(kid);
    console.log(`  └ ${kid.id}「${kid.title}」→ 已拆解`);
  }
  if (parentCard.stage === 'backlog') { parentCard.stage = 'ready'; }
  pushHistory(parentCard, 'split', `拆出 ${flags.sub.length} 张子卡`);
  writeBoard(cards);
  console.log(`✓ ${id} 已拆解（父卡随子卡走，子卡全完成后父卡才能 done）`);
  runCheck({ silent: true }); cmdReport({ silent: true });
}

function cmdMove(flags) {
  const [id, to] = flags._;
  if (!id || !STAGES.includes(to)) die(`用法: npm run board -- move <id> <${STAGES.join('|')}> [--note 说明] [--evidence "commit/路径"] [--block "阻塞原因"] [--unblock]`);
  const cards = readBoard();
  const card = findCard(cards, id);
  if (flags.block) { card.blockedOn = flags.block; pushHistory(card, 'block', flags.block); }
  if (flags.unblock) { card.blockedOn = null; pushHistory(card, 'unblock', flags.note || ''); }
  if (to !== card.stage) {
    const allowed = cfg.transitions[card.stage] || [];
    if (!allowed.includes(to)) die(`不允许 ${cfg.stages[card.stage].name} → ${cfg.stages[to].name}（合法流转: ${allowed.map((s) => cfg.stages[s].name).join('/') || '无'}）`);
    const limit = cfg.wipLimits[to];
    if (limit) {
      const n = cards.filter((c) => c.stage === to && !isBlocked(c) && c.id !== id).length;
      if (n >= limit && !isBlocked(card)) die(`${cfg.stages[to].name} WIP 已满（${n}/${limit}）—— 先把在制品做完`);
    }
    if (to === 'done') {
      if (!flags.evidence && !card.evidence) die('完成必须带产出物证据: --evidence "commit hash / 文件路径 / 链接"');
      const openKids = cards.filter((k) => k.parent === id && !['done', 'rejected'].includes(k.stage));
      if (openKids.length) die(`还有 ${openKids.length} 张子卡未完成: ${openKids.map((k) => k.id).join(', ')}`);
      card.doneAt = nowIso();
    }
    if (flags.evidence) card.evidence = flags.evidence;
    pushHistory(card, `move:${card.stage}->${to}`, flags.note || '');
    card.stage = to;
    console.log(`✓ ${id}「${card.title}」→ ${cfg.stages[to].name}`);
  } else {
    writeBoard(cards);
    console.log(`✓ ${id} 状态已更新（阶段未变）`);
    runCheck({ silent: true }); cmdReport({ silent: true });
    return;
  }
  writeBoard(cards);
  runCheck({ silent: true }); cmdReport({ silent: true });
}

function cmdNext() {
  const cards = runCheck({ silent: true });
  // 有未完成子卡的父卡是容器，不直接干它，干它的子卡
  const hasOpenKids = (c) => cards.some((k) => k.parent === c.id && !['done', 'rejected'].includes(k.stage));
  const pick = (stage) => sortCards(cards.filter((c) => c.stage === stage && !isBlocked(c) && !hasOpenKids(c)))[0];
  // 完成优先于开工（拉动式）：越靠近交付的越先做
  for (const [stage, verb] of [['deploy', '把上线收尾'], ['test', '按验收标准测试'], ['dev', '继续开发']]) {
    const c = pick(stage);
    if (c) {
      console.log(`→ ${verb}: ${c.id}「${c.title}」 [${c.project}/${c.priority}]`);
      console.log(`  验收标准: ${c.acceptance}`);
      return;
    }
  }
  const ready = pick('ready');
  if (ready) {
    console.log(`→ 开工（move ${ready.id} dev）: ${ready.id}「${ready.title}」 [${ready.project}/${ready.priority}]`);
    console.log(`  验收标准: ${ready.acceptance}`);
    return;
  }
  const backlog = pick('backlog');
  if (backlog) {
    console.log(`→ 先拆解: ${backlog.id}「${backlog.title}」—— 用 split 拆成子任务，或足够小就直接 move ${backlog.id} dev`);
    return;
  }
  const inbox = cards.filter((c) => c.stage === 'inbox');
  if (inbox.length) {
    console.log(`→ 收件箱有 ${inbox.length} 个想法待判断（judge），执行层暂无可做的事`);
    return;
  }
  const blocked = cards.filter((c) => isBlocked(c) && !['done', 'rejected', 'icebox'].includes(c.stage));
  if (blocked.length) {
    console.log(`→ 全部阻塞中，等用户解锁：`);
    blocked.forEach((c) => console.log(`  🚫 ${c.id}「${c.title}」— ${c.blockedOn}`));
    return;
  }
  console.log('→ 看板上没有可推进的事。这不是问题——不要硬造工作');
}

function cmdStatus() {
  const cards = runCheck({ silent: true });
  for (const s of STAGES) {
    const list = sortCards(cards.filter((c) => c.stage === s));
    if (!list.length) continue;
    console.log(`\n${cfg.stages[s].name} (${list.length})`);
    for (const c of list) {
      console.log(`  ${isBlocked(c) ? '🚫' : '·'} [${c.priority}] ${c.id} ${c.title}${c.parent ? `（子卡 of ${c.parent}）` : ''}${isBlocked(c) ? ` — 阻塞: ${c.blockedOn}` : ''}`);
    }
  }
}

// ---------- 看板 HTML ----------

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function cmdReport({ silent = false } = {}) {
  const cards = readBoard();
  const now = nowIso().replace('T', ' ').slice(0, 16) + ' UTC';
  const lanes = ['inbox', 'backlog', 'ready', 'dev', 'test', 'deploy', 'done'];
  const prioColor = { P0: '#b3372f', P1: '#24435f', P2: '#8a8a8a' };
  const doneRecent = (c) => c.stage !== 'done' || (c.doneAt && c.doneAt.slice(0, 10) >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10));

  const cardHtml = (c) => {
    const kids = cards.filter((k) => k.parent === c.id);
    const kidsDone = kids.filter((k) => k.stage === 'done').length;
    return `<div class="card ${isBlocked(c) ? 'blocked' : ''}">
      <div class="chips">
        <span class="chip prio" style="background:${prioColor[c.priority]}">${c.priority}</span>
        <span class="chip">${esc(c.project)}</span>
        ${c.parent ? `<span class="chip sub">子卡</span>` : ''}
        ${kids.length ? `<span class="chip">${kidsDone}/${kids.length} 子卡</span>` : ''}
        ${isBlocked(c) ? `<span class="chip block">🚫 阻塞</span>` : ''}
      </div>
      <div class="title">${esc(c.title)}</div>
      ${c.acceptance ? `<div class="meta">验收: ${esc(c.acceptance)}</div>` : ''}
      ${isBlocked(c) ? `<div class="meta blockmsg">等: ${esc(c.blockedOn)}</div>` : ''}
      ${c.evidence ? `<div class="meta">产出: ${esc(c.evidence)}</div>` : ''}
      ${c.ref ? `<div class="meta">↗ ${esc(c.ref)}（状态真相在原台账）</div>` : ''}
      <div class="meta faint">${esc(c.id)} · ${esc(c.source)} · ${esc(c.createdAt.slice(0, 10))}${c.doneAt ? ` → ${esc(c.doneAt.slice(0, 10))}` : ''}</div>
    </div>`;
  };

  const laneHtml = (s) => {
    const list = sortCards(cards.filter((c) => c.stage === s && doneRecent(c)));
    const total = cards.filter((c) => c.stage === s).length;
    const limit = cfg.wipLimits[s];
    return `<div class="lane">
      <div class="lane-head">${cfg.stages[s].name} <span class="count">${total}${limit ? `/${limit}` : ''}</span></div>
      <div class="lane-desc">${esc(cfg.stages[s].desc)}</div>
      ${list.map(cardHtml).join('\n') || '<div class="empty">—</div>'}
      ${s === 'done' && total > list.length ? `<div class="empty">…另有 ${total - list.length} 张两周前完成的卡（见 board.json）</div>` : ''}
    </div>`;
  };

  const parked = ['icebox', 'rejected'].map((s) => {
    const list = sortCards(cards.filter((c) => c.stage === s));
    if (!list.length) return '';
    return `<details><summary>${cfg.stages[s].name}（${list.length}）</summary>${list.map((c) =>
      `<div class="parked-row"><b>${esc(c.title)}</b> — ${esc(c.verdictReason || '')} <span class="faint">${esc(c.id)}</span></div>`).join('')}</details>`;
  }).join('\n');

  const blocked = cards.filter((c) => isBlocked(c) && !['done', 'rejected', 'icebox'].includes(c.stage));

  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>任务流水线 — 看板</title>
<style>
  :root { --bg:#f7f6f3; --card:#fff; --ink:#1a1a1a; --muted:#6b6b6b; --line:#e5e2dc; --accent:#24435f; --neg:#b3372f; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; padding:28px 18px 60px; }
  .wrap { max-width:1400px; margin:0 auto; }
  h1 { font-size:21px; }
  .sub { color:var(--muted); font-size:12.5px; margin:4px 0 18px; }
  .alert { background:#fdf3f2; border:1px solid #ecc; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:13px; }
  .board { display:grid; grid-template-columns:repeat(7,minmax(170px,1fr)); gap:10px; overflow-x:auto; }
  .lane { background:#efede8; border-radius:10px; padding:10px; min-width:170px; }
  .lane-head { font-weight:650; font-size:13.5px; color:var(--accent); }
  .count { color:var(--muted); font-weight:400; font-size:12px; }
  .lane-desc { color:var(--muted); font-size:11px; margin:2px 0 10px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px 11px; margin-bottom:8px; }
  .card.blocked { opacity:.75; border-style:dashed; }
  .chips { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
  .chip { font-size:10.5px; padding:1px 7px; border-radius:99px; background:#8a8a8a; color:#fff; }
  .chip.block { background:var(--neg); }
  .chip.sub { background:#b0885a; }
  .title { font-size:13.5px; font-weight:600; line-height:1.4; }
  .meta { font-size:11.5px; color:var(--muted); margin-top:5px; }
  .blockmsg { color:var(--neg); }
  .faint { color:#a5a19a; }
  .empty { color:#a5a19a; font-size:12px; text-align:center; padding:8px 0; }
  details { margin-top:14px; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px 14px; font-size:13px; }
  summary { cursor:pointer; color:var(--muted); }
  .parked-row { padding:6px 0; border-bottom:1px solid var(--line); }
  .parked-row:last-child { border-bottom:none; }
  footer { color:var(--muted); font-size:12px; margin-top:22px; line-height:1.8; }
  @media (max-width:900px){ .board{ grid-template-columns:repeat(2,1fr);} }
</style>
</head>
<body>
<div class="wrap">
  <h1>任务流水线</h1>
  <div class="sub">生成于 ${now} ・ 数据源 tasks/board.json ・ 本页为生成产物，不要手改 ・ 流转: 想法 → 判断 → 待办 → 拆解 → 开发 → 测试 → 上线 → 完成</div>
  ${blocked.length ? `<div class="alert">🚫 <b>${blocked.length} 张卡阻塞中，等用户解锁：</b>${blocked.map((c) => `「${esc(c.title)}」— ${esc(c.blockedOn)}`).join('　')}</div>` : ''}
  <div class="board">
    ${lanes.map(laneHtml).join('\n')}
  </div>
  ${parked}
  <footer>
    操作: 收想法 <code>npm run board -- idea "…"</code> ／ 判断 <code>judge</code> ／ 拆解 <code>split</code> ／ 流转 <code>move</code> ／ 调度 <code>next</code>。
    完成卡两周后从看板隐藏，数据永久保留在 board.json。规则全文见 <code>docs/20260811-任务流水线.md</code>。
  </footer>
</div>
</body>
</html>
`;
  fs.writeFileSync(WORKBENCH, html);
  if (!silent) console.log(`✓ 看板已生成: ${WORKBENCH}`);
}

// ---------- 入口 ----------

const [cmd, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

switch (cmd) {
  case 'idea': cmdIdea(flags); break;
  case 'judge': cmdJudge(flags); break;
  case 'split': cmdSplit(flags); break;
  case 'move': cmdMove(flags); break;
  case 'next': cmdNext(); break;
  case 'check': runCheck(); break;
  case 'status': cmdStatus(); break;
  case 'report': cmdReport(); break;
  default:
    console.log(`任务流水线

  idea "想法一句话" [--note] [--source] [--project] [--priority]
  judge <id> --verdict accept|icebox|reject --reason "…" [--acceptance "…"]
  split <id> --sub "子任务（验收：…）" --sub "…"
  move <id> <阶段> [--note] [--evidence] [--block "原因"] [--unblock]
  next / check / status / report`);
    process.exit(cmd ? 1 : 0);
}
