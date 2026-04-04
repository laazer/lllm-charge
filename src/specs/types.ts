export interface Spec {
  id: string
  title: string
  description: string
  category: SpecCategory
  status: SpecStatus
  priority: SpecPriority
  content: SpecContent
  codeLinks: CodeGraphLink[]
  metadata: SpecMetadata
  createdAt: Date
  updatedAt: Date
}

export type SpecCategory = 'feature' | 'api' | 'bug' | 'performance' | 'security' | 'documentation'
export type SpecStatus = 'draft' | 'review' | 'approved' | 'implemented' | 'tested' | 'deployed'
export type SpecPriority = 'low' | 'medium' | 'high' | 'critical'

export interface SpecContent {
  requirements: string[]
  acceptance: string[]
  technical?: string[]
  notes?: string
}

export interface SpecMetadata {
  tags: string[]
  version: number
  author: string
  assignee?: string
  estimatedHours?: number
  labels?: string[]
}

export interface CodeGraphLink {
  symbol: string
  file: string
  line: number
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'test'
  confidence: number
}