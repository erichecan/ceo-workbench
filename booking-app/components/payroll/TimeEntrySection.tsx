'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Member {
  id: string
  name: string
}

interface TimeEntry {
  id: string
  clockIn: string
  clockOut: string | null
  teamMember: { id: string; name: string }
}

function formatHours(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return '—'
  const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60)
  return `${hours.toFixed(2)}h`
}

export default function TimeEntrySection({
  members,
  initialEntries,
}: {
  members: Member[]
  initialEntries: TimeEntry[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [teamMemberId, setTeamMemberId] = useState(members[0]?.id ?? '')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/payroll/time-entries')
    if (res.ok) setEntries(await res.json())
  }

  async function handleSubmit() {
    if (!teamMemberId || !clockIn) {
      setError('Select a team member and a start time')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/payroll/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMemberId, clockIn, clockOut: clockOut || undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error?.message ?? data.error ?? 'Failed to save time entry')
      return
    }
    setClockIn('')
    setClockOut('')
    await refresh()
  }

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-lg font-semibold text-slate-900">Time Entries</h2>
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
          <Label>Start</Label>
          <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>End (optional)</Label>
          <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </div>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Add Entry'}
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Member</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Start</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">End</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No time entries yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-900">{e.teamMember.name}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(e.clockIn).toLocaleString('en-CA')}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.clockOut ? new Date(e.clockOut).toLocaleString('en-CA') : 'In progress'}
                </td>
                <td className="px-4 py-3 text-right text-slate-900">{formatHours(e.clockIn, e.clockOut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
