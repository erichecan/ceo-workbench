/**
 * 诊断书：一页自包含 HTML，发给潜在客户点开的东西。
 *
 * 结构固定四段，顺序不能改 —— 它是一条说服链：
 *   你的生意 → 我看到的 → 真正的瓶颈 → 建议方案
 * 前两段建立「他真的看过我」，第三段给出他不知道的东西，第四段才落到产品。
 *
 * 不放价格、不放承诺、不放联系方式。这一页的唯一目的是让对方回一句话。
 * 无外链无 CDN：对方可能在墙内打开，一个加载不出来的字体就毁掉第一印象。
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";
import { open } from "./storage.js";

export const DIAG_DIR = path.join(DATA_DIR, "diagnoses");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/** 昵称里的 ASCII 部分 + lead id。纯中文昵称退化成 lead-<id>。 */
export function makeSlug(nickname, leadId) {
  const base = String(nickname || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-${leadId}` : `lead-${leadId}`;
}

const CSS = `*{box-sizing:border-box}
body{margin:0;padding:3rem 1.2rem 5rem;background:#fbfbfa;color:#1a1a19;
     font:16px/1.75 -apple-system,"PingFang SC","Helvetica Neue",sans-serif}
@media(prefers-color-scheme:dark){body{background:#16161a;color:#e8e8e6}
  .row{border-color:#2c2c32}.k,.hero,.foot{color:#9a9a95}}
.wrap{max-width:640px;margin:0 auto}
h1{font-size:1.45rem;margin:0 0 .4rem;line-height:1.35}
.hero{color:#6b6b66;font-size:.92rem;margin:0 0 2.4rem}
.row{padding:1.2rem 0;border-top:1px solid #e5e4e0}
.k{color:#6b6b66;font-size:.8rem;letter-spacing:.06em;margin:0 0 .45rem}
.v{margin:0;font-size:1.05rem}
.big .v{font-size:1.2rem;font-weight:600;line-height:1.5}
.foot{margin-top:2.5rem;color:#6b6b66;font-size:.82rem;line-height:1.7}`;

/** 四段诊断书。缺失的段落整段不渲染，不留空壳。 */
export function buildDiagHtml(lead, d) {
  const row = (k, v, cls = "") =>
    v ? `<div class="row ${cls}"><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p></div>` : "";

  const biz = [d.industry, d.business_size, lead.ip_location].filter(Boolean).join(" · ");
  const plan = [d.product_line, d.reason].filter(Boolean).join(" —— ");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>给 ${esc(lead.author || "你")} 的生意诊断</title><style>${CSS}</style></head>
<body><div class="wrap">
<h1>给 ${esc(lead.author || "你")} 的一页诊断</h1>
<p class="hero">看了你的主页写的。不是模板，也不是报价单。</p>
${row("你的生意", biz)}
${row("我看到的", d.online_assets)}
${row("真正的瓶颈", d.bottleneck, "big")}
${row("建议方案", plan)}
<p class="foot">这页是免费的，看完不用回也没关系。<br>
如果哪里说得不对，欢迎直接指出来 —— 我按公开信息判断，难免有偏差。</p>
</div></body></html>`;
}

/**
 * 给所有有瓶颈的诊断落盘成 HTML，并回写 slug。
 * 没有瓶颈的不生成 —— 那份诊断和同行的报价单没区别，发出去反而掉价。
 */
export function writeDiagCards() {
  fs.mkdirSync(DIAG_DIR, { recursive: true });
  const db = open();
  const rows = db
    .prepare(
      `SELECT l.id, l.author, l.ip_location, d.industry, d.business_size,
              d.online_assets, d.bottleneck, d.product_line, d.reason, d.diag_slug
       FROM leads l JOIN diagnoses d ON d.lead_id = l.id
       WHERE d.bottleneck IS NOT NULL AND TRIM(d.bottleneck) != ''`
    )
    .all();

  const setSlug = db.prepare(`UPDATE diagnoses SET diag_slug=?, diag_html=? WHERE lead_id=?`);
  const files = [];
  for (const r of rows) {
    const slug = r.diag_slug || makeSlug(r.author, r.id);
    const html = buildDiagHtml(r, r);
    const file = path.join(DIAG_DIR, `${slug}.html`);
    fs.writeFileSync(file, html, "utf-8");
    setSlug.run(slug, html, r.id);
    files.push(file);
  }
  return { written: files.length, files };
}
