'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Client {
  id?: string
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}

interface Props {
  open: boolean
  client?: Client
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function ClientModal({ open, client, onClose, onSaved }: Props) {
  const [name, setName] = useState(client?.name ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(client?.name ?? '')
    setEmail(client?.email ?? '')
    setPhone(client?.phone ?? '')
    setNotes(client?.notes ?? '')
    setError(null)
    setLoading(false)
  }, [client, open])

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      const url = client?.id ? `/admin/api/clients/${client.id}` : '/admin/api/clients'
      const method = client?.id ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? data.message ?? 'Failed to save')
        return
      }
      await onSaved()
      onClose()
    } catch {
      setError('Unexpected error, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client?.id ? 'Edit Client' : 'Add Client'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Isabella Rodriguez" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} placeholder="isabella@email.com" />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={phone ?? ''} onChange={e => setPhone(e.target.value)} placeholder="+1 416 555 0100" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes ?? ''} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Prefers square nails, allergic to gel remover…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name || loading}>{loading ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
