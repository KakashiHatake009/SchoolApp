import { USE_MOCK } from '@/config'
import { authUsers } from '@/data/mockData'
import type { AuthUser } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL || ''

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

const mock = {
  async login(email: string, _password: string): Promise<{ user: AuthUser; token: string }> {
    await delay()
    const user = authUsers.find((u) => u.email === email)
    if (!user) throw new Error('Invalid credentials')
    return { user, token: 'mock-token' }
  },
  async refresh(): Promise<{ user: AuthUser; token: string }> {
    throw new Error('Not supported in mock mode')
  },
  async logout(): Promise<void> {},
  async forgotPassword(_email: string): Promise<void> { await delay() },
  async resetPassword(_email: string, _code: string, _newPassword: string): Promise<void> { await delay() },
}

const api = {
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role as AuthUser['role'],
      },
      token: data.token,
    }
  },

  async refresh(): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Refresh failed')
    const data = await res.json()
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role as AuthUser['role'],
      },
      token: data.token,
    }
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  },

  async forgotPassword(email: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || 'Request failed')
    }
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || 'Reset failed')
    }
  },
}

export const authService = USE_MOCK ? mock : api
