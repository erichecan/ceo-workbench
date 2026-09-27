import Link from 'next/link'

const LINKS = [
  { href: '/business-types', label: '适用业态' },
  { href: '/features', label: '功能' },
]

export function MarketingNav() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-heading text-lg font-semibold text-primary">
          Beauty & Wellness Booking
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <Link
            href="/book/demo-salon"
            className="rounded-lg bg-primary px-3.5 py-1.5 text-primary-foreground hover:bg-primary/90"
          >
            查看预约页 Demo
          </Link>
        </nav>
      </div>
    </header>
  )
}
