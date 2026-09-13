#!/usr/bin/env node
/**
 * 预约卡录入后台 —— 现在是「自己用」的工具，不是给商户本人用的产品。
 *
 * 零依赖：node:http 手写，跟这个仓库其余脚本一个路数（board.mjs/ledger.mjs
 * 都没引框架）。只监听 localhost，不做鉴权——这台机器之外没人能连进来，
 * 跟 site/server.cjs 那种要挂 Cloud Run 的站点不是一回事，不用同一套安全前提。
 *
 * 用法：node src/card-admin.js [--port 4321]
 * 打开 http://localhost:4321 选一条线索，填营业时间/已占用时段/卡片文案，
 * 保存后立刻重新生成卡片，页面上直接能看到最新效果。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  leadsForCards,
  getBookingSettings,
  setBookingSettings,
  listBookings,
  addBooking,
  deleteBooking,
  listStaff,
  addStaff,
  deactivateStaff,
  recordCardSend,
  findConflictingSends,
  resolveCardSend,
  getCardMeta,
  setCardMeta,
} from "./storage.js";
import { getFreeSlots } from "./booking.js";
import { generateCard, cardSlug, CARD_BG_DIR, CARD_OUT_DIR } from "./card.js";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1]) || 4321;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const CHANNEL_LABELS = { xiaohongshu: "小红书", phone: "电话", walk_in: "到店", other: "其他" };

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function layout(body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>预约卡录入</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2.5rem 1.5rem 6rem;background:#fbfbfa;color:#1a1a19;
       font:15px/1.6 -apple-system,"PingFang SC","Helvetica Neue",sans-serif}
  .wrap{max-width:720px;margin:0 auto}
  h1{font-size:1.3rem;margin:0 0 1.5rem}
  h2{font-size:1rem;color:#4a4a46;margin:2rem 0 .8rem;border-top:1px solid #e5e4e0;padding-top:1.5rem}
  a{color:#a15c00}
  select,input[type=text],input[type=time],input[type=date],input[type=number]{
    font:inherit;padding:.5rem .6rem;border:1px solid #ddd;border-radius:6px;background:#fff}
  label{display:block;font-size:.8rem;color:#6b6b66;margin-bottom:.3rem}
  .row{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
  .field{flex:1;min-width:160px}
  .day{display:flex;align-items:center;gap:.6rem;padding:.4rem 0;border-bottom:1px solid #f0efe9}
  .day span{width:3rem;font-weight:600}
  .day input[type=time]{width:6.5rem}
  table{width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:1rem}
  td,th{padding:.4rem .3rem;border-bottom:1px solid #eee;text-align:left}
  button{padding:.55rem 1.2rem;border:0;border-radius:6px;background:#a15c00;color:#fff;
    font-size:.9rem;cursor:pointer}
  button.secondary{background:#8a8a84}
  button.danger{background:#a13a2f;padding:.3rem .7rem;font-size:.8rem}
  .card-preview{max-width:100%;border-radius:12px;margin:1rem 0;box-shadow:0 8px 30px rgba(0,0,0,.15)}
  .pick-list a{display:block;padding:.7rem .9rem;border:1px solid #e5e4e0;border-radius:8px;
    margin-bottom:.5rem;text-decoration:none;color:#1a1a19;background:#fff}
  .pick-list a:hover{border-color:#a15c00}
  .has-card{color:#3f7d46;font-size:.8rem;margin-left:.5rem}
  .slots-echo{font-size:.85rem;color:#4a4a46;background:#f3efe4;padding:.6rem .8rem;border-radius:8px}
  .flash{background:#e1ebdd;color:#2f5c34;padding:.6rem .9rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}
  .error{background:#f8e1dc;color:#9a3b24;padding:.6rem .9rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}
  .warn{background:#fbf0dc;color:#8a5a00;padding:.6rem .9rem;border-radius:8px;margin-bottom:1rem;font-size:.85rem;line-height:1.7}
  .conflict-item{display:flex;justify-content:space-between;align-items:center;gap:.6rem}
  .item-sub{font-size:.8rem;color:#8a7a6e}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function pickerPage() {
  const leads = leadsForCards();
  const items = leads
    .map(
      (l) =>
        `<a href="/edit?lead=${l.id}">#${l.id} ${esc(l.author || "(无昵称)")} · ${esc(l.product_line || "")}${
          l.has_card ? '<span class="has-card">● 已配置过卡片</span>' : ""
        }</a>`
    )
    .join("");
  return layout(`
    <h1>预约卡录入 · 选一条线索</h1>
    <div class="pick-list">${items || "<p>还没有判定为真实商机的线索。</p>"}</div>
  `);
}

function dayRow(n, hours) {
  const range = hours[String(n)];
  const on = Boolean(range);
  return `<div class="day">
    <span>${WEEKDAYS[n]}</span>
    <input type="checkbox" name="day${n}_on" ${on ? "checked" : ""}>
    <input type="time" name="day${n}_start" value="${on ? range[0] : "10:00"}">
    <span>–</span>
    <input type="time" name="day${n}_end" value="${on ? range[1] : "19:00"}">
  </div>`;
}

function bookingRow(leadId, b, staffList) {
  const staffName = b.staff_id ? staffList.find((s) => s.id === b.staff_id)?.name : null;
  const meta = [b.customer_name, b.phone, b.service_item, CHANNEL_LABELS[b.channel] || b.channel, staffName]
    .filter(Boolean)
    .join(" · ");
  return `<tr>
    <td>${esc(b.date)}<div class="item-sub">${esc(meta)}</div></td><td>${esc(b.start_time)}–${esc(b.end_time)}</td>
    <td><form method="post" action="/booking/delete" style="margin:0">
      <input type="hidden" name="lead" value="${leadId}">
      <input type="hidden" name="id" value="${b.id}">
      <button class="danger" type="submit">删除</button>
    </form></td>
  </tr>`;
}

function staffRow(leadId, s) {
  return `<tr>
    <td>${esc(s.name)}</td>
    <td><form method="post" action="/staff/deactivate" style="margin:0">
      <input type="hidden" name="lead" value="${leadId}">
      <input type="hidden" name="id" value="${s.id}">
      <button class="danger" type="submit">停用</button>
    </form></td>
  </tr>`;
}

/** 见 booking.js 注释：这两个只用来渲染提醒，不阻止写入。 */
function collectSendConflicts(leadId, bookings) {
  const seen = new Map();
  for (const b of bookings) {
    for (const hit of findConflictingSends(leadId, b.date, b.start_time, b.end_time)) seen.set(hit.id, hit);
  }
  return [...seen.values()];
}

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
      <span>这个时段的卡片${s.note ? `发给过「${esc(s.note)}」` : "之前发出去过"}，现在被订上了——确认一下是不是同一位客人</span>
      <form method="post" action="/card/resolve-send" style="display:inline"><input type="hidden" name="send_id" value="${s.id}"><button type="submit">标记已处理</button></form>
    </div>`
    )
    .join("");
  const overlapItems = staffOverlaps
    .map(
      ([a, b]) =>
        `<div class="conflict-item"><span>${esc(a.date)} ${esc(a.start_time)}–${esc(a.end_time)} 跟 ${esc(b.start_time)}–${esc(b.end_time)} 撞车了</span></div>`
    )
    .join("");
  return `<div class="warn">⚠️ 可能有人撞了同一个时段<br>${sendItems}${overlapItems}</div>`;
}

function editPage(leadId, { saved = false, errorMsg = "" } = {}) {
  const leads = leadsForCards();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return layout(`<p>找不到线索 #${leadId}。<a href="/">返回列表</a></p>`);

  const settings = getBookingSettings(leadId) || { slotMinutes: 90, hours: {} };
  const meta = getCardMeta(leadId) || { brand_name: "", region_label: "", style_tags: "", background_file: "" };
  const bookings = listBookings(leadId);
  const staffList = listStaff(leadId);
  const sendConflicts = collectSendConflicts(leadId, bookings);
  const staffOverlaps = collectStaffOverlaps(bookings);
  const backgrounds = fs.existsSync(CARD_BG_DIR) ? fs.readdirSync(CARD_BG_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f)) : [];
  const bgOptions = backgrounds
    .map((f) => `<option value="${esc(f)}" ${f === meta.background_file ? "selected" : ""}>${esc(f)}</option>`)
    .join("");

  const slug = cardSlug(meta.brand_name, lead.author, leadId);
  const outFile = path.join(CARD_OUT_DIR, `${slug}.png`);
  const hasOutput = fs.existsSync(outFile);
  const staffFieldOnForm = staffList.length
    ? `<div class="field"><label>技师</label><select name="staff_id"><option value="">不指定</option>${staffList
        .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
        .join("")}</select></div>`
    : "";

  return layout(`
    <h1>#${leadId} ${esc(lead.author || "")}
      <a href="/" style="font-size:.8rem;margin-left:1rem">← 换一条</a>
      <a href="/schedule?lead=${leadId}" style="font-size:.8rem;margin-left:1rem">📆 完整时间表</a>
    </h1>
    ${saved ? '<div class="flash">已保存，卡片已重新生成 ✓</div>' : ""}
    ${errorMsg ? `<div class="error">${esc(errorMsg)}</div>` : ""}
    ${conflictBanner(sendConflicts, staffOverlaps)}

    <form method="post" action="/save">
      <input type="hidden" name="lead" value="${leadId}">

      <h2>卡片文案（可随时改）</h2>
      <div class="row">
        <div class="field"><label>店名</label>
          <input type="text" name="brand_name" value="${esc(meta.brand_name || lead.author || "")}" style="width:100%"></div>
        <div class="field"><label>地区标签</label>
          <input type="text" name="region_label" value="${esc(meta.region_label)}" style="width:100%" placeholder="如 Scarborough"></div>
        <div class="field"><label>风格标签</label>
          <input type="text" name="style_tags" value="${esc(meta.style_tags)}" style="width:100%" placeholder="如 猫眼 · 日式手绘"></div>
      </div>
      <div class="row">
        <div class="field"><label>底图</label>
          <select name="background_file" style="width:100%">${bgOptions || "<option value=''>data/cards/backgrounds 里还没有图</option>"}</select></div>
        <div class="field"><label>预约时长（分钟/单位时段）</label>
          <input type="number" name="slot_minutes" value="${settings.slotMinutes}" min="15" step="15"></div>
      </div>

      <h2>营业时间</h2>
      ${[0, 1, 2, 3, 4, 5, 6].map((n) => dayRow(n, settings.hours)).join("")}

      <div style="margin-top:1.5rem"><button type="submit">保存并重新生成卡片</button></div>
    </form>

    <h2>已占用时段（未来）</h2>
    <table>
      <thead><tr><th>日期</th><th>时间</th><th></th></tr></thead>
      <tbody>${bookings.map((b) => bookingRow(leadId, b, staffList)).join("") || `<tr><td colspan="3">暂无</td></tr>`}</tbody>
    </table>
    <form method="post" action="/booking/add">
      <input type="hidden" name="lead" value="${leadId}">
      <div class="row">
        <div class="field"><label>日期</label><input type="date" name="booking_date" required></div>
        <div class="field"><label>开始</label><input type="time" name="booking_start" required></div>
        <div class="field"><label>结束</label><input type="time" name="booking_end" required></div>
        <div class="field"><label>客人称呼</label><input type="text" name="customer_name" placeholder="选填"></div>
        <div class="field"><label>电话</label><input type="text" name="phone" placeholder="选填"></div>
        <div class="field"><label>预约项目</label><input type="text" name="service_item" placeholder="选填"></div>
        <div class="field"><label>渠道</label><select name="channel">
          ${Object.entries(CHANNEL_LABELS).map(([v, l]) => `<option value="${v}" ${v === "xiaohongshu" ? "selected" : ""}>${esc(l)}</option>`).join("")}
        </select></div>
        ${staffFieldOnForm}
      </div>
      <button class="secondary" type="submit">添加占用</button>
    </form>

    <h2>技师</h2>
    <table>
      <thead><tr><th>姓名</th><th></th></tr></thead>
      <tbody>${staffList.map((s) => staffRow(leadId, s)).join("") || `<tr><td colspan="2">还没加技师——单人店不用加</td></tr>`}</tbody>
    </table>
    <form method="post" action="/staff/add">
      <input type="hidden" name="lead" value="${leadId}">
      <div class="row"><div class="field"><label>技师姓名</label><input type="text" name="name" required></div></div>
      <button class="secondary" type="submit">添加技师</button>
    </form>

    <h2>卡片预览</h2>
    ${
      hasOutput
        ? `<img class="card-preview" src="/output/${encodeURIComponent(slug)}.png?t=${Date.now()}">`
        : "<p>还没生成过，保存一次试试。</p>"
    }
    <form method="post" action="/card/mark-sent">
      <input type="hidden" name="lead" value="${leadId}">
      <div class="row"><div class="field"><label>发给了谁（选填）</label><input type="text" name="note"></div></div>
      <button class="secondary" type="submit">记一次「已发送」</button>
    </form>
  `);
}

