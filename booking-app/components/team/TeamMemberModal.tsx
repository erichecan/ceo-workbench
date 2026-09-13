'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TeamMember {
  id?: string
  name: string
  email: string
  role: string
  calendarColor: string
  isBookable: boolean
}

interface Props {
  open: boolean
  member?: TeamMember
  onClose: () => void
  onSaved: () => void
}

export default function TeamMemberModal({ open, member, onClose, onSaved }: Props) {
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [role, setRole] = useState(member?.role ?? 'LOW')
  const [color, setColor] = useState(member?.calendarColor ?? '#8B5CF6')
  const [isBookable, setIsBookable] = useState(member?.isBookable ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(member?.name ?? '')
    setEmail(member?.email ?? '')
    setRole(member?.role ?? 'LOW')
    setColor(member?.calendarColor ?? '#8B5CF6')
    setIsBookable(member?.isBookable ?? true)
  }, [member, open])

  async function handleSave() {
    setLoading(true)
    setError(null)
    const url = member?.id ? `/admin/api/team/${member.id}` : '/admin/api/team'
    const method = member?.id ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role, calendarColor: color, isBookable }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? 'Failed to save')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member?.id ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Alice" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="alice@salon.com" type="email" />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => { if (value !== null) setRole(value) }}
              items={{ OWNER: 'Owner', MANAGER: 'Manager', LOW: 'Staff' }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="LOW">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Calendar Color</Label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-full rounded border border-slate-200 cursor-pointer" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="bookable" checked={isBookable} onChange={e => setIsBookable(e.target.checked)} />
            <Label htmlFor="bookable">Bookable</Label>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving\u2026' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
