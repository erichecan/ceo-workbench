'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Member {
  id: string
  name: string
}

interface PayrollPeriod {
  id: string
  periodStart: string
  periodEnd: string
  hoursWorked: number
  commissionTotal: number
  status: string
  teamMember: { id: string; name: string }
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

export default function PayrollPeriodSection({
  members,
  initialPeriods,
}: {
  members: Member[]
  initialPeriods: PayrollPeriod[]
}) {
  const [periods, setPeriods] = useState(initialPeriods)
  const [teamMemberId, setTeamMemberId] = useState(members[0]?.id ?? '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/payroll/periods')
    if (res.ok) setPeriods(await res.json())
  }

  async function handleGenerate() {
    if (!teamMemberId || !periodStart || !periodEnd) {
      setError('Select a team member and a start/end date')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/payroll/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamMemberId,
        periodStart: `${periodStart}T00:00:00.000`,
        periodEnd: `${periodEnd}T23:59:59.999`,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error?.message ?? data.error ?? 'Failed to generate payroll period')
      return
    }
    setPeriodStart('')
    setPeriodEnd('')
    await refresh()
  }

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-lg font-semibold text-slate-900">Payroll Periods</h2>
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] items-end">
        <div className="space-y-1">
          <Label>Team Member</Label>
          <Select
            value={teamMemberId}
            onValueChange={(v) => setTeamMemberId(v ?? '')}
            items={Object.fromEntries(members.map((m) => [m.id, m.name]))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Period Start</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Period End</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Period'}
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Member</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Hours</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Commission</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No payroll periods generated yet.
                </td>
              </tr>
            )}
            {periods.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-900">{p.teamMember.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                </td>
                <td className="px-4 py-3 text-right text-slate-900">{p.hoursWorked.toFixed(2)}h</td>
                <td className="px-4 py-3 text-right text-slate-900">${centsToDisplay(p.commissionTotal)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">
                    {p.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
