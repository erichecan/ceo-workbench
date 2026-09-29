import { getSession } from '@/lib/auth'
import { listGiftCards, createGiftCard } from '@/lib/db/queries/gift-cards'
import { z } from 'zod'

const createSchema = z.object({
  initialValue: z.number().int().min(1),
  clientId: z.string().optional().nullable(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const giftCards = await listGiftCards(session.workspaceId)
  return Response.json(giftCards)
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
  const giftCard = await createGiftCard(session.workspaceId, parsed.data)
  return Response.json(giftCard, { status: 201 })
}
