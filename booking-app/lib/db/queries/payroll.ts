import { prisma } from '@/lib/db'

export async function createTimeEntry(
  workspaceId: string,
  data: { teamMemberId: string; clockIn: Date; clockOut?: Date | null }
) {
  return prisma.timeEntry.create({
    data: {
      workspaceId,
      teamMemberId: data.teamMemberId,
      clockIn: data.clockIn,
      clockOut: data.clockOut ?? undefined,
    },
    include: { teamMember: { select: { id: true, name: true } } },
  })
}

export async function updateTimeEntryClockOut(id: string, workspaceId: string, clockOut: Date) {
  return prisma.timeEntry.updateMany({
    where: { id, workspaceId },
    data: { clockOut },
  })
}

export async function listTimeEntries(
  workspaceId: string,
  teamMemberId?: string,
  dateRange?: { from: Date; to: Date }
) {
  return prisma.timeEntry.findMany({
    where: {
      workspaceId,
      ...(teamMemberId && { teamMemberId }),
      ...(dateRange && { clockIn: { gte: dateRange.from, lte: dateRange.to } }),
    },
    include: { teamMember: { select: { id: true, name: true } } },
    orderBy: { clockIn: 'desc' },
  })
}

export async function listPayrollPeriods(workspaceId: string, teamMemberId?: string) {
  return prisma.payrollPeriod.findMany({
    where: { workspaceId, ...(teamMemberId && { teamMemberId }) },
    include: { teamMember: { select: { id: true, name: true } } },
    orderBy: { periodStart: 'desc' },
  })
}

/**
 * hoursWorked = 周期内该员工所有已打卡结束（clockOut 不为空）的 TimeEntry 时长之和。
 * commissionTotal = 周期内该员工所有 Sale 的 SaleItem 中，服务提成比例
 * (Service.commissionRate ?? TeamMember.commissionRate) 乘以 SaleItem.price 后累加，四舍五入取整（分）。
 * 匹配窗口用 TimeEntry.clockIn / Sale.createdAt 落在 [periodStart, periodEnd] 内。
 */
export async function generatePayrollPeriod(
  workspaceId: string,
  teamMemberId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const teamMember = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, workspaceId },
  })
  if (!teamMember) throw new Error('Team member not found')

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      workspaceId,
      teamMemberId,
      clockIn: { gte: periodStart, lte: periodEnd },
      clockOut: { not: null },
    },
  })
  const hoursWorked = timeEntries.reduce((sum, entry) => {
    if (!entry.clockOut) return sum
    const ms = entry.clockOut.getTime() - entry.clockIn.getTime()
    return sum + ms / (1000 * 60 * 60)
  }, 0)

  const sales = await prisma.sale.findMany({
    where: {
      workspaceId,
      teamMemberId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      items: { include: { service: { select: { commissionRate: true } } } },
    },
  })

  let commissionCents = 0
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!item.serviceId) continue
      const rate = item.service?.commissionRate ?? teamMember.commissionRate
      commissionCents += item.price * rate
    }
  }

  return prisma.payrollPeriod.create({
    data: {
      workspaceId,
      teamMemberId,
      periodStart,
      periodEnd,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      commissionTotal: Math.round(commissionCents),
      status: 'DRAFT',
    },
    include: { teamMember: { select: { id: true, name: true } } },
  })
}
