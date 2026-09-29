import { getSession } from '@/lib/auth'
import { getProduct, updateProduct, archiveProduct } from '@/lib/db/queries/products'
import { z } from 'zod'

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    sku: z.string().optional(),
    price: z.number().int().min(0).optional(),
    stockQty: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const product = await getProduct(id, session.workspaceId)
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(product)
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
  const result = await updateProduct(id, session.workspaceId, parsed.data)
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
  const result = await archiveProduct(id, session.workspaceId)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
