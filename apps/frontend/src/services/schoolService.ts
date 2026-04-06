import { USE_MOCK } from '@/config'
import { apiClient } from './apiClient'
import { schools as mockSchools } from '@/data/mockData'
import type { School } from '@/types'

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))
let _schools = [...mockSchools]

const mock = {
  getAll: async (): Promise<School[]> => { await delay(); return [..._schools] },
  getById: async (id: string): Promise<School | undefined> => { await delay(); return _schools.find((s) => s.id === id) },
  create: async (data: Omit<School, 'id' | 'createdAt'>): Promise<School> => {
    await delay()
    const school: School = { ...data, id: `school-${Date.now()}`, createdAt: new Date().toISOString() }
    _schools.push(school)
    return school
  },
  update: async (id: string, data: Partial<School>): Promise<School> => {
    await delay()
    _schools = _schools.map((s) => (s.id === id ? { ...s, ...data } : s))
    return _schools.find((s) => s.id === id)!
  },
  delete: async (id: string): Promise<void> => { await delay(); _schools = _schools.filter((s) => s.id !== id) },
}

const api = {
  getAll: () => apiClient.get<School[]>('/schools'),
  getById: (id: string) => apiClient.get<School>(`/schools/${id}`),
  create: (data: Omit<School, 'id' | 'createdAt'>) => apiClient.post<School>('/schools', data),
  update: (id: string, data: Partial<School>) => apiClient.patch<School>(`/schools/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/schools/${id}`),
}

export const schoolService = USE_MOCK ? mock : api
