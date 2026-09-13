/**
 * SQLite 存储（better-sqlite3，同步 API，单进程脚本用它最省事）。
 *
 * 两张表：
 *   leads     一条抓到的原始线索（一篇笔记，或一条评论），带跟进状态
 *   analysis  这条线索的 AI 分析结果，1:1 挂在 leads 上
 *
 * 分两张表而不是塞一张，是因为它们的生命周期不同：抓取只写 leads，
 * 分析只写 analysis。换了 prompt 想重跑分析时，`DELETE FROM analysis`
 * 就能重来，不用重付一次抓取成本（也不用再冒一次触发风控的险）。
 */
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { DB_PATH, ensureDirs } from "./config.js";

export const STATUSES = ["new", "contacted", "replied", "won", "dropped"];

let db;
let dbFile;

/** 传 customPath 可指向另一个库（测试用临时文件）。不传则用默认库。 */
export function open(customPath = null) {
  if (db && (!customPath || customPath === dbFile)) return db;
  if (db) db.close();
  ensureDirs();
  dbFile = customPath || DB_PATH;
  db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function close() {
  if (db) db.close();
  db = undefined;
  dbFile = undefined;
}

/**
 * 给已存在的 leads 表补列。
 *
 * 用 ALTER TABLE ADD COLUMN 而不是重建表：库里已有真实线索和跟进状态，
 * 重建会丢。SQLite 的 ADD COLUMN 是 O(1) 且不重写数据行。
 * 列已存在时 better-sqlite3 会抛错，catch 掉即可 —— 比先查 PRAGMA 再判断短。
 */
function migrate(d) {
  // ⚠️ better-sqlite3 对多余的命名参数是**静默容忍**的：insertLead 传了
  //    SQL 里没有的字段不会报错，字段直接消失。2026-08-13 因此发现 is_reply
  //    从加上那天起就没存进去过，测试也照过（测的是函数返回值，不是库）。
  //    加新字段时，这里和 insertLead 的 SQL 必须同时改。
  for (const col of [
    "author_user_id TEXT",
    "ip_location TEXT",
    "profile_url TEXT",
    "is_reply INTEGER",
    "note_count INTEGER",
  ]) {
    try {
      d.exec(`ALTER TABLE leads ADD COLUMN ${col}`);
    } catch {
      /* 列已存在 */
    }
  }
  // bookings 补「完整预约记录」需要的五列——staff 表由 SCHEMA 里的
  // CREATE TABLE IF NOT EXISTS 保证在这一步之前已经存在。
  for (const col of [
    "customer_name TEXT",
    "phone TEXT",
    "service_item TEXT",
    "channel TEXT NOT NULL DEFAULT 'xiaohongshu'",
    "staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL",
  ]) {
    try {
      d.exec(`ALTER TABLE bookings ADD COLUMN ${col}`);
    } catch {
      /* 列已存在 */
    }
  }
  // demo_track（十个站型）→ product_line（四条产品线）。老库的列名要跟着改，
  // CREATE TABLE IF NOT EXISTS 不会动已存在的表。
  // 历史行里的旧值不做映射：它们是旧口径的产物，混进新报告只会误导。
  try {
    d.exec(`ALTER TABLE analysis RENAME COLUMN demo_track TO product_line`);
  } catch {
    /* 已改过名，或是新建库 */
  }
  // 公开评论草稿这条路彻底不走了（线索全来自同行评论区，在那儿留评论既是
  // 挖墙脚也撞禁令）。列留着就还是一个能装草稿的地方，一并删掉。
  try {
    d.exec(`ALTER TABLE analysis DROP COLUMN first_comment`);
  } catch {
    /* 已删过，或 SQLite 版本不支持 DROP COLUMN —— 不影响功能 */
  }
}

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key    TEXT    NOT NULL UNIQUE,
      source        TEXT    NOT NULL,          -- note | comment
      platform      TEXT    NOT NULL DEFAULT 'xhs',
      keyword       TEXT,                      -- 由哪个搜索词带出来的
      note_id       TEXT,
      url           TEXT,
      title         TEXT,
      author        TEXT,
      body          TEXT    NOT NULL,
      likes         INTEGER,
      published_at  TEXT,
      screenshot    TEXT,                      -- data/screenshots 下的相对路径
      scraped_at    TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'new',
      follow_note   TEXT,
      updated_at    TEXT,
      -- 以下三列服务 L2：uid 是拉主页的钥匙，属地用于 L1 地域过滤。
      -- 老库由 migrate() 补上，这里的定义只对新建库生效。
      author_user_id TEXT,
      ip_location    TEXT,
      profile_url    TEXT,
      is_reply       INTEGER,      -- 评论模式：是不是楼中楼回复
      note_count     INTEGER       -- 商家模式：他在搜索结果里出现了几篇笔记
    );
    CREATE TABLE IF NOT EXISTS analysis (
      lead_id        INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      score          INTEGER NOT NULL,
      is_lead        INTEGER NOT NULL,
      need_summary   TEXT,
      product_line   TEXT,
      demo_pitch     TEXT,
      dm_angle       TEXT,
      evidence       TEXT,
      risk_flags     TEXT,                     -- JSON 数组：同行/招聘/广告/信息不足
      model          TEXT,
      analyzed_at    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id       TEXT PRIMARY KEY,          -- opencli comments.userId
      nickname      TEXT,                      -- opencli comments.author
      recent_notes  TEXT,                      -- JSON 数组：opencli user 的标题
      profile_url   TEXT,
      status        TEXT NOT NULL,             -- ok | empty（无公开笔记）
      fetched_at    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS diagnoses (
      lead_id       INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      user_id       TEXT,
      industry      TEXT,
      business_size TEXT,
      online_assets TEXT,
      bottleneck    TEXT,
      product_line  TEXT,
      reason        TEXT,
      is_heavy      INTEGER NOT NULL DEFAULT 0,
      diag_html     TEXT,
      diag_slug     TEXT UNIQUE,
      dm_draft      TEXT,
      model         TEXT,
      diagnosed_at  TEXT NOT NULL
    );
    -- 以下两张表服务「预约卡」：卡片上的空闲时段不是编的，是从这里算出来的。
    CREATE TABLE IF NOT EXISTS booking_settings (
      lead_id       INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      slot_minutes  INTEGER NOT NULL DEFAULT 90,
      hours_json    TEXT    NOT NULL,   -- {"1":["10:00","19:00"], ...} 0=周日..6=周六，缺的键=当天不营业
      updated_at    TEXT    NOT NULL
    );
    -- 技师：可选维度。单人店不建任何记录——这时预约按「店铺整体」占用，行为
    -- 跟没有这张表之前完全一样。多技师店才需要建，预约才谈得上「该派谁」。
    CREATE TABLE IF NOT EXISTS staff (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id       INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      date          TEXT    NOT NULL,   -- YYYY-MM-DD
      start_time    TEXT    NOT NULL,   -- HH:MM
      end_time      TEXT    NOT NULL,   -- HH:MM
      status        TEXT    NOT NULL DEFAULT 'booked',  -- booked | cancelled
      created_at    TEXT    NOT NULL,
      -- 以下五列撑起「一条完整预约记录」：谁要来、约的什么、从哪来的、谁接的。
      -- 老库由 migrate() 补上，这里的定义只对新建库生效。
      customer_name TEXT,
      phone         TEXT,
      service_item  TEXT,
      channel       TEXT    NOT NULL DEFAULT 'xiaohongshu',  -- xiaohongshu | phone | walk_in | other
      staff_id      INTEGER REFERENCES staff(id) ON DELETE SET NULL
    );
    -- 卡片上「店名/地区/风格标签/用哪张底图」——展示信息，未来随时可换，
    -- 跟诊断产出的事实字段（industry/bottleneck）分开存，互不干扰。
    CREATE TABLE IF NOT EXISTS card_meta (
      lead_id         INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      brand_name      TEXT,
      region_label    TEXT,
      style_tags      TEXT,
      background_file TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    -- 卡片是静态图，发出去之后系统管不着那份拷贝。这张表记「发出那一刻卡上
    -- 显示的空位」，用来在新预约撞上同一时段时提醒店主——启发式提醒，不强控。
    CREATE TABLE IF NOT EXISTS card_sends (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      slots_json  TEXT    NOT NULL,
      note        TEXT,
      sent_at     TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'active'  -- active | resolved
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_scraped ON leads(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_score ON analysis(score DESC);
    CREATE INDEX IF NOT EXISTS idx_diag_slug ON diagnoses(diag_slug);
    CREATE INDEX IF NOT EXISTS idx_bookings_lead_date ON bookings(lead_id, date);
    CREATE INDEX IF NOT EXISTS idx_staff_lead ON staff(lead_id, active);
    CREATE INDEX IF NOT EXISTS idx_card_sends_lead ON card_sends(lead_id, status);
`;

/**
 * 去重键。三种线索三种口径：
 *
 *   author  —— 商家模式。**一个商家一条线索**，跨关键词也不重复：
 *              同一家美甲店可能同时出现在「多伦多 美甲」和「多伦多 美睫」里，
 *              重复建线索等于对同一个人做两次诊断、发两次私信。
 *   note    —— 笔记本体，note_id 天然唯一。
 *   comment —— 评论抓不到稳定 ID，用正文哈希兜底。
 */
export function dedupeKey({ source, note_id, body, author_user_id }) {
  if (source === "author" && author_user_id) return `author:${author_user_id}`;
  if (source === "note" && note_id) return `note:${note_id}`;
  const hash = crypto.createHash("sha1").update(body || "").digest("hex").slice(0, 16);
  return `comment:${note_id || "?"}:${hash}`;
}

/** 返回 true 表示这条是新的（已存在则原样跳过，不覆盖跟进状态）。 */
export function insertLead(lead) {
  const d = open();
  const key = dedupeKey(lead);
  const r = d
    .prepare(
      `INSERT OR IGNORE INTO leads
       (dedupe_key, source, platform, keyword, note_id, url, title, author,
        body, likes, published_at, screenshot, scraped_at, updated_at,
        author_user_id, ip_location, profile_url, is_reply, note_count)
       VALUES (@dedupe_key, @source, @platform, @keyword, @note_id, @url, @title,
               @author, @body, @likes, @published_at, @screenshot, @scraped_at, @scraped_at,
               @author_user_id, @ip_location, @profile_url, @is_reply, @note_count)`
    )
    .run({
      platform: "xhs",
      keyword: null, note_id: null, url: null, title: null, author: null,
      likes: null, published_at: null, screenshot: null,
      author_user_id: null, ip_location: null, profile_url: null,
      is_reply: 0, note_count: null,
      ...lead,
      dedupe_key: key,
      scraped_at: lead.scraped_at || new Date().toISOString(),
    });
  return r.changes > 0;
}

export function saveAnalysis(leadId, a) {
  open()
    .prepare(
      `INSERT INTO analysis
       (lead_id, score, is_lead, need_summary, product_line, demo_pitch,
        dm_angle, evidence, risk_flags, model, analyzed_at)
       VALUES (@lead_id, @score, @is_lead, @need_summary, @product_line, @demo_pitch,
               @dm_angle, @evidence, @risk_flags, @model, @analyzed_at)
       ON CONFLICT(lead_id) DO UPDATE SET
         score=excluded.score, is_lead=excluded.is_lead,
         need_summary=excluded.need_summary, product_line=excluded.product_line,
         demo_pitch=excluded.demo_pitch,
         dm_angle=excluded.dm_angle, evidence=excluded.evidence,
         risk_flags=excluded.risk_flags, model=excluded.model,
         analyzed_at=excluded.analyzed_at`
    )
    .run({
      lead_id: leadId,
      score: a.score ?? 0,
      is_lead: a.is_lead ? 1 : 0,
      need_summary: a.need_summary || "",
      product_line: a.product_line || "官网",
      demo_pitch: a.demo_pitch || "",
      dm_angle: a.dm_angle || "",
      evidence: a.evidence || "",
      risk_flags: JSON.stringify(a.risk_flags || []),
      model: a.model || "",
      analyzed_at: new Date().toISOString(),
    });
}

/**
 * 把所有待分析的非北美线索一次性标记掉，返回处理条数。
 *
 * 地域过滤是集合操作，不该在 AI 循环里逐条穿越 —— 2026-08-13 实测：队列前面
 * 积压了上百条上个渠道遗留的国内线索，analyze 每次都要一条条走过它们才够到
 * 真正要分析的商家，limit 再怎么调都白搭。一条 SQL 秒级清完。
 *
 * ip_location IS NULL 的**不动**：商家模式没有属地字段，地域靠搜索词保证，
 * 交给 L1 的模型判断。这里只处理明确不在北美的。
 */
export function skipNonTargetRegion(model = "") {
  const r = open()
    .prepare(
      `INSERT INTO analysis (lead_id, score, is_lead, need_summary, product_line,
                             demo_pitch, dm_angle, evidence, risk_flags, model, analyzed_at)
       SELECT l.id, 25, 0, '属地 ' || l.ip_location || '，不在目标市场（北美）',
              '官网', '', '', '', '["非目标地区"]', @model, @at
       FROM leads l LEFT JOIN analysis a ON a.lead_id = l.id
       WHERE a.lead_id IS NULL
         AND l.ip_location IS NOT NULL
         AND l.ip_location NOT IN ('美国','加拿大')`
    )
    .run({ model, at: new Date().toISOString() });
  return r.changes;
}

/**
 * 还没分析过的线索。keyword 传入时只取该搜索词带出来的
 * —— 队列按 id 排，新抓的品类排在积压后面，想针对性验证某个品类就得能挑。
 */
export const pendingLeads = (limit = 20, keyword = null) =>
  open()
    .prepare(
      `SELECT l.* FROM leads l LEFT JOIN analysis a ON a.lead_id = l.id
       WHERE a.lead_id IS NULL AND (? IS NULL OR l.keyword = ?)
       ORDER BY l.id LIMIT ?`
    )
    .all(keyword, keyword, limit);

/** 已分析的线索，按分数降序。since 传 'YYYY-MM-DD' 只取当天及以后。 */
export function analyzedLeads({ since = null, minScore = 0 } = {}) {
  const rows = open()
    .prepare(
      `SELECT l.*, a.score, a.is_lead, a.need_summary, a.product_line, a.demo_pitch,
              a.dm_angle, a.evidence, a.risk_flags, a.analyzed_at,
              d.industry, d.business_size, d.online_assets, d.bottleneck,
              d.reason, d.is_heavy, d.diag_slug, d.dm_draft
       FROM leads l JOIN analysis a ON a.lead_id = l.id
       LEFT JOIN diagnoses d ON d.lead_id = l.id
       WHERE a.score >= ? AND (? IS NULL OR l.scraped_at >= ?)
       ORDER BY a.score DESC, l.likes DESC`
    )
    .all(minScore, since, since);
  return rows.map((r) => ({ ...r, risk_flags: JSON.parse(r.risk_flags || "[]") }));
}

export function setStatus(id, status, note = null) {
  if (!STATUSES.includes(status)) throw new Error(`状态只能是 ${STATUSES.join(" / ")}`);
  const r = open()
    .prepare(`UPDATE leads SET status=?, follow_note=COALESCE(?, follow_note), updated_at=? WHERE id=?`)
    .run(status, note, new Date().toISOString(), id);
  return r.changes > 0;
}

export function saveProfile(p) {
  open()
    .prepare(
      `INSERT INTO profiles (user_id, nickname, recent_notes, profile_url, status, fetched_at)
       VALUES (@user_id, @nickname, @recent_notes, @profile_url, @status, @fetched_at)
       ON CONFLICT(user_id) DO UPDATE SET
         nickname=excluded.nickname, recent_notes=excluded.recent_notes,
         profile_url=excluded.profile_url, status=excluded.status,
         fetched_at=excluded.fetched_at`
    )
    .run({
      user_id: p.user_id,
      nickname: p.nickname || null,
      recent_notes: JSON.stringify(p.recent_notes || []),
      profile_url: p.profile_url || null,
      status: p.status || "ok",
      fetched_at: new Date().toISOString(),
    });
}

export function getProfile(userId) {
  const r = open().prepare(`SELECT * FROM profiles WHERE user_id=?`).get(userId);
  return r ? { ...r, recent_notes: JSON.parse(r.recent_notes || "[]") } : null;
}

/**
 * 待抓主页的线索：值得深挖、在北美、有 uid、且还没抓过。
 *
 * 地域过滤写进 SQL 而不是拉出来再过滤 —— 非北美的线索连查都不查出来，
 * L2 的主页配额不会被它们占掉。
 */
export function leadsNeedingProfile(limit = 8) {
  return open()
    .prepare(
      `SELECT l.* FROM leads l
       JOIN analysis a ON a.lead_id = l.id
       LEFT JOIN profiles p ON p.user_id = l.author_user_id
       WHERE a.is_lead = 1 AND l.author_user_id IS NOT NULL
         AND p.user_id IS NULL
         AND (l.ip_location IS NULL OR l.ip_location IN ('美国','加拿大'))
       ORDER BY a.score DESC LIMIT ?`
    )
    .all(limit);
}

/** 主页已抓到内容（status=ok）、但还没做生意诊断的线索。扑空的不进。 */
export function leadsNeedingDiagnosis(limit = 8) {
  return open()
    .prepare(
      `SELECT l.* FROM leads l
       JOIN analysis a ON a.lead_id = l.id
       JOIN profiles p ON p.user_id = l.author_user_id AND p.status = 'ok'
       LEFT JOIN diagnoses d ON d.lead_id = l.id
       WHERE d.lead_id IS NULL ORDER BY a.score DESC LIMIT ?`
    )
    .all(limit);
}

export function saveDiagnosis(leadId, d) {
  open()
    .prepare(
      `INSERT INTO diagnoses (lead_id, user_id, industry, business_size, online_assets,
                              bottleneck, product_line, reason, is_heavy, diag_html,
                              diag_slug, dm_draft, model, diagnosed_at)
       VALUES (@lead_id, @user_id, @industry, @business_size, @online_assets,
               @bottleneck, @product_line, @reason, @is_heavy, @diag_html,
               @diag_slug, @dm_draft, @model, @diagnosed_at)
       ON CONFLICT(lead_id) DO UPDATE SET
         industry=excluded.industry, business_size=excluded.business_size,
         online_assets=excluded.online_assets, bottleneck=excluded.bottleneck,
         product_line=excluded.product_line, reason=excluded.reason,
         is_heavy=excluded.is_heavy, diag_html=excluded.diag_html,
         diag_slug=excluded.diag_slug, dm_draft=excluded.dm_draft,
         model=excluded.model, diagnosed_at=excluded.diagnosed_at`
    )
    .run({
      lead_id: leadId,
      user_id: d.user_id || null,
      industry: d.industry || null,
      business_size: d.business_size || null,
      online_assets: d.online_assets || null,
      bottleneck: d.bottleneck || null,
      product_line: d.product_line || null,
      reason: d.reason || null,
      is_heavy: d.is_heavy ? 1 : 0,
      diag_html: d.diag_html || null,
      diag_slug: d.diag_slug || null,
      dm_draft: d.dm_draft || null,
      model: d.model || null,
      diagnosed_at: new Date().toISOString(),
    });
}

/** 商户自己维护的营业时间。每次调用整条覆盖——店主改营业时间不用先查旧值。 */
export function setBookingSettings(leadId, { slotMinutes = 90, hours }) {
  open()
    .prepare(
      `INSERT INTO booking_settings (lead_id, slot_minutes, hours_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(lead_id) DO UPDATE SET
         slot_minutes=excluded.slot_minutes, hours_json=excluded.hours_json,
         updated_at=excluded.updated_at`
    )
    .run(leadId, slotMinutes, JSON.stringify(hours), new Date().toISOString());
}

export function getBookingSettings(leadId) {
  const r = open().prepare(`SELECT slot_minutes, hours_json FROM booking_settings WHERE lead_id=?`).get(leadId);
  return r ? { slotMinutes: r.slot_minutes, hours: JSON.parse(r.hours_json) } : null;
}

/**
 * @param {number} leadId
 * @param {{date:string, startTime:string, endTime:string, customerName?:string,
 *          phone?:string, serviceItem?:string, channel?:string, staffId?:number}} b
 * @returns {number} 插入（或命中的已有）那条预约的 id
 */
export function addBooking(leadId, b) {
  const d = open();
  const staffId = b.staffId || null;
  // 同一技师/同一店铺、同一天同一起止时间的记录已经存在——大概率是表单重复
  // 提交（双击 / 网络重试），不再插第二条，直接把已有那条的 id 还回去。
  const dup = d
    .prepare(
      `SELECT id FROM bookings WHERE lead_id=? AND date=? AND start_time=? AND end_time=?
       AND status='booked' AND staff_id IS ?`
    )
    .get(leadId, b.date, b.startTime, b.endTime, staffId);
  if (dup) return dup.id;

  const r = d
    .prepare(
      `INSERT INTO bookings
       (lead_id, date, start_time, end_time, status, created_at,
        customer_name, phone, service_item, channel, staff_id)
       VALUES (?, ?, ?, ?, 'booked', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      leadId, b.date, b.startTime, b.endTime, new Date().toISOString(),
      b.customerName || null, b.phone || null, b.serviceItem || null,
      b.channel || "xiaohongshu", staffId
    );
  return r.lastInsertRowid;
}


/** 未来的全部占用（不分日期），供录入界面展示/删除用。 */
export function listBookings(leadId) {
  return open()
    .prepare(
      `SELECT id, date, start_time, end_time, customer_name, phone,
              service_item, channel, staff_id
       FROM bookings
       WHERE lead_id=? AND status='booked' AND date >= date('now')
       ORDER BY date, start_time`
    )
    .all(leadId);
}

export function deleteBooking(id) {
  open().prepare(`DELETE FROM bookings WHERE id=?`).run(id);
}

/** 技师列表；activeOnly=false 时连停用的一起返回，管理界面要看全貌时用。 */
export function listStaff(leadId, { activeOnly = true } = {}) {
  const where = activeOnly ? "AND active=1" : "";
  return open()
    .prepare(`SELECT id, name, active, sort_order FROM staff WHERE lead_id=? ${where} ORDER BY sort_order, id`)
    .all(leadId);
}

export function addStaff(leadId, name) {
  const r = open()
    .prepare(`INSERT INTO staff (lead_id, name, created_at) VALUES (?, ?, ?)`)
    .run(leadId, name, new Date().toISOString());
  return r.lastInsertRowid;
}

/** 技师离职/下线——不物理删除，已经挂在历史预约上的 staff_id 不该跟着变野。 */
export function deactivateStaff(id) {
  open().prepare(`UPDATE staff SET active=0 WHERE id=?`).run(id);
}

/**
 * 卡片发出去那一刻，把当时显示的空位快照落一份——卡片是静态图，发出去之后
 * 系统管不着那份拷贝，只能靠这份快照在日后撞车时提醒店主。
 */
export function recordCardSend(leadId, slots, note) {
  open()
    .prepare(`INSERT INTO card_sends (lead_id, slots_json, note, sent_at, status) VALUES (?, ?, ?, ?, 'active')`)
    .run(leadId, JSON.stringify(slots), note || null, new Date().toISOString());
}

/**
 * 找出还是 active、且快照里的时段跟这个新预约有重叠的发送记录。
 * 按时间段重叠做启发式匹配——没有客户身份体系，做不到精确匹配到同一个人，
 * 只能提醒店主自己判断，不做强控制（不阻止预约写入）。
 */
export function findConflictingSends(leadId, date, startTime, endTime) {
  return open()
    .prepare(`SELECT id, slots_json, note, sent_at FROM card_sends WHERE lead_id=? AND status='active'`)
    .all(leadId)
    .filter((r) =>
      JSON.parse(r.slots_json).some((s) => s.date === date && s.time < endTime && s.end > startTime)
    );
}

export function resolveCardSend(id) {
  open().prepare(`UPDATE card_sends SET status='resolved' WHERE id=?`).run(id);
}

/** 卡片文件名兜底要用到昵称，取最小字段就够。 */
export function getLead(id) {
  return open().prepare(`SELECT id, author FROM leads WHERE id=?`).get(id) || null;
}

/**
 * 够格出预约卡的线索——不是「所有真线索」，是「靠时段吃饭的生意」。
 * 预约卡这个功能只对『预约系统』产品线有意义：地产经纪、摄影师这些不按
 * 时段卖钱，混进这个列表只会让人不知道点进去要干嘛。
 * has_card 标出已经配过卡片素材的。
 */
export function leadsForCards(productLine = "预约系统") {
  return open()
    .prepare(
      `SELECT l.id, l.author, a.product_line,
              CASE WHEN cm.lead_id IS NULL THEN 0 ELSE 1 END AS has_card
       FROM leads l
       JOIN analysis a ON a.lead_id = l.id
       LEFT JOIN card_meta cm ON cm.lead_id = l.id
       WHERE a.is_lead = 1 AND a.product_line = ?
       ORDER BY has_card DESC, l.id DESC`
    )
    .all(productLine);
}

export function bookingsOn(leadId, date) {
  return open()
    .prepare(`SELECT start_time, end_time, staff_id FROM bookings WHERE lead_id=? AND date=? AND status='booked'`)
    .all(leadId, date);
}

export function setCardMeta(leadId, { brandName, regionLabel, styleTags, backgroundFile }) {
  open()
    .prepare(
      `INSERT INTO card_meta (lead_id, brand_name, region_label, style_tags, background_file, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(lead_id) DO UPDATE SET
         brand_name=excluded.brand_name, region_label=excluded.region_label,
         style_tags=excluded.style_tags, background_file=excluded.background_file,
         updated_at=excluded.updated_at`
    )
    .run(leadId, brandName || null, regionLabel || null, styleTags || null, backgroundFile, new Date().toISOString());
}

/** fallback_name：品牌名为空时 card.js 用来兜底的名字，统一走 leads.author——
 *  跟 Postgres 那边 card_meta.fallback_name 是同一个作用，接口形状对齐。 */
export function getCardMeta(leadId) {
  return (
    open()
      .prepare(
        `SELECT cm.*, l.author AS fallback_name FROM card_meta cm
         JOIN leads l ON l.id = cm.lead_id WHERE cm.lead_id=?`
      )
      .get(leadId) || null
  );
}

export function stats() {
  const d = open();
  return {
    leads: d.prepare(`SELECT COUNT(*) n FROM leads`).get().n,
    analyzed: d.prepare(`SELECT COUNT(*) n FROM analysis`).get().n,
    qualified: d.prepare(`SELECT COUNT(*) n FROM analysis WHERE is_lead=1`).get().n,
    byStatus: d.prepare(`SELECT status, COUNT(*) n FROM leads GROUP BY status`).all(),
  };
}
