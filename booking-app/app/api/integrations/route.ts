import { getSession } from '@/lib/auth'
import {
  getIntegrationSettingsView,
  upsertIntegrationSettings,
} from '@/lib/db/queries/integration-settings'
import { z } from 'zod'

/**
 * 集成设置涉及密钥管理，权限比其他模块更严：只有 OWNER 能读写，MANAGER/LOW 一律 403。
 */
function requireOwner(session: { role: string } | null) {
  if (!session) return { error: 'Unauthorized', status: 401 as const }
  if (session.role !== 'OWNER') return { error: 'Forbidden', status: 403 as const }
  return null
}

export async function GET() {
  const session = await getSession()
  const denied = requireOwner(session)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })

  const view = await getIntegrationSettingsView(session!.workspaceId)
  return Response.json(view)
}

const patchSchema = z.object({
  resendApiKey: z.string().min(1).optional(),
  twilioAccountSid: z.string().min(1).optional(),
  twilioAuthToken: z.string().min(1).optional(),
  twilioFromNumber: z.string().min(1).optional(),
  mailchimpApiKey: z.string().min(1).optional(),
  mailchimpListId: z.string().min(1).optional(),
})

export async function PATCH(req: Request) {
  const session = await getSession()
  const denied = requireOwner(session)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  await upsertIntegrationSettings(session!.workspaceId, parsed.data)
  return Response.json({ ok: true })
}
