import { getSession } from '@/lib/auth'
import { getClients } from '@/lib/db/queries/clients'
import { syncClientToMailchimp } from '@/lib/notifications/mailchimp'

/**
 * 手动批量同步当前 workspace 全部客户进 Mailchimp。用于验证 dry-run 逻辑，
 * 以后 Eric 配好真实 Key 后也可用它一次性补量。未配置 Key 时每条都会走 dry-run 分支。
 */
export async function POST() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const clients = await getClients(session.workspaceId)

  let synced = 0
  let skipped = 0
  let failed = 0
  for (const client of clients) {
    const result = await syncClientToMailchimp(session.workspaceId, {
      email: client.email,
      name: client.name,
    })
    if (result.synced) synced += 1
    else if (result.reason === 'sync_failed' || result.reason === 'invalid_key') failed += 1
    else skipped += 1
  }

  return Response.json({ total: clients.length, synced, skipped, failed })
}
