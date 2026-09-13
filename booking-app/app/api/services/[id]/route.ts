import { getSession } from '@/lib/auth'
import { updateService, archiveService } from '@/lib/db/queries/services'
import { PriceType } from '@/lib/generated/prisma'
import { z } from 'zod'

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    description: z.string().optional(),
    priceType: z.enum(['FIXED', 'FROM', 'FREE']).optional(),
    price: z.number().min(0).optional(),
    duration: z.number().int().min(5).optional(),
    isOnlineBookable: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' })

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
  const result = await updateService(id, session.workspaceId, {
    ...parsed.data,
    ...(parsed.data.priceType !== undefined && { priceType: parsed.data.priceType as PriceType }),
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
  const result = await archiveService(id, session.workspaceId)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
