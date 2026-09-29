import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import type { Prisma } from '@/lib/generated/prisma'

type DbClient = typeof prisma | Prisma.TransactionClient

export class GiftCardError extends Error {}

function generateGiftCardCode(): string {
  return randomBytes(6).toString('hex').toUpperCase()
}

export async function listGiftCards(workspaceId: string) {
  return prisma.giftCard.findMany({
    where: { workspaceId },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getGiftCardByCode(workspaceId: string, code: string, db: DbClient = prisma) {
  return db.giftCard.findFirst({ where: { workspaceId, code: code.trim().toUpperCase() } })
}

export async function createGiftCard(
  workspaceId: string,
  data: { initialValue: number; clientId?: string | null }
) {
  let code = generateGiftCardCode()
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.giftCard.findUnique({ where: { code } })
    if (!existing) break
    code = generateGiftCardCode()
  }
  return prisma.giftCard.create({
    data: {
      workspaceId,
      code,
      initialValue: data.initialValue,
      balance: data.initialValue,
      clientId: data.clientId ?? undefined,
    },
  })
}

export async function deactivateGiftCard(id: string, workspaceId: string) {
  return prisma.giftCard.updateMany({ where: { id, workspaceId }, data: { isActive: false } })
}

/**
 * 校验并扣减礼品卡余额，返回扣减后的卡记录。amount 必须 > 0 且不超过当前余额。
 * 用 updateMany 的条件 where(balance >= amount) 做原子扣减，避免并发场景下透支。
 */
export async function redeemGiftCard(workspaceId: string, code: string, amount: number, db: DbClient = prisma) {
  const card = await getGiftCardByCode(workspaceId, code, db)
  if (!card) throw new GiftCardError('Gift card not found')
  if (!card.isActive) throw new GiftCardError('Gift card is not active')
  if (amount <= 0) throw new GiftCardError('Redeem amount must be positive')
  if (card.balance < amount) throw new GiftCardError('Insufficient gift card balance')
  const result = await db.giftCard.updateMany({
    where: { id: card.id, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  })
  if (result.count === 0) throw new GiftCardError('Insufficient gift card balance')
  return { ...card, balance: card.balance - amount }
}
