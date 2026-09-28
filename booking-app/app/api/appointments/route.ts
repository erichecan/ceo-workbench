import { getSession } from '@/lib/auth'
import { getAppointmentsForRange, createAppointment, AppointmentConflictError } from '@/lib/db/queries/appointments'
import { z } from 'zod'

const createSchema = z.object({
  locationId: z.string(),
  clientId: z.string().optional(),
  teamMemberId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  services: z.array(z.object({
    serviceId: z.string(),
    price: z.number().min(0),
    duration: z.number().int().min(5),
  })).min(1),
})

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!locationId || !from || !to) {
    return Response.json({ error: 'locationId, from, to required' }, { status: 400 })
  }
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return Response.json({ error: 'from and to must be valid ISO dates' }, { status: 400 })
  }
  const appointments = await getAppointmentsForRange(
    session.workspaceId,
    locationId,
    fromDate,
    toDate
  )
  return Response.json(appointments)
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
  const { startTime, endTime, ...rest } = parsed.data
  try {
    const appointment = await createAppointment(session.workspaceId, {
      ...rest,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    })
    return Response.json(appointment, { status: 201 })
  } catch (err) {
    if (err instanceof AppointmentConflictError) {
      return Response.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}
