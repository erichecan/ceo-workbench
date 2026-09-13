#!/usr/bin/env node
/**
 * 店主自己会看到的那个界面 —— 跟 card-admin.js 不是一回事。
 *
 * card-admin.js 是「我」管理所有线索的内部工具，一进去就是一整个列表，
 * 混着好几个不相关的商户，那种东西绝对不能给客户看到（她不该看见同行）。
 *
 * portal.js 是**给客户用、能部署到公网**的版本：一次只服务一个商户
 * （DEFAULT_LEAD_ID 或 ?lead=<id> 认成「这就是你」），不出现任何别的商户
 * 信息，文案换成店主看得懂的大白话（"客人什么时候来"，不是 "booking_start"）。
 *
 * 数据存在 Postgres（booking-db.js），不是本地 SQLite——这个文件会被部署到
 * Cloud Run，容器磁盘不持久，本地 SQLite 文件放这里等于每次冷启动就清空。
 * 内部工具 card-admin.js 继续用本地 SQLite，两边不共用存储层。
 *
 * 环境变量：
 *   DATABASE_URL              Postgres 连接串（必需，booking-db.js 读取）
 *   PORTAL_USER / PORTAL_PASS 登录凭据；生产环境（NODE_ENV=production）必填，
 *                             本地不设就跳过鉴权，方便开发时直接开着用
 *   DEFAULT_LEAD_ID           这个部署实例服务哪个商户，默认 99（本地演示值）
 *   PORT                      监听端口（Cloud Run 注入，默认 4322）
 *
 * 本地用法：node src/portal.js [--port 4322]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import * as store from "./booking-db.js";
import { getFreeSlots } from "./booking.js";
import { generateCard, cardSlug, CARD_OUT_DIR } from "./card.js";
import { createAuth } from "./auth.js";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1]) || Number(process.env.PORT) || 4322;
const DEFAULT_LEAD_ID = Number(process.env.DEFAULT_LEAD_ID) || 99;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const CHANNEL_LABELS = { xiaohongshu: "小红书", phone: "电话", walk_in: "到店", other: "其他" };

const auth = createAuth({ user: process.env.PORTAL_USER, pass: process.env.PORTAL_PASS, cookieName: "portal_session", title: "预约后台" });
if (!auth && process.env.NODE_ENV === "production") {
  console.error("✗ 拒绝启动：生产环境必须配置 PORTAL_USER / PORTAL_PASS。");
  process.exit(1);
}
if (!auth) console.warn("⚠️ 未配置 PORTAL_USER/PORTAL_PASS，本地演示模式，不鉴权。");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${iso.slice(5).replace("-", "/")} 周${"日一二三四五六"[d.getDay()]}`;
}

/** 卡片文件名要跟 card.js 生成文件时用的算法完全一致——meta.fallback_name
 *  就是店名为空时的兜底名字，两边算法保持一致，预览才不会 404。 */
function slugFor(meta, leadId) {
  return cardSlug(meta?.brand_name, meta?.fallback_name, leadId);
}

function staffOptions(staffList, selected) {
  return staffList
    .map((s) => `<option value="${s.id}" ${Number(selected) === s.id ? "selected" : ""}>${esc(s.name)}</option>`)
    .join("");
}

function bookingRow(leadId, b, staffList) {
  const staffName = b.staff_id ? staffList.find((s) => s.id === b.staff_id)?.name : null;
  const meta = [b.customer_name, b.phone, b.service_item, CHANNEL_LABELS[b.channel] || b.channel, staffName]
    .filter(Boolean)
    .join(" · ");
  return `<div class="item">
    <div class="item-main"><b>${esc(fmtDate(b.date))}</b> ${esc(b.start_time)}–${esc(b.end_time)}
      ${meta ? `<div class="item-sub">${esc(meta)}</div>` : ""}</div>
    <form method="post" action="/booking/delete">
      <input type="hidden" name="lead" value="${leadId}">
      <input type="hidden" name="id" value="${b.id}">
      <button class="link-btn" type="submit">取消</button>
    </form>
  </div>`;
}

