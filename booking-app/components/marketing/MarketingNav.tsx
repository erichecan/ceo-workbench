import Link from 'next/link'

const LINKS = [
  { href: '/business-types', label: '适用业态' },
  { href: '/features', label: '功能' },
  { href: '/social-media', label: '社交媒体代运营' },
]

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-heading text-xl font-semibold tracking-tight text-primary">
          Beauty & Wellness Booking
        </Link>
        <nav className="flex items-center gap-7 text-sm font-medium text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hidden hover:text-foreground sm:inline">
              {l.label}
            </Link>
          ))}
          <Link
            href="/book/demo-salon"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            查看预约页 Demo
          </Link>
        </nav>
      </div>
    </header>
  )
}
