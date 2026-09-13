'use client'

const STATUS_COLORS: Record<string, string> = {
  BOOKED:     'bg-blue-100 border-blue-400 text-blue-900',
  CONFIRMED:  'bg-indigo-100 border-indigo-400 text-indigo-900',
  ARRIVED:    'bg-yellow-100 border-yellow-400 text-yellow-900',
  STARTED:    'bg-orange-100 border-orange-400 text-orange-900',
  COMPLETED:  'bg-green-100 border-green-400 text-green-900',
  NO_SHOW:    'bg-red-100 border-red-400 text-red-900',
  CANCELLED:  'bg-slate-100 border-slate-300 text-slate-500',
}

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
  client?: { name: string } | null
  teamMember?: { name: string; calendarColor: string } | null
  services: AppointmentService[]
}

interface Props {
  appointment: Appointment
  topPx: number
  heightPx: number
  onClick: (a: Appointment) => void
}

export default function AppointmentBlock({ appointment, topPx, heightPx, onClick }: Props) {
  const colorClass = STATUS_COLORS[appointment.status] ?? STATUS_COLORS.BOOKED
  const serviceNames = appointment.services.map(s => s.service.name).join(', ')

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(appointment) }}
      className={`absolute left-1 right-1 rounded-md border-l-4 px-2 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden ${colorClass}`}
      style={{
        top: topPx,
        height: Math.max(heightPx - 2, 20),
        borderLeftColor: appointment.teamMember?.calendarColor ?? '#8B5CF6',
      }}
      onClick={() => onClick(appointment)}
    >
      <p className="text-xs font-semibold truncate">{appointment.client?.name ?? 'Walk-in'}</p>
      {heightPx > 35 && (
        <p className="text-[10px] truncate opacity-70">{serviceNames}</p>
      )}
    </div>
  )
}
