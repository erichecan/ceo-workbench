import { getSession } from '@/lib/auth'
import { getServicesWithCategories, createService } from '@/lib/db/queries/services'
import { PriceType } from '@/lib/generated/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  priceType: z.enum(['FIXED', 'FROM', 'FREE']).default('FIXED'),
  price: z.number().min(0).default(0),
  duration: z.number().int().min(5),
  isOnlineBookable: z.boolean().default(true),
})

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const services = await getServicesWithCategories(session.workspaceId)
  return Response.json(services)
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
  const service = await createService(session.workspaceId, {
    ...parsed.data,
    priceType: parsed.data.priceType as PriceType,
  })
  return Response.json(service, { status: 201 })
}
