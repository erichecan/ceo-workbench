'use client'

import { useState } from 'react'
import { IntegrationSection } from './IntegrationSection'
import type { IntegrationSettingsView } from '@/lib/db/queries/integration-settings'

interface IntegrationsFormProps {
  initialSettings: IntegrationSettingsView
}

type FieldKey =
  | 'resendApiKey'
  | 'twilioAccountSid'
  | 'twilioAuthToken'
  | 'twilioFromNumber'
  | 'mailchimpApiKey'
  | 'mailchimpListId'

async function saveFields(fields: Partial<Record<FieldKey, string>>) {
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value && value.trim().length > 0)
  )
  const res = await fetch('/api/integrations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('保存失败')
  return (await res.json()) as { ok: true }
}

export function IntegrationsForm({ initialSettings }: IntegrationsFormProps) {
  const [settings, setSettings] = useState(initialSettings)

  async function refresh() {
    const res = await fetch('/api/integrations')
    if (res.ok) setSettings(await res.json())
  }

  return (
    <div className="space-y-6">
      <IntegrationSection
        title="Resend 邮件"
        configured={settings.resend.configured}
        description="用于向客户发送预约创建 / 提醒邮件。"
        fields={[
          {
            key: 'resendApiKey',
            label: 'API Key',
            placeholder: settings.resend.apiKeyMasked ?? '未配置',
          },
        ]}
        onSave={async (values) => {
          await saveFields(values)
          await refresh()
        }}
      />

      <IntegrationSection
        title="Twilio 短信"
        configured={settings.twilio.configured}
        description="用于向客户发送预约创建 / 提醒短信，三项需同时配置齐才生效。"
        fields={[
          {
            key: 'twilioAccountSid',
            label: 'Account SID',
            placeholder: settings.twilio.accountSidMasked ?? '未配置',
          },
          {
            key: 'twilioAuthToken',
            label: 'Auth Token',
            placeholder: settings.twilio.authTokenMasked ?? '未配置',
          },
          {
            key: 'twilioFromNumber',
            label: '发送号码',
            placeholder: settings.twilio.fromNumber ?? '未配置',
          },
        ]}
        onSave={async (values) => {
          await saveFields(values)
          await refresh()
        }}
      />

      <IntegrationSection
        title="Mailchimp"
        configured={settings.mailchimp.configured}
        description="客户创建后自动同步进指定名单，用于邮件营销。"
        fields={[
          {
            key: 'mailchimpApiKey',
            label: 'API Key',
            placeholder: settings.mailchimp.apiKeyMasked ?? '未配置',
          },
          {
            key: 'mailchimpListId',
            label: 'List ID',
            placeholder: settings.mailchimp.listId ?? '未配置',
          },
        ]}
        onSave={async (values) => {
          await saveFields(values)
          await refresh()
        }}
      />
    </div>
  )
}
