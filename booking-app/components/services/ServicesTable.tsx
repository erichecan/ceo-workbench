'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Archive } from 'lucide-react'
import ServiceModal from './ServiceModal'

interface Category {
  id: string
  name: string
}

interface Service {
  id: string
  name: string
  categoryId?: string | null
  description?: string | null
  priceType: string
  price: number
  duration: number
  isOnlineBookable: boolean
  category?: Category | null
}

export default function ServicesTable({
  initialServices,
  categories,
}: {
  initialServices: Service[]
  categories: Category[]
}) {
  const [services, setServices] = useState(initialServices)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Service | undefined>()
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/admin/api/services')
    if (!res.ok) {
      setError('Failed to refresh services')
      return
    }
    setServices(await res.json())
  }

  async function handleArchive(id: string) {
    setError(null)
    const res = await fetch(`/admin/api/services/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Failed to archive service')
      return
    }
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
        <Button
          onClick={() => {
            setEditing(undefined)
            setModalOpen(true)
          }}
        >
          <Plus size={16} className="mr-2" /> Add Service
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Price</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Duration</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.category?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {s.priceType === 'FREE' ? (
                    <Badge>Free</Badge>
                  ) : (
                    `$${(s.price / 100).toFixed(2)}`
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{s.duration} min</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(s)
                      setModalOpen(true)
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleArchive(s.id)}>
                    <Archive size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ServiceModal
        open={modalOpen}
        service={editing}
        categories={categories}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </div>
  )
}
