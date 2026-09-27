import { z } from 'zod'
import { getPublicWorkspaceBySlug, createPublicBooking } from '@/lib/db/queries/public-bookings'
import { zonedTimeToUtc } from '@/lib/timezone'

// 公开端点，故意不鉴权：这是给还没注册的顾客提交预约请求用的，见 proxy.ts 的 PUBLIC_PATHS。
const bookSchema = z.object({
  slug: z.string().min(1).max(200),
  serviceId: z.string().min(1).max(100),
  clientName: z.string().trim().min(1).max(100),
  clientPhone: z.string().trim().min(6).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = bookSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: '信息不完整或格式不对' }, { status: 400 })
  }
  const { slug, serviceId, clientName, clientPhone, date, time, note } = parsed.data

  const workspace = await getPublicWorkspaceBySlug(slug)
  if (!workspace || workspace.locations.length === 0) {
    return Response.json({ error: '找不到这家店' }, { status: 404 })
  }

  const service = workspace.services.find((s) => s.id === serviceId)
  if (!service) {
    return Response.json({ error: '服务项目不存在或已下架' }, { status: 400 })
  }

  const location = workspace.locations[0]
  const startTime = zonedTimeToUtc(date, time, location.timezone)
  if (Number.isNaN(startTime.getTime()) || startTime.getTime() < Date.now() - 5 * 60 * 1000) {
    return Response.json({ error: '预约时间不合法' }, { status: 400 })
  }
  const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000)

  await createPublicBooking({
    workspaceId: workspace.id,
    locationId: location.id,
    serviceId: service.id,
    servicePrice: service.price,
    serviceDuration: service.duration,
    clientName,
    clientPhone,
    note,
    startTime,
    endTime,
  })

  return Response.json({ ok: true }, { status: 201 })
}
