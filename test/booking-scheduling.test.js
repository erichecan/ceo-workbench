import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as store from "../src/storage.js";
import { getFreeSlots } from "../src/booking.js";

function freshDb() {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "leads-")), "t.db");
  store.close();
  store.open(p);
  return p;
}

function mkLead(n = 1) {
  store.insertLead({ source: "comment", body: `内容${n}`, note_id: `n${n}`, author: `店${n}` });
  return store.open().prepare("SELECT id FROM leads").get().id;
}

test("预约记录能存下姓名/电话/项目/渠道/技师", () => {
  freshDb();
  const leadId = mkLead();
  const staffId = store.addStaff(leadId, "小美");
  store.addBooking(leadId, {
    date: "2026-09-20", startTime: "10:00", endTime: "11:30",
    customerName: "王小姐", phone: "6471234567", serviceItem: "美甲+手绘",
    channel: "xiaohongshu", staffId,
  });
  const [b] = store.listBookings(leadId);
  assert.equal(b.customer_name, "王小姐");
  assert.equal(b.phone, "6471234567");
  assert.equal(b.service_item, "美甲+手绘");
  assert.equal(b.channel, "xiaohongshu");
  assert.equal(b.staff_id, staffId);
});

test("渠道不填时默认小红书，姓名/电话/项目/技师都可以不填", () => {
  freshDb();
  const leadId = mkLead();
  store.addBooking(leadId, { date: "2026-09-20", startTime: "10:00", endTime: "11:30" });
  const [b] = store.listBookings(leadId);
  assert.equal(b.channel, "xiaohongshu");
  assert.equal(b.staff_id, null);
});

test("技师停用后 listStaff 默认不再返回，但历史预约的 staff_id 不受影响", () => {
  freshDb();
  const leadId = mkLead();
  const staffId = store.addStaff(leadId, "小美");
  store.addBooking(leadId, { date: "2026-09-20", startTime: "10:00", endTime: "11:00", staffId });
  store.deactivateStaff(staffId);
  assert.deepEqual(store.listStaff(leadId).map((s) => s.name), []);
  assert.equal(store.listStaff(leadId, { activeOnly: false }).length, 1);
  assert.equal(store.listBookings(leadId)[0].staff_id, staffId);
});

test("单人店（没有技师）：一个预约占满这个时段", () => {
  freshDb();
  const leadId = mkLead();
  const now = new Date("2026-09-14T09:00:00"); // 周一
  store.setBookingSettings(leadId, { slotMinutes: 60, hours: { "1": ["10:00", "12:00"] } });
  store.addBooking(leadId, { date: "2026-09-14", startTime: "10:00", endTime: "11:00" });
  const slots = getFreeSlots(leadId, { days: 1, count: 5, now });
  assert.deepEqual(slots.map((s) => s.time), ["11:00"]);
});

test("多技师店：技师A被占用，技师B还空着，这个时段仍然显示在卡片上", () => {
  freshDb();
  const leadId = mkLead();
  const now = new Date("2026-09-14T09:00:00");
  const a = store.addStaff(leadId, "技师A");
  store.addStaff(leadId, "技师B");
  store.setBookingSettings(leadId, { slotMinutes: 60, hours: { "1": ["10:00", "12:00"] } });
  store.addBooking(leadId, { date: "2026-09-14", startTime: "10:00", endTime: "11:00", staffId: a });
  const slots = getFreeSlots(leadId, { days: 1, count: 5, now });
  assert.deepEqual(slots.map((s) => s.time), ["10:00", "11:00"]);
});

test("多技师店：两个技师都被占用，这个时段才算满", () => {
  freshDb();
  const leadId = mkLead();
  const now = new Date("2026-09-14T09:00:00");
  const a = store.addStaff(leadId, "技师A");
  const b = store.addStaff(leadId, "技师B");
  store.setBookingSettings(leadId, { slotMinutes: 60, hours: { "1": ["10:00", "12:00"] } });
  store.addBooking(leadId, { date: "2026-09-14", startTime: "10:00", endTime: "11:00", staffId: a });
  store.addBooking(leadId, { date: "2026-09-14", startTime: "10:00", endTime: "11:00", staffId: b });
  const slots = getFreeSlots(leadId, { days: 1, count: 5, now });
  assert.deepEqual(slots.map((s) => s.time), ["11:00"]);
});

test("多技师店：没标技师的预约按占满全部技师保守处理", () => {
  freshDb();
  const leadId = mkLead();
  const now = new Date("2026-09-14T09:00:00");
  store.addStaff(leadId, "技师A");
  store.addStaff(leadId, "技师B");
  store.setBookingSettings(leadId, { slotMinutes: 60, hours: { "1": ["10:00", "12:00"] } });
  store.addBooking(leadId, { date: "2026-09-14", startTime: "10:00", endTime: "11:00" }); // 没填 staffId
  const slots = getFreeSlots(leadId, { days: 1, count: 5, now });
  assert.deepEqual(slots.map((s) => s.time), ["11:00"]);
});

test("卡片发送快照能找出重叠时段的冲突，标记已处理后不再命中", () => {
  freshDb();
  const leadId = mkLead();
  store.recordCardSend(leadId, [{ date: "2026-09-20", time: "10:00", end: "11:30" }], "发给了@小红薯用户A");
  const hits = store.findConflictingSends(leadId, "2026-09-20", "10:30", "12:00");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].note, "发给了@小红薯用户A");

  const noHit = store.findConflictingSends(leadId, "2026-09-20", "12:00", "13:00");
  assert.equal(noHit.length, 0);

  store.resolveCardSend(hits[0].id);
  assert.equal(store.findConflictingSends(leadId, "2026-09-20", "10:30", "12:00").length, 0);
});
