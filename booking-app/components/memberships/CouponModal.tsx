'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Coupon {
  id?: string
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  expiresAt?: string | Date | null
  usageLimit?: number | null
  isActive: boolean
}

interface Props {
  open: boolean
  coupon?: Coupon
  onClose: () => void
  onSaved: () => void
}

function toDateInputValue(v: string | Date | null | undefined): string {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function CouponModal({ open, coupon, onClose, onSaved }: Props) {
  const [code, setCode] = useState(coupon?.code ?? '')
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>(coupon?.discountType ?? 'PERCENT')
  const [discountValueInput, setDiscountValueInput] = useState(
    coupon ? (coupon.discountType === 'PERCENT' ? String(coupon.discountValue) : (coupon.discountValue / 100).toFixed(2)) : '10'
  )
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(coupon?.expiresAt))
  const [usageLimit, setUsageLimit] = useState(coupon?.usageLimit != null ? String(coupon.usageLimit) : '')
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCode(coupon?.code ?? '')
    setDiscountType(coupon?.discountType ?? 'PERCENT')
    setDiscountValueInput(
      coupon ? (coupon.discountType === 'PERCENT' ? String(coupon.discountValue) : (coupon.discountValue / 100).toFixed(2)) : '10'
    )
    setExpiresAt(toDateInputValue(coupon?.expiresAt))
    setUsageLimit(coupon?.usageLimit != null ? String(coupon.usageLimit) : '')
    setIsActive(coupon?.isActive ?? true)
    setError(null)
  }, [coupon, open])

  async function handleSave() {
    if (!code.trim()) {
      setError('优惠码不能为空')
      return
    }
    const discountValue =
      discountType === 'PERCENT'
        ? Math.round(parseFloat(discountValueInput || '0'))
        : Math.round(parseFloat(discountValueInput || '0') * 100)
    if (isNaN(discountValue) || discountValue < 0) {
      setError('折扣数值无效')
      return
    }
    if (discountType === 'PERCENT' && discountValue > 100) {
      setError('百分比折扣不能超过 100')
      return
    }
    setLoading(true)
    setError(null)
    const url = coupon?.id ? `/api/coupons/${coupon.id}` : '/api/coupons'
    const method = coupon?.id ? 'PATCH' : 'POST'
    const body: Record<string, unknown> = {
      discountType,
      discountValue,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      usageLimit: usageLimit.trim() === '' ? null : Number(usageLimit),
      isActive,
    }
    if (!coupon?.id) body.code = code.trim()
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(res.status === 409 ? '优惠码已存在' : (data.error ?? '保存失败'))
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{coupon?.id ? '编辑优惠券' : '新建优惠券'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>优惠码</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SAVE20"
              disabled={!!coupon?.id}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>折扣类型</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType((v as 'PERCENT' | 'FIXED') ?? 'PERCENT')}
                items={{ PERCENT: '百分比', FIXED: '固定金额' }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">百分比</SelectItem>
                  <SelectItem value="FIXED">固定金额</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{discountType === 'PERCENT' ? '折扣百分比 (%)' : '折扣金额 ($)'}</Label>
              <Input
                type="number"
                value={discountValueInput}
                onChange={(e) => setDiscountValueInput(e.target.value)}
                min={0}
                max={discountType === 'PERCENT' ? 100 : undefined}
                step={discountType === 'PERCENT' ? 1 : 0.01}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>过期日期（可选）</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>使用次数上限（可选）</Label>
              <Input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                min={1}
                placeholder="不限"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="couponActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <Label htmlFor="couponActive">启用</Label>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '保存中…' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
