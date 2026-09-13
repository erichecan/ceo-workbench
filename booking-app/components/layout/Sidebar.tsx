'use client'

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

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch('/admin/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('[Logout] request failed', err)
    }
    window.location.assign('/admin/login')
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center px-4 border-b border-slate-200">
        <span className="font-semibold text-slate-900">Beauty & Wellness</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200">
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
