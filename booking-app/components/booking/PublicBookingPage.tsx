'use client'

import { useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface PublicService {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'FROM' | 'FREE'
}

export interface PublicBookingPageProps {
  slug: string
  shopName: string
  logoUrl?: string | null
  services: PublicService[]
}

function formatPrice(service: PublicService) {
  if (service.priceType === 'FREE') return '免费'
  const dollars = (service.price / 100).toFixed(0)
  return service.priceType === 'FROM' ? `$${dollars} 起` : `$${dollars}`
}

function ShopAvatar({
  shopName,
  logoUrl,
  size,
  onDark = false,
}: {
  shopName: string
  logoUrl?: string | null
  size: 'sm' | 'lg'
  onDark?: boolean
}) {
  const dimension = size === 'lg' ? 'size-24 text-3xl' : 'size-14 text-xl'
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={shopName} className={cn('rounded-full object-cover', dimension)} />
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-heading',
        onDark ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
        dimension
      )}
    >
      {shopName.slice(0, 1)}
    </div>
  )
}

export default function PublicBookingPage({ slug, shopName, logoUrl, services }: PublicBookingPageProps) {
  const [serviceId, setServiceId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const missingFields = [
    !serviceId && '服务项目',
    !clientName && '姓名',
    !clientPhone && '电话',
    !date && '日期',
    !time && '时间',
  ].filter(Boolean) as string[]
  const canSubmit = missingFields.length === 0 && !submitting

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, serviceId, clientName, clientPhone, date, time, note }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? '提交失败，请稍后重试')
      }
    } catch {
      setError('网络出了点问题，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <CheckCircle2 className="mb-1 size-14 text-primary" strokeWidth={1.5} />
        <h1 className="font-heading text-2xl text-primary">预约请求已收到</h1>
        <p className="text-muted-foreground">{shopName} 会尽快电话确认你的预约时间，请留意来电。</p>
        <Button variant="outline" onClick={() => setDone(false)}>再预约一个</Button>
      </div>
    )
  }

  return (
    <div className="lg:flex lg:min-h-screen">
      <aside className="hidden shrink-0 flex-col items-center justify-center gap-4 bg-primary px-10 py-16 text-center lg:flex lg:w-[380px]">
        <ShopAvatar shopName={shopName} logoUrl={logoUrl} size="lg" onDark />
        <h1 className="font-heading text-3xl text-primary-foreground">{shopName}</h1>
        <p className="text-sm text-primary-foreground/80">在线预约，我们会尽快电话确认你的时间</p>
      </aside>

      <div className="mx-auto max-w-md animate-in fade-in slide-in-from-bottom-2 px-6 py-10 duration-500 lg:max-w-xl lg:flex-1 lg:px-16 lg:py-16">
        <header className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
          <ShopAvatar shopName={shopName} logoUrl={logoUrl} size="sm" />
          <h1 className="font-heading text-2xl text-primary">{shopName}</h1>
        </header>

        <section className="mb-6">
          <Label className="mb-2 block">选择服务项目</Label>
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.98]',
                  serviceId === s.id ? 'border-ring bg-accent ring-1 ring-ring' : 'border-border hover:bg-muted'
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      serviceId === s.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {serviceId === s.id && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">{s.duration} 分钟</span>
                  </span>
                </span>
                <span className="text-sm font-medium text-primary">{formatPrice(s)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <Label htmlFor="clientName" className="mb-1 block">姓名</Label>
            <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="怎么称呼你" />
          </div>
          <div>
            <Label htmlFor="clientPhone" className="mb-1 block">电话</Label>
            <Input id="clientPhone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="方便联系你确认时间" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="date" className="mb-1 block">日期</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label htmlFor="time" className="mb-1 block">时间</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="note" className="mb-1 block">备注（选填）</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="有什么想提前说明的" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={!canSubmit} className="mt-2 w-full">
            {submitting ? '提交中…' : '提交预约请求'}
          </Button>
          {!submitting && missingFields.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">还差：{missingFields.join('、')}</p>
          )}
        </section>
      </div>
    </div>
  )
}
