'use client'
import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import AppointmentBlock from './AppointmentBlock'

const HOUR_HEIGHT = 64 // px per hour
const START_HOUR = 8
const END_HOUR = 20

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  client?: { name: string } | null
  teamMember?: { name: string; calendarColor: string } | null
  services: Array<{ service: { id: string; name: string }; price: number; duration: number }>
}

interface Props {
  date: Date
  appointments: Appointment[]
  onSlotClick: (hour: number, minute: number) => void
  onAppointmentClick: (a: Appointment) => void
}

function timeToTopPx(timeStr: string): number {
  const d = parseISO(timeStr)
  const hours = d.getHours() - START_HOUR
  const minutes = d.getMinutes()
  return (hours * 60 + minutes) * (HOUR_HEIGHT / 60)
}

function durationToHeightPx(startStr: string, endStr: string): number {
  const start = parseISO(startStr)
  const end = parseISO(endStr)
  const durationMin = (end.getTime() - start.getTime()) / 60000
  return durationMin * (HOUR_HEIGHT / 60)
}

export default function CalendarDayView({ date, appointments, onSlotClick, onAppointmentClick }: Props) {
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    []
  )

  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  return (
    <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden">
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

      {/* Day column */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-10 border-b border-slate-100 flex items-center justify-center">
          <span className="text-xs font-semibold text-slate-700">{format(date, 'EEE d')}</span>
        </div>

        {/* Grid */}
        <div className="relative overflow-hidden" style={{ height: totalHeight }}>
          {/* Hour lines */}
          {hours.map(h => (
            <div
              key={h}
              className="absolute left-0 right-0 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              onClick={() => onSlotClick(h, 0)}
            />
          ))}

          {/* Appointment blocks */}
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
      </div>
    </div>
  )
}
