import { getSession } from '@/lib/auth'
import { createTimeEntry, listTimeEntries } from '@/lib/db/queries/payroll'
import { z } from 'zod'

const createSchema = z.object({
  teamMemberId: z.string().min(1),
  clockIn: z.string().min(1),
  clockOut: z.string().min(1).optional(),
})

function parseDate(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const teamMemberId = searchParams.get('teamMemberId') ?? undefined
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined
  const entries = await listTimeEntries(session.workspaceId, teamMemberId, dateRange)
  return Response.json(entries)
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

  const clockIn = parseDate(parsed.data.clockIn)
  if (!clockIn) return Response.json({ error: 'Invalid clockIn' }, { status: 400 })
  let clockOut: Date | null = null
  if (parsed.data.clockOut) {
    clockOut = parseDate(parsed.data.clockOut)
    if (!clockOut) return Response.json({ error: 'Invalid clockOut' }, { status: 400 })
    if (clockOut <= clockIn) {
      return Response.json({ error: 'clockOut must be after clockIn' }, { status: 400 })
    }
  }

  const entry = await createTimeEntry(session.workspaceId, {
    teamMemberId: parsed.data.teamMemberId,
    clockIn,
    clockOut,
  })
  return Response.json(entry, { status: 201 })
}
