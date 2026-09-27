'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from 'date-fns'
import CalendarToolbar from './CalendarToolbar'
import CalendarDayView from './CalendarDayView'
import CalendarWeekView from './CalendarWeekView'
import AppointmentModal from './AppointmentModal'
import CheckoutModal from './CheckoutModal'

type ViewMode = 'day' | 'week'

interface Client { id: string; name: string }
interface TeamMember { id: string; name: string; calendarColor: string }
interface Service { id: string; name: string; price: number; duration: number }
interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  channel?: string
  clientId?: string
  teamMemberId?: string
  notes?: string
  client?: { name: string } | null
  teamMember?: { name: string; calendarColor: string } | null
  services: Array<{ service: { id: string; name: string }; price: number; duration: number }>
}

interface Props {
  locationId: string
  clients: Client[]
  teamMembers: TeamMember[]
  services: Service[]
}

export default function CalendarClient({ locationId, clients, teamMembers, services }: Props) {
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('day')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppt, setEditingAppt] = useState<Appointment | undefined>()
  const [newApptTime, setNewApptTime] = useState('')
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [checkoutAppt, setCheckoutAppt] = useState<Appointment | undefined>()
  const abortRef = useRef<AbortController | null>(null)

  const fetchAppointments = useCallback(async (d: Date, v: ViewMode) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const from = v === 'day' ? startOfDay(d) : startOfWeek(d)
    const to = v === 'day' ? endOfDay(d) : endOfWeek(d)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/appointments?locationId=${locationId}&from=${from.toISOString()}&to=${to.toISOString()}`,
        { signal: abortRef.current.signal }
      )
      if (!res.ok) {
        setError('Failed to load appointments')
        return
      }
      setAppointments(await res.json())
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchAppointments(date, view)
  }, [fetchAppointments])

  function handleDateChange(d: Date) {
    setDate(d)
    fetchAppointments(d, view)
  }

  function handleViewChange(v: ViewMode) {
    setView(v)
    fetchAppointments(date, v)
  }

  function handleSlotClick(hour: number, minute: number) {
    const d = new Date(date)
    d.setHours(hour, minute, 0, 0)
    setNewApptTime(format(d, "yyyy-MM-dd'T'HH:mm"))
    setEditingAppt(undefined)
    setModalOpen(true)
  }

  function handleWeekSlotClick(hour: number, minute: number, dayDate: Date) {
    const d = new Date(dayDate)
    d.setHours(hour, minute, 0, 0)
    setNewApptTime(format(d, "yyyy-MM-dd'T'HH:mm"))
    setEditingAppt(undefined)
    setModalOpen(true)
  }

  function handleAppointmentClick(a: Appointment) {
    setEditingAppt(a)
    setModalOpen(true)
  }

  function handleCheckoutFromModal() {
    setModalOpen(false)
    setCheckoutAppt(editingAppt)
    setCheckoutModalOpen(true)
  }

  function handleCheckedOut() {
    fetchAppointments(date, view)
  }

  return (
    <div>
      <CalendarToolbar
        date={date}
        view={view}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
      />

      {error && <p className="text-red-500 text-sm px-4 py-2">{error}</p>}
      {loading && <p className="text-slate-400 text-sm px-4 py-2">Loading…</p>}

      {view === 'day' && (
        <CalendarDayView
          date={date}
          appointments={appointments}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {view === 'week' && (
        <CalendarWeekView
          date={date}
          appointments={appointments}
          onSlotClick={handleWeekSlotClick}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      <AppointmentModal
        open={modalOpen}
        appointment={
          editingAppt
            ? {
                id: editingAppt.id,
                clientId: editingAppt.clientId,
                teamMemberId: editingAppt.teamMemberId,
                startTime: editingAppt.startTime,
                endTime: editingAppt.endTime,
                status: editingAppt.status,
                channel: editingAppt.channel,
                notes: editingAppt.notes,
                services: editingAppt.services,
              }
            : newApptTime
            ? { startTime: newApptTime }
            : undefined
        }
        locationId={locationId}
        clients={clients}
        teamMembers={teamMembers}
        services={services}
        onClose={() => setModalOpen(false)}
        onSaved={() => fetchAppointments(date, view)}
        onCheckout={handleCheckoutFromModal}
      />

      <CheckoutModal
        open={checkoutModalOpen}
        appointment={checkoutAppt}
        locationId={locationId}
        onClose={() => setCheckoutModalOpen(false)}
        onCheckedOut={handleCheckedOut}
      />
    </div>
  )
}
