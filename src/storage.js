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
  for (const col of ["author_user_id TEXT", "ip_location TEXT", "profile_url TEXT"]) {
    try {
      d.exec(`ALTER TABLE leads ADD COLUMN ${col}`);
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
      profile_url    TEXT
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
    CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_scraped ON leads(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_score ON analysis(score DESC);
    CREATE INDEX IF NOT EXISTS idx_diag_slug ON diagnoses(diag_slug);
`;

/** 评论抓不到稳定 ID（详情页 DOM 里没有），用正文哈希兜底去重。 */
export function dedupeKey({ source, note_id, body }) {
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
        author_user_id, ip_location, profile_url)
       VALUES (@dedupe_key, @source, @platform, @keyword, @note_id, @url, @title,
               @author, @body, @likes, @published_at, @screenshot, @scraped_at, @scraped_at,
               @author_user_id, @ip_location, @profile_url)`
    )
    .run({
      platform: "xhs",
      keyword: null, note_id: null, url: null, title: null, author: null,
      likes: null, published_at: null, screenshot: null,
      author_user_id: null, ip_location: null, profile_url: null,
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

/** 还没分析过的线索。 */
export const pendingLeads = (limit = 20) =>
  open()
    .prepare(
      `SELECT l.* FROM leads l LEFT JOIN analysis a ON a.lead_id = l.id
       WHERE a.lead_id IS NULL ORDER BY l.id LIMIT ?`
    )
    .all(limit);

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

export function stats() {
  const d = open();
  return {
    leads: d.prepare(`SELECT COUNT(*) n FROM leads`).get().n,
    analyzed: d.prepare(`SELECT COUNT(*) n FROM analysis`).get().n,
    qualified: d.prepare(`SELECT COUNT(*) n FROM analysis WHERE is_lead=1`).get().n,
    byStatus: d.prepare(`SELECT status, COUNT(*) n FROM leads GROUP BY status`).all(),
  };
}
