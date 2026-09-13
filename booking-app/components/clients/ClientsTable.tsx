'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Search } from 'lucide-react'
import ClientModal from './ClientModal'

interface Client {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export default function ClientsTable({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | undefined>()
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function refresh(q?: string) {
    setError(null)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const url = q ? `/admin/api/clients?search=${encodeURIComponent(q)}` : '/admin/api/clients'
    try {
      const res = await fetch(url, { signal: abortRef.current.signal })
      if (!res.ok) {
        setError('Failed to refresh clients')
        return
      }
      setClients(await res.json())
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Failed to refresh clients')
    }
  }

  async function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    await refresh(e.target.value)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <Button onClick={() => { setEditing(undefined); setModalOpen(true) }}>
          <Plus size={16} className="mr-2" /> Add Client
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search by name, email, phone…" value={search} onChange={handleSearch} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {search ? 'No clients match your search.' : 'No clients yet. Add your first client above.'}
                </td>
              </tr>
            ) : clients.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setModalOpen(true) }}>
                    <Pencil size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClientModal
        open={modalOpen}
        client={editing}
        onClose={() => setModalOpen(false)}
        onSaved={async () => await refresh(search)}
      />
    </div>
  )
}
