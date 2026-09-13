/**
 * 预约系统在 Postgres(Neon)上的存储实现——只服务部署到公网的 portal.js。
 *
 * 线索抓取/分析那套(leads/analysis/diagnoses)继续留在本地 SQLite(storage.js)，
 * 不搬过来：那部分从不部署到 Cloud Run，没有「容器无状态、磁盘写了也留不住」
 * 这个问题，搬过来纯属增加风险、不产生收益。
 *
 * 这个模块和 storage.js 里预约相关的函数签名/行为保持一致（同样的函数名、
 * 同样的参数形状），区别只是这边全部是 async——booking.js/card.js 靠依赖注入
 * 同时兼容两边：`await store.xxx()` 对同步返回值和 Promise 都成立。
 *
 * card_meta 多一个 fallback_name 列，取代 SQLite 版本里靠 JOIN leads.author
 * 拿到的品牌名兜底——这边没有 leads 表，不建跨库依赖，一次性迁移时把
 * author 的值直接写进这一列就行。
 */
import pg from "pg";

const { Pool } = pg;
let pool;

function db() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("未配置 DATABASE_URL");
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function one(sql, params) {
  const { rows } = await db().query(sql, params);
  return rows[0] || null;
}
async function many(sql, params) {
  const { rows } = await db().query(sql, params);
  return rows;
}

export async function getBookingSettings(leadId) {
  const r = await one(`SELECT slot_minutes, hours_json FROM booking_settings WHERE lead_id=$1`, [leadId]);
  return r ? { slotMinutes: r.slot_minutes, hours: JSON.parse(r.hours_json) } : null;
}

export async function setBookingSettings(leadId, { slotMinutes = 90, hours }) {
  await db().query(
    `INSERT INTO booking_settings (lead_id, slot_minutes, hours_json, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (lead_id) DO UPDATE SET
       slot_minutes=excluded.slot_minutes, hours_json=excluded.hours_json, updated_at=excluded.updated_at`,
    [leadId, slotMinutes, JSON.stringify(hours)]
  );
}

export async function listStaff(leadId, { activeOnly = true } = {}) {
  const where = activeOnly ? "AND active=true" : "";
  return many(`SELECT id, name, active, sort_order FROM staff WHERE lead_id=$1 ${where} ORDER BY sort_order, id`, [leadId]);
}

export async function addStaff(leadId, name) {
  const r = await one(`INSERT INTO staff (lead_id, name, created_at) VALUES ($1, $2, now()) RETURNING id`, [leadId, name]);
  return r.id;
}

export async function deactivateStaff(id) {
  await db().query(`UPDATE staff SET active=false WHERE id=$1`, [id]);
}

export async function bookingsOn(leadId, date) {
  return many(`SELECT start_time, end_time, staff_id FROM bookings WHERE lead_id=$1 AND date=$2 AND status='booked'`, [leadId, date]);
}

export async function addBooking(leadId, b) {
  const staffId = b.staffId || null;
  const dup = await one(
    `SELECT id FROM bookings WHERE lead_id=$1 AND date=$2 AND start_time=$3 AND end_time=$4
     AND status='booked' AND staff_id IS NOT DISTINCT FROM $5`,
    [leadId, b.date, b.startTime, b.endTime, staffId]
  );
  if (dup) return dup.id;

  const r = await one(
    `INSERT INTO bookings
     (lead_id, date, start_time, end_time, status, created_at, customer_name, phone, service_item, channel, staff_id)
     VALUES ($1, $2, $3, $4, 'booked', now(), $5, $6, $7, $8, $9)
     RETURNING id`,
    [leadId, b.date, b.startTime, b.endTime, b.customerName || null, b.phone || null, b.serviceItem || null, b.channel || "xiaohongshu", staffId]
  );
  return r.id;
}

export async function listBookings(leadId) {
  return many(
    `SELECT id, date, start_time, end_time, customer_name, phone, service_item, channel, staff_id
     FROM bookings WHERE lead_id=$1 AND status='booked' AND date >= current_date::text
     ORDER BY date, start_time`,
    [leadId]
  );
}

export async function deleteBooking(id) {
  await db().query(`DELETE FROM bookings WHERE id=$1`, [id]);
}

export async function getCardMeta(leadId) {
  return one(`SELECT * FROM card_meta WHERE lead_id=$1`, [leadId]);
}

export async function setCardMeta(leadId, { brandName, regionLabel, styleTags, backgroundFile, fallbackName }) {
  await db().query(
    `INSERT INTO card_meta (lead_id, brand_name, region_label, style_tags, background_file, fallback_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (lead_id) DO UPDATE SET
       brand_name=excluded.brand_name, region_label=excluded.region_label, style_tags=excluded.style_tags,
       background_file=excluded.background_file, fallback_name=excluded.fallback_name, updated_at=excluded.updated_at`,
    [leadId, brandName || null, regionLabel || null, styleTags || null, backgroundFile, fallbackName || null]
  );
}

export async function recordCardSend(leadId, slots, note) {
  await db().query(
    `INSERT INTO card_sends (lead_id, slots_json, note, sent_at, status) VALUES ($1, $2, $3, now(), 'active')`,
    [leadId, JSON.stringify(slots), note || null]
  );
}

export async function findConflictingSends(leadId, date, startTime, endTime) {
  const rows = await many(`SELECT id, slots_json, note, sent_at FROM card_sends WHERE lead_id=$1 AND status='active'`, [leadId]);
  return rows.filter((r) => JSON.parse(r.slots_json).some((s) => s.date === date && s.time < endTime && s.end > startTime));
}

export async function resolveCardSend(id) {
  await db().query(`UPDATE card_sends SET status='resolved' WHERE id=$1`, [id]);
}
