import { getSession } from '@/lib/auth'
import { getAppointment, updateAppointment, cancelAppointment, AppointmentConflictError } from '@/lib/db/queries/appointments'
import { AppointmentStatus } from '@/lib/generated/prisma'
import { z } from 'zod'

const VALID_STATUSES = ['BOOKED', 'CONFIRMED', 'ARRIVED', 'STARTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const

const patchSchema = z.object({
  clientId: z.string().optional(),
  teamMemberId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z.enum(VALID_STATUSES).optional(),
  notes: z.string().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'At least one field required' })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const appt = await getAppointment(id, session.workspaceId)
  if (!appt) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(appt)
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
  const { startTime, endTime, status, ...rest } = parsed.data
  try {
    const result = await updateAppointment(id, session.workspaceId, {
      ...rest,
      ...(startTime ? { startTime: new Date(startTime) } : {}),
      ...(endTime ? { endTime: new Date(endTime) } : {}),
      ...(status ? { status: status as AppointmentStatus } : {}),
    })
    if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof AppointmentConflictError) {
      return Response.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const result = await cancelAppointment(id, session.workspaceId)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
