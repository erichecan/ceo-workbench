import { getSession } from '@/lib/auth'
import { getSale } from '@/lib/db/queries/sales'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sale = await getSale(id, session.workspaceId)
  if (!sale) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(sale)
}
