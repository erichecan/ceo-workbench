import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTeamMembers } from '@/lib/db/queries/team'
import { listTimeEntries, listPayrollPeriods } from '@/lib/db/queries/payroll'
import TimeEntrySection from '@/components/payroll/TimeEntrySection'
import PayrollPeriodSection from '@/components/payroll/PayrollPeriodSection'

export default async function PayrollPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'OWNER' && session.role !== 'MANAGER') redirect('/calendar')

  const [members, timeEntries, periods] = await Promise.all([
    getTeamMembers(session.workspaceId),
    listTimeEntries(session.workspaceId),
    listPayrollPeriods(session.workspaceId),
  ])

  const membersForSelect = members.map((m) => ({ id: m.id, name: m.name }))
  const entriesForClient = timeEntries.map((e) => ({
    id: e.id,
    clockIn: e.clockIn.toISOString(),
    clockOut: e.clockOut ? e.clockOut.toISOString() : null,
    teamMember: e.teamMember,
  }))
  const periodsForClient = periods.map((p) => ({
    id: p.id,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    hoursWorked: p.hoursWorked,
    commissionTotal: p.commissionTotal,
    status: p.status,
    teamMember: p.teamMember,
  }))

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Payroll</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track hours worked and commission payouts.</p>
      </div>
      <TimeEntrySection members={membersForSelect} initialEntries={entriesForClient} />
      <PayrollPeriodSection members={membersForSelect} initialPeriods={periodsForClient} />
    </div>
  )
}
