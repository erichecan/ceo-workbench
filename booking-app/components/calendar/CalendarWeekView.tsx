'use client'
import { useMemo } from 'react'
import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import AppointmentBlock from './AppointmentBlock'

const HOUR_HEIGHT = 48
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
  onSlotClick: (hour: number, minute: number, dayDate: Date) => void
  onAppointmentClick: (a: Appointment) => void
}

function timeToTopPx(timeStr: string): number {
  const d = parseISO(timeStr)
  return ((d.getHours() - START_HOUR) * 60 + d.getMinutes()) * (HOUR_HEIGHT / 60)
}

function durationToHeightPx(start: string, end: string): number {
  return ((parseISO(end).getTime() - parseISO(start).getTime()) / 60000) * (HOUR_HEIGHT / 60)
}

function apptDay(timeStr: string): string {
  return format(parseISO(timeStr), 'yyyy-MM-dd')
}

export default function CalendarWeekView({ date, appointments, onSlotClick, onAppointmentClick }: Props) {
  const days = useMemo(() => {
    const ws = startOfWeek(date)
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  }, [date])
  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), [])
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  return (
    <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
      {/* Gutter */}
      <div className="w-14 shrink-0 border-r border-slate-100">
        <div className="h-10 border-b border-slate-100" />
        {hours.map(h => (
          <div key={h} className="border-b border-slate-100 flex items-start justify-end pr-2 pt-1" style={{ height: HOUR_HEIGHT }}>
            <span className="text-[9px] text-slate-400 font-medium">{format(new Date().setHours(h, 0, 0, 0), 'h a')}</span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd')
        const dayAppts = appointments.filter(a => apptDay(a.startTime) === dayKey)
        return (
          <div key={dayKey} className="flex-1 min-w-[100px] flex flex-col border-r border-slate-100 last:border-r-0">
            <div className="h-10 border-b border-slate-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-slate-700">{format(day, 'EEE d')}</span>
            </div>
            <div className="relative overflow-hidden" style={{ height: totalHeight }}>
              {hours.map(h => (
                <div
                  key={h}
                  role="button"
                  tabIndex={0}
                  aria-label={`Book appointment at ${h}:00`}
                  className="absolute left-0 right-0 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick(h, 0, day)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSlotClick(h, 0, day) }}
                />
              ))}
              {dayAppts.map(a => (
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
        )
      })}
    </div>
  )
}
