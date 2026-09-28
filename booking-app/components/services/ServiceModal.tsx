'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface Category {
  id: string
  name: string
}

interface Service {
  id?: string
  name: string
  categoryId?: string | null
  description?: string | null
  priceType: string
  price: number
  duration: number
  isOnlineBookable: boolean
  commissionRate?: number | null
}

interface Props {
  open: boolean
  service?: Service
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export default function ServiceModal({ open, service, categories, onClose, onSaved }: Props) {
  const [name, setName] = useState(service?.name ?? '')
  const [categoryId, setCategoryId] = useState(service?.categoryId ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [priceType, setPriceType] = useState(service?.priceType ?? 'FIXED')
  const [price, setPrice] = useState(service?.price ?? 0)
  const [duration, setDuration] = useState(service?.duration ?? 60)
  const [isOnlineBookable, setIsOnlineBookable] = useState(service?.isOnlineBookable ?? true)
  const [commissionRate, setCommissionRate] = useState<string>(
    service?.commissionRate != null ? String(Math.round(service.commissionRate * 100)) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(service?.name ?? '')
    setCategoryId(service?.categoryId ?? '')
    setDescription(service?.description ?? '')
    setPriceType(service?.priceType ?? 'FIXED')
    setPrice(service?.price ?? 0)
    setDuration(service?.duration ?? 60)
    setIsOnlineBookable(service?.isOnlineBookable ?? true)
    setCommissionRate(service?.commissionRate != null ? String(Math.round(service.commissionRate * 100)) : '')
    setError(null)
  }, [service, open])

  async function handleSave() {
    setLoading(true)
    setError(null)
    const url = service?.id ? `/api/services/${service.id}` : '/api/services'
    const method = service?.id ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        categoryId: categoryId || undefined,
        description: description || undefined,
        priceType,
        price,
        duration,
        isOnlineBookable,
        commissionRate: commissionRate.trim() === '' ? null : Number(commissionRate) / 100,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? data.message ?? 'Failed to save')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service?.id ? 'Edit Service' : 'Add Service'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gel Manicure" />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId(v ?? '')}
              items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Price Type</Label>
              <Select
                value={priceType}
                onValueChange={(v) => setPriceType(v ?? 'FIXED')}
                items={{ FIXED: 'Fixed', FROM: 'From', FREE: 'Free' }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                  <SelectItem value="FROM">From</SelectItem>
                  <SelectItem value="FREE">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Price (cents)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={5}
              step={5}
            />
          </div>
          <div className="space-y-1">
            <Label>Commission Rate (%)</Label>
            <Input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              min={0}
              max={100}
              placeholder="Uses team member's default rate"
            />
            <p className="text-xs text-slate-400">
              Leave blank to use each team member&apos;s default commission rate. Set a value here to override it for
              this service specifically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="online"
              checked={isOnlineBookable}
              onChange={(e) => setIsOnlineBookable(e.target.checked)}
            />
            <Label htmlFor="online">Online bookable</Label>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
