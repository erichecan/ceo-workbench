'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Ban } from 'lucide-react'
import CouponModal from './CouponModal'

interface Coupon {
  id: string
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  expiresAt?: string | Date | null
  usageLimit?: number | null
  usedCount: number
  isActive: boolean
}

export default function CouponsTable({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | undefined>()
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/coupons')
    if (!res.ok) {
      setError('刷新优惠券列表失败')
      return
    }
    setCoupons(await res.json())
  }

  async function handleDeactivate(id: string) {
    if (!confirm('确认停用此优惠券？')) return
    setError(null)
    const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('停用优惠券失败')
      return
    }
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-slate-900">优惠券</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setModalOpen(true)
          }}
        >
          <Plus size={16} className="mr-2" /> 新建优惠券
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">优惠码</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">折扣</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">过期时间</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">使用次数</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">状态</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  暂无优惠券
                </td>
              </tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.code}</td>
                <td className="px-4 py-3 text-slate-600">
                  {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `$${(c.discountValue / 100).toFixed(2)}`}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '不限'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.usedCount}
                  {c.usageLimit != null ? ` / ${c.usageLimit}` : ''}
                </td>
                <td className="px-4 py-3">
                  {c.isActive ? <Badge>启用中</Badge> : <Badge variant="outline">已停用</Badge>}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(c)
                      setModalOpen(true)
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  {c.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeactivate(c.id)}>
                      <Ban size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CouponModal open={modalOpen} coupon={editing} onClose={() => setModalOpen(false)} onSaved={refresh} />
    </div>
  )
}
