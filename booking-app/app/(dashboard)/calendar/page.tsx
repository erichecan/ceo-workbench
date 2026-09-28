import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getClients } from '@/lib/db/queries/clients'
import { getTeamMembers } from '@/lib/db/queries/team'
import { getServicesWithCategories } from '@/lib/db/queries/services'
import CalendarClient from '@/components/calendar/CalendarClient'

export default async function CalendarPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const location = await prisma.location.findFirst({
    where: { workspaceId: session.workspaceId },
  })
  if (!location) {
    return <p className="text-slate-500 p-8">No location configured. Add a location in Settings.</p>
  }

  const [clients, teamMembers, servicesData] = await Promise.all([
    getClients(session.workspaceId),
    getTeamMembers(session.workspaceId),
    getServicesWithCategories(session.workspaceId),
  ])

  return (
    <CalendarClient
      locationId={location.id}
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      teamMembers={teamMembers.map(m => ({ id: m.id, name: m.name, calendarColor: m.calendarColor, isBookable: m.isBookable }))}
      services={servicesData.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration }))}
    />
  )
}
