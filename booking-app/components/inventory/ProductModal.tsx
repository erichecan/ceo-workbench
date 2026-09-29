'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Product {
  id?: string
  name: string
  sku?: string | null
  price: number
  stockQty: number
  lowStockThreshold: number
}

interface Props {
  open: boolean
  product?: Product
  onClose: () => void
  onSaved: () => void
}

export default function ProductModal({ open, product, onClose, onSaved }: Props) {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [priceInput, setPriceInput] = useState(product ? (product.price / 100).toFixed(2) : '0.00')
  const [stockQty, setStockQty] = useState(product?.stockQty ?? 0)
  const [lowStockThreshold, setLowStockThreshold] = useState(product?.lowStockThreshold ?? 5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(product?.name ?? '')
    setSku(product?.sku ?? '')
    setPriceInput(product ? (product.price / 100).toFixed(2) : '0.00')
    setStockQty(product?.stockQty ?? 0)
    setLowStockThreshold(product?.lowStockThreshold ?? 5)
    setError(null)
  }, [product, open])

  async function handleSave() {
    if (!name.trim()) {
      setError('名称不能为空')
      return
    }
    const priceCents = Math.round(parseFloat(priceInput || '0') * 100)
    if (isNaN(priceCents) || priceCents < 0) {
      setError('价格无效')
      return
    }
    setLoading(true)
    setError(null)
    const url = product?.id ? `/api/products/${product.id}` : '/api/products'
    const method = product?.id ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        sku: sku.trim() || undefined,
        price: priceCents,
        stockQty,
        lowStockThreshold,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '保存失败')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product?.id ? '编辑商品' : '新建商品'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>商品名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="洗发水 500ml" />
          </div>
          <div className="space-y-1">
            <Label>SKU（可选）</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-001" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>价格 ($)</Label>
              <Input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label>库存数量</Label>
              <Input
                type="number"
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>低库存阈值</Label>
            <Input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              min={0}
            />
            <p className="text-xs text-slate-400">库存数量低于此值时，列表会用红色提示。</p>
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
