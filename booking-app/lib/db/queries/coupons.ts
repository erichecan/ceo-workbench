import { prisma } from '@/lib/db'
import type { Coupon, Prisma } from '@/lib/generated/prisma'

type DbClient = typeof prisma | Prisma.TransactionClient

export interface CouponInput {
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  expiresAt?: Date | null
  usageLimit?: number | null
  isActive?: boolean
}

export class CouponValidationError extends Error {}

export async function listCoupons(workspaceId: string) {
  return prisma.coupon.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } })
}

export async function getCoupon(id: string, workspaceId: string) {
  return prisma.coupon.findFirst({ where: { id, workspaceId } })
}

export async function createCoupon(workspaceId: string, data: CouponInput) {
  return prisma.coupon.create({
    data: { workspaceId, ...data, code: data.code.trim().toUpperCase() },
  })
}

export async function updateCoupon(id: string, workspaceId: string, data: Partial<CouponInput>) {
  return prisma.coupon.updateMany({
    where: { id, workspaceId },
    data: { ...data, ...(data.code ? { code: data.code.trim().toUpperCase() } : {}) },
  })
}

export async function deactivateCoupon(id: string, workspaceId: string) {
  return prisma.coupon.updateMany({ where: { id, workspaceId }, data: { isActive: false } })
}

/**
 * 校验优惠券是否可用，返回按 subtotal 计算出的折扣金额（分）。
 * PERCENT：discountValue 为百分比整数（如 20 = 20%），折扣 = round(subtotal * discountValue / 100)
 * FIXED：折扣 = discountValue，但不超过传入的 subtotal
 * 不修改 usedCount——计数由调用方在结账成功后单独调用 incrementCouponUsage。
 */
export async function validateCoupon(
  workspaceId: string,
  code: string,
  subtotal: number,
  db: DbClient = prisma
): Promise<{ coupon: Coupon; discountAmount: number }> {
  const coupon = await db.coupon.findUnique({
    where: { workspaceId_code: { workspaceId, code: code.trim().toUpperCase() } },
  })
  if (!coupon) throw new CouponValidationError('Coupon not found')
  if (!coupon.isActive) throw new CouponValidationError('Coupon is not active')
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw new CouponValidationError('Coupon has expired')
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponValidationError('Coupon usage limit reached')
  }
  const base = Math.max(0, subtotal)
  const raw =
    coupon.discountType === 'PERCENT'
      ? Math.round((base * coupon.discountValue) / 100)
      : coupon.discountValue
  const discountAmount = Math.min(Math.max(raw, 0), base)
  return { coupon, discountAmount }
}

export async function incrementCouponUsage(id: string, db: DbClient = prisma) {
  return db.coupon.update({ where: { id }, data: { usedCount: { increment: 1 } } })
}
