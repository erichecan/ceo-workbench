import { getSession } from '@/lib/auth'
import { deactivateGiftCard } from '@/lib/db/queries/gift-cards'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const result = await deactivateGiftCard(id, session.workspaceId)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
