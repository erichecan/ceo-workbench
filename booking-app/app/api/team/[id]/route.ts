import { getSession } from '@/lib/auth'
import { getTeamMember, updateTeamMember, deleteTeamMember } from '@/lib/db/queries/team'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['OWNER', 'MANAGER', 'LOW']).optional(),
  calendarColor: z.string().optional(),
  isBookable: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'No fields to update' })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const member = await getTeamMember(id, session.workspaceId)
  if (!member) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(member)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  const result = await updateTeamMember(id, session.workspaceId, parsed.data)
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await deleteTeamMember(id, session.workspaceId)
  return Response.json({ ok: true })
}
