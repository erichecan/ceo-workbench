import { getSession } from '@/lib/auth'
import { updateTimeEntryClockOut } from '@/lib/db/queries/payroll'
import { z } from 'zod'

const patchSchema = z.object({
  clockOut: z.string().min(1),
})

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

  const clockOut = new Date(parsed.data.clockOut)
  if (Number.isNaN(clockOut.getTime())) {
    return Response.json({ error: 'Invalid clockOut' }, { status: 400 })
  }

  const result = await updateTimeEntryClockOut(id, session.workspaceId, clockOut)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
