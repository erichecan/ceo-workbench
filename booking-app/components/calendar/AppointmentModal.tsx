'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { format, addMinutes } from 'date-fns'

const STATUSES = ['BOOKED', 'CONFIRMED', 'ARRIVED', 'STARTED', 'COMPLETED', 'NO_SHOW'] as const

interface Client { id: string; name: string }
interface TeamMember { id: string; name: string }
interface Service { id: string; name: string; price: number; duration: number }

interface AppointmentService {
  service: { id: string; name: string }
  price: number
  duration: number
}

interface Appointment {
  id?: string
  clientId?: string
  teamMemberId?: string
  startTime: string
  endTime?: string
  status?: string
  notes?: string
  services?: AppointmentService[]
}

interface Props {
  open: boolean
  appointment?: Appointment
  locationId: string
  clients: Client[]
  teamMembers: TeamMember[]
  services: Service[]
  onClose: () => void
  onSaved: () => void
  onCheckout?: () => void
}

export default function AppointmentModal({
  open, appointment, locationId, clients, teamMembers, services, onClose, onSaved, onCheckout
}: Props) {
  const [clientId, setClientId] = useState(appointment?.clientId ?? '')
  const [teamMemberId, setTeamMemberId] = useState(appointment?.teamMemberId ?? '')
  const [startTime, setStartTime] = useState(
    appointment?.startTime
      ? format(new Date(appointment.startTime), "yyyy-MM-dd'T'HH:mm")
      : ''
  )
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    appointment?.services?.map(s => s.service.id) ?? []
  )
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [status, setStatus] = useState(appointment?.status ?? 'BOOKED')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setClientId(appointment?.clientId ?? '')
    setTeamMemberId(appointment?.teamMemberId ?? '')
    setStartTime(appointment?.startTime ? format(new Date(appointment.startTime), "yyyy-MM-dd'T'HH:mm") : '')
    setSelectedServiceIds(appointment?.services?.map(s => s.service.id) ?? [])
    setNotes(appointment?.notes ?? '')
    setStatus(appointment?.status ?? 'BOOKED')
    setError(null)
    setLoading(false)
  }, [appointment?.id, open])

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id))
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
  const endTime = startTime
    ? format(addMinutes(new Date(startTime), totalDuration || 60), "yyyy-MM-dd'T'HH:mm")
    : ''

  function toggleService(id: string) {
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!startTime) return
    setLoading(true)
    setError(null)
    try {
      const body = {
        locationId,
        clientId: clientId || undefined,
        teamMemberId: teamMemberId || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime || startTime).toISOString(),
        notes: notes || undefined,
        services: selectedServices.map(s => ({ serviceId: s.id, price: s.price, duration: s.duration })),
      }

      let res: Response
      if (appointment?.id) {
        res = await fetch(`/api/appointments/${appointment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: notes || undefined,
            teamMemberId: teamMemberId || undefined,
            ...(startTime ? { startTime: new Date(startTime).toISOString() } : {}),
            ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
          }),
        })
      } else {
        res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? data.message ?? 'Failed to save')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Unexpected error, please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!appointment?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to cancel appointment')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Unexpected error, please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!appointment?.id) return
    setStatus(newStatus)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        setStatus(appointment.status ?? 'BOOKED') // revert optimistic update
        setError('Failed to update status')
        return
      }
      onSaved()
    } catch {
      setStatus(appointment.status ?? 'BOOKED')
      setError('Unexpected error updating status')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment?.id ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Status (edit only) */}
          {appointment?.id && (
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => handleStatusChange(s)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${
                      status === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date/time */}
          <div className="space-y-1">
            <Label>Start time *</Label>
            <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          {endTime && (
            <p className="text-xs text-slate-500">
              End: {format(new Date(endTime), 'h:mm a')} ({totalDuration || 60} min)
            </p>
          )}

          {/* Client */}
          <div className="space-y-1">
            <Label>Client</Label>
            <Select
              value={clientId}
              onValueChange={v => setClientId(v ?? '')}
              items={{ '': 'Walk-in', ...Object.fromEntries(clients.map(c => [c.id, c.name])) }}
            >
              <SelectTrigger><SelectValue placeholder="Walk-in / select client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Walk-in</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team member */}
          <div className="space-y-1">
            <Label>Team member</Label>
            <Select
              value={teamMemberId}
              onValueChange={v => setTeamMemberId(v ?? '')}
              items={{ '': 'Any available', ...Object.fromEntries(teamMembers.map(m => [m.id, m.name])) }}
            >
              <SelectTrigger><SelectValue placeholder="Any available" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any available</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Services (create only) */}
          {!appointment?.id && (
            <div className="space-y-2">
              <Label>Services *</Label>
              <div className="flex flex-wrap gap-2">
                {services.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedServiceIds.includes(s.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {s.name} ({s.duration}m)
                  </button>
                ))}
              </div>
              {selectedServices.length > 0 && (
                <p className="text-xs text-slate-500">
                  Total: {totalDuration} min · ${selectedServices.reduce((s, v) => s + v.price, 0).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes…" />
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <div>
            {appointment?.id && (
              <Button variant="destructive" size="sm" onClick={handleCancel}>Cancel appt.</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Dismiss</Button>
            {appointment?.id && onCheckout && (status === 'ARRIVED' || status === 'STARTED') && (
              <Button
                variant="outline"
                className="border-green-500 text-green-700 hover:bg-green-50"
                onClick={onCheckout}
              >
                Checkout
              </Button>
            )}
            <Button onClick={handleSave} disabled={loading || (!appointment?.id && selectedServiceIds.length === 0)}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