/**
 * 找出还是 active、且快照里的时段跟现在这些预约重叠的发送记录——说明这个
 * 时段的卡片发出去过，而现在确实有人订上了，值得店主回头确认是不是发给过
 * 不止一位客人。在渲染时现算，不靠 URL 传状态，刷新页面也能看到。
 */
async function collectSendConflicts(leadId, bookings) {
  const seen = new Map();
  for (const b of bookings) {
    for (const hit of await store.findConflictingSends(leadId, b.date, b.start_time, b.end_time)) {
      seen.set(hit.id, hit);
    }
  }
  return [...seen.values()];
}

/** 两条预约时间重叠、且没法用「不同技师」互相开脱——这是真的撞车了。 */
function collectStaffOverlaps(bookings) {
  const pairs = [];
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i], b = bookings[j];
      if (a.date !== b.date) continue;
      if (!(a.start_time < b.end_time && b.start_time < a.end_time)) continue;
      if (a.staff_id && b.staff_id && a.staff_id !== b.staff_id) continue;
      pairs.push([a, b]);
    }
  }
  return pairs;
}

function conflictBanner(sendConflicts, staffOverlaps) {
  if (!sendConflicts.length && !staffOverlaps.length) return "";
  const sendItems = sendConflicts
    .map(
      (s) => `<div class="conflict-item">
      <span>这个时段的卡片${s.note ? `发给过「${esc(s.note)}」` : "之前发出去过"}，现在这个时段被订上了——确认一下是不是同一位客人</span>
      <form method="post" action="/card/resolve-send" style="display:inline">
        <input type="hidden" name="send_id" value="${s.id}">
        <button class="link-btn" type="submit">标记已处理</button>
      </form>
    </div>`
    )
    .join("");
  const overlapItems = staffOverlaps
    .map(
      ([a, b]) =>
        `<div class="conflict-item"><span>${esc(fmtDate(a.date))} ${esc(a.start_time)}–${esc(a.end_time)} 跟 ${esc(b.start_time)}–${esc(b.end_time)} 撞车了，确认要不要跟客人重新协调时间</span></div>`
    )
    .join("");
  return `<div class="warn">⚠️ 可能有人撞了同一个时段<br>${sendItems}${overlapItems}</div>`;
}

