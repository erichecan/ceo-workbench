import { prisma } from '@/lib/db'

export interface IntegrationSettingsInput {
  resendApiKey?: string | null
  twilioAccountSid?: string | null
  twilioAuthToken?: string | null
  twilioFromNumber?: string | null
  mailchimpApiKey?: string | null
  mailchimpListId?: string | null
}

export async function getIntegrationSettings(workspaceId: string) {
  return prisma.integrationSettings.findUnique({ where: { workspaceId } })
}

export interface IntegrationSettingsView {
  resend: { configured: boolean; apiKeyMasked: string | null }
  twilio: {
    configured: boolean
    accountSidMasked: string | null
    authTokenMasked: string | null
    fromNumber: string | null
  }
  mailchimp: { configured: boolean; apiKeyMasked: string | null; listId: string | null }
}

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 4) return '****'
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`
}

/**
 * 脱敏后的集成设置视图：Key 类字段只保留后 4 位，用于前端展示。
 * API 路由与设置页共用，避免明文 Key 在任何响应/服务端渲染输出里出现。
 */
export async function getIntegrationSettingsView(
  workspaceId: string
): Promise<IntegrationSettingsView> {
  const settings = await getIntegrationSettings(workspaceId)
  return {
    resend: {
      configured: Boolean(settings?.resendApiKey),
      apiKeyMasked: maskSecret(settings?.resendApiKey),
    },
    twilio: {
      configured: Boolean(
        settings?.twilioAccountSid && settings?.twilioAuthToken && settings?.twilioFromNumber
      ),
      accountSidMasked: maskSecret(settings?.twilioAccountSid),
      authTokenMasked: maskSecret(settings?.twilioAuthToken),
      fromNumber: settings?.twilioFromNumber ?? null,
    },
    mailchimp: {
      configured: Boolean(settings?.mailchimpApiKey && settings?.mailchimpListId),
      apiKeyMasked: maskSecret(settings?.mailchimpApiKey),
      listId: settings?.mailchimpListId ?? null,
    },
  }
}

export async function upsertIntegrationSettings(
  workspaceId: string,
  data: IntegrationSettingsInput
) {
  return prisma.integrationSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  })
}
