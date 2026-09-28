/**
 * 临时验证脚本：预约冲突检测（M1 单元1）
 * 用法：npx tsx scripts/verify-appointment-conflict.ts
 * 用完即删，不接入 CI。
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const TEST_TAG = 'verify-conflict-test'

async function main() {
  // dynamic import so dotenv.config() above runs before lib/db.ts reads process.env.DATABASE_URL
  const { prisma } = await import('../lib/db')
  const {
    createAppointment,
    updateAppointment,
    hasConflict,
    AppointmentConflictError,
  } = await import('../lib/db/queries/appointments')

  const workspace = await prisma.workspace.findFirst()
  const location = await prisma.location.findFirst({ where: { workspaceId: workspace?.id } })
  const teamMember = await prisma.teamMember.findFirst({ where: { workspaceId: workspace?.id } })
  const service = await prisma.service.findFirst({ where: { workspaceId: workspace?.id } })

  if (!workspace || !location || !teamMember || !service) {
    console.error('缺少种子数据（workspace/location/teamMember/service），先跑 npm run db:seed')
    process.exit(1)
  }

  const createdIds: string[] = []
  let failures = 0

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  PASS: ${msg}`)
    } else {
      console.log(`  FAIL: ${msg}`)
      failures++
    }
  }

  try {
    // --- Case 1: 同员工同时段第二次创建应被拒绝 ---
    console.log('Case 1: 同员工重叠时段')
    const base = new Date()
    base.setHours(9, 0, 0, 0)
    const start1 = new Date(base)
    const end1 = new Date(base.getTime() + 60 * 60000) // 9:00-10:00

    const first = await createAppointment(workspace.id, {
      locationId: location.id,
      teamMemberId: teamMember.id,
      startTime: start1,
      endTime: end1,
      notes: TEST_TAG,
      services: [{ serviceId: service.id, price: service.price, duration: 60 }],
    })
    createdIds.push(first.id)
    assert(!!first.id, '第一条预约创建成功')

    const overlapStart = new Date(base.getTime() + 30 * 60000) // 9:30
    const overlapEnd = new Date(base.getTime() + 90 * 60000) // 10:30
    let secondRejected = false
    try {
      const rejected = await createAppointment(workspace.id, {
        locationId: location.id,
        teamMemberId: teamMember.id,
        startTime: overlapStart,
        endTime: overlapEnd,
        notes: TEST_TAG,
        services: [{ serviceId: service.id, price: service.price, duration: 60 }],
      })
      createdIds.push(rejected.id) // safety net: track even if conflict check unexpectedly let it through
    } catch (err) {
      secondRejected = err instanceof AppointmentConflictError
    }
    assert(secondRejected, '重叠时段第二条预约被 AppointmentConflictError 拒绝')

    // --- Case 2: 不重叠时段应成功 ---
    console.log('Case 2: 同员工不重叠时段')
    const start2 = new Date(base.getTime() + 120 * 60000) // 11:00
    const end2 = new Date(base.getTime() + 180 * 60000) // 12:00
    const second = await createAppointment(workspace.id, {
      locationId: location.id,
      teamMemberId: teamMember.id,
      startTime: start2,
      endTime: end2,
      notes: TEST_TAG,
      services: [{ serviceId: service.id, price: service.price, duration: 60 }],
    })
    createdIds.push(second.id)
    assert(!!second.id, '不重叠的第二条预约创建成功')

    // --- Case 3: 改期到冲突时段应被拒绝 ---
    console.log('Case 3: 改期到已被占用的时段')
    let rescheduleRejected = false
    try {
      await updateAppointment(second.id, workspace.id, {
        startTime: overlapStart,
        endTime: overlapEnd,
      })
    } catch (err) {
      rescheduleRejected = err instanceof AppointmentConflictError
    }
    assert(rescheduleRejected, '改期到冲突时段被拒绝')

    // --- Case 4: 直接调用 hasConflict 断言 ---
    console.log('Case 4: hasConflict 查询函数')
    const conflictNow = await hasConflict(workspace.id, teamMember.id, overlapStart, overlapEnd)
    assert(conflictNow === true, 'hasConflict 对已占用时段返回 true')
    const noConflict = await hasConflict(workspace.id, teamMember.id, new Date(base.getTime() + 240 * 60000), new Date(base.getTime() + 300 * 60000))
    assert(noConflict === false, 'hasConflict 对空闲时段返回 false')

    // --- Case 5: excludeAppointmentId 排除自身 ---
    console.log('Case 5: 改期到自己当前时段不应被拒绝（排除自身）')
    const selfReschedule = await updateAppointment(second.id, workspace.id, {
      startTime: start2,
      endTime: end2,
      notes: TEST_TAG + '-self',
    })
    assert(selfReschedule.count === 1, '改期到自己原时段成功（未被自身冲突误判）')
  } finally {
    if (createdIds.length > 0) {
      await prisma.appointmentService.deleteMany({ where: { appointmentId: { in: createdIds } } })
      await prisma.appointment.deleteMany({ where: { id: { in: createdIds } } })
      console.log(`清理了 ${createdIds.length} 条测试预约`)
    }
    await prisma.$disconnect()
  }

  console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
