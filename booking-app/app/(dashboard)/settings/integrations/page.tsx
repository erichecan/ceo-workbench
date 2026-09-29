import { getSession } from '@/lib/auth'
import { getIntegrationSettingsView } from '@/lib/db/queries/integration-settings'
import { IntegrationsForm } from '@/components/settings/IntegrationsForm'
import { redirect } from 'next/navigation'

export default async function IntegrationsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'OWNER') redirect('/calendar')

  const settings = await getIntegrationSettingsView(session.workspaceId)

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-heading text-2xl font-bold text-primary mb-1">集成设置</h1>
      <p className="text-sm text-slate-500 mb-6">
        配置邮件 / 短信 / Mailchimp 的 API Key。未配置时相关通知与同步会以 dry-run
        方式跳过，不影响预约与客户管理等主流程。
      </p>
      <IntegrationsForm initialSettings={settings} />
    </div>
  )
}
