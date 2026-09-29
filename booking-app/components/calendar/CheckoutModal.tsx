'use client'
import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'

interface CheckoutItem {
  serviceId?: string
  productId?: string
  name: string
  price: number // cents, per unit
  quantity: number
}

interface Product {
  id: string
  name: string
  price: number
  stockQty: number
  isArchived: boolean
}

interface Coupon {
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  isActive: boolean
  expiresAt: string | null
  usageLimit: number | null
  usedCount: number
}

interface GiftCard {
  code: string
  balance: number
  isActive: boolean
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

/** 与 lib/db/queries/coupons.ts validateCoupon 逻辑一致，仅用于前端预览，真正校验在提交时后端做 */
function previewCouponDiscount(coupon: Coupon, base: number): { ok: true; discount: number } | { ok: false; message: string } {
  if (!coupon.isActive) return { ok: false, message: '优惠券已停用' }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: '优惠券已过期' }
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: '优惠券已达使用上限' }
  }
  const b = Math.max(0, base)
  const raw = coupon.discountType === 'PERCENT' ? Math.round((b * coupon.discountValue) / 100) : coupon.discountValue
  return { ok: true, discount: Math.min(Math.max(raw, 0), b) }
}

/** 后端 CheckoutError 消息目前是英文，这里翻译成用户看得懂的中文 */
function translateCheckoutError(message: string): string {
  if (message.startsWith('Insufficient stock for')) {
    return `库存不足：${message.replace('Insufficient stock for ', '')}`
  }
  if (message.startsWith('Product archived:')) {
    return `商品已下架：${message.replace('Product archived: ', '')}`
  }
  if (message.startsWith('Product not found:')) {
    return `商品不存在：${message.replace('Product not found: ', '')}`
  }
  const map: Record<string, string> = {
    'Coupon not found': '优惠券不存在',
    'Coupon is not active': '优惠券已停用',
    'Coupon has expired': '优惠券已过期',
    'Coupon usage limit reached': '优惠券已达使用上限',
    'Gift card not found': '礼品卡不存在',
    'Gift card is not active': '礼品卡已停用',
    'Insufficient gift card balance': '礼品卡余额不足',
    'Gift card redeem amount must be positive': '礼品卡抵扣金额需大于 0',
    'Client required to redeem points': '需要选择客户才能使用积分抵扣',
    'Client not found': '客户不存在',
    'Workspace not found': '系统错误，请重试',
  }
  return map[message] ?? '结账失败，请重试'
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

  const [products, setProducts] = useState<Product[]>([])
  const [productToAdd, setProductToAdd] = useState('')

  const [couponCode, setCouponCode] = useState('')
  const [couponPreview, setCouponPreview] = useState<{ discount: number; message?: string } | null>(null)

  const [giftCardCode, setGiftCardCode] = useState('')
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null)
  const [giftCardMessage, setGiftCardMessage] = useState<string | null>(null)
  const [giftCardAmountInput, setGiftCardAmountInput] = useState('0.00')

  const [clientPointsBalance, setClientPointsBalance] = useState<number | null>(null)
  const [redeemPointsInput, setRedeemPointsInput] = useState('0')

  useEffect(() => {
    if (!open || !appointment) return
    setItems(
      appointment.services.map((s) => ({
        serviceId: s.service.id,
        name: s.service.name,
        price: s.price,
        quantity: 1,
      }))
    )
    setDiscountCents(0)
    setDiscountInput('0.00')
    setTipCents(0)
    setTipInput('0.00')
    setPaymentMethod('CASH')
    setError(null)
    setProductToAdd('')
    setCouponCode('')
    setCouponPreview(null)
    setGiftCardCode('')
    setGiftCardBalance(null)
    setGiftCardMessage(null)
    setGiftCardAmountInput('0.00')
    setRedeemPointsInput('0')
    setClientPointsBalance(null)

    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Product[]) => setProducts(data.filter((p) => !p.isArchived)))
      .catch(() => setProducts([]))

    if (appointment.clientId) {
      fetch(`/api/clients/${appointment.clientId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { pointsBalance?: number } | null) => setClientPointsBalance(data?.pointsBalance ?? null))
        .catch(() => setClientPointsBalance(null))
    }
  }, [open, appointment])

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const afterDiscount = Math.max(0, subtotal - discountCents)
  const couponDiscount = couponPreview?.discount ?? 0
  const afterCoupon = Math.max(0, afterDiscount - couponDiscount)
  const giftCardAmountCents = Math.min(Math.max(parseDollarsToCents(giftCardAmountInput), 0), afterCoupon)
  const afterGiftCard = Math.max(0, afterCoupon - giftCardAmountCents)
  const total = afterGiftCard + tipCents

  function handleItemPriceChange(index: number, val: string) {
    const cents = parseDollarsToCents(val)
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, price: cents } : item)))
  }

  function handleItemQtyChange(index: number, val: string) {
    const qty = Math.max(1, Math.round(Number(val)) || 1)
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)))
  }

  function handleAddProduct() {
    if (!productToAdd) return
    const product = products.find((p) => p.id === productToAdd)
    if (!product) return
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
    setProductToAdd('')
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const applyCoupon = useCallback(async () => {
    const code = couponCode.trim().toUpperCase()
    if (!code) {
      setCouponPreview(null)
      return
    }
    setCouponPreview(null)
    try {
      const res = await fetch('/api/coupons')
      if (!res.ok) return
      const coupons: Coupon[] = await res.json()
      const match = coupons.find((c) => c.code === code)
      if (!match) {
        setCouponPreview({ discount: 0, message: '优惠券不存在' })
        return
      }
      const preview = previewCouponDiscount(match, afterDiscount)
      if (!preview.ok) {
        setCouponPreview({ discount: 0, message: preview.message })
        return
      }
      setCouponPreview({ discount: preview.discount })
    } catch {
      setCouponPreview({ discount: 0, message: '优惠券校验失败，请重试' })
    }
  }, [couponCode, afterDiscount])

  const applyGiftCard = useCallback(async () => {
    const code = giftCardCode.trim().toUpperCase()
    if (!code) {
      setGiftCardBalance(null)
      setGiftCardMessage(null)
      return
    }
    setGiftCardBalance(null)
    setGiftCardMessage(null)
    try {
      const res = await fetch('/api/gift-cards')
      if (!res.ok) return
      const cards: GiftCard[] = await res.json()
      const match = cards.find((c) => c.code === code)
      if (!match) {
        setGiftCardMessage('礼品卡不存在')
        return
      }
      if (!match.isActive) {
        setGiftCardMessage('礼品卡已停用')
        return
      }
      setGiftCardBalance(match.balance)
      setGiftCardAmountInput(centsToDisplay(Math.min(match.balance, afterCoupon)))
    } catch {
      setGiftCardMessage('礼品卡校验失败，请重试')
    }
  }, [giftCardCode, afterCoupon])

  async function handleCheckout() {
    if (!appointment) return
    setLoading(true)
    setError(null)
    try {
      const redeemPoints = Math.max(0, Math.round(Number(redeemPointsInput)) || 0)
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          appointmentId: appointment.id,
          clientId: appointment.clientId ?? undefined,
          teamMemberId: appointment.teamMemberId ?? undefined,
          discountAmount: discountCents,
          tipAmount: tipCents,
          paymentMethod,
          items: items.map((i) => ({
            serviceId: i.serviceId,
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          couponCode: couponPreview && !couponPreview.message ? couponCode.trim() : undefined,
          giftCardCode: giftCardBalance !== null ? giftCardCode.trim() : undefined,
          giftCardAmount: giftCardBalance !== null ? giftCardAmountCents : undefined,
          redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? translateCheckoutError(data.error) : '结账失败，请重试')
        return
      }
      onCheckedOut()
      onClose()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setLoading(false)
    }
  }

  const clientName = appointment?.client?.name ?? 'Walk-in'
  const staffName = appointment?.teamMember?.name
  const availableProducts = products.filter((p) => p.stockQty > 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <Label>项目 / 商品</Label>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-slate-700 truncate">{item.name}</span>
                {item.productId && (
                  <Input
                    type="number"
                    className="w-14 text-center text-sm h-8"
                    value={item.quantity}
                    min={1}
                    onChange={(e) => handleItemQtyChange(i, e.target.value)}
                  />
                )}
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <Input
                    className="pl-5 text-right text-sm h-8"
                    defaultValue={centsToDisplay(item.price)}
                    onBlur={(e) => handleItemPriceChange(i, e.target.value)}
                  />
                </div>
                {item.productId && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(i)}
                    className="text-slate-400 hover:text-red-500 shrink-0"
                    aria-label="移除"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-400">尚未添加任何项目</p>}
          </div>

          {/* Add product */}
          <div className="flex items-center gap-2">
            <Select value={productToAdd} onValueChange={(v) => setProductToAdd(v ?? '')}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="选择商品加入结账单" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (库存 {p.stockQty}) · ${centsToDisplay(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleAddProduct} disabled={!productToAdd}>
              添加商品
            </Button>
          </div>

          {/* Discount */}
          <div className="flex items-center gap-2">
            <Label className="w-28 shrink-0">Discount ($)</Label>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                className="pl-5 text-right text-sm h-8"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onBlur={() => {
                  const cents = parseDollarsToCents(discountInput)
                  setDiscountCents(cents)
                  setDiscountInput(centsToDisplay(cents))
                }}
              />
            </div>
          </div>

          {/* Coupon */}
          <div className="space-y-1">
            <Label>优惠券码（可选）</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value)
                  setCouponPreview(null)
                }}
                onBlur={applyCoupon}
                placeholder="SAVE20"
              />
              <Button size="sm" variant="outline" onClick={applyCoupon}>
                校验
              </Button>
            </div>
            {couponPreview?.message && <p className="text-xs text-red-500">{couponPreview.message}</p>}
            {couponPreview && !couponPreview.message && (
              <p className="text-xs text-green-700">优惠券生效，折扣 ${centsToDisplay(couponPreview.discount)}</p>
            )}
          </div>

          {/* Gift card */}
          <div className="space-y-1">
            <Label>礼品卡号（可选）</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={giftCardCode}
                onChange={(e) => {
                  setGiftCardCode(e.target.value)
                  setGiftCardBalance(null)
                  setGiftCardMessage(null)
                }}
                onBlur={applyGiftCard}
                placeholder="A1B2C3D4E5F6"
              />
              <Button size="sm" variant="outline" onClick={applyGiftCard}>
                校验
              </Button>
            </div>
            {giftCardMessage && <p className="text-xs text-red-500">{giftCardMessage}</p>}
            {giftCardBalance !== null && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 shrink-0">
                  余额 ${centsToDisplay(giftCardBalance)}，本次抵扣
                </span>
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <Input
                    className="pl-5 text-right text-sm h-8"
                    value={giftCardAmountInput}
                    onChange={(e) => setGiftCardAmountInput(e.target.value)}
                    onBlur={() =>
                      setGiftCardAmountInput(
                        centsToDisplay(Math.min(Math.max(parseDollarsToCents(giftCardAmountInput), 0), Math.min(giftCardBalance, afterCoupon)))
                      )
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Points redemption */}
          {clientPointsBalance !== null && clientPointsBalance > 0 && (
            <div className="space-y-1">
              <Label>使用积分抵扣（当前余额 {clientPointsBalance} 分）</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={redeemPointsInput}
                min={0}
                max={clientPointsBalance}
                onChange={(e) => setRedeemPointsInput(e.target.value)}
                onBlur={() => {
                  const n = Math.max(0, Math.min(clientPointsBalance, Math.round(Number(redeemPointsInput)) || 0))
                  setRedeemPointsInput(String(n))
                }}
              />
              <p className="text-xs text-slate-400">实际可抵扣金额以提交后系统计算为准（不超过订单剩余金额）。</p>
            </div>
          )}

          {/* Tip */}
          <div className="flex items-center gap-2">
            <Label className="w-28 shrink-0">Tip ($)</Label>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                className="pl-5 text-right text-sm h-8"
                value={tipInput}
                onChange={(e) => setTipInput(e.target.value)}
                onBlur={() => {
                  const cents = parseDollarsToCents(tipInput)
                  setTipCents(cents)
                  setTipInput(centsToDisplay(cents))
                }}
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-1">
            <Label>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
              items={Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]))}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
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
            {couponDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Coupon</span>
                <span>−${centsToDisplay(couponDiscount)}</span>
              </div>
            )}
            {giftCardAmountCents > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Gift card</span>
                <span>−${centsToDisplay(giftCardAmountCents)}</span>
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
            {clientPointsBalance !== null && Number(redeemPointsInput) > 0 && (
              <p className="text-xs text-slate-400">
                积分抵扣将在提交后按实际金额计算，上方总额未包含积分抵扣预估。
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
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
