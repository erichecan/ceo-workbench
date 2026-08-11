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

export function open() {
  if (db) return db;
  ensureDirs();
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
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
      updated_at    TEXT
    );
    CREATE TABLE IF NOT EXISTS analysis (
      lead_id        INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      score          INTEGER NOT NULL,
      is_lead        INTEGER NOT NULL,
      need_summary   TEXT,
      demo_track     TEXT,
      demo_pitch     TEXT,
      first_comment  TEXT,
      dm_angle       TEXT,
      evidence       TEXT,
      risk_flags     TEXT,                     -- JSON 数组：同行/招聘/广告/信息不足
      model          TEXT,
      analyzed_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_scraped ON leads(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_score ON analysis(score DESC);
  `);
  return db;
}

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
        body, likes, published_at, screenshot, scraped_at, updated_at)
       VALUES (@dedupe_key, @source, @platform, @keyword, @note_id, @url, @title,
               @author, @body, @likes, @published_at, @screenshot, @scraped_at, @scraped_at)`
    )
    .run({
      platform: "xhs",
      keyword: null, note_id: null, url: null, title: null, author: null,
      likes: null, published_at: null, screenshot: null,
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
       (lead_id, score, is_lead, need_summary, demo_track, demo_pitch,
        first_comment, dm_angle, evidence, risk_flags, model, analyzed_at)
       VALUES (@lead_id, @score, @is_lead, @need_summary, @demo_track, @demo_pitch,
               @first_comment, @dm_angle, @evidence, @risk_flags, @model, @analyzed_at)
       ON CONFLICT(lead_id) DO UPDATE SET
         score=excluded.score, is_lead=excluded.is_lead,
         need_summary=excluded.need_summary, demo_track=excluded.demo_track,
         demo_pitch=excluded.demo_pitch, first_comment=excluded.first_comment,
         dm_angle=excluded.dm_angle, evidence=excluded.evidence,
         risk_flags=excluded.risk_flags, model=excluded.model,
         analyzed_at=excluded.analyzed_at`
    )
    .run({
      lead_id: leadId,
      score: a.score ?? 0,
      is_lead: a.is_lead ? 1 : 0,
      need_summary: a.need_summary || "",
      demo_track: a.demo_track || "其他",
      demo_pitch: a.demo_pitch || "",
      first_comment: a.first_comment || "",
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
      `SELECT l.*, a.score, a.is_lead, a.need_summary, a.demo_track, a.demo_pitch,
              a.first_comment, a.dm_angle, a.evidence, a.risk_flags, a.analyzed_at
       FROM leads l JOIN analysis a ON a.lead_id = l.id
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

export function stats() {
  const d = open();
  return {
    leads: d.prepare(`SELECT COUNT(*) n FROM leads`).get().n,
    analyzed: d.prepare(`SELECT COUNT(*) n FROM analysis`).get().n,
    qualified: d.prepare(`SELECT COUNT(*) n FROM analysis WHERE is_lead=1`).get().n,
    byStatus: d.prepare(`SELECT status, COUNT(*) n FROM leads GROUP BY status`).all(),
  };
}
