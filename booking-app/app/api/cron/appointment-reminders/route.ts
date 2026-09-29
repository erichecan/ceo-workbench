import { getUpcomingAppointmentsForReminders } from '@/lib/db/queries/appointments'
import { sendAppointmentEmail } from '@/lib/notifications/email'
import { sendAppointmentSms } from '@/lib/notifications/sms'

const REMINDER_WINDOW_HOURS = 24

interface ChannelTally {
  sent: number
  notConfigured: number
  failed: number
  noContact: number
}

function emptyTally(): ChannelTally {
  return { sent: 0, notConfigured: 0, failed: 0, noContact: 0 }
}

/**
 * 服务端到服务端调用，无用户 session，鉴权用共享密钥比对：
 * 请求头 `Authorization: Bearer <CRON_SECRET>`，CRON_SECRET 来自环境变量。
 * 未设置 CRON_SECRET 或请求头不匹配一律 401，防止任何人都能调用触发批量发信。
 * 本轮未接入真实的定时触发器（Vercel Cron/GitHub Actions），仅支持手动 POST 触发验证逻辑。
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  return auth.slice(7) === secret
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000)
  const appointments = await getUpcomingAppointmentsForReminders(now, windowEnd)

  const email = emptyTally()
  const sms = emptyTally()
  let processed = 0
  let skipped = 0

  for (const appointment of appointments) {
    const client = appointment.client
    const when = appointment.startTime.toLocaleString('en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    const body = `提醒：您好${client?.name ? ' ' + client.name : ''}，您有一个预约将在 ${when} 开始。`

    let attempted = false

    if (client?.email) {
      attempted = true
      const result = await sendAppointmentEmail(appointment.workspaceId, client.email, '预约提醒', body)
      if (result.sent) email.sent += 1
      else if (result.reason === 'not_configured') email.notConfigured += 1
      else email.failed += 1
    } else {
      email.noContact += 1
    }

    if (client?.phone) {
      attempted = true
      const result = await sendAppointmentSms(appointment.workspaceId, client.phone, body)
      if (result.sent) sms.sent += 1
      else if (result.reason === 'not_configured') sms.notConfigured += 1
      else sms.failed += 1
    } else {
      sms.noContact += 1
    }

    if (attempted) processed += 1
    else skipped += 1
  }

  return Response.json({
    totalAppointments: appointments.length,
    processed,
    skipped,
    email,
    sms,
  })
}
