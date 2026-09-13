'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEMO_ACCOUNTS = [
  {
    role: 'owner',
    label: '店主一键登录',
    email: 'owner@demo.com',
    password: 'password123',
    color: 'bg-purple-600 hover:bg-purple-700',
  },
] as const

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickLoginRole, setQuickLoginRole] = useState<string | null>(null)

  async function doLogin(emailVal: string, passwordVal: string) {
    setError('')
    const res = await fetch('/admin/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailVal, password: passwordVal }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Login failed')
    }
    // Hard navigation — sidesteps Next.js RSC prefetch which has issues behind
    // the nginx proxy on Cloud Run (see nginx.conf for the port-stripping config)
    window.location.assign('/admin/calendar')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await doLogin(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickLogin(account: typeof DEMO_ACCOUNTS[number]) {
    setQuickLoginRole(account.role)
    setEmail(account.email)
    setPassword(account.password)
    try {
      await doLogin(account.email, account.password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setQuickLoginRole(null)
    }
  }

  const anyLoading = loading || quickLoginRole !== null

  return (
    <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Beauty & Wellness</h1>
        <p className="text-sm text-slate-500">Sign in to your account</p>
      </div>

      {/* Quick login buttons */}
      <div className="space-y-2">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.role}
            type="button"
            onClick={() => handleQuickLogin(acc)}
            disabled={anyLoading}
            className={`w-full text-white font-medium py-2.5 px-4 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${acc.color}`}
          >
            {quickLoginRole === acc.role ? '登录中…' : acc.label}
          </button>
        ))}
        <p className="text-xs text-center text-slate-400 pt-1">
          Demo 账号：{DEMO_ACCOUNTS[0].email} / {DEMO_ACCOUNTS[0].password}
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-400">或手动登录</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="owner@demo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={anyLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={anyLoading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={anyLoading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
