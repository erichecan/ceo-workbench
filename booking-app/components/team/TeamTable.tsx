'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Archive } from 'lucide-react'
import TeamMemberModal from './TeamMemberModal'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  calendarColor: string
  isBookable: boolean
}

export default function TeamTable({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [members, setMembers] = useState(initialMembers)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | undefined>()
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/team')
    setMembers(await res.json())
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Failed to archive member')
      return
    }
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary">Team</h1>
        <Button onClick={() => { setEditing(undefined); setModalOpen(true) }}>
          <Plus size={16} className="mr-2" /> Add Member
        </Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Bookable</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: m.calendarColor }} />
                  <span className="font-medium text-slate-900">{m.name}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{m.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{m.role}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{m.isBookable ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setModalOpen(true) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleArchive(m.id)}>
                    <Archive size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <TeamMemberModal
        open={modalOpen}
        member={editing}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </div>
  )
}
