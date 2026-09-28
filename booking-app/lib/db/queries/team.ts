import { prisma } from '@/lib/db'
import { Role } from '@/lib/generated/prisma'

export async function getTeamMembers(workspaceId: string) {
  return prisma.teamMember.findMany({
    where: { workspaceId, isArchived: false },
    orderBy: { name: 'asc' },
  })
}

export async function getTeamMember(id: string, workspaceId: string) {
  return prisma.teamMember.findFirst({ where: { id, workspaceId } })
}

export async function createTeamMember(
  workspaceId: string,
  data: {
    name: string
    email: string
    role: Role
    calendarColor: string
    isBookable: boolean
    commissionRate?: number
  }
) {
  return prisma.teamMember.create({ data: { workspaceId, ...data } })
}

export async function updateTeamMember(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string
    email: string
    role: Role
    calendarColor: string
    isBookable: boolean
    isArchived: boolean
    commissionRate: number
  }>
) {
  return prisma.teamMember.updateMany({ where: { id, workspaceId }, data })
}

export async function deleteTeamMember(id: string, workspaceId: string) {
  return prisma.teamMember.updateMany({
    where: { id, workspaceId },
    data: { isArchived: true },
  })
}
