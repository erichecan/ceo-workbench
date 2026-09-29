'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Client {
  id: string
  name: string
}

interface Props {
  open: boolean
  clients: Client[]
  onClose: () => void
  onSaved: () => void
}

export default function GiftCardModal({ open, clients, onClose, onSaved }: Props) {
  const [initialValueInput, setInitialValueInput] = useState('50.00')
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setInitialValueInput('50.00')
    setClientId('')
    setError(null)
  }, [open])

  async function handleSave() {
    const initialValue = Math.round(parseFloat(initialValueInput || '0') * 100)
    if (isNaN(initialValue) || initialValue <= 0) {
      setError('面值必须大于 0')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/gift-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialValue, clientId: clientId || undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '创建失败')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建礼品卡</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>面值 ($)</Label>
            <Input
              type="number"
              value={initialValueInput}
              onChange={(e) => setInitialValueInput(e.target.value)}
              min={0.01}
              step="0.01"
            />
          </div>
          <div className="space-y-1">
            <Label>关联客户（可选）</Label>
            <Select
              value={clientId}
              onValueChange={(v) => setClientId(v ?? '')}
              items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
            >
              <SelectTrigger>
                <SelectValue placeholder="不关联客户" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-400">卡号系统自动生成，保存后可在列表中查看。</p>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '创建中…' : '创建'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
