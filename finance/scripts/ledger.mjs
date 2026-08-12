#!/usr/bin/env node
/**
 * 财务台账工具 — 零依赖，Node 20+
 *
 * 用法：npm run ledger -- <command> [options]
 *
 *   add     记一笔账
 *   roll    把到期的周期性收支自动过账（幂等）
 *   check   跑全部不变量校验（封账月哈希、重复 id、字段合法性…）
 *   close   封账某个月（冻结汇总 + 交易哈希）
 *   report  重新生成工作台 finance/workbench.html
 *   status  终端里看当前概况
 *
 * 数据目录可用环境变量 FINANCE_DIR 覆盖（测试用），默认 finance/
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIN_DIR = process.env.FINANCE_DIR || path.join(__dirname, '..');
const LEDGER = path.join(FIN_DIR, 'ledger.jsonl');
const CONFIG = path.join(FIN_DIR, 'config.json');
const RECURRING = path.join(FIN_DIR, 'recurring.json');
const CLOSES_DIR = path.join(FIN_DIR, 'closes');
const WORKBENCH = path.join(FIN_DIR, 'workbench.html');

// ---------- 基础读写 ----------

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function readRecurring() {
  if (!fs.existsSync(RECURRING)) return [];
  return JSON.parse(fs.readFileSync(RECURRING, 'utf8'));
}

function readLedger() {
  if (!fs.existsSync(LEDGER)) return [];
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim());
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      die(`ledger.jsonl 第 ${i + 1} 行不是合法 JSON`);
    }
  });
}

function appendTx(tx) {
  fs.appendFileSync(LEDGER, JSON.stringify(tx) + '\n');
}

function readCloses() {
  if (!fs.existsSync(CLOSES_DIR)) return [];
  return fs
    .readdirSync(CLOSES_DIR)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(CLOSES_DIR, f), 'utf8')));
}

function die(msg) {
  console.error(`⛔ ${msg}`);
  process.exit(1);
}

// ---------- 通用工具 ----------

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

function toCad(amount, currency, config) {
  if (currency === config.baseCurrency) return amount;
  const rate = config.fx[currency];
  if (!rate) die(`config.json 里没有 ${currency} 的汇率`);
  return amount * rate;
}

function fmtCad(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** 封账哈希：某月全部交易按 id 排序后的规范化 JSON 的 sha256 */
function monthHash(txs) {
  const sorted = [...txs].sort((a, b) => a.id.localeCompare(b.id));
  const canonical = JSON.stringify(
    sorted.map((t) => ({
      id: t.id, date: t.date, type: t.type, project: t.project,
      category: t.category, amount: t.amount, currency: t.currency,
      counterparty: t.counterparty ?? '', note: t.note ?? '', source: t.source,
    }))
  );
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      (flags._ ??= []).push(argv[i]);
    }
  }
  return flags;
}

// ---------- 校验 ----------

