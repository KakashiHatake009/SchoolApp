import { USE_MOCK } from '@/config'
import { apiClient } from './apiClient'
import { teachers as mockTeachers } from '@/data/mockData'
import type { Teacher } from '@/types'

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))
let _teachers = [...mockTeachers]

const mock = {
  getByEvent: async (eventId: string): Promise<Teacher[]> => { await delay(); return _teachers.filter((t) => t.eventId === eventId) },
  getBySchool: async (schoolId: string): Promise<Teacher[]> => { await delay(); return _teachers.filter((t) => t.schoolId === schoolId) },
  getById: async (id: string): Promise<Teacher | undefined> => { await delay(); return _teachers.find((t) => t.id === id) },
  create: async (data: Omit<Teacher, 'id'>): Promise<Teacher> => {
    await delay()
    const teacher: Teacher = { ...data, id: `teacher-${Date.now()}` }
    _teachers.push(teacher)
    return teacher
  },
  update: async (id: string, data: Partial<Teacher>): Promise<Teacher> => {
    await delay()
    _teachers = _teachers.map((t) => (t.id === id ? { ...t, ...data } : t))
    return _teachers.find((t) => t.id === id)!
  },
  delete: async (id: string): Promise<void> => { await delay(); _teachers = _teachers.filter((t) => t.id !== id) },
  notify: async (id: string): Promise<{ ok: boolean; code: string }> => { await delay(); return { ok: true, code: '123456' } },
}

const api = {
  getByEvent: (eventId: string) => apiClient.get<Teacher[]>(`/teachers?eventId=${eventId}`),
  getBySchool: (schoolId: string) => apiClient.get<Teacher[]>(`/teachers?schoolId=${schoolId}`),
  getById: (id: string) => apiClient.get<Teacher>(`/teachers/${id}`),
  create: (data: Omit<Teacher, 'id'>) => apiClient.post<Teacher>('/teachers', data),
  update: (id: string, data: Partial<Teacher>) => apiClient.patch<Teacher>(`/teachers/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/teachers/${id}`),
  notify: (id: string) => apiClient.post<{ ok: boolean; code: string }>(`/teachers/${id}/notify`, {}),
}

export const teacherService = USE_MOCK ? mock : api
