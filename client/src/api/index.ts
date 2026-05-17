const API = '/api'

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${API}${url}`, {
    ...options,
    headers,
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.hash = '#/login'
    throw new Error('登录已过期')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error)
  }
  return res.json()
}

export const authApi = {
  register: (data: { username: string; password: string; nickname: string }) =>
    request<{ token: string; user: import('../types').AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { username: string; password: string }) =>
    request<{ token: string; user: import('../types').AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () =>
    request<import('../types').AuthUser>('/auth/me'),
}

export const usersApi = {
  getById: (id: string) => request<import('../types').User>(`/users/${id}`),
  getWorks: (id: string) => request<import('../types').Work[]>(`/users/${id}/works`),
  getContributions: (id: string) => request<import('../types').Work[]>(`/users/${id}/contributions`),
  uploadAvatar: async (file: File): Promise<{ avatar: string }> => {
    const formData = new FormData()
    formData.append('avatar', file)
    const headers: Record<string, string> = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API}/users/avatar`, { method: 'POST', headers, body: formData })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '上传失败' }))
      throw new Error(err.error)
    }
    return res.json()
  },
}

export const worksApi = {
  list: (params?: { type?: string; sort?: string }) => {
    const qs = new URLSearchParams()
    if (params?.type && params.type !== 'all') qs.set('type', params.type)
    if (params?.sort) qs.set('sort', params.sort)
    const query = qs.toString()
    return request<import('../types').Work[]>(`/works${query ? '?' + query : ''}`)
  },
  getById: (id: string) => request<import('../types').WorkDetail>(`/works/${id}`),
  getPages: (id: string) => request<import('../types').WorkPage[]>(`/works/${id}/pages`),
  getTree: (id: string) => request<import('../types').ChapterTreeData>(`/works/${id}/tree`),
  create: (data: { title: string; description: string; type: string; pages?: import('../types').PageInput[]; cover_image?: string; allow_fork?: number }) =>
    request<{ id: string; message: string }>('/works', { method: 'POST', body: JSON.stringify(data) }),
  fork: (parentId: string, data: { subtitle: string; description?: string; pages?: import('../types').PageInput[]; cover_image?: string; fork_from_page?: number }) =>
    request<{ id: string; message: string }>(`/works/${parentId}/fork`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ message: string }>(`/works/${id}`, { method: 'DELETE' }),
  getBranches: (id: string, page: number) =>
    request<import('../types').BranchWork[]>(`/works/${id}/branches?page=${page}`),
  getPageLikes: (id: string) =>
    request<import('../types').PageLikeInfo[]>(`/works/${id}/page-likes`),
  likeWork: (id: string) =>
    request<{ liked: boolean }>(`/works/${id}/like`, { method: 'POST' }),
  likePage: (pageId: string) =>
    request<{ liked: boolean }>(`/pages/${pageId}/like`, { method: 'POST' }),
}

