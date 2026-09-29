import mailchimp from '@mailchimp/mailchimp_marketing'
import crypto from 'crypto'
import { getIntegrationSettings } from '@/lib/db/queries/integration-settings'

export interface MailchimpSyncResult {
  synced: boolean
  reason?: 'not_configured' | 'no_email' | 'invalid_key' | 'sync_failed'
}

/**
 * Mailchimp API key 格式为 `<key>-<server>`（如 `abc123-us21`），server 前缀决定请求路由到哪个数据中心。
 */
function extractServerPrefix(apiKey: string): string | null {
  const parts = apiKey.split('-')
  if (parts.length < 2) return null
  return parts[parts.length - 1]
}

/**
 * 把客户同步进 Mailchimp 指定名单。workspace 未配置 mailchimpApiKey/mailchimpListId 时进入 dry-run：
 * 只记日志、返回 synced:false，不抛异常，不阻塞调用方的主流程。
 * 用 setListMember（PUT）做 upsert：member 已存在则更新，不存在则按 status_if_new 新建，不会因重复同步报错。
 */
export async function syncClientToMailchimp(
  workspaceId: string,
  client: { email?: string | null; name?: string | null }
): Promise<MailchimpSyncResult> {
  if (!client.email) {
    return { synced: false, reason: 'no_email' }
  }
  try {
    const settings = await getIntegrationSettings(workspaceId)
    const apiKey = settings?.mailchimpApiKey
    const listId = settings?.mailchimpListId
    if (!apiKey || !listId) {
      console.log(`[dry-run][mailchimp] not configured, would sync ${client.email} into list`)
      return { synced: false, reason: 'not_configured' }
    }
    const server = extractServerPrefix(apiKey)
    if (!server) {
      console.error('[mailchimp] API key missing server prefix (expected format key-usXX)')
      return { synced: false, reason: 'invalid_key' }
    }
    mailchimp.setConfig({ apiKey, server })
    const subscriberHash = crypto
      .createHash('md5')
      .update(client.email.toLowerCase())
      .digest('hex')
    const [firstName, ...rest] = (client.name ?? '').trim().split(/\s+/)
    await mailchimp.lists.setListMember(listId, subscriberHash, {
      email_address: client.email,
      status_if_new: 'subscribed',
      merge_fields: {
        FNAME: firstName ?? '',
        LNAME: rest.join(' '),
      },
    })
    return { synced: true }
  } catch (err) {
    console.error(
      '[mailchimp] unexpected error syncing client:',
      err instanceof Error ? err.message : String(err)
    )
    return { synced: false, reason: 'sync_failed' }
  }
}
