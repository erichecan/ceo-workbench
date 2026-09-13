'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CheckoutItem {
  serviceId?: string
  name: string
  price: number  // cents
}

interface AppointmentForCheckout {
  id: string
  clientId?: string
  teamMemberId?: string
  client?: { name: string } | null
  teamMember?: { name: string } | null
  services: Array<{
    service: { id: string; name: string }
    price: number
    duration: number
  }>
}

interface Props {
  open: boolean
  appointment: AppointmentForCheckout | undefined
  locationId: string
  onClose: () => void
  onCheckedOut: () => void
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'E_TRANSFER', label: 'E-Transfer' },
  { value: 'OTHER', label: 'Other' },
] as const

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}

function parseDollarsToCents(val: string): number {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

export default function CheckoutModal({ open, appointment, locationId, onClose, onCheckedOut }: Props) {
  const [items, setItems] = useState<CheckoutItem[]>([])
  const [discountCents, setDiscountCents] = useState(0)
  const [discountInput, setDiscountInput] = useState('0.00')
  const [tipCents, setTipCents] = useState(0)
  const [tipInput, setTipInput] = useState('0.00')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'E_TRANSFER' | 'OTHER'>('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !appointment) return
    setItems(
      appointment.services.map(s => ({
        serviceId: s.service.id,
        name: s.service.name,
        price: s.price,
      }))
    )
    setDiscountCents(0)
    setDiscountInput('0.00')
    setTipCents(0)
    setTipInput('0.00')
    setPaymentMethod('CASH')
    setError(null)
  }, [open, appointment?.id])

  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const total = Math.max(0, subtotal - discountCents + tipCents)

  function handleItemPriceChange(index: number, val: string) {
    const cents = parseDollarsToCents(val)
    setItems(prev => prev.map((item, i) => i === index ? { ...item, price: cents } : item))
  }

  function handleDiscountBlur() {
    setDiscountCents(parseDollarsToCents(discountInput))
    setDiscountInput(centsToDisplay(parseDollarsToCents(discountInput)))
  }

  function handleTipBlur() {
    setTipCents(parseDollarsToCents(tipInput))
    setTipInput(centsToDisplay(parseDollarsToCents(tipInput)))
  }

  async function handleCheckout() {
    if (!appointment) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          appointmentId: appointment.id,
          clientId: appointment.clientId ?? undefined,
          teamMemberId: appointment.teamMemberId ?? undefined,
          subtotal,
          discountAmount: discountCents,
          tipAmount: tipCents,
          paymentMethod,
          items,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Checkout failed')
        return
      }
      onCheckedOut()
      onClose()
    } catch {
      setError('Unexpected error, please try again')
    } finally {
      setLoading(false)
    }
  }

  const clientName = appointment?.client?.name ?? 'Walk-in'
  const staffName = appointment?.teamMember?.name

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{clientName}</span>
            {staffName && <span> · {staffName}</span>}
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Services</Label>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-slate-700 truncate">{item.name}</span>
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <Input
                    className="pl-5 text-right text-sm h-8"
                    defaultValue={centsToDisplay(item.price)}
                    onBlur={e => handleItemPriceChange(i, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Discount */}
          <div className="flex items-center gap-2">
            <Label className="w-28 shrink-0">Discount ($)</Label>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                className="pl-5 text-right text-sm h-8"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                onBlur={handleDiscountBlur}
              />
            </div>
          </div>

          {/* Tip */}
          <div className="flex items-center gap-2">
            <Label className="w-28 shrink-0">Tip ($)</Label>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                className="pl-5 text-right text-sm h-8"
                value={tipInput}
                onChange={e => setTipInput(e.target.value)}
                onBlur={handleTipBlur}
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-1">
            <Label>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={v => setPaymentMethod(v as typeof paymentMethod)}
              items={Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]))}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>${centsToDisplay(subtotal)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>−${centsToDisplay(discountCents)}</span>
              </div>
            )}
            {tipCents > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tip</span>
                <span>+${centsToDisplay(tipCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900 text-base pt-1">
              <span>Total</span>
              <span>${centsToDisplay(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleCheckout}
            disabled={loading || items.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Processing…' : `Collect $${centsToDisplay(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
