'use client'
import { useMemo } from 'react'
import { format } from 'date-fns'
import CalendarDayColumn from './CalendarDayColumn'
import { START_HOUR, END_HOUR } from './calendar-grid'

interface AppointmentService {
  service: { id: string; name: string }
  price: number
  duration: number
}

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  channel?: string
  teamMemberId?: string
  client?: { name: string } | null
  teamMember?: { name: string; calendarColor: string } | null
  services: AppointmentService[]
}

interface TeamMember {
  id: string
  name: string
  calendarColor: string
}

interface Column {
  id?: string
  name: string
  color?: string
}

interface Props {
  date: Date
  appointments: Appointment[]
  teamMembers: TeamMember[]
  onSlotClick: (hour: number, minute: number, teamMemberId?: string) => void
  onAppointmentClick: (a: Appointment) => void
}

export default function CalendarDayView({ date, appointments, teamMembers, onSlotClick, onAppointmentClick }: Props) {
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    []
  )
  const multi = teamMembers.length > 1

  const columns: Column[] = multi
    ? [
        ...teamMembers.map(m => ({ id: m.id, name: m.name, color: m.calendarColor })),
        { id: undefined, name: 'Unassigned' },
      ]
    : [{ id: undefined, name: format(date, 'EEE d') }]

  return (
    <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
      {/* Time gutter */}
      <div className="w-16 shrink-0 border-r border-slate-100">
        <div className="h-10 border-b border-slate-100" />
        {hours.map(h => (
          <div key={h} className="h-16 border-b border-slate-100 flex items-start justify-end pr-2 pt-1">
            <span className="text-[10px] text-slate-400 font-medium">
              {format(new Date().setHours(h, 0, 0, 0), 'h a')}
            </span>
          </div>
        ))}
      </div>

      {columns.map(col => {
        const colAppointments = multi
          ? appointments.filter(a => (a.teamMemberId ?? undefined) === col.id)
          : appointments
        return (
          <div
            key={col.id ?? 'unassigned'}
            className="flex-1 min-w-[140px] flex flex-col border-r border-slate-100 last:border-r-0"
          >
            <div className="h-10 border-b border-slate-100 flex items-center justify-center gap-1.5 px-2">
              {multi && col.color && (
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
              )}
              <span className="text-xs font-semibold text-slate-700 truncate">{col.name}</span>
            </div>
            <CalendarDayColumn
              appointments={colAppointments}
              onSlotClick={(h, m) => onSlotClick(h, m, col.id)}
              onAppointmentClick={onAppointmentClick}
            />
          </div>
        )
      })}
    </div>
  )
}
