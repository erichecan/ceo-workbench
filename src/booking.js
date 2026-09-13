/**
 * 从「营业时间 - 已被占用的时段」里算出未来几天真正空闲的时段。
 *
 * 卡片上显示的时段绝不能是编的——那是这张卡片存在的全部意义（比同行随手
 * 报个时间可信）。没配置营业时间的商户返回空数组，卡片那边负责显示占位提示，
 * 不会拿假时间充数。
 *
 * 多技师店的「空闲」是店铺整体口径：只要还有一个技师没被占用，这个时段对
 * 客人来说就是能约的——不能因为技师 A 满了就把整个时段标成不可约，那样卡片
 * 会平白少掉本来能接的生意。没指定技师的预约（含单人店的全部预约）按「占满
 * 所有技师」处理，这是保守默认：店主没标技师，系统没法知道具体是谁被占用了。
 */
import { getBookingSettings, bookingsOn, listStaff } from "./storage.js";

const WEEKDAY_LABEL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function timeOfDay(hhmm) {
  const h = Number(hhmm.slice(0, 2));
  if (h < 12) return "上午";
  if (h < 17) return "下午";
  if (h < 19) return "傍晚";
  return "晚间";
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * @param {number} leadId
 * @param {{days?:number, count?:number, now?:Date}} opts  now 只在测试里传
 * @returns {{date:string, weekday:number, time:string, end:string, label:string}[]}
 */
export function getFreeSlots(leadId, { days = 7, count = 3, now = new Date() } = {}) {
  const settings = getBookingSettings(leadId);
  if (!settings) return [];
  const { slotMinutes, hours } = settings;
  const staffIds = listStaff(leadId).map((s) => s.id);

  const results = [];
  for (let d = 0; d < days && results.length < count; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    const iso = day.toISOString().slice(0, 10);
    const weekday = day.getDay();
    const range = hours[String(weekday)];
    if (!range) continue; // 当天不营业

    const [openT, closeT] = range;
    const booked = bookingsOn(leadId, iso);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (let t = toMinutes(openT); t + slotMinutes <= toMinutes(closeT); t += slotMinutes) {
      if (d === 0 && t <= nowMinutes) continue; // 今天已经过去的时段不展示
      const slotEnd = t + slotMinutes;
      if (!hasCapacity(booked, staffIds, t, slotEnd)) continue;
      const hhmm = toHHMM(t);
      results.push({
        date: iso, weekday, time: hhmm, end: toHHMM(slotEnd),
        label: d === 0 ? timeOfDay(hhmm) : WEEKDAY_LABEL[weekday],
      });
      if (results.length >= count) break;
    }
  }
  return results;
}

/**
 * 单人店（staffIds 为空）：任何重叠预约都占满整个店。
 * 多技师店：没标技师的预约按「占满所有技师」保守处理；标了技师的预约只占
 * 那一个技师——只要还有一个技师没被占用，这个时段就算有空位。
 */
function hasCapacity(booked, staffIds, t, slotEnd) {
  const overlapping = booked.filter((b) => t < toMinutes(b.end_time) && slotEnd > toMinutes(b.start_time));
  if (staffIds.length === 0) return overlapping.length === 0;
  if (overlapping.some((b) => !b.staff_id)) return false;
  const occupied = new Set(overlapping.map((b) => b.staff_id));
  return staffIds.some((id) => !occupied.has(id));
}
