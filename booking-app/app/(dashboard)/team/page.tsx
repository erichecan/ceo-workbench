import { getSession } from '@/lib/auth'
import { getTeamMembers } from '@/lib/db/queries/team'
import TeamTable from '@/components/team/TeamTable'
import { redirect } from 'next/navigation'

export default async function TeamPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const members = await getTeamMembers(session.workspaceId)
  return <TeamTable initialMembers={members} />
}