export const commentsApi = {
  list: (workId: string) => request<import('../types').Comment[]>(`/works/${workId}/comments`),
  create: (workId: string, data: { content: string; parent_id?: string }) =>
    request<{ message: string }>(`/works/${workId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ message: string }>(`/comments/${id}`, { method: 'DELETE' }),
}

export const bookmarksApi = {
  list: (status?: string) => {
    const qs = status && status !== 'all' ? `?status=${status}` : ''
    return request<import('../types').Bookmark[]>(`/bookmarks${qs}`)
  },
  create: (data: { work_id: string }) =>
    request<{ message: string }>('/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  update: (workId: string, data: { read_status?: string; last_read_page?: number }) =>
    request<{ message: string }>(`/bookmarks/${workId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (workId: string) =>
    request<{ message: string }>(`/bookmarks/${workId}`, { method: 'DELETE' }),
  check: (workId: string) =>
    request<{ bookmarked: boolean; bookmark: import('../types').Bookmark | null }>(`/bookmarks/check?work_id=${workId}`),
}

export const conversationsApi = {
  list: () => request<import('../types').Conversation[]>('/conversations'),
  create: (targetUserId: string) =>
    request<{ conversation_id: string; created: boolean }>('/conversations', { method: 'POST', body: JSON.stringify({ target_user_id: targetUserId }) }),
  getMessages: (convId: string) =>
    request<{ conversation: import('../types').Conversation; members: import('../types').User[]; messages: import('../types').Message[] }>(`/conversations/${convId}/messages`),
  sendMessage: (convId: string, data: { content: string; msg_type?: string }) =>
    request<{ message: string }>(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
}

export const aiApi = {
  getProviders: () =>
    request<{ textProviders: import('../types').TextProviderInfo[]; imageProviders: import('../types').ImageProviderInfo[] }>('/ai/providers'),
  generate: (data: import('../types').AIGenerateRequest) =>
    request<import('../types').AIGenerateResult>('/ai/generate', { method: 'POST', body: JSON.stringify(data) }),
  generateCustom: (data: { synopsis: string; style: string; type: string; pageCount: number; textConfig: { baseUrl: string; apiKey: string; model: string }; imageConfig: { baseUrl: string; apiKey: string; model: string } }) =>
    request<import('../types').AIGenerateResult>('/ai/generate-custom', { method: 'POST', body: JSON.stringify(data) }),
  generatePage: (data: { provider: string; style: string; type: string; imagePrompt: string; dialogue: string }) =>
    request<{ image_url: string; ai_generated: boolean }>('/ai/generate-page', { method: 'POST', body: JSON.stringify(data) }),
  generateCover: (data: { coverPrompt: string; provider?: string; style?: string; customConfig?: { baseUrl: string; apiKey: string; model: string } }) =>
    request<{ cover_image: string }>('/ai/generate-cover', { method: 'POST', body: JSON.stringify(data) }),
  getConfig: () =>
    request<{ text_base_url: string; text_api_key: string; text_model: string; image_base_url: string; image_api_key: string; image_model: string }>('/ai/config'),
  saveConfig: (data: { text_base_url: string; text_api_key: string; text_model: string; image_base_url: string; image_api_key: string; image_model: string }) =>
    request<{ message: string }>('/ai/config', { method: 'PUT', body: JSON.stringify(data) }),
}

export const creditsApi = {
  status: () =>
    request<{ credits: number; checkedInToday: boolean; streak: number }>('/credits/status'),
  checkIn: () =>
    request<{ creditsEarned: number; streak: number; totalCredits: number; message: string }>('/credits/check-in', { method: 'POST' }),
  logs: () =>
    request<{ id: string; amount: number; type: string; description: string; task_id: string | null; created_at: string }[]>('/credits/logs'),
}

export const tasksApi = {
  list: () =>
    request<{ id: string; status: string; type: string; credits_used: number; created_at: string; completed_at: string | null; error: string | null }[]>('/ai/tasks'),
  getById: (id: string) =>
    request<any>(`/ai/tasks/${id}`),
  publish: (id: string, data?: { title?: string; subtitle?: string; description?: string; cover_image?: string; allow_fork?: number }) =>
    request<{ id: string; message: string }>(`/ai/tasks/${id}/publish`, { method: 'POST', body: JSON.stringify(data || {}) }),
  cancel: (id: string) =>
    request<{ message: string }>(`/ai/tasks/${id}/cancel`, { method: 'POST' }),
  delete: (id: string) =>
    request<{ message: string }>(`/ai/tasks/${id}`, { method: 'DELETE' }),
  regenerate: (id: string) =>
    request<{ taskId: string; message: string }>(`/ai/tasks/${id}/regenerate`, { method: 'POST' }),
}

export const followsApi = {
  follow: (userId: string) =>
    request<{ message: string }>(`/users/${userId}/follow`, { method: 'POST' }),
  unfollow: (userId: string) =>
    request<{ message: string }>(`/users/${userId}/follow`, { method: 'DELETE' }),
  status: (userId: string) =>
    request<{ isFollowing: boolean; isFollowedBy: boolean; isMutual: boolean }>(`/users/${userId}/follow-status`),
  followers: (userId: string) =>
    request<import('../types').User[]>(`/users/${userId}/followers`),
  following: (userId: string) =>
    request<import('../types').User[]>(`/users/${userId}/following`),
  mutualFollowers: () =>
    request<{ id: string; nickname: string; avatar: string; username: string }[]>('/users/me/mutual-followers'),
}

export const subscriptionsApi = {
  list: (userId: string) =>
    request<import('../types').Subscription[]>(`/users/${userId}/subscriptions`),
  subscribe: (workId: string) =>
    request<{ message: string }>('/subscriptions', { method: 'POST', body: JSON.stringify({ work_id: workId }) }),
  unsubscribe: (workId: string) =>
    request<{ message: string }>(`/subscriptions/${workId}`, { method: 'DELETE' }),
  check: (workId: string) =>
    request<{ subscribed: boolean; last_viewed_fork_count: number }>(`/subscriptions/check?work_id=${workId}`),
  markViewed: (workId: string) =>
    request<{ message: string }>(`/subscriptions/${workId}/viewed`, { method: 'PUT' }),
}

export const uploadApi = {
  image: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append('image', file)
    const headers: Record<string, string> = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API}/upload/image`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.hash = '#/login'
      throw new Error('登录已过期')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '上传失败' }))
      throw new Error(err.error)
    }
    return res.json()
  },
}
