import { getSession } from '@/lib/auth'
import { countPendingOnlineAppointments } from '@/lib/db/queries/appointments'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const count = await countPendingOnlineAppointments(session.workspaceId)
  return Response.json({ count })
}
