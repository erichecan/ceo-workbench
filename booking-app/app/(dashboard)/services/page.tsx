import { getSession } from '@/lib/auth'
import { getServicesWithCategories, getCategories } from '@/lib/db/queries/services'
import ServicesTable from '@/components/services/ServicesTable'
import { redirect } from 'next/navigation'

export default async function ServicesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const [services, categories] = await Promise.all([
    getServicesWithCategories(session.workspaceId),
    getCategories(session.workspaceId),
  ])
  return <ServicesTable initialServices={services} categories={categories} />
}
