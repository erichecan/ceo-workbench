import { getSession } from '@/lib/auth'
import { getClients } from '@/lib/db/queries/clients'
import ClientsTable from '@/components/clients/ClientsTable'
import { redirect } from 'next/navigation'

export default async function ClientsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const clients = await getClients(session.workspaceId)
  return <ClientsTable initialClients={clients} />
}
