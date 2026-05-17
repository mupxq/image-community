export interface AuthUser {
  id: string
  username: string
  nickname: string
  avatar: string
  bio: string
  created_at: string
}

export interface User {
  id: string
  nickname: string
  avatar: string
  bio: string
  created_at: string
}

export interface Work {
  id: string
  title: string
  subtitle?: string
  description: string
  cover_image: string
  type: 'comic' | 'drama' | 'novel'
  creator_id: string
  parent_work_id: string | null
  root_work_id: string | null
  status: 'draft' | 'published'
  created_at: string
  creator_name?: string
  creator_avatar?: string
  fork_count?: number
  comment_count?: number
}

export interface WorkDetail extends Work {
  contributors: Contributor[]
  parentWork: { id: string; title: string; creator_name: string } | null
  allow_fork?: number
  fork_from_page?: number | null
  like_count?: number
  liked?: boolean
}

export interface BranchWork {
  id: string
  title: string
  description: string
  cover_image: string
  type: string
  created_at: string
  fork_from_page: number
  creator_name: string
  creator_avatar: string
  page_count: number
}

export interface PageLikeInfo {
  page_id: string
  page_number: number
  like_count: number
  liked: boolean
}

export interface WorkPage {
  id: string
  work_id: string
  page_number: number
  image_url: string
  description: string
  dialogue: string
  ai_generated: number
  created_at: string
}

export interface Contributor {
  id: string
  nickname: string
  avatar: string
  role: 'creator' | 'ancestor'
  joined_at: string
}

export interface Comment {
  id: string
  work_id: string
  user_id: string
  content: string
  created_at: string
  nickname: string
  avatar: string
  parent_id: string | null
  reply_to_name: string | null
}

export interface Bookmark {
  id: string
  user_id: string
  work_id: string
  read_status: 'want_read' | 'reading' | 'finished'
  last_read_page: number
  created_at: string
  updated_at: string
  title?: string
  description?: string
  type?: 'comic' | 'drama' | 'novel'
  creator_name?: string
  creator_avatar?: string
  total_pages?: number
}

export interface Conversation {
  id: string
  type: 'private' | 'group'
  title: string
  work_id: string | null
  created_at: string
  displayName?: string
  displayAvatar?: string
  members?: User[]
  last_message?: string
  last_sender?: string
  last_message_time?: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  msg_type: 'text' | 'image' | 'work_share' | 'system'
  created_at: string
  sender_name: string
  sender_avatar: string
}

export interface TreeNode {
  id: string
  title: string
  cover_image: string
  type: 'comic' | 'drama' | 'novel'
  parent_work_id: string | null
  root_work_id: string | null
  creator_id: string
  created_at: string
  creator_name: string
  creator_avatar: string
  fork_count: number
  children: TreeNode[]
}

export interface ChapterTreeWork {
  id: string
  title: string
  subtitle: string
  type: string
  parent_work_id: string | null
  root_work_id: string | null
  fork_from_page: number | null
  creator_id: string
  creator_name: string
}

export interface ChapterTreePage {
  id: string
  work_id: string
  page_number: number
  description: string
  dialogue: string
}

export interface ChapterTreeData {
  works: ChapterTreeWork[]
  pages: ChapterTreePage[]
  root_work_id: string
}

export interface PageInput {
  description: string
  dialogue: string
  image_url?: string
  imagePrompt?: string
  ai_generated?: boolean
}

// ===== AI Provider Types =====

export interface TextProviderInfo {
  id: string
  name: string
  icon: string
  type: 'text'
  models: { id: string; name: string }[]
  enabled: boolean
}

export interface ImageProviderInfo {
  id: string
  name: string
  icon: string
  type: 'image'
  models: { id: string; name: string }[]
  enabled: boolean
}

export interface AIGenerateRequest {
  synopsis: string
  style: string
  type: 'comic' | 'drama' | 'novel'
  pageCount: number
  textProvider: string
  imageProvider: string
}

export interface AIGeneratePage {
  pageNumber: number
  description: string
  dialogue: string
  image_url?: string
  ai_generated: boolean
}

export interface Subscription {
  id: string
  user_id: string
  work_id: string
  last_viewed_fork_count: number
  created_at: string
  title: string
  description: string
  type: 'comic' | 'drama' | 'novel'
  cover_image: string
  creator_name: string
  creator_avatar: string
  total_pages: number
  current_fork_count: number
  has_update: boolean
  new_fork_count: number
}

export interface AIGenerateResult {
  title: string
  description: string
  pages: AIGeneratePage[]
}
