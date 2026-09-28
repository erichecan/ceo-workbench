import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@/lib/generated/prisma'

export class AppointmentConflictError extends Error {
  constructor() {
    super('该员工在此时段已有预约')
    this.name = 'AppointmentConflictError'
  }
}

const NON_BLOCKING_STATUSES: AppointmentStatus[] = ['CANCELLED', 'NO_SHOW']

export async function hasConflict(
  workspaceId: string,
  teamMemberId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: {
      workspaceId,
      teamMemberId,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      status: { notIn: NON_BLOCKING_STATUSES },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  })
  return count > 0
}

export async function getAppointmentsForRange(
  workspaceId: string,
  locationId: string,
  from: Date,
  to: Date
) {
  return prisma.appointment.findMany({
    where: {
      workspaceId,
      locationId,
      startTime: { gte: from },
      endTime: { lte: to },
      status: { not: 'CANCELLED' },
    },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      teamMember: { select: { id: true, name: true, calendarColor: true } },
      services: { include: { service: { select: { id: true, name: true } } } },
    },
    orderBy: { startTime: 'asc' },
  })
}

export async function countPendingOnlineAppointments(workspaceId: string) {
  return prisma.appointment.count({
    where: { workspaceId, channel: 'ONLINE', status: 'BOOKED' },
  })
}

export async function getAppointment(id: string, workspaceId: string) {
  return prisma.appointment.findFirst({
    where: { id, workspaceId },
    include: {
      client: true,
      teamMember: true,
      services: { include: { service: true } },
    },
  })
}

export async function createAppointment(
  workspaceId: string,
  data: {
    locationId: string
    clientId?: string
    teamMemberId?: string
    startTime: Date
    endTime: Date
    notes?: string
    services: Array<{ serviceId: string; price: number; duration: number }>
  }
) {
  const { services, ...apptData } = data
  if (apptData.teamMemberId) {
    const conflict = await hasConflict(
      workspaceId,
      apptData.teamMemberId,
      apptData.startTime,
      apptData.endTime
    )
    if (conflict) throw new AppointmentConflictError()
  }
  return prisma.appointment.create({
    data: {
      workspaceId,
      ...apptData,
      services: { create: services },
    },
    include: {
      client: true,
      teamMember: true,
      services: { include: { service: true } },
    },
  })
}

export interface AppointmentUpdateData {
  clientId?: string
  teamMemberId?: string
  startTime?: Date
  endTime?: Date
  status?: AppointmentStatus
  notes?: string
}

export async function updateAppointment(
  id: string,
  workspaceId: string,
  data: AppointmentUpdateData
) {
  const touchesSchedule =
    data.teamMemberId !== undefined || data.startTime !== undefined || data.endTime !== undefined
  if (touchesSchedule) {
    const existing = await prisma.appointment.findFirst({ where: { id, workspaceId } })
    if (!existing) return { count: 0 }
    const teamMemberId = data.teamMemberId !== undefined ? data.teamMemberId : existing.teamMemberId
    const startTime = data.startTime ?? existing.startTime
    const endTime = data.endTime ?? existing.endTime
    if (teamMemberId) {
      const conflict = await hasConflict(workspaceId, teamMemberId, startTime, endTime, id)
      if (conflict) throw new AppointmentConflictError()
    }
  }
  return prisma.appointment.updateMany({ where: { id, workspaceId }, data })
}

export async function cancelAppointment(id: string, workspaceId: string) {
  return prisma.appointment.updateMany({
    where: { id, workspaceId },
    data: { status: 'CANCELLED' },
  })
}
