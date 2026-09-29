import { Sidebar } from '@/components/layout/Sidebar'
import { getSession } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return (
    <div className="flex h-screen bg-muted">
      <Sidebar role={session?.role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
