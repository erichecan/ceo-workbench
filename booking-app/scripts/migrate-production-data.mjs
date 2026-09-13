// 只读迁移脚本:把 portal.js 生产库(webproject-booking 分支,只有 5 张表:
// staff/booking_settings/bookings/card_meta/card_sends,没有 leads 表——lead 的展示信息
// 已经拍平进 card_meta)的真实数据映射进新 schema。
//
// 只对源库执行 SELECT,不写回。目标库按需 upsert,可重复跑(幂等)。
//
// 用法:
//   SOURCE_DATABASE_URL="<生产 Neon 连接串>" npm run migrate:production --prefix booking-app
// 目标库连接串取 booking-app/.env.local 里的 DATABASE_URL(即 booking-app-dev 分支)。

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, BookingChannel, AppointmentStatus } from '../lib/generated/prisma/index.js'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })

const sourceUrl = process.env.SOURCE_DATABASE_URL
if (!sourceUrl) {
  console.error('缺少 SOURCE_DATABASE_URL(生产库只读连接串),已中止,未做任何操作。')
  process.exit(1)
}
if (sourceUrl === process.env.DATABASE_URL) {
  console.error('SOURCE_DATABASE_URL 和目标 DATABASE_URL 相同,这会把生产库当成目标库,已中止。')
  process.exit(1)
}

const source = new pg.Client({ connectionString: sourceUrl })
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const dest = new PrismaClient({ adapter })

const CHANNEL_MAP = {
  xiaohongshu: BookingChannel.ONLINE,
  phone: BookingChannel.OFFLINE,
  walk_in: BookingChannel.WALK_IN,
  other: BookingChannel.OFFLINE,
}
const STATUS_MAP = {
  booked: AppointmentStatus.BOOKED,
  cancelled: AppointmentStatus.CANCELLED,
}

function toDateTime(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00`)
}

async function main() {
  await source.connect()

  const { rows: leadRows } = await source.query(
    `SELECT lead_id, brand_name, region_label, fallback_name FROM card_meta ORDER BY lead_id`
  )

  console.log(`源库找到 ${leadRows.length} 个门店(card_meta 行数)。`)

  let workspaceCount = 0
  let staffCount = 0
  let bookingCount = 0
  let skippedBookings = 0

  for (const lead of leadRows) {
    const slug = `lead-${lead.lead_id}`
    const name = lead.brand_name || lead.fallback_name || slug

    const workspace = await dest.workspace.upsert({
      where: { slug },
      update: { name },
      create: { name, slug, taxRate: 13 }, // Ontario HST
    })
    workspaceCount++

    const location = await dest.location.upsert({
      where: { id: `${slug}-main` },
      update: { name: lead.region_label || name },
      create: {
        id: `${slug}-main`,
        workspaceId: workspace.id,
        name: lead.region_label || name,
        timezone: 'America/Toronto', // 客户都在多伦多地区,archive 里的默认值是 Europe/Dublin,不适用
      },
    })

    // ── 技师 ────────────────────────────────────────────────────────────────
    const { rows: staffRows } = await source.query(
      `SELECT id, name, active, sort_order FROM staff WHERE lead_id = $1 ORDER BY sort_order, id`,
      [lead.lead_id]
    )
    const staffIdMap = new Map() // 老 staff.id -> 新 TeamMember.id

    for (const s of staffRows) {
      const email = `staff-${s.id}@${slug}.internal` // 老表没有 email 字段,TeamMember 要求 email 唯一,合成一个占位邮箱
      const teamMember = await dest.teamMember.upsert({
        where: { workspaceId_email: { workspaceId: workspace.id, email } },
        update: { name: s.name, isArchived: !s.active },
        create: {
          workspaceId: workspace.id,
          name: s.name,
          email,
          isArchived: !s.active,
        },
      })
      staffIdMap.set(s.id, teamMember.id)
      staffCount++
    }

    // ── 预约 ────────────────────────────────────────────────────────────────
    const { rows: bookingRows } = await source.query(
      `SELECT id, date, start_time, end_time, status, customer_name, phone, service_item, channel, staff_id
       FROM bookings WHERE lead_id = $1 ORDER BY id`,
      [lead.lead_id]
    )

    for (const b of bookingRows) {
      const status = STATUS_MAP[b.status]
      if (!status) {
        console.warn(`  跳过 booking id=${b.id}:未知 status "${b.status}"`)
        skippedBookings++
        continue
      }

      let clientId = null
      if (b.customer_name || b.phone) {
        const existingClient = b.phone
          ? await dest.client.findFirst({ where: { workspaceId: workspace.id, phone: b.phone } })
          : null
        const client =
          existingClient ??
          (await dest.client.create({
            data: {
              workspaceId: workspace.id,
              name: b.customer_name || '(未留姓名)',
              phone: b.phone || null,
            },
          }))
        clientId = client.id
      }

      const teamMemberId = b.staff_id ? staffIdMap.get(b.staff_id) ?? null : null

      await dest.appointment.upsert({
        where: { id: `${slug}-booking-${b.id}` },
        update: {},
        create: {
          id: `${slug}-booking-${b.id}`,
          workspaceId: workspace.id,
          locationId: location.id,
          clientId,
          teamMemberId,
          startTime: toDateTime(b.date, b.start_time),
          endTime: toDateTime(b.date, b.end_time),
          status,
          channel: CHANNEL_MAP[b.channel] ?? BookingChannel.OFFLINE,
          notes: b.service_item || null,
        },
      })
      bookingCount++
    }
  }

  console.log(`\n迁移完成:${workspaceCount} 个门店(workspace),${staffCount} 个技师,${bookingCount} 条预约。`)
  if (skippedBookings > 0) console.log(`⚠️  ${skippedBookings} 条预约因 status 未知被跳过,需人工核对。`)
  console.log(`\n⚠️  已知未迁移字段(新 schema 暂无对应位置,记录在案,不是丢数据):`)
  console.log(`   booking_settings(营业时间/时段时长)、card_sends(卡片发送追踪) —— 等新系统对应功能落地后再补。`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await source.end()
    await dest.$disconnect()
  })
