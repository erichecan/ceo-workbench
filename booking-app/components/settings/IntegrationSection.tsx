'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FieldConfig {
  key: string
  label: string
  placeholder: string
}

interface IntegrationSectionProps {
  title: string
  description: string
  configured: boolean
  fields: FieldConfig[]
  onSave: (values: Record<string, string>) => Promise<void>
}

export function IntegrationSection({
  title,
  description,
  configured,
  fields,
  onSave,
}: IntegrationSectionProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await onSave(values)
      setValues({})
      setSaved(true)
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-slate-900">{title}</h2>
        <Badge variant={configured ? 'default' : 'secondary'}>
          {configured ? '已配置' : '未配置'}
        </Badge>
      </div>
      <p className="text-sm text-slate-500 mb-4">{description}</p>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={field.key} className="text-xs text-slate-600">
              {field.label}
            </Label>
            <Input
              id={field.key}
              type="password"
              autoComplete="off"
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
        {saved && <span className="text-xs text-emerald-600">已保存</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  )
}
