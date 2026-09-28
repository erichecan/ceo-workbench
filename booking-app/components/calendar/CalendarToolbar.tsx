'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format, addDays, subDays, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'

type ViewMode = 'day' | 'week' | 'month'

interface Props {
  date: Date
  view: ViewMode
  onDateChange: (d: Date) => void
  onViewChange: (v: ViewMode) => void
}

export default function CalendarToolbar({ date, view, onDateChange, onViewChange }: Props) {
  function prev() {
    if (view === 'day') onDateChange(subDays(date, 1))
    else if (view === 'week') onDateChange(subDays(date, 7))
    else onDateChange(subMonths(date, 1))
  }
  function next() {
    if (view === 'day') onDateChange(addDays(date, 1))
    else if (view === 'week') onDateChange(addDays(date, 7))
    else onDateChange(addMonths(date, 1))
  }

  const label = view === 'day'
    ? format(date, 'EEEE, MMMM d, yyyy')
    : view === 'week'
    ? `${format(startOfWeek(date), 'MMM d')} – ${format(endOfWeek(date), 'MMM d, yyyy')}`
    : format(date, 'MMMM yyyy')

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prev}><ChevronLeft size={16} /></Button>
        <span className="text-sm font-semibold text-slate-800 min-w-[220px] text-center">{label}</span>
        <Button variant="outline" size="sm" onClick={next}><ChevronRight size={16} /></Button>
        <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>Today</Button>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
        {(['day', 'week', 'month'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize ${
              view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
