import { prisma } from '@/lib/db'
import { syncClientToMailchimp } from '@/lib/notifications/mailchimp'

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
  return prisma.client.findFirst({
    where: { id, workspaceId, isBlocked: false },
    include: {
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 50,
        include: {
          teamMember: { select: { id: true, name: true } },
          services: { include: { service: { select: { id: true, name: true } } } },
        },
      },
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { items: true },
      },
    },
  })
}

export async function createClient(
  workspaceId: string,
  data: { name: string; email?: string; phone?: string; notes?: string }
) {
  const client = await prisma.client.create({ data: { workspaceId, ...data } })
  // fire-and-forget：Mailchimp 同步失败/未配置都不应影响客户创建本身
  syncClientToMailchimp(workspaceId, { email: client.email, name: client.name }).catch((err) => {
    console.error('[notify] mailchimp sync threw unexpectedly:', err)
  })
  return client
}

export async function updateClient(
  id: string,
  workspaceId: string,
  data: Partial<{ name: string; email: string | null; phone: string | null; notes: string | null; isBlocked: boolean }>
) {
  return prisma.client.updateMany({ where: { id, workspaceId }, data })
}
