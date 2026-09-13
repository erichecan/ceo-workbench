/**
 * 预约卡：杂志封面感的一张图，发朋友圈/回评论/回私信用。
 *
 * 底图是真实拍摄质感的图片（AI 生图工具产出，人像照片模型画不好中文，
 * 所以底图上不放任何文字），文字（店名/地区/风格标签/空闲时段）全部由
 * 本文件叠加渲染——同一张底图能配任意商户，换的只是数据，不用重新生图。
 *
 * 渲染走本机 Chrome headless screenshot，不引 puppeteer：这个仓库的原则是
 * 能不加依赖就不加，而截图这件事一个 execFileSync 调用就够。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DATA_DIR } from "./config.js";
import { getFreeSlots } from "./booking.js";

export const CARD_BG_DIR = path.join(DATA_DIR, "cards", "backgrounds");
export const CARD_OUT_DIR = path.join(DATA_DIR, "cards", "output");

const CARD_W = 1024;
const CARD_H = 1536;
const CHROME_PATH =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function buildCardHtml({ brandName, regionLabel, styleTags, slots, bgFile }) {
  const bgPath = path.join(CARD_BG_DIR, bgFile);
  const slotChips = slots.length
    ? slots.map((s) => `<div class="slot"><span>${esc(s.label)}</span>${esc(s.time)}</div>`).join("")
    : `<div class="slot empty">这几天时段更新中，直接回复问也一样</div>`;
  const tagline = [regionLabel, styleTags].filter(Boolean).join(" · ");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;1,500&family=Noto+Sans+SC:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden}
  body{font-family:"Noto Sans SC",sans-serif;position:relative;color:#2B2320}
  .bg{position:absolute;inset:0;width:${CARD_W}px;height:${CARD_H}px;object-fit:cover}
  .top-scrim{position:absolute;top:0;left:0;right:0;height:320px;
    background:linear-gradient(180deg, rgba(20,10,10,.55), rgba(20,10,10,0))}
  .masthead{position:absolute;top:56px;left:0;right:0;text-align:center;color:#FBF3EC}
  .brand{font-family:"Bodoni Moda",serif;font-style:italic;font-weight:600;font-size:80px;line-height:1.05;
    text-shadow:0 4px 24px rgba(0,0,0,.35)}
  .tagline{margin-top:14px;font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:#F1DCD0;
    text-shadow:0 2px 12px rgba(0,0,0,.4)}
  .panel{position:absolute;left:48px;right:48px;bottom:56px;background:rgba(30,20,18,.86);
    backdrop-filter:blur(6px);border-radius:26px;padding:38px 44px 42px;color:#F3E9DD;
    box-shadow:0 30px 60px rgba(0,0,0,.4)}
  .panel-label{font-size:20px;letter-spacing:.1em;color:#D9A85C;text-transform:uppercase}
  .panel-title{font-size:38px;font-weight:600;margin-top:6px}
  .slots{display:flex;gap:16px;margin-top:24px}
  .slot{flex:1;text-align:center;background:#F3E9DD;color:#2B2320;border-radius:14px;padding:16px 6px;
    font-size:24px;font-weight:600;font-variant-numeric:tabular-nums}
  .slot span{display:block;font-size:15px;font-weight:400;color:#8A7A6E;margin-bottom:5px;letter-spacing:.05em}
  .slot.empty{font-size:17px;color:#8A7A6E;font-weight:500;padding:22px 10px}
  .cta{margin-top:24px;padding-top:22px;border-top:1px solid rgba(243,233,221,.2);font-size:21px;
    color:#E6D8CC;text-align:center}
  .cta b{color:#F3E9DD}
  </style></head><body>
  <img class="bg" src="file://${bgPath}">
  <div class="top-scrim"></div>
  <div class="masthead">
    <div class="brand">${esc(brandName)}</div>
    ${tagline ? `<div class="tagline">${esc(tagline)}</div>` : ""}
  </div>
  <div class="panel">
    <div class="panel-label">近期可约</div>
    <div class="panel-title">回这张卡，直接约</div>
    <div class="slots">${slotChips}</div>
    <div class="cta">告诉我们想要的<b>时段和款式</b>，其余交给我们</div>
  </div>
  </body></html>`;
}

/** HTML 落一份临时文件再截图——Chrome 的 file:// 截图模式不接受 stdin。 */
export function renderCardPng(html, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpHtml = outPath.replace(/\.png$/, ".tmp.html");
  fs.writeFileSync(tmpHtml, html, "utf-8");
  try {
    execFileSync(
      CHROME_PATH,
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        // 容器里跑（Cloud Run 的 chromium）才需要这两个：沙盒在无特权容器里
        // 起不来，/dev/shm 默认太小会直接崩掉；本机 Chrome 加了也无害。
        "--no-sandbox",
        "--disable-dev-shm-usage",
        `--window-size=${CARD_W},${CARD_H}`,
        "--allow-file-access-from-files",
        `--screenshot=${outPath}`,
        `file://${tmpHtml}`,
      ],
      { stdio: "ignore" }
    );
  } finally {
    fs.unlinkSync(tmpHtml);
  }
}

export function cardSlug(brandName, author, leadId) {
  return (
    (brandName || author || `lead-${leadId}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `lead-${leadId}`
  );
}

/**
 * 生成一张预约卡。要求 lead 已经在 card_meta 里配好店名/地区/风格标签/底图——
 * 没配的直接报错，不用默认值瞎猜，免得批量跑出一堆张冠李生的卡。
 *
 * @param {object} store  见 booking.js 文件头注释——storage.js 或 booking-db.js。
 *   store.getCardMeta() 除了 brand_name 等字段，必须带一个 fallback_name
 *   （品牌名为空时用来兜底的名字，SQLite 那边是 JOIN leads.author 拿到的，
 *   Postgres 那边是迁移时直接写进 card_meta 的一列）——这样这个函数不用
 *   关心「名字从哪个表来」，两边店铺信息表结构不同也不用两套逻辑。
 */
export async function generateCard(store, leadId) {
  const meta = await store.getCardMeta(leadId);
  if (!meta) throw new Error(`lead ${leadId} 还没配置 card_meta（店名/地区/风格标签/底图），先调 setCardMeta`);

  const bgFile = path.join(CARD_BG_DIR, meta.background_file);
  if (!fs.existsSync(bgFile)) throw new Error(`底图不存在：${bgFile}`);

  const slots = await getFreeSlots(store, leadId, { days: 7, count: 3 });
  const html = buildCardHtml({
    brandName: meta.brand_name || meta.fallback_name,
    regionLabel: meta.region_label,
    styleTags: meta.style_tags,
    slots,
    bgFile: meta.background_file,
  });

  const slug = cardSlug(meta.brand_name, meta.fallback_name, leadId);
  const outPath = path.join(CARD_OUT_DIR, `${slug}.png`);
  renderCardPng(html, outPath);
  return { outPath, slots };
}
