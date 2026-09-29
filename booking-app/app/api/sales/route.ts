import { getSession } from '@/lib/auth'
import { checkoutSale, getSales, CheckoutError } from '@/lib/db/queries/sales'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  locationId: z.string(),
  appointmentId: z.string().optional(),
  clientId: z.string().optional(),
  teamMemberId: z.string().optional(),
  discountAmount: z.number().int().min(0),
  tipAmount: z.number().int().min(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'E_TRANSFER', 'OTHER']),
  notes: z.string().optional(),
  items: z.array(z.object({
    serviceId: z.string().optional(),
    productId: z.string().optional(),
    name: z.string().min(1),
    price: z.number().int().min(0),
    quantity: z.number().int().min(1).default(1),
  })).min(1),
  couponCode: z.string().optional(),
  giftCardCode: z.string().optional(),
  giftCardAmount: z.number().int().min(0).optional(),
  redeemPoints: z.number().int().min(0).optional(),
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
  const sales = await getSales(session.workspaceId, locationId, fromDate, toDate)
  return Response.json(sales)
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

  type DbProxy = {
    location: { findFirst: (args: { where: object; select?: object }) => Promise<{ id: string } | null> }
    appointment: { findFirst: (args: { where: object; select?: object }) => Promise<{ id: string } | null> }
  }
  const db = prisma as unknown as DbProxy
  const location = await db.location.findFirst({
    where: { id: parsed.data.locationId, workspaceId: session.workspaceId },
    select: { id: true },
  })
  if (!location) return Response.json({ error: 'Location not found' }, { status: 404 })

  if (parsed.data.appointmentId) {
    const appt = await db.appointment.findFirst({
      where: { id: parsed.data.appointmentId, workspaceId: session.workspaceId },
      select: { id: true },
    })
    if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 })
  }

  try {
    const sale = await checkoutSale(session.workspaceId, parsed.data)
    return Response.json(sale, { status: 201 })
  } catch (err) {
    if (err instanceof CheckoutError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
