import { getSession } from '@/lib/auth'
import { listProducts, createProduct } from '@/lib/db/queries/products'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().int().min(0),
  stockQty: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
})

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const includeArchived = searchParams.get('includeArchived') === 'true'
  const products = await listProducts(session.workspaceId, { includeArchived })
  return Response.json(products)
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
  const product = await createProduct(session.workspaceId, parsed.data)
  return Response.json(product, { status: 201 })
}
