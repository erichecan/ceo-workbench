import { sendAppointmentEmail } from './email'
import { sendAppointmentSms } from './sms'

interface AppointmentForNotify {
  startTime: Date
  client?: { email?: string | null; phone?: string | null; name?: string | null } | null
}

/**
 * 预约创建后触发的通知。fire-and-forget：不 await、不阻塞调用方；
 * sendAppointmentEmail/sendAppointmentSms 内部已捕获所有异常并返回 sent:false，
 * 这里的 .catch 只是双重保险，防止未来实现变化后出现未处理的 rejection。
 */
export function notifyAppointmentCreated(workspaceId: string, appointment: AppointmentForNotify) {
  const client = appointment.client
  if (!client) return

  const when = appointment.startTime.toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const subject = '预约已创建'
  const body = `您好${client.name ? ' ' + client.name : ''}，您的预约已创建，时间：${when}。`

  if (client.email) {
    sendAppointmentEmail(workspaceId, client.email, subject, body).catch((err) => {
      console.error('[notify] appointment email threw unexpectedly:', err)
    })
  }
  if (client.phone) {
    sendAppointmentSms(workspaceId, client.phone, body).catch((err) => {
      console.error('[notify] appointment sms threw unexpectedly:', err)
    })
  }
}
