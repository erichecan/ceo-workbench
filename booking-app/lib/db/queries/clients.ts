import { prisma } from '@/lib/db'

export async function getClients(workspaceId: string, search?: string) {
  return prisma.client.findMany({
    where: {
      workspaceId,
      isBlocked: false,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { name: 'asc' },
    take: 200,
  })
}

export async function getClient(id: string, workspaceId: string) {
  return prisma.client.findFirst({ where: { id, workspaceId, isBlocked: false } })
}

export async function createClient(
  workspaceId: string,
  data: { name: string; email?: string; phone?: string; notes?: string }
) {
  return prisma.client.create({ data: { workspaceId, ...data } })
}

export async function updateClient(
  id: string,
  workspaceId: string,
  data: Partial<{ name: string; email: string | null; phone: string | null; notes: string | null; isBlocked: boolean }>
) {
  return prisma.client.updateMany({ where: { id, workspaceId }, data })
}
