import { Resend } from 'resend'
import { getIntegrationSettings } from '@/lib/db/queries/integration-settings'

export interface SendEmailResult {
  sent: boolean
  reason?: 'not_configured' | 'send_failed'
}

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

/**
 * 发送预约相关邮件。workspace 未配置 resendApiKey 时进入 dry-run：
 * 只记日志、返回 sent:false，不抛异常，不阻塞调用方的主流程。
 */
export async function sendAppointmentEmail(
  workspaceId: string,
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  try {
    const settings = await getIntegrationSettings(workspaceId)
    const apiKey = settings?.resendApiKey
    if (!apiKey) {
      console.log(`[dry-run][email] not configured, would send to ${to}: "${subject}"`)
      return { sent: false, reason: 'not_configured' }
    }
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      text: body,
    })
    if (error) {
      console.error('[email] Resend API error:', error.message)
      return { sent: false, reason: 'send_failed' }
    }
    return { sent: true }
  } catch (err) {
    console.error(
      '[email] unexpected error sending appointment email:',
      err instanceof Error ? err.message : String(err)
    )
    return { sent: false, reason: 'send_failed' }
  }
}
