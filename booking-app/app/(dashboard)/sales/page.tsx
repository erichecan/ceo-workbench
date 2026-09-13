import { getSession } from '@/lib/auth'
import { getSales, getDailySummary } from '@/lib/db/queries/sales'
import { redirect } from 'next/navigation'
import { startOfDay, endOfDay } from 'date-fns'
import SalesSummary from '@/components/sales/SalesSummary'
import SalesTable from '@/components/sales/SalesTable'
import { prisma } from '@/lib/db'

export default async function SalesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Get first location for this workspace (same as calendar page)
  const location = await prisma.location.findFirst({
    where: { workspaceId: session.workspaceId },
    select: { id: true, name: true },
  })
  if (!location) {
    return (
      <div className="p-6">
        <p className="text-slate-500">No location configured.</p>
      </div>
    )
  }

  const today = new Date()
  const [summary, sales] = await Promise.all([
    getDailySummary(session.workspaceId, location.id, today),
    getSales(session.workspaceId, location.id, startOfDay(today), endOfDay(today)),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sales</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Today · {today.toLocaleDateString('en-CA', { dateStyle: 'full' })}
        </p>
      </div>

      <SalesSummary summary={summary} />
      <SalesTable sales={sales} />
    </div>
  )
}
