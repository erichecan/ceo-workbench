import { getSession } from '@/lib/auth'
import { generatePayrollPeriod, listPayrollPeriods } from '@/lib/db/queries/payroll'
import { z } from 'zod'

const createSchema = z.object({
  teamMemberId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
})

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const teamMemberId = searchParams.get('teamMemberId') ?? undefined
  const periods = await listPayrollPeriods(session.workspaceId, teamMemberId)
  return Response.json(periods)
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

  const periodStart = new Date(parsed.data.periodStart)
  const periodEnd = new Date(parsed.data.periodEnd)
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return Response.json({ error: 'Invalid period dates' }, { status: 400 })
  }
  if (periodEnd <= periodStart) {
    return Response.json({ error: 'periodEnd must be after periodStart' }, { status: 400 })
  }

  try {
    const period = await generatePayrollPeriod(
      session.workspaceId,
      parsed.data.teamMemberId,
      periodStart,
      periodEnd
    )
    return Response.json(period, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate payroll period'
    return Response.json({ error: message }, { status: 400 })
  }
}
