'use client'
import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_PER_DAY = 3

interface Appointment {
  id: string
  startTime: string
  status: string
  client?: { name: string } | null
}

interface Props {
  date: Date
  appointments: Appointment[]
  onDayClick: (d: Date) => void
}

function apptDayKey(timeStr: string): string {
  return format(parseISO(timeStr), 'yyyy-MM-dd')
}

export default function CalendarMonthView({ date, appointments, onDayClick }: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(date))
    const end = endOfWeek(endOfMonth(date))
    const result: Date[] = []
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      result.push(cursor)
    }
    return result
  }, [date])

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of appointments) {
      const key = apptDayKey(a.startTime)
      const list = map.get(key) ?? []
      list.push(a)
      map.set(key, list)
    }
    return map
  }, [appointments])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {WEEKDAY_LABELS.map(w => (
          <div key={w} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(d => {
          const key = format(d, 'yyyy-MM-dd')
          const dayAppts = apptsByDay.get(key) ?? []
          const inMonth = isSameMonth(d, date)
          const today = isSameDay(d, new Date())
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(d)}
              className={`min-h-[92px] border-r border-b border-slate-100 last:border-r-0 p-1.5 text-left align-top hover:bg-slate-50 transition-colors ${
                inMonth ? 'bg-white' : 'bg-slate-50/60'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center size-5 rounded-full text-[11px] font-semibold ${
                  today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {format(d, 'd')}
              </span>
              {dayAppts.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayAppts.slice(0, MAX_VISIBLE_PER_DAY).map(a => (
                    <p key={a.id} className="truncate text-[10px] text-slate-600">
                      {format(parseISO(a.startTime), 'h:mm a')} {a.client?.name ?? 'Walk-in'}
                    </p>
                  ))}
                  {dayAppts.length > MAX_VISIBLE_PER_DAY && (
                    <p className="text-[10px] font-medium text-primary">
                      +{dayAppts.length - MAX_VISIBLE_PER_DAY} more
                    </p>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
