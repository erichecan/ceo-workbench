'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, Users, UserCheck, Scissors, LogOut, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/calendar', label: '预约日历', icon: CalendarDays },
  { href: '/clients', label: '客户管理', icon: Users },
  { href: '/team', label: '员工管理', icon: UserCheck },
  { href: '/services', label: '服务项目', icon: Scissors },
  { href: '/sales', label: '销售记录', icon: ReceiptText },
]

const PENDING_POLL_MS = 60_000

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingOnline, setPendingOnline] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch('/api/appointments/pending-count')
        if (!res.ok || cancelled) return
        const { count } = await res.json()
        if (!cancelled) setPendingOnline(count)
      } catch {
        // 静默失败：这个红点是提醒性质，不阻塞任何操作
      }
    }
    poll()
    const timer = setInterval(poll, PENDING_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('[Logout] request failed', err)
    }
    window.location.assign('/login')
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center px-4 border-b border-border">
        <span className="font-heading italic font-semibold text-primary">Beauty & Wellness</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-accent text-accent-foreground'
                : 'text-slate-600 hover:bg-accent/50 hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {href === '/calendar' && pendingOnline > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white"
                title={`${pendingOnline} 个线上预约待确认`}
              >
                {pendingOnline}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-slate-600"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