function page({ leadId, meta, settings, bookings, staffList, freeSlots, slug, saved, errorMsg, sendConflicts, staffOverlaps }) {
  const brand = meta?.brand_name || "你的店";

  const bookingRows = bookings.map((b) => bookingRow(leadId, b, staffList)).join("") || `<p class="muted">接下来几天还没有客人预约。</p>`;

  const freeEcho = freeSlots.length
    ? freeSlots.map((s) => `${esc(s.label)} ${esc(s.time)}`).join(" · ")
    : "最近几天的空位都设置好了吗？";

  const dayRows = [0, 1, 2, 3, 4, 5, 6]
    .map((n) => {
      const range = settings.hours[String(n)];
      const on = Boolean(range);
      return `<div class="hour-row">
        <label class="hour-check"><input type="checkbox" name="day${n}_on" ${on ? "checked" : ""}> ${WEEKDAYS[n]}营业</label>
        <input type="time" name="day${n}_start" value="${on ? range[0] : "10:00"}">
        <span>至</span>
        <input type="time" name="day${n}_end" value="${on ? range[1] : "19:00"}">
      </div>`;
    })
    .join("");

  const staffRows =
    staffList
      .map(
        (s) => `<div class="item">
      <div class="item-main">${esc(s.name)}</div>
      <form method="post" action="/staff/deactivate">
        <input type="hidden" name="lead" value="${leadId}">
        <input type="hidden" name="id" value="${s.id}">
        <button class="link-btn" type="submit">停用</button>
      </form>
    </div>`
      )
      .join("") || `<p class="muted">还没加技师——只有一个人做的话不用加，预约按整店记就行。</p>`;

  const staffFieldOnForm = staffList.length
    ? `<div class="field">给谁做<select name="staff_id"><option value="">不指定</option>${staffOptions(staffList, "")}</select></div>`
    : "";

  const outFile = path.join(CARD_OUT_DIR, `${slug}.png`);
  const hasCard = fs.existsSync(outFile);

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} · 预约后台</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@1,600&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box}
  body{margin:0;background:#F7F5F1;color:#2B2320;
       font:16px/1.6 "Noto Sans SC",-apple-system,sans-serif}
  .top{background:#2B2320;color:#F3E9DD;padding:2rem 1.5rem;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:.6rem}
  .top .brand{font-family:"Bodoni Moda",serif;font-style:italic;font-weight:600;font-size:2rem}
  .top .sub{color:#C9BBAE;font-size:.9rem;margin-top:.3rem}
  .top a{color:#F3E9DD;font-size:.85rem}
  .wrap{max-width:640px;margin:-1.5rem auto 4rem;padding:0 1.2rem;display:flex;flex-direction:column;gap:1.2rem}
  .card{background:#fff;border-radius:16px;padding:1.5rem 1.5rem 1.7rem;box-shadow:0 10px 30px rgba(43,35,32,.08)}
  .card h2{font-size:1.05rem;margin:0 0 1rem;display:flex;align-items:center;gap:.5rem}
  .flash{background:#E1EBDD;color:#2F5C34;padding:.7rem 1rem;border-radius:10px;font-size:.9rem}
  .error{background:#F8E1DC;color:#9A3B24;padding:.7rem 1rem;border-radius:10px;font-size:.9rem}
  .warn{background:#FBF0DC;color:#8A5A00;padding:.7rem 1rem;border-radius:10px;font-size:.85rem;line-height:1.7}
  .conflict-item{display:flex;justify-content:space-between;align-items:center;gap:.6rem}
  .item{display:flex;align-items:center;justify-content:space-between;padding:.7rem 0;border-bottom:1px solid #F1EEE8;gap:.6rem}
  .item:last-child{border-bottom:none}
  .item-main{font-size:.95rem}
  .item-sub{font-size:.82rem;color:#8A7A6E;margin-top:.2rem}
  .muted{color:#9A8B7E;font-size:.9rem}
  .link-btn{background:none;border:0;color:#B5432A;font-size:.85rem;cursor:pointer;padding:.2rem;white-space:nowrap}
  form.inline{display:flex;flex-wrap:wrap;gap:.7rem;align-items:flex-end;margin-top:1rem}
  .field{display:flex;flex-direction:column;gap:.3rem;font-size:.85rem;color:#6B5D52}
  input[type=date],input[type=time],input[type=text],input[type=tel],select{padding:.5rem .6rem;border:1px solid #E3DCD3;border-radius:8px;font:inherit}
  button.primary{background:#B8863B;color:#fff;border:0;border-radius:8px;padding:.6rem 1.3rem;font:inherit;font-weight:600;cursor:pointer}
  button.primary:hover{background:#A5762F}
  button.secondary{background:#EFE8DE;color:#4a4a46;border:0;border-radius:8px;padding:.6rem 1.1rem;font:inherit;cursor:pointer}
  .hour-row{display:flex;align-items:center;gap:.6rem;padding:.4rem 0;font-size:.9rem}
  .hour-check{display:flex;align-items:center;gap:.4rem;width:8rem}
  details summary{cursor:pointer;color:#8A7A6E;font-size:.88rem}
  .free{background:#FBF3EA;border:1px solid #EFDFC9;border-radius:10px;padding:.8rem 1rem;font-size:.9rem;color:#6B5D30}
  .card-preview{width:100%;border-radius:14px;margin-top:.8rem}
  .hint{font-size:.85rem;color:#8A7A6E;margin-top:.6rem;line-height:1.6}
</style></head>
<body>
  <div class="top">
    <div>
      <div class="brand">${esc(brand)}</div>
      <div class="sub">预约后台 · ${esc(meta?.region_label || "")}</div>
    </div>
    <a href="/schedule?lead=${leadId}">📆 看完整时间表 →</a>
  </div>
  <div class="wrap">
    ${saved ? '<div class="flash">已保存 ✓ 预约卡已经更新</div>' : ""}
    ${errorMsg ? `<div class="error">${esc(errorMsg)}</div>` : ""}
    ${conflictBanner(sendConflicts, staffOverlaps)}

    <div class="card">
      <h2>📅 接下来的预约</h2>
      ${bookingRows}
      <form class="inline" method="post" action="/booking/add">
        <input type="hidden" name="lead" value="${leadId}">
        <div class="field">客人什么时候来<input type="date" name="booking_date" required></div>
        <div class="field">开始<input type="time" name="booking_start" required></div>
        <div class="field">结束<input type="time" name="booking_end" required></div>
        <div class="field">客人称呼<input type="text" name="customer_name" placeholder="选填"></div>
        <div class="field">电话<input type="tel" name="phone" placeholder="选填"></div>
        <div class="field">预约项目<input type="text" name="service_item" placeholder="如 美甲+手绘"></div>
        <div class="field">渠道<select name="channel">
          ${Object.entries(CHANNEL_LABELS).map(([v, l]) => `<option value="${v}" ${v === "xiaohongshu" ? "selected" : ""}>${esc(l)}</option>`).join("")}
        </select></div>
        ${staffFieldOnForm}
        <button class="primary" type="submit">记下这个预约</button>
      </form>
      <p class="hint">客人在小红书私信里跟你约好之后，来这里记一笔——预约卡上的空位会自动跟着更新，不用你自己去改图。</p>
    </div>

    <div class="card">
      <h2>✨ 你的预约卡</h2>
      <div class="free">最近能约：${freeEcho}</div>
      ${hasCard ? `<img class="card-preview" src="/card.png?lead=${leadId}&t=${Date.now()}">` : '<p class="muted">先设置好营业时间，卡片就会自动生成。</p>'}
      <form class="inline" method="post" action="/card/mark-sent">
        <input type="hidden" name="lead" value="${leadId}">
        <div class="field">发给了谁（选填）<input type="text" name="note" placeholder="如 小红书@某某"></div>
        <button class="secondary" type="submit">我发了这张卡</button>
      </form>
      <p class="hint">客人问"有位置吗"的时候，直接把这张图发给她就行——上面的空位是实时的。发出去之后点一下"我发了这张卡"，万一后来有别的客人也想约同一个时段，系统会提醒你。</p>
    </div>

    <div class="card">
      <h2>👥 技师</h2>
      ${staffRows}
      <form class="inline" method="post" action="/staff/add">
        <input type="hidden" name="lead" value="${leadId}">
        <div class="field">加一位技师<input type="text" name="name" placeholder="技师称呼" required></div>
        <button class="secondary" type="submit">添加</button>
      </form>
      <p class="hint">只有店主一个人做的话不用加——不加技师，预约就按"整店"来记，跟以前一样。</p>
    </div>

    <div class="card">
      <details>
        <summary>⚙️ 营业时间设置</summary>
        <form method="post" action="/hours/save" style="margin-top:1rem">
          <input type="hidden" name="lead" value="${leadId}">
          ${dayRows}
          <div class="field" style="margin-top:.8rem;width:10rem">每个预约时长（分钟）
            <input type="number" name="slot_minutes" value="${settings.slotMinutes}" min="15" step="15">
          </div>
          <div style="margin-top:1rem"><button class="primary" type="submit">保存营业时间</button></div>
        </form>
      </details>
    </div>
  </div>
</body></html>`;
}

async function schedulePage(leadId, days = 5) {
  const meta = await store.getCardMeta(leadId);
  const settings = (await store.getBookingSettings(leadId)) || { slotMinutes: 90, hours: {} };
  const staffList = await store.listStaff(leadId);
  const columns = staffList.length ? staffList : [{ id: null, name: "店铺" }];
  const bookings = await store.listBookings(leadId);

  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const dayBlocks = [];
  for (let d = 0; d < days; d++) {
    const day = new Date();
    day.setDate(day.getDate() + d);
    const iso = day.toISOString().slice(0, 10);
    const range = settings.hours[String(day.getDay())];
    if (!range) continue;
    const dayBookings = bookings.filter((b) => b.date === iso);
    const [openT, closeT] = range;
    const rows = [];
    for (let t = toMin(openT); t + settings.slotMinutes <= toMin(closeT); t += settings.slotMinutes) {
      const slotEnd = t + settings.slotMinutes;
      const cells = columns.map((col) =>
        dayBookings.find((b) => {
          const overlap = toMin(b.start_time) < slotEnd && toMin(b.end_time) > t;
          return overlap && (!b.staff_id || b.staff_id === col.id);
        })
      );
      rows.push({ time: toHHMM(t), cells });
    }
    dayBlocks.push({ iso, rows });
  }

  const table = (block) => `
    <h3>${esc(fmtDate(block.iso))}</h3>
    ${
      block.rows.length
        ? `<table>
      <thead><tr><th>时间</th>${columns.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead>
      <tbody>${block.rows
        .map(
          (r) => `<tr><td>${r.time}</td>${r.cells
            .map((b) => (b ? `<td class="busy">${esc(b.customer_name || b.service_item || "已约")}</td>` : `<td class="free">空</td>`))
            .join("")}</tr>`
        )
        .join("")}</tbody>
    </table>`
        : `<p class="muted">当天没营业。</p>`
    }
  `;

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta?.brand_name || "预约")} · 时间表</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:1.5rem;background:#F7F5F1;color:#2B2320;font:15px/1.5 -apple-system,"Noto Sans SC",sans-serif}
  a{color:#B5432A}
  h3{margin:1.5rem 0 .6rem}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
  th,td{padding:.5rem .6rem;border-bottom:1px solid #F1EEE8;text-align:left;font-size:.88rem}
  td.free{color:#9A8B7E}
  td.busy{background:#FBF0DC;color:#8A5A00;font-weight:600}
  .muted{color:#9A8B7E}
</style></head><body>
  <p><a href="/?lead=${leadId}">← 返回预约后台</a></p>
  <h1>完整时间表</h1>
  ${dayBlocks.map(table).join("") || "<p>还没设置营业时间。</p>"}
</body></html>`;
}

function serveCard(res, slug) {
  const full = path.join(CARD_OUT_DIR, `${slug}.png`);
  if (!fs.existsSync(full)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
  fs.createReadStream(full).pipe(res);
}

function parseHoursFromForm(form) {
  const hours = {};
  for (let n = 0; n <= 6; n++) {
    if (form.get(`day${n}_on`)) {
      const start = form.get(`day${n}_start`);
      const end = form.get(`day${n}_end`);
      if (start && end) hours[String(n)] = [start, end];
    }
  }
  return hours;
}

async function render(leadId, { saved = false, errorMsg = "" } = {}, res) {
  const meta = await store.getCardMeta(leadId);
  const settings = (await store.getBookingSettings(leadId)) || { slotMinutes: 90, hours: {} };
  const bookings = await store.listBookings(leadId);
  const staffList = await store.listStaff(leadId);
  const freeSlots = await getFreeSlots(store, leadId, { days: 7, count: 3 });
  const slug = slugFor(meta, leadId);
  const sendConflicts = await collectSendConflicts(leadId, bookings);
  const staffOverlaps = collectStaffOverlaps(bookings);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page({ leadId, meta, settings, bookings, staffList, freeSlots, slug, saved, errorMsg, sendConflicts, staffOverlaps }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "POST" && url.pathname === "/login" && auth) {
      const form = new URLSearchParams(await readBody(req));
      const result = auth.handleLogin(form);
      if (!result.ok) {
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(auth.loginPage(result.msg));
      }
      res.writeHead(302, { "Set-Cookie": result.cookie, Location: "/" });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/logout" && auth) {
      res.writeHead(302, { "Set-Cookie": auth.logoutCookie(), Location: "/login" });
      return res.end();
    }
    if (auth && auth.guard(req, res)) return;

    if (req.method === "GET" && url.pathname === "/") {
      const leadId = Number(url.searchParams.get("lead")) || DEFAULT_LEAD_ID;
      return await render(
        leadId,
        {
          saved: url.searchParams.get("saved") === "1",
          errorMsg: url.searchParams.get("error") === "badtime" ? "结束时间要晚于开始时间，这条没记上，麻烦重新填一下。" : "",
        },
        res
      );
    }
    if (req.method === "GET" && url.pathname === "/schedule") {
      const leadId = Number(url.searchParams.get("lead")) || DEFAULT_LEAD_ID;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await schedulePage(leadId));
    }
    if (req.method === "GET" && url.pathname === "/card.png") {
      const leadId = Number(url.searchParams.get("lead")) || DEFAULT_LEAD_ID;
      const meta = await store.getCardMeta(leadId);
      return serveCard(res, slugFor(meta, leadId));
    }
    if (req.method === "POST" && url.pathname === "/booking/add") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      const date = form.get("booking_date");
      const startTime = form.get("booking_start");
      const endTime = form.get("booking_end");
      if (!date || !startTime || !endTime || startTime >= endTime) {
        res.writeHead(302, { Location: `/?lead=${leadId}&error=badtime` });
        return res.end();
      }
      const staffId = form.get("staff_id") ? Number(form.get("staff_id")) : null;
      await store.addBooking(leadId, {
        date, startTime, endTime,
        customerName: form.get("customer_name"),
        phone: form.get("phone"),
        serviceItem: form.get("service_item"),
        channel: form.get("channel") || "xiaohongshu",
        staffId,
      });
      if (await store.getCardMeta(leadId)) await generateCard(store, leadId);
      res.writeHead(302, { Location: `/?lead=${leadId}&saved=1` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/booking/delete") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      await store.deleteBooking(Number(form.get("id")));
      if (await store.getCardMeta(leadId)) await generateCard(store, leadId);
      res.writeHead(302, { Location: `/?lead=${leadId}&saved=1` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/hours/save") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      await store.setBookingSettings(leadId, {
        slotMinutes: Number(form.get("slot_minutes")) || 90,
        hours: parseHoursFromForm(form),
      });
      if (await store.getCardMeta(leadId)) await generateCard(store, leadId);
      res.writeHead(302, { Location: `/?lead=${leadId}&saved=1` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/staff/add") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      const name = (form.get("name") || "").trim();
      if (name) await store.addStaff(leadId, name);
      res.writeHead(302, { Location: `/?lead=${leadId}&saved=1` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/staff/deactivate") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      await store.deactivateStaff(Number(form.get("id")));
      res.writeHead(302, { Location: `/?lead=${leadId}&saved=1` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/card/mark-sent") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      const slots = await getFreeSlots(store, leadId, { days: 7, count: 3 });
      await store.recordCardSend(leadId, slots, form.get("note"));
      res.writeHead(302, { Location: `/?lead=${leadId}&saved=1` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/card/resolve-send") {
      const form = new URLSearchParams(await readBody(req));
      await store.resolveCardSend(Number(form.get("send_id")));
      res.writeHead(302, { Location: req.headers.referer || "/" });
      return res.end();
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`⛔ ${e.message}`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`店主预约后台 → http://localhost:${PORT}/?lead=${DEFAULT_LEAD_ID}`);
});
