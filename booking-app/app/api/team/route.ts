import { getSession } from '@/lib/auth'
import { getTeamMembers, createTeamMember } from '@/lib/db/queries/team'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['OWNER', 'MANAGER', 'LOW']).default('LOW'),
  calendarColor: z.string().default('#8B5CF6'),
  isBookable: z.boolean().default(true),
})

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const members = await getTeamMembers(session.workspaceId)
  return Response.json(members)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  const member = await createTeamMember(session.workspaceId, parsed.data)
  return Response.json(member, { status: 201 })
}
