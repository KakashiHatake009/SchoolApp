import { USE_MOCK } from '@/config'
import { authUsers } from '@/data/mockData'
import type { AuthUser } from '@/types'

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

const mock = {
  async login(email: string, _password: string): Promise<{ user: AuthUser; token: string }> {
    await delay()
    const user = authUsers.find((u) => u.email === email)
    if (!user) throw new Error('Invalid credentials')
    return { user, token: 'mock-token' }
  },
}

const api = {
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
}

export const authService = USE_MOCK ? mock : api
