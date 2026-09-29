import { getSession } from '@/lib/auth'
import { getCoupon, updateCoupon, deactivateCoupon } from '@/lib/db/queries/coupons'
import { z } from 'zod'

const patchSchema = z
  .object({
    discountType: z.enum(['PERCENT', 'FIXED']).optional(),
    discountValue: z.number().int().min(0).optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    usageLimit: z.number().int().min(1).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const coupon = await getCoupon(id, session.workspaceId)
  if (!coupon) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(coupon)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  const result = await updateCoupon(id, session.workspaceId, {
    ...parsed.data,
    expiresAt:
      parsed.data.expiresAt !== undefined
        ? parsed.data.expiresAt
          ? new Date(parsed.data.expiresAt)
          : null
        : undefined,
  })
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const result = await deactivateCoupon(id, session.workspaceId)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