function validateTx(tx, config, lineLabel) {
  const errs = [];
  if (!tx.id) errs.push('缺 id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date ?? '')) errs.push(`date 非法: ${tx.date}`);
  else if (Number.isNaN(Date.parse(tx.date))) errs.push(`date 不是真实日期: ${tx.date}`);
  if (!['income', 'expense', 'receivable'].includes(tx.type)) errs.push(`type 非法: ${tx.type}`);
  if (!(typeof tx.amount === 'number' && tx.amount > 0)) errs.push(`amount 必须是正数: ${tx.amount}`);
  if (!(tx.currency === config.baseCurrency || config.fx[tx.currency])) errs.push(`currency 未知: ${tx.currency}`);
  if (!config.projects.includes(tx.project)) errs.push(`project 未知: ${tx.project}`);
  const cats = tx.type === 'expense' ? config.categories.expense : config.categories.income;
  if (cats && !cats.includes(tx.category)) errs.push(`category「${tx.category}」不在 ${tx.type} 类目里`);
  if (!['manual', 'auto:recurring'].includes(tx.source)) errs.push(`source 非法: ${tx.source}`);
  return errs.map((e) => `${lineLabel}: ${e}`);
}

function runCheck({ silent = false } = {}) {
  const config = readConfig();
  const txs = readLedger();
  const closes = readCloses();
  const recurring = readRecurring();
  const problems = [];

  // 1. 逐笔字段校验
  txs.forEach((tx, i) => problems.push(...validateTx(tx, config, `第 ${i + 1} 笔 (${tx.id ?? '?'})`)));

  // 2. id 唯一
  const seen = new Set();
  for (const tx of txs) {
    if (seen.has(tx.id)) problems.push(`id 重复: ${tx.id}`);
    seen.add(tx.id);
  }

  // 3. 封账月不可变：重算哈希对比
  for (const close of closes) {
    const monthTxs = txs.filter((t) => monthOf(t.date) === close.month);
    const hash = monthHash(monthTxs);
    if (hash !== close.txHash) {
      problems.push(
        `封账月 ${close.month} 的交易被改动过（哈希不符）。封账后的月份不允许增删改；` +
        `如确需更正，用当月红冲（记一笔反向交易），不要动历史`
      );
    }
    if (monthTxs.length !== close.txCount) {
      problems.push(`封账月 ${close.month} 交易笔数 ${monthTxs.length} ≠ 封账时的 ${close.txCount}`);
    }
  }

  // 4. 周期项配置合法
  for (const item of recurring) {
    if (!item.id) problems.push('recurring.json 有条目缺 id');
    if (!['income', 'expense'].includes(item.type)) problems.push(`周期项 ${item.id}: type 非法`);
    if (!(typeof item.amount === 'number' && item.amount > 0)) problems.push(`周期项 ${item.id}: amount 非法`);
    if (!(item.currency === config.baseCurrency || config.fx[item.currency])) problems.push(`周期项 ${item.id}: currency 未知`);
    if (!config.projects.includes(item.project)) problems.push(`周期项 ${item.id}: project 未知`);
    if (item.active && !/^\d{4}-\d{2}-\d{2}$/.test(item.startDate ?? '')) problems.push(`周期项 ${item.id}: active 但 startDate 非法`);
  }

  // 5. 自动过账幂等：auto id 必须能对应回周期项
  const recurringIds = new Set(recurring.map((r) => r.id));
  for (const tx of txs) {
    if (tx.source === 'auto:recurring') {
      const m = tx.id.match(/^auto-(.+)-(\d{4}-\d{2})$/);
      if (!m) problems.push(`自动过账 id 格式非法: ${tx.id}`);
      else if (!recurringIds.has(m[1])) problems.push(`自动过账 ${tx.id} 对应的周期项 ${m[1]} 已不存在（周期项只能停用不能删除）`);
    }
  }

  if (problems.length) {
    problems.forEach((p) => console.error(`✗ ${p}`));
    die(`check 未通过：${problems.length} 个问题`);
  }
  if (!silent) console.log(`✓ check 通过：${txs.length} 笔交易，${closes.length} 个封账月，${recurring.length} 个周期项`);
  return { config, txs, closes, recurring };
}

// ---------- 命令 ----------

function cmdAdd(flags) {
  const config = readConfig();
  const tx = {
    id: flags.id || `tx-${crypto.randomBytes(4).toString('hex')}`,
    date: flags.date || todayStr(),
    type: flags.type,
    project: flags.project,
    category: flags.category,
    amount: flags.amount !== undefined ? Number(flags.amount) : undefined,
    currency: flags.currency || config.baseCurrency,
    counterparty: flags.who || '',
    note: flags.note || '',
    source: 'manual',
  };
  const errs = validateTx(tx, config, '本笔');
  if (errs.length) {
    errs.forEach((e) => console.error(`✗ ${e}`));
    console.error(
      '\n用法: npm run ledger -- add --type income|expense --project <项目> --category <类目> --amount <金额> ' +
      '[--currency CAD|USD] [--date YYYY-MM-DD] [--who 对方] [--note 备注]'
    );
    console.error(`项目: ${config.projects.join(' / ')}`);
    console.error(`收入类目: ${config.categories.income.join(' / ')}`);
    console.error(`支出类目: ${config.categories.expense.join(' / ')}`);
    process.exit(1);
  }
  const closedMonths = new Set(readCloses().map((c) => c.month));
  if (closedMonths.has(monthOf(tx.date))) {
    die(`${monthOf(tx.date)} 已封账，不能往里记账。更正历史请在当月做红冲`);
  }
  appendTx(tx);
  const typeLabel = { income: '收入', expense: '支出', receivable: '应收（未计入收入）' }[tx.type];
  console.log(`✓ 已记账 ${tx.id}: ${tx.date} ${typeLabel} ${tx.amount} ${tx.currency} [${tx.project}/${tx.category}] ${tx.note}`);
  runCheck({ silent: true });
  cmdReport({ silent: true });
}

function cmdSettle(flags) {
  const rid = flags._[0] || flags.id;
  if (!rid) die('用法: npm run ledger -- settle <应收id> [--date YYYY-MM-DD] [--amount 实收金额] [--note 备注]');
  const s = computeState();
  const r = s.txs.find((t) => t.id === rid && t.type === 'receivable');
  if (!r) die(`找不到应收 ${rid}（用 status 看未结清的应收）`);
  if (s.settledIds.has(rid)) die(`${rid} 已结清，不能重复结清`);

  const date = flags.date || todayStr();
  if (new Set(readCloses().map((c) => c.month)).has(monthOf(date))) {
    die(`${monthOf(date)} 已封账，不能往里记账`);
  }
  const amount = flags.amount !== undefined ? Number(flags.amount) : r.amount;
  const tx = {
    id: `tx-${crypto.randomBytes(4).toString('hex')}`,
    date,
    type: 'income',
    project: r.project,
    category: r.category,
    amount,
    currency: r.currency,
    counterparty: r.counterparty || '',
    note: flags.note || `结清应收 ${rid}${r.note ? `（${r.note}）` : ''}`,
    source: 'manual',
    settles: rid,
  };
  const errs = validateTx(tx, s.config, '结清');
  if (errs.length) { errs.forEach((e) => console.error(`✗ ${e}`)); process.exit(1); }
  appendTx(tx);
  const diff = amount - r.amount;
  console.log(`✓ 应收 ${rid} 已结清：${date} 实收 ${amount} ${tx.currency}${diff ? `（与原挂账差 ${diff > 0 ? '+' : ''}${diff.toFixed(2)}）` : ''}`);
  runCheck({ silent: true });
  cmdReport({ silent: true });
}

function monthsBetween(startMonth, endMonth) {
  const out = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function cmdRoll() {
  const { config, txs, closes, recurring } = runCheck({ silent: true });
  const existingIds = new Set(txs.map((t) => t.id));
  const closedMonths = new Set(closes.map((c) => c.month));
  const today = todayStr();
  let posted = 0;

  for (const item of recurring) {
    if (!item.active) continue;
    const anchorDay = Number(item.startDate.slice(8, 10));
    for (const month of monthsBetween(monthOf(item.startDate), monthOf(today))) {
      const id = `auto-${item.id}-${month}`;
      if (existingIds.has(id)) continue;
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const date = `${month}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
      if (date > today) continue; // 本月还没到扣款日
      if (date < item.startDate) continue;
      if (item.endDate && date > item.endDate) continue;
      if (closedMonths.has(month)) {
        console.warn(`⚠ ${id} 应过账但 ${month} 已封账，跳过。请人工核对该月封账是否正确`);
        continue;
      }
      appendTx({
        id, date, type: item.type, project: item.project, category: item.category,
        amount: item.amount, currency: item.currency,
        counterparty: item.counterparty ?? item.name, note: `[自动] ${item.name}`,
        source: 'auto:recurring',
      });
      console.log(`✓ 自动过账 ${id}: ${date} ${item.type === 'income' ? '收入' : '支出'} ${item.amount} ${item.currency} — ${item.name}`);
      posted++;
    }
  }
  if (posted === 0) console.log('✓ roll：没有到期未过账的周期项');
  runCheck({ silent: true });
  cmdReport({ silent: true });
}

function summarizeMonth(txs, month, config) {
  const monthTxs = txs.filter((t) => monthOf(t.date) === month);
  const sum = (list) => list.reduce((acc, t) => acc + toCad(t.amount, t.currency, config), 0);
  const income = sum(monthTxs.filter((t) => t.type === 'income'));
  const expense = sum(monthTxs.filter((t) => t.type === 'expense'));
  const byProject = {};
  for (const p of config.projects) {
    const pt = monthTxs.filter((t) => t.project === p);
    if (pt.length) {
      byProject[p] = {
        income: sum(pt.filter((t) => t.type === 'income')),
        expense: sum(pt.filter((t) => t.type === 'expense')),
      };
    }
  }
  return { month, txCount: monthTxs.length, income, expense, net: income - expense, byProject };
}

function cmdClose(flags) {
  const month = flags._?.[0];
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) die('用法: npm run ledger -- close YYYY-MM');
  const { config, txs, closes, recurring } = runCheck({ silent: true });
  if (closes.some((c) => c.month === month)) die(`${month} 已封账`);
  const currentMonth = monthOf(todayStr());
  if (month >= currentMonth && !flags.force) {
    die(`只能封已结束的月份（当前 ${currentMonth}）。确要封本月加 --force`);
  }
  // 封账前置：该月所有 active 周期项都必须已过账
  for (const item of recurring) {
    if (!item.active) continue;
    if (monthOf(item.startDate) > month) continue;
    if (item.endDate && monthOf(item.endDate) < month) continue;
    const id = `auto-${item.id}-${month}`;
    if (!txs.some((t) => t.id === id)) {
      die(`周期项「${item.name}」在 ${month} 还没过账（缺 ${id}）。先跑 roll 再封账`);
    }
  }
  const monthTxs = txs.filter((t) => monthOf(t.date) === month);
  const summary = summarizeMonth(txs, month, config);
  const close = {
    month,
    closedAt: new Date().toISOString(),
    txCount: monthTxs.length,
    txHash: monthHash(monthTxs),
    baseCurrency: config.baseCurrency,
    fxUsed: config.fx,
    summary,
  };
  fs.mkdirSync(CLOSES_DIR, { recursive: true });
  fs.writeFileSync(path.join(CLOSES_DIR, `${month}.json`), JSON.stringify(close, null, 2) + '\n');
  console.log(`✓ ${month} 已封账：${monthTxs.length} 笔，收入 ${fmtCad(summary.income)}，支出 ${fmtCad(summary.expense)}，净 ${fmtCad(summary.net)}（CAD）`);
  cmdReport({ silent: true });
}

function computeState() {
  const { config, txs, closes, recurring } = runCheck({ silent: true });
  const months = [...new Set(txs.map((t) => monthOf(t.date)))].sort();
  const monthly = months.map((m) => summarizeMonth(txs, m, config));
  const activeIncome = recurring.filter((r) => r.active && r.type === 'income');
  const activeExpense = recurring.filter((r) => r.active && r.type === 'expense');
  const mrr = activeIncome.reduce((a, r) => a + toCad(r.amount, r.currency, config), 0);
  const burn = activeExpense.reduce((a, r) => a + toCad(r.amount, r.currency, config), 0);
  const totalIncome = monthly.reduce((a, m) => a + m.income, 0);
  const totalExpense = monthly.reduce((a, m) => a + m.expense, 0);

  // 应收：type=receivable 且未被任何 income 交易的 settles 指向的，才算未结清。
  // 只追加不改写历史——结清是追加一条带 settles 的 income，原应收行原样留着。
  const settledIds = new Set(txs.filter((t) => t.settles).map((t) => t.settles));
  const openReceivables = txs.filter((t) => t.type === 'receivable' && !settledIds.has(t.id));
  const receivableTotal = openReceivables.reduce((a, t) => a + toCad(t.amount, t.currency, config), 0);

  return {
    config, txs, closes, recurring, monthly,
    mrr, burn, clients: activeIncome.length,
    totalIncome, totalExpense, net: totalIncome - totalExpense,
    openReceivables, receivableTotal, settledIds,
  };
}

function cmdStatus() {
  const s = computeState();
  const g = s.config.goals;
  console.log('── 财务概况（CAD 口径）──');
  console.log(`累计: 收入 ${fmtCad(s.totalIncome)} / 支出 ${fmtCad(s.totalExpense)} / 净 ${fmtCad(s.net)}`);
  console.log(`MRR: ${fmtCad(s.mrr)} / 目标 ${fmtCad(g.mrrTarget)}　付费客户: ${s.clients} / ${g.clientTarget}`);
  console.log(`月订阅支出（burn）: ${fmtCad(s.burn)}`);
  if (s.openReceivables.length) {
    console.log(`应收未收: ${fmtCad(s.receivableTotal)}（${s.openReceivables.length} 笔）— 不计入上面的收入`);
    for (const r of s.openReceivables) {
      console.log(`  · ${r.date} ${r.amount} ${r.currency} [${r.project}] ${r.counterparty || ''} ${r.note || ''}`);
    }
  }
  console.log(`交易 ${s.txs.length} 笔，封账 ${s.closes.length} 个月，周期项 active ${s.recurring.filter((r) => r.active).length} / ${s.recurring.length}`);
  const thisMonth = summarizeMonth(s.txs, monthOf(todayStr()), s.config);
  console.log(`本月: 收入 ${fmtCad(thisMonth.income)} / 支出 ${fmtCad(thisMonth.expense)} / 净 ${fmtCad(thisMonth.net)}`);
}

// ---------- 工作台 HTML ----------

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cmdReport({ silent = false } = {}) {
  const s = computeState();
  const g = s.config.goals;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const thisMonth = summarizeMonth(s.txs, monthOf(todayStr()), s.config);
  const closedSet = new Set(s.closes.map((c) => c.month));

  const catLabel = { income: '收入', expense: '支出' };
  const pct = (v, target) => target > 0 ? Math.min(100, Math.round((v / target) * 100)) : 0;

  const txRows = [...s.txs]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map((t) => {
      const cad = toCad(t.amount, t.currency, s.config);
      const settled = t.type === 'receivable' && s.settledIds.has(t.id);
      const label = t.type === 'expense' ? '支出' : t.type === 'receivable' ? (settled ? '应收·已结' : '应收') : '收入';
      const sign = t.type === 'expense' ? '−' : t.type === 'receivable' ? '' : '+';
      return `<tr class="${t.type}${settled ? ' settled' : ''}">
        <td>${esc(t.date)}${closedSet.has(monthOf(t.date)) ? ' <span class="lock" title="该月已封账">🔒</span>' : ''}</td>
        <td>${label}</td>
        <td>${esc(t.project)}</td>
        <td>${esc(t.category)}</td>
        <td class="num">${sign}${t.amount.toFixed(2)} ${esc(t.currency)}</td>
        <td class="num">${sign}${cad.toFixed(2)}</td>
        <td>${esc(t.counterparty || '')}</td>
        <td class="note">${esc(t.note || '')}</td>
      </tr>`;
    })
    .join('\n');

  const monthRows = [...s.monthly].reverse().map((m) => `<tr>
      <td>${esc(m.month)}${closedSet.has(m.month) ? ' 🔒' : ''}</td>
      <td class="num pos">+${m.income.toFixed(2)}</td>
      <td class="num neg">−${m.expense.toFixed(2)}</td>
      <td class="num ${m.net >= 0 ? 'pos' : 'neg'}">${m.net >= 0 ? '+' : '−'}${Math.abs(m.net).toFixed(2)}</td>
      <td class="num">${m.txCount}</td>
    </tr>`).join('\n');

  const projectAgg = {};
  for (const m of s.monthly) {
    for (const [p, v] of Object.entries(m.byProject)) {
      projectAgg[p] ??= { income: 0, expense: 0 };
      projectAgg[p].income += v.income;
      projectAgg[p].expense += v.expense;
    }
  }
  const projectRows = Object.entries(projectAgg).map(([p, v]) => `<tr>
      <td>${esc(p)}</td>
      <td class="num pos">+${v.income.toFixed(2)}</td>
      <td class="num neg">−${v.expense.toFixed(2)}</td>
      <td class="num ${v.income - v.expense >= 0 ? 'pos' : 'neg'}">${(v.income - v.expense) >= 0 ? '+' : '−'}${Math.abs(v.income - v.expense).toFixed(2)}</td>
    </tr>`).join('\n') || '<tr><td colspan="4" class="empty">还没有任何交易</td></tr>';

  const recurringRows = s.recurring.map((r) => {
    const cad = toCad(r.amount, r.currency, s.config);
    return `<tr class="${r.active ? '' : 'inactive'}">
      <td>${r.active ? '<span class="dot on"></span>启用' : '<span class="dot off"></span>停用'}</td>
      <td>${esc(r.name)}</td>
      <td>${catLabel[r.type]}</td>
      <td>${esc(r.project)}</td>
      <td class="num">${r.amount.toFixed(2)} ${esc(r.currency)}/月</td>
      <td class="num">≈ ${cad.toFixed(2)}</td>
      <td class="note">${esc(r.note || '')}</td>
    </tr>`;
  }).join('\n') || '<tr><td colspan="7" class="empty">无</td></tr>';

  const fxNote = Object.entries(s.config.fx).map(([c, r]) => `1 ${c} ≈ ${r} CAD`).join('，');

  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>财务工作台 — ${esc(monthOf(todayStr()))}</title>
<style>
  :root {
    --bg: #f7f6f3; --card: #ffffff; --ink: #1a1a1a; --muted: #6b6b6b;
    --line: #e5e2dc; --pos: #1a7f4e; --neg: #b3372f; --accent: #24435f;
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); color: var(--ink); font: 15px/1.65 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; padding: 32px 20px 64px; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  header { margin-bottom: 24px; }
  h1 { font-size: 22px; letter-spacing: .5px; }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin: 20px 0 28px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
  .card .label { font-size: 12px; color: var(--muted); letter-spacing: 1px; }
  .card .value { font-size: 26px; font-weight: 650; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .card .hint { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .pos { color: var(--pos); } .neg { color: var(--neg); }
  .bar { height: 6px; background: var(--line); border-radius: 3px; margin-top: 10px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: 3px; }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 20px 22px; margin-bottom: 18px; overflow-x: auto; }
  h2 { font-size: 15px; letter-spacing: 1px; color: var(--accent); margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; letter-spacing: .5px; border-bottom: 1px solid var(--line); padding: 6px 10px 6px 0; white-space: nowrap; }
  td { border-bottom: 1px solid var(--line); padding: 7px 10px 7px 0; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th.num { text-align: right; }
  .note { color: var(--muted); font-size: 12.5px; }
  .empty { color: var(--muted); text-align: center; padding: 18px 0 !important; }
  .inactive { opacity: .55; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .dot.on { background: var(--pos); } .dot.off { background: #bbb; }
  .lock { font-size: 11px; }
  tr.income td.num { }
  footer { color: var(--muted); font-size: 12px; margin-top: 24px; line-height: 1.8; }
  @media print { body { background: #fff; padding: 0; } section, .card { border-color: #ccc; break-inside: avoid; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>财务工作台</h1>
    <div class="sub">生成于 ${now} ・ 数据源 finance/ledger.jsonl ・ 本页为生成产物，不要手改</div>
  </header>

  <div class="cards">
    <div class="card">
      <div class="label">本月净现金流（CAD）</div>
      <div class="value ${thisMonth.net >= 0 ? 'pos' : 'neg'}">${thisMonth.net >= 0 ? '+' : '−'}${Math.abs(thisMonth.net).toFixed(2)}</div>
      <div class="hint">收入 +${thisMonth.income.toFixed(2)} ／ 支出 −${thisMonth.expense.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="label">MRR / 阶段一目标</div>
      <div class="value">${s.mrr.toFixed(0)} <span style="font-size:14px;color:var(--muted)">/ ${g.mrrTarget}</span></div>
      <div class="bar"><i style="width:${pct(s.mrr, g.mrrTarget)}%"></i></div>
      <div class="hint">${pct(s.mrr, g.mrrTarget)}%（来自启用中的客户月费周期项）</div>
    </div>
    <div class="card">
      <div class="label">付费客户 / 目标</div>
      <div class="value">${s.clients} <span style="font-size:14px;color:var(--muted)">/ ${g.clientTarget}</span></div>
      <div class="bar"><i style="width:${pct(s.clients, g.clientTarget)}%"></i></div>
      <div class="hint">口径：启用中的收入类周期项数量</div>
    </div>
    <div class="card">
      <div class="label">月度订阅支出（burn）</div>
      <div class="value neg">−${s.burn.toFixed(2)}</div>
      <div class="hint">启用中的支出类周期项合计（CAD/月）</div>
    </div>
    <div class="card">
      <div class="label">应收未收（CAD）</div>
      <div class="value">${s.receivableTotal.toFixed(2)}</div>
      <div class="hint">${s.openReceivables.length} 笔未结清 ・ <strong>不计入收入</strong>，收到后用 settle 转收入</div>
    </div>
    <div class="card">
      <div class="label">历史累计净额（CAD）</div>
      <div class="value ${s.net >= 0 ? 'pos' : 'neg'}">${s.net >= 0 ? '+' : '−'}${Math.abs(s.net).toFixed(2)}</div>
      <div class="hint">收入 +${s.totalIncome.toFixed(2)} ／ 支出 −${s.totalExpense.toFixed(2)}</div>
    </div>
  </div>

  <section>
    <h2>分项目损益（累计，CAD）</h2>
    <table>
      <thead><tr><th>项目</th><th class="num">收入</th><th class="num">支出</th><th class="num">净额</th></tr></thead>
      <tbody>${projectRows}</tbody>
    </table>
  </section>

  <section>
    <h2>月度汇总（CAD）　🔒 = 已封账</h2>
    <table>
      <thead><tr><th>月份</th><th class="num">收入</th><th class="num">支出</th><th class="num">净额</th><th class="num">笔数</th></tr></thead>
      <tbody>${monthRows || '<tr><td colspan="5" class="empty">还没有任何交易</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>周期性收支（订阅 / 客户月费）</h2>
    <table>
      <thead><tr><th>状态</th><th>名称</th><th>方向</th><th>项目</th><th class="num">金额</th><th class="num">折 CAD/月</th><th>备注</th></tr></thead>
      <tbody>${recurringRows}</tbody>
    </table>
  </section>

  <section>
    <h2>全部流水（新在前）</h2>
    <table>
      <thead><tr><th>日期</th><th>方向</th><th>项目</th><th>类目</th><th class="num">原币金额</th><th class="num">折 CAD</th><th>对方</th><th>备注</th></tr></thead>
      <tbody>${txRows || '<tr><td colspan="8" class="empty">账本还是空的。第一笔真实收支发生时用 npm run ledger -- add 记入</td></tr>'}</tbody>
    </table>
  </section>

  <footer>
    汇率（仅用于折算展示，原币金额永远是真相）：${esc(fxNote)}。<br>
    操作入口：记账 <code>npm run ledger -- add …</code> ／ 周期过账 <code>npm run ledger -- roll</code> ／ 校验 <code>npm run ledger -- check</code> ／ 封账 <code>npm run ledger -- close YYYY-MM</code>。<br>
    规则全文见 <code>docs/20260811-记账工作台.md</code>。封账月份的数字已冻结在 <code>finance/closes/</code>，与 ledger 哈希绑定。
  </footer>
</div>
</body>
</html>
`;
  fs.writeFileSync(WORKBENCH, html);
  if (!silent) console.log(`✓ 工作台已生成: ${WORKBENCH}`);
}

// ---------- 入口 ----------

const [cmd, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

switch (cmd) {
  case 'add': cmdAdd(flags); break;
  case 'settle': cmdSettle(flags); break;
  case 'roll': cmdRoll(); break;
  case 'check': runCheck(); break;
  case 'close': cmdClose(flags); break;
  case 'report': cmdReport(); console.log('✓ 已重新生成'); break;
  case 'status': cmdStatus(); break;
  default:
    console.log(`财务台账工具

命令:
  add     记一笔账        npm run ledger -- add --type expense --project shared --category 工具订阅 --amount 97 --currency USD --who GoHighLevel --note "8月订阅"
          挂一笔应收      npm run ledger -- add --type receivable --project veggie --category 网站建设 --amount 1700 --currency EUR --who 客户名 --note "尾款"
  settle  应收转已收      npm run ledger -- settle <应收id> [--date YYYY-MM-DD] [--amount 实收金额]
  roll    周期项自动过账   npm run ledger -- roll
  check   不变量校验      npm run ledger -- check
  close   月末封账        npm run ledger -- close 2026-08
  report  重新生成工作台   npm run ledger -- report
  status  终端看概况      npm run ledger -- status`);
    process.exit(cmd ? 1 : 0);
}
