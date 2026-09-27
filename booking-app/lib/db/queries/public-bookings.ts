import { prisma } from '@/lib/db'

export async function getPublicWorkspaceBySlug(slug: string) {
  return prisma.workspace.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      services: {
        where: { isArchived: false, isOnlineBookable: true },
        select: { id: true, name: true, duration: true, price: true, priceType: true },
        orderBy: { name: 'asc' },
      },
      locations: {
        select: { id: true, timezone: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })
}

async function findOrCreateClientByPhone(workspaceId: string, name: string, phone: string) {
  const existing = await prisma.client.findFirst({ where: { workspaceId, phone } })
  if (existing) return existing
  return prisma.client.create({ data: { workspaceId, name, phone, memberSince: new Date() } })
}

export async function createPublicBooking(data: {
  workspaceId: string
  locationId: string
  serviceId: string
  servicePrice: number
  serviceDuration: number
  clientName: string
  clientPhone: string
  note?: string
  startTime: Date
  endTime: Date
}) {
  const client = await findOrCreateClientByPhone(data.workspaceId, data.clientName, data.clientPhone)
  return prisma.appointment.create({
    data: {
      workspaceId: data.workspaceId,
      locationId: data.locationId,
      clientId: client.id,
      startTime: data.startTime,
      endTime: data.endTime,
      channel: 'ONLINE',
      status: 'BOOKED',
      notes: data.note,
      services: {
        create: [{ serviceId: data.serviceId, price: data.servicePrice, duration: data.serviceDuration }],
      },
    },
  })
}
