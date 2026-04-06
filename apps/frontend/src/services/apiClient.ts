import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'

const API_BASE = import.meta.env.VITE_API_URL || ''

let refreshPromise: Promise<string> | null = null

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = authService
    .refresh()
    .then(({ user, token }) => {
      useAuthStore.getState().setAuth(user, token)
      return token
    })
    .catch((err) => {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      throw err
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401 && token) {
    const newToken = await refreshToken()
    const retry = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      },
    })

    if (!retry.ok) {
      const data = await retry.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || `${retry.status} ${retry.statusText}`)
    }

    if (retry.status === 204) return null as T
    return retry.json()
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `${res.status} ${res.statusText}`)
  }

  if (res.status === 204) return null as T
  return res.json()
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
