import twilio from 'twilio'
import { getIntegrationSettings } from '@/lib/db/queries/integration-settings'

export interface SendSmsResult {
  sent: boolean
  reason?: 'not_configured' | 'send_failed'
}

/**
 * 发送预约相关短信。workspace 未配置完整的 Twilio 三件套时进入 dry-run：
 * 只记日志、返回 sent:false，不抛异常，不阻塞调用方的主流程。
 */
export async function sendAppointmentSms(
  workspaceId: string,
  to: string,
  body: string
): Promise<SendSmsResult> {
  try {
    const settings = await getIntegrationSettings(workspaceId)
    const accountSid = settings?.twilioAccountSid
    const authToken = settings?.twilioAuthToken
    const fromNumber = settings?.twilioFromNumber
    if (!accountSid || !authToken || !fromNumber) {
      console.log(`[dry-run][sms] not configured, would send to ${to}: "${body}"`)
      return { sent: false, reason: 'not_configured' }
    }
    const client = twilio(accountSid, authToken)
    await client.messages.create({ body, from: fromNumber, to })
    return { sent: true }
  } catch (err) {
    console.error(
      '[sms] unexpected error sending appointment sms:',
      err instanceof Error ? err.message : String(err)
    )
    return { sent: false, reason: 'send_failed' }
  }
}
