'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Ban } from 'lucide-react'
import GiftCardModal from './GiftCardModal'

interface Client {
  id: string
  name: string
}

interface GiftCard {
  id: string
  code: string
  initialValue: number
  balance: number
  isActive: boolean
  client?: { id: string; name: string } | null
}

export default function GiftCardsTable({
  initialGiftCards,
  clients,
}: {
  initialGiftCards: GiftCard[]
  clients: Client[]
}) {
  const [giftCards, setGiftCards] = useState(initialGiftCards)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/gift-cards')
    if (!res.ok) {
      setError('刷新礼品卡列表失败')
      return
    }
    setGiftCards(await res.json())
  }

  async function handleDeactivate(id: string) {
    if (!confirm('确认停用此礼品卡？停用后无法再用于结账抵扣。')) return
    setError(null)
    const res = await fetch(`/api/gift-cards/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('停用礼品卡失败')
      return
    }
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-slate-900">礼品卡</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-2" /> 新建礼品卡
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">卡号</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">面值</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">余额</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">关联客户</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">状态</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {giftCards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  暂无礼品卡
                </td>
              </tr>
            )}
            {giftCards.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium text-slate-900">{g.code}</td>
                <td className="px-4 py-3 text-slate-600">${(g.initialValue / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-600">${(g.balance / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-600">{g.client?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {g.isActive ? <Badge>启用中</Badge> : <Badge variant="outline">已停用</Badge>}
                </td>
                <td className="px-4 py-3 text-right">
                  {g.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeactivate(g.id)}>
                      <Ban size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GiftCardModal open={modalOpen} clients={clients} onClose={() => setModalOpen(false)} onSaved={refresh} />
    </div>
  )
}