function schedulePage(leadId) {
  const leads = leadsForCards();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return layout(`<p>找不到线索 #${leadId}。<a href="/">返回列表</a></p>`);

  const settings = getBookingSettings(leadId) || { slotMinutes: 90, hours: {} };
  const staffList = listStaff(leadId);
  const columns = staffList.length ? staffList : [{ id: null, name: "店铺" }];
  const bookings = listBookings(leadId);

  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const blocks = [];
  for (let d = 0; d < 5; d++) {
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
    blocks.push({ iso, rows });
  }

  const table = (block) => `
    <h2>${esc(block.iso)}</h2>
    ${
      block.rows.length
        ? `<table><thead><tr><th>时间</th>${columns.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead>
      <tbody>${block.rows
        .map(
          (r) => `<tr><td>${r.time}</td>${r.cells
            .map((b) => (b ? `<td style="background:#fbf0dc">${esc(b.customer_name || b.service_item || "已约")}</td>` : `<td>空</td>`))
            .join("")}</tr>`
        )
        .join("")}</tbody></table>`
        : "<p>当天没营业。</p>"
    }
  `;

  return layout(`
    <h1>#${leadId} ${esc(lead.author || "")} · 完整时间表 <a href="/edit?lead=${leadId}" style="font-size:.8rem;margin-left:1rem">← 返回</a></h1>
    ${blocks.map(table).join("") || "<p>还没设置营业时间。</p>"}
  `);
}

function serveFile(res, dir, filename) {
  const safe = path.basename(filename);
  const full = path.join(dir, safe);
  if (!full.startsWith(dir) || !fs.existsSync(full)) {
    res.writeHead(404);
    res.end("not found");
    return;
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(pickerPage());
    }
    if (req.method === "GET" && url.pathname === "/edit") {
      const leadId = Number(url.searchParams.get("lead"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(
        editPage(leadId, {
          saved: url.searchParams.get("saved") === "1",
          errorMsg: url.searchParams.get("error") === "badtime" ? "结束时间要晚于开始时间，没有写入。" : "",
        })
      );
    }
    if (req.method === "GET" && url.pathname === "/schedule") {
      const leadId = Number(url.searchParams.get("lead"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(schedulePage(leadId));
    }
    if (req.method === "GET" && url.pathname.startsWith("/output/")) {
      return serveFile(res, CARD_OUT_DIR, url.pathname.slice("/output/".length));
    }
    if (req.method === "GET" && url.pathname.startsWith("/bg/")) {
      return serveFile(res, CARD_BG_DIR, url.pathname.slice("/bg/".length));
    }

    if (req.method === "POST" && url.pathname === "/save") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      const lead = leadsForCards().find((l) => l.id === leadId);
      const oldMeta = getCardMeta(leadId);
      const oldSlug = oldMeta ? cardSlug(oldMeta.brand_name, lead?.author, leadId) : null;

      setCardMeta(leadId, {
        brandName: form.get("brand_name"),
        regionLabel: form.get("region_label"),
        styleTags: form.get("style_tags"),
        backgroundFile: form.get("background_file"),
      });
      setBookingSettings(leadId, {
        slotMinutes: Number(form.get("slot_minutes")) || 90,
        hours: parseHoursFromForm(form),
      });
      generateCard(leadId);

      // 改店名会换一个文件名——旧文件不会再被更新，永远定格在改名那一刻的
      // 空位状态，留着就是一份可能已经发出去的过期信息，直接删掉。
      const newSlug = cardSlug(form.get("brand_name"), lead?.author, leadId);
      if (oldSlug && oldSlug !== newSlug) {
        const oldFile = path.join(CARD_OUT_DIR, `${oldSlug}.png`);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      res.writeHead(302, { Location: `/edit?lead=${leadId}&saved=1` });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/booking/add") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      const date = form.get("booking_date");
      const startTime = form.get("booking_start");
      const endTime = form.get("booking_end");
      if (!date || !startTime || !endTime || startTime >= endTime) {
        res.writeHead(302, { Location: `/edit?lead=${leadId}&error=badtime` });
        return res.end();
      }
      const staffId = form.get("staff_id") ? Number(form.get("staff_id")) : null;
      addBooking(leadId, {
        date, startTime, endTime,
        customerName: form.get("customer_name"),
        phone: form.get("phone"),
        serviceItem: form.get("service_item"),
        channel: form.get("channel") || "xiaohongshu",
        staffId,
      });
      if (getCardMeta(leadId)) generateCard(leadId);
      res.writeHead(302, { Location: `/edit?lead=${leadId}&saved=1` });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/booking/delete") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      deleteBooking(Number(form.get("id")));
      if (getCardMeta(leadId)) generateCard(leadId);
      res.writeHead(302, { Location: `/edit?lead=${leadId}&saved=1` });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/staff/add") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      const name = (form.get("name") || "").trim();
      if (name) addStaff(leadId, name);
      res.writeHead(302, { Location: `/edit?lead=${leadId}&saved=1` });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/staff/deactivate") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      deactivateStaff(Number(form.get("id")));
      res.writeHead(302, { Location: `/edit?lead=${leadId}&saved=1` });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/card/mark-sent") {
      const form = new URLSearchParams(await readBody(req));
      const leadId = Number(form.get("lead"));
      recordCardSend(leadId, getFreeSlots(leadId, { days: 7, count: 3 }), form.get("note"));
      res.writeHead(302, { Location: `/edit?lead=${leadId}&saved=1` });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/card/resolve-send") {
      const form = new URLSearchParams(await readBody(req));
      resolveCardSend(Number(form.get("send_id")));
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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`预约卡录入后台 → http://localhost:${PORT}`);
});
