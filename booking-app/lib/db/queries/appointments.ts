import { prisma } from '@/lib/db'
import { Prisma } from '@/lib/generated/prisma'

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

type AppointmentPatchData = Omit<
  Prisma.AppointmentUncheckedUpdateManyInput,
  'id' | 'workspaceId' | 'locationId' | 'createdAt' | 'updatedAt'
>

export async function updateAppointment(
  id: string,
  workspaceId: string,
  data: AppointmentPatchData
) {
  return prisma.appointment.updateMany({ where: { id, workspaceId }, data })
}

export async function cancelAppointment(id: string, workspaceId: string) {
  return prisma.appointment.updateMany({
    where: { id, workspaceId },
    data: { status: 'CANCELLED' },
  })
}
