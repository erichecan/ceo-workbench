'use client'
import { useMemo } from 'react'
import AppointmentBlock from './AppointmentBlock'
import { HOUR_HEIGHT, START_HOUR, END_HOUR, timeToTopPx, durationToHeightPx } from './calendar-grid'

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
  client?: { name: string } | null
  teamMember?: { name: string; calendarColor: string } | null
  services: AppointmentService[]
}

interface Props {
  appointments: Appointment[]
  onSlotClick: (hour: number, minute: number) => void
  onAppointmentClick: (a: Appointment) => void
}

export default function CalendarDayColumn({ appointments, onSlotClick, onAppointmentClick }: Props) {
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    []
  )
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  return (
    <div className="relative overflow-hidden" style={{ height: totalHeight }}>
      {hours.map(h => (
        <div
          key={h}
          role="button"
          tabIndex={0}
          aria-label={`Book appointment at ${h}:00`}
          className="absolute left-0 right-0 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
          style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          onClick={() => onSlotClick(h, 0)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSlotClick(h, 0) }}
        />
      ))}

      {appointments.map(a => (
        <AppointmentBlock
          key={a.id}
          appointment={a}
          topPx={timeToTopPx(a.startTime)}
          heightPx={durationToHeightPx(a.startTime, a.endTime)}
          onClick={onAppointmentClick}
        />
      ))}
    </div>
  )
}
