import { prisma } from '@/lib/db'
import { startOfDay, endOfDay } from 'date-fns'

type PaymentMethod = 'CASH' | 'CARD' | 'E_TRANSFER' | 'OTHER'

export async function createSale(
  workspaceId: string,
  data: {
    locationId: string
    appointmentId?: string
    clientId?: string
    teamMemberId?: string
    subtotal: number
    discountAmount: number
    tipAmount: number
    total: number
    paymentMethod: PaymentMethod
    notes?: string
    items: Array<{ serviceId?: string; name: string; price: number }>
  }
) {
  const { items, appointmentId, ...saleData } = data
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        workspaceId,
        appointmentId,
        ...saleData,
        items: { create: items },
      },
      include: {
        items: true,
        client: { select: { id: true, name: true } },
        teamMember: { select: { id: true, name: true } },
      },
    })
    if (appointmentId) {
      await tx.appointment.updateMany({
        where: { id: appointmentId, workspaceId },
        data: { status: 'COMPLETED' },
      })
    }
    return sale
  })
}

export async function getSales(
  workspaceId: string,
  locationId: string,
  from: Date,
  to: Date
) {
  return prisma.sale.findMany({
    where: {
      workspaceId,
      locationId,
      createdAt: { gte: from, lte: to },
    },
    include: {
      client: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getSale(id: string, workspaceId: string) {
  return prisma.sale.findFirst({
    where: { id, workspaceId },
    include: {
      client: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true } },
      items: true,
    },
  })
}

type SaleSummaryRow = {
  total: number
  tipAmount: number
  discountAmount: number
  paymentMethod: string
}

export async function getDailySummary(
  workspaceId: string,
  locationId: string,
  date: Date
) {
  const from = startOfDay(date)
  const to = endOfDay(date)
  const sales = (await prisma.sale.findMany({
    where: { workspaceId, locationId, createdAt: { gte: from, lte: to } },
    select: { total: true, tipAmount: true, discountAmount: true, paymentMethod: true },
  })) as unknown as SaleSummaryRow[]
  const revenue = sales.reduce((sum, s) => sum + s.total, 0)
  const tips = sales.reduce((sum, s) => sum + s.tipAmount, 0)
  const discounts = sales.reduce((sum, s) => sum + s.discountAmount, 0)
  const byMethod: Record<string, number> = { CASH: 0, CARD: 0, E_TRANSFER: 0, OTHER: 0 }
  for (const s of sales) {
    byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total
  }
  return { count: sales.length, revenue, tips, discounts, byMethod }
}
