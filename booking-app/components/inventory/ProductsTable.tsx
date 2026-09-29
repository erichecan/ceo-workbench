'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Archive } from 'lucide-react'
import ProductModal from './ProductModal'

interface Product {
  id: string
  name: string
  sku?: string | null
  price: number
  stockQty: number
  lowStockThreshold: number
  isArchived: boolean
}

export default function ProductsTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | undefined>()
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/products')
    if (!res.ok) {
      setError('刷新商品列表失败')
      return
    }
    setProducts(await res.json())
  }

  async function handleArchive(id: string) {
    if (!confirm('确认归档此商品？归档后不会出现在结账页的商品列表中。')) return
    setError(null)
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('归档商品失败')
      return
    }
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary">库存管理</h1>
        <Button
          onClick={() => {
            setEditing(undefined)
            setModalOpen(true)
          }}
        >
          <Plus size={16} className="mr-2" /> 新建商品
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">名称</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">价格</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">库存</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  暂无商品，点击右上角新建
                </td>
              </tr>
            )}
            {products.map((p) => {
              const isLow = p.stockQty <= p.lowStockThreshold
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3">${(p.price / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {isLow ? (
                      <Badge variant="destructive">{p.stockQty} 库存不足</Badge>
                    ) : (
                      <span className="text-slate-600">{p.stockQty}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p)
                        setModalOpen(true)
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleArchive(p.id)}>
                      <Archive size={14} />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ProductModal
        open={modalOpen}
        product={editing}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </div>
  )
}
