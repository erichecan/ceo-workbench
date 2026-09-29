import { prisma } from '@/lib/db'
import { startOfDay, endOfDay } from 'date-fns'
import { validateCoupon, incrementCouponUsage, CouponValidationError } from './coupons'
import { getGiftCardByCode, redeemGiftCard, GiftCardError } from './gift-cards'

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

export class CheckoutError extends Error {}

export interface CheckoutItemInput {
  serviceId?: string
  productId?: string
  name: string
  price: number
  quantity?: number
}

export interface CheckoutInput {
  locationId: string
  appointmentId?: string
  clientId?: string
  teamMemberId?: string
  discountAmount: number
  tipAmount: number
  paymentMethod: PaymentMethod
  notes?: string
  items: CheckoutItemInput[]
  couponCode?: string
  giftCardCode?: string
  giftCardAmount?: number
  redeemPoints?: number
}

/**
 * 结账：服务+商品一起卖，联动优惠券/礼品卡/积分，全部在一个事务内完成。
 * 金额抵扣顺序（与 total 公式一致）：subtotal -> 手动折扣 -> 优惠券 -> 礼品卡 -> 积分，
 * 每一步都在剩余可抵扣金额（remaining）内封顶，remaining 不会小于 0。
 * 税：本项目当前没有任何地方真正计算 taxRate/taxAmount（现状确认过，全代码库唯一引用在
 * Prisma 生成代码里），沿用现状不发明新规则，taxAmount 继续为 0（走 schema 默认值）。
 */
export async function checkoutSale(workspaceId: string, input: CheckoutInput) {
  return prisma.$transaction(async (tx) => {
    const subtotal = input.items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0)
    let remaining = Math.max(0, subtotal - input.discountAmount)

    // ---- 库存校验 + 扣减（先校验全部再扣减，任何一项不足直接整体失败）----
    for (const item of input.items) {
      if (!item.productId) continue
      const qty = item.quantity ?? 1
      const product = await tx.product.findFirst({ where: { id: item.productId, workspaceId } })
      if (!product) throw new CheckoutError(`Product not found: ${item.name}`)
      if (product.isArchived) throw new CheckoutError(`Product archived: ${item.name}`)
      if (product.stockQty < qty) throw new CheckoutError(`Insufficient stock for ${item.name}`)
    }
    for (const item of input.items) {
      if (!item.productId) continue
      const qty = item.quantity ?? 1
      const result = await tx.product.updateMany({
        where: { id: item.productId, workspaceId, stockQty: { gte: qty } },
        data: { stockQty: { decrement: qty } },
      })
      if (result.count === 0) throw new CheckoutError(`Insufficient stock for ${item.name}`)
    }

    // ---- 优惠券 ----
    let couponAmount = 0
    let couponId: string | null = null
    if (input.couponCode) {
      try {
        const { coupon, discountAmount } = await validateCoupon(workspaceId, input.couponCode, remaining, tx)
        couponId = coupon.id
        couponAmount = discountAmount
        remaining -= couponAmount
      } catch (err) {
        if (err instanceof CouponValidationError) throw new CheckoutError(err.message)
        throw err
      }
    }

    // ---- 礼品卡 ----
    let giftCardAmount = 0
    if (input.giftCardCode) {
      const card = await getGiftCardByCode(workspaceId, input.giftCardCode, tx)
      if (!card) throw new CheckoutError('Gift card not found')
      const requested = input.giftCardAmount ?? Math.min(card.balance, remaining)
      giftCardAmount = Math.min(Math.max(requested, 0), remaining)
      if (giftCardAmount <= 0) throw new CheckoutError('Gift card redeem amount must be positive')
      try {
        await redeemGiftCard(workspaceId, input.giftCardCode, giftCardAmount, tx)
      } catch (err) {
        if (err instanceof GiftCardError) throw new CheckoutError(err.message)
        throw err
      }
      remaining -= giftCardAmount
    }

    // ---- 积分抵扣 + 积分累计 ----
    let pointsRedeemed = 0
    let pointsEarned = 0
    const client = input.clientId
      ? await tx.client.findFirst({ where: { id: input.clientId, workspaceId } })
      : null
    if (input.clientId && !client) throw new CheckoutError('Client not found')

    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } })
    if (!workspace) throw new CheckoutError('Workspace not found')

    if (input.redeemPoints && input.redeemPoints > 0) {
      if (!client) throw new CheckoutError('Client required to redeem points')
      const maxByBalance = Math.min(input.redeemPoints, client.pointsBalance)
      const maxByOrderCents =
        workspace.pointsValueCents > 0 ? Math.floor(remaining / workspace.pointsValueCents) : 0
      pointsRedeemed = Math.max(0, Math.min(maxByBalance, maxByOrderCents))
      remaining -= pointsRedeemed * workspace.pointsValueCents
    }

    // 积分累计基于折扣/优惠券后的“真实消费额”（不含礼品卡/积分抵扣、不含小费），按整美元计
    if (client) {
      const earnBaseCents = Math.max(0, subtotal - input.discountAmount - couponAmount)
      pointsEarned = Math.floor(earnBaseCents / 100) * workspace.pointsPerEuro
    }

    const total = Math.max(0, remaining) + input.tipAmount

    const sale = await tx.sale.create({
      data: {
        workspaceId,
        locationId: input.locationId,
        appointmentId: input.appointmentId,
        clientId: input.clientId,
        teamMemberId: input.teamMemberId,
        subtotal,
        discountAmount: input.discountAmount,
        tipAmount: input.tipAmount,
        couponAmount,
        giftCardAmount,
        pointsEarned,
        pointsRedeemed,
        total,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        items: {
          create: input.items.map((item) => ({
            serviceId: item.serviceId,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity ?? 1,
          })),
        },
      },
      include: {
        items: true,
        client: { select: { id: true, name: true } },
        teamMember: { select: { id: true, name: true } },
      },
    })

    if (input.appointmentId) {
      await tx.appointment.updateMany({
        where: { id: input.appointmentId, workspaceId },
        data: { status: 'COMPLETED' },
      })
    }
    if (couponId) {
      await incrementCouponUsage(couponId, tx)
    }
    if (client && (pointsEarned !== 0 || pointsRedeemed !== 0)) {
      await tx.client.update({
        where: { id: client.id },
        data: { pointsBalance: { increment: pointsEarned - pointsRedeemed } },
      })
    }

    return sale
  })
}
