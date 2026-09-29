import { getSession } from '@/lib/auth'
import { listCoupons, createCoupon } from '@/lib/db/queries/coupons'
import { z } from 'zod'

const createSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: z.number().int().min(0),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
})

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const coupons = await listCoupons(session.workspaceId)
  return Response.json(coupons)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const coupon = await createCoupon(session.workspaceId, {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    })
    return Response.json(coupon, { status: 201 })
  } catch {
    return Response.json({ error: 'Coupon code already exists' }, { status: 409 })
  }
}
