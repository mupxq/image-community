const API = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error)
  }
  return res.json()
}

export const usersApi = {
  getAll: () => request<import('../types').User[]>('/users'),
  getById: (id: number) => request<import('../types').User>(`/users/${id}`),
  getWorks: (id: number) => request<import('../types').Work[]>(`/users/${id}/works`),
  getContributions: (id: number) => request<import('../types').Work[]>(`/users/${id}/contributions`),
}

export const worksApi = {
  list: (params?: { type?: string; sort?: string }) => {
    const qs = new URLSearchParams()
    if (params?.type && params.type !== 'all') qs.set('type', params.type)
    if (params?.sort) qs.set('sort', params.sort)
    const query = qs.toString()
    return request<import('../types').Work[]>(`/works${query ? '?' + query : ''}`)
  },
  getById: (id: number) => request<import('../types').WorkDetail>(`/works/${id}`),
  getPages: (id: number) => request<import('../types').WorkPage[]>(`/works/${id}/pages`),
  getTree: (id: number) => request<import('../types').TreeNode>(`/works/${id}/tree`),
  create: (data: { title: string; description: string; type: string; creator_id: number; pages?: import('../types').PageInput[] }) =>
    request<{ id: number; message: string }>('/works', { method: 'POST', body: JSON.stringify(data) }),
  fork: (parentId: number, data: { title: string; description: string; creator_id: number; pages?: import('../types').PageInput[] }) =>
    request<{ id: number; message: string }>(`/works/${parentId}/fork`, { method: 'POST', body: JSON.stringify(data) }),
}

export const commentsApi = {
  list: (workId: number) => request<import('../types').Comment[]>(`/works/${workId}/comments`),
  create: (workId: number, data: { user_id: number; content: string }) =>
    request<{ message: string }>(`/works/${workId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
}

export const bookmarksApi = {
  list: (userId: number, status?: string) => {
    const qs = status && status !== 'all' ? `?status=${status}` : ''
    return request<import('../types').Bookmark[]>(`/users/${userId}/bookmarks${qs}`)
  },
  create: (data: { user_id: number; work_id: number }) =>
    request<{ message: string }>('/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { read_status?: string; last_read_page?: number }) =>
    request<{ message: string }>(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<{ message: string }>(`/bookmarks/${id}`, { method: 'DELETE' }),
  check: (userId: number, workId: number) =>
    request<{ bookmarked: boolean; bookmark: import('../types').Bookmark | null }>(`/bookmarks/check?user_id=${userId}&work_id=${workId}`),
}

export const conversationsApi = {
  list: (userId: number) => request<import('../types').Conversation[]>(`/users/${userId}/conversations`),
  getMessages: (convId: number) =>
    request<{ conversation: import('../types').Conversation; members: import('../types').User[]; messages: import('../types').Message[] }>(`/conversations/${convId}/messages`),
  sendMessage: (convId: number, data: { sender_id: number; content: string; msg_type?: string }) =>
    request<{ message: string }>(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
}
