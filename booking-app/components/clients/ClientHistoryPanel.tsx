'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface AppointmentHistoryItem {
  id: string
  startTime: string
  status: string
  teamMember?: { name: string } | null
  services: Array<{ service: { name: string } }>
}

interface SaleHistoryItem {
  id: string
  createdAt: string
  total: number
  paymentMethod: string
}

interface ClientDetail {
  appointments: AppointmentHistoryItem[]
  sales: SaleHistoryItem[]
}

interface Props {
  clientId: string
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function ClientHistoryPanel({ clientId }: Props) {
  const [data, setData] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/clients/${clientId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load history')
        return res.json()
      })
      .then((json: ClientDetail) => { if (!cancelled) setData(json) })
      .catch(() => { if (!cancelled) setError('Failed to load history') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [clientId])

  if (loading) return <p className="text-sm text-slate-400 py-4">Loading history…</p>
  if (error) return <p className="text-sm text-red-500 py-4">{error}</p>
  if (!data) return null

  return (
    <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Appointment history
        </h3>
        {data.appointments.length === 0 ? (
          <p className="text-sm text-slate-400">No appointments yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.appointments.map(a => (
              <li key={a.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {format(new Date(a.startTime), 'MMM d, yyyy h:mm a')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 shrink-0">{a.status}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.services.map(s => s.service.name).join(', ') || 'No services'}
                  {a.teamMember && ` · ${a.teamMember.name}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Purchase history
        </h3>
        {data.sales.length === 0 ? (
          <p className="text-sm text-slate-400">No sales yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.sales.map(s => (
              <li key={s.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800">
                  {format(new Date(s.createdAt), 'MMM d, yyyy h:mm a')}
                </span>
                <span className="text-xs text-slate-500 shrink-0">
                  ${centsToDisplay(s.total)} · {s.paymentMethod}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
