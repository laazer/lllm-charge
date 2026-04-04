import { EventEmitter } from 'events'
import { z } from 'zod'

export const TicketSchema = z.object({
  id: z.string(),
  key: z.string(), // Human-readable key like PROJ-123
  title: z.string(),
  description: z.string(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'testing', 'done', 'blocked']),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']),
  assignee: z.string().optional(),
  reporter: z.string(),
  parent: z.string().optional(), // For subtasks and stories under epics
  children: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  fixVersions: z.array(z.string()).default([]),
  storyPoints: z.number().optional(),
  originalEstimate: z.number().optional(), // in hours
  timeSpent: z.number().default(0), // in hours
  timeRemaining: z.number().optional(), // in hours
  dueDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolutionDate: z.date().optional(),
  linkedIssues: z.array(z.object({
    ticketId: z.string(),
    linkType: z.enum(['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by'])
  })).default([]),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    path: z.string(),
    size: z.number(),
    uploadedAt: z.date(),
    uploadedBy: z.string()
  })).default([]),
  comments: z.array(z.object({
    id: z.string(),
    content: z.string(),
    author: z.string(),
    createdAt: z.date(),
    updatedAt: z.date().optional()
  })).default([]),
  customFields: z.record(z.any()).default({})
})

export type Ticket = z.infer<typeof TicketSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  key: z.string(), // Project key like PROJ
  name: z.string(),
  description: z.string(),
  type: z.enum(['software', 'business', 'service_desk']),
  lead: z.string(),
  components: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    lead: z.string().optional()
  })).default([]),
  versions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    releaseDate: z.date().optional(),
    released: z.boolean().default(false)
  })).default([]),
  workflows: z.record(z.array(z.string())).default({}), // status -> allowed transitions
  createdAt: z.date(),
  updatedAt: z.date()
})

export type Project = z.infer<typeof ProjectSchema>

export const SprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string(),
  projectId: z.string(),
  state: z.enum(['future', 'active', 'closed']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  tickets: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type Sprint = z.infer<typeof SprintSchema>

export class ProjectForge extends EventEmitter {
  private projects = new Map<string, Project>()
  private tickets = new Map<string, Ticket>()
  private sprints = new Map<string, Sprint>()
  private ticketCounter = new Map<string, number>() // projectKey -> counter

  // Default workflow for software projects
  private defaultWorkflow: Record<string, string[]> = {
    'backlog': ['todo'],
    'todo': ['in_progress', 'backlog'],
    'in_progress': ['review', 'blocked', 'todo'],
    'review': ['testing', 'in_progress'],
    'testing': ['done', 'in_progress'],
    'blocked': ['todo', 'in_progress'],
    'done': []
  }

  async createProject(
    key: string,
    name: string,
    description: string,
    lead: string,
    type: Project['type'] = 'software'
  ): Promise<string> {
    const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const project: Project = {
      id,
      key: key.toUpperCase(),
      name,
      description,
      type,
      lead,
      components: [],
      versions: [],
      workflows: type === 'software' ? this.defaultWorkflow : {},
      createdAt: now,
      updatedAt: now
    }

    this.projects.set(id, project)
    this.ticketCounter.set(project.key, 0)
    
    this.emit('project:created', project)
    return id
  }

  async createTicket(
    projectId: string,
    title: string,
    description: string,
    type: Ticket['type'],
    reporter: string,
    options: {
      assignee?: string
      priority?: Ticket['priority']
      parent?: string
      labels?: string[]
      components?: string[]
      storyPoints?: number
      originalEstimate?: number
      dueDate?: Date
      customFields?: Record<string, any>
    } = {}
  ): Promise<string> {
    const project = this.projects.get(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    const id = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const counter = this.ticketCounter.get(project.key) || 0
    const newCounter = counter + 1
    this.ticketCounter.set(project.key, newCounter)

    const key = `${project.key}-${newCounter}`
    const now = new Date()

    const ticket: Ticket = {
      id,
      key,
      title,
      description,
      type,
      status: 'backlog',
      priority: options.priority || 'medium',
      assignee: options.assignee,
      reporter,
      parent: options.parent,
      children: [],
      labels: options.labels || [],
      components: options.components || [],
      fixVersions: [],
      storyPoints: options.storyPoints,
      originalEstimate: options.originalEstimate,
      timeSpent: 0,
      timeRemaining: options.originalEstimate,
      dueDate: options.dueDate,
      createdAt: now,
      updatedAt: now,
      linkedIssues: [],
      attachments: [],
      comments: [],
      customFields: options.customFields || {}
    }

    this.tickets.set(id, ticket)

    // Add to parent if specified
    if (options.parent) {
      const parentTicket = this.tickets.get(options.parent)
      if (parentTicket) {
        parentTicket.children.push(id)
        parentTicket.updatedAt = now
      }
    }

    this.emit('ticket:created', ticket)
    return id
  }

  async updateTicket(id: string, updates: Partial<Omit<Ticket, 'id' | 'key' | 'createdAt'>>): Promise<void> {
    const ticket = this.tickets.get(id)
    if (!ticket) {
      throw new Error(`Ticket ${id} not found`)
    }

    const oldStatus = ticket.status
    const updatedTicket: Ticket = {
      ...ticket,
      ...updates,
      updatedAt: new Date()
    }

    // Validate status transition if status is being changed
    if (updates.status && updates.status !== oldStatus) {
      const project = Array.from(this.projects.values()).find(p => 
        ticket.key.startsWith(p.key)
      )
      
      if (project && project.workflows[oldStatus] && !project.workflows[oldStatus].includes(updates.status)) {
        throw new Error(`Invalid status transition from ${oldStatus} to ${updates.status}`)
      }

      // Set resolution date when moving to done
      if (updates.status === 'done' && !updatedTicket.resolutionDate) {
        updatedTicket.resolutionDate = new Date()
      }
    }

    this.tickets.set(id, updatedTicket)
    this.emit('ticket:updated', { old: ticket, new: updatedTicket })
  }

  async transitionTicket(id: string, newStatus: Ticket['status'], comment?: string): Promise<void> {
    await this.updateTicket(id, { status: newStatus })
    
    if (comment) {
      await this.addComment(id, comment, 'system')
    }

    this.emit('ticket:transitioned', { ticketId: id, newStatus, comment })
  }

  async addComment(ticketId: string, content: string, author: string): Promise<string> {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`)
    }

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const comment = {
      id: commentId,
      content,
      author,
      createdAt: new Date()
    }

    ticket.comments.push(comment)
    ticket.updatedAt = new Date()

    this.emit('comment:added', { ticketId, comment })
    return commentId
  }

  async logWork(ticketId: string, timeSpent: number, description: string, author: string): Promise<void> {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`)
    }

    ticket.timeSpent += timeSpent
    if (ticket.timeRemaining && ticket.timeRemaining > 0) {
      ticket.timeRemaining = Math.max(0, ticket.timeRemaining - timeSpent)
    }
    ticket.updatedAt = new Date()

    await this.addComment(ticketId, `Logged ${timeSpent}h of work: ${description}`, author)
    
    this.emit('work:logged', { ticketId, timeSpent, description, author })
  }

  async linkTickets(sourceId: string, targetId: string, linkType: Ticket['linkedIssues'][0]['linkType']): Promise<void> {
    const sourceTicket = this.tickets.get(sourceId)
    const targetTicket = this.tickets.get(targetId)
    
    if (!sourceTicket || !targetTicket) {
      throw new Error('One or both tickets not found')
    }

    // Add link to source
    sourceTicket.linkedIssues.push({ ticketId: targetId, linkType })
    sourceTicket.updatedAt = new Date()

    // Add reciprocal link to target
    const reciprocalLinkType = this.getReciprocalLinkType(linkType)
    if (reciprocalLinkType) {
      targetTicket.linkedIssues.push({ ticketId: sourceId, linkType: reciprocalLinkType })
      targetTicket.updatedAt = new Date()
    }

    this.emit('tickets:linked', { sourceId, targetId, linkType })
  }

  async createSprint(projectId: string, name: string, goal: string, startDate?: Date, endDate?: Date): Promise<string> {
    const project = this.projects.get(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    const id = `sprint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const sprint: Sprint = {
      id,
      name,
      goal,
      projectId,
      state: 'future',
      startDate,
      endDate,
      tickets: [],
      createdAt: now,
      updatedAt: now
    }

    this.sprints.set(id, sprint)
    this.emit('sprint:created', sprint)
    return id
  }

  async startSprint(sprintId: string): Promise<void> {
    const sprint = this.sprints.get(sprintId)
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`)
    }

    sprint.state = 'active'
    sprint.startDate = sprint.startDate || new Date()
    sprint.updatedAt = new Date()

    // Move tickets from backlog to todo
    for (const ticketId of sprint.tickets) {
      const ticket = this.tickets.get(ticketId)
      if (ticket && ticket.status === 'backlog') {
        await this.updateTicket(ticketId, { status: 'todo' })
      }
    }

    this.emit('sprint:started', sprint)
  }

  async completeSprint(sprintId: string): Promise<void> {
    const sprint = this.sprints.get(sprintId)
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`)
    }

    sprint.state = 'closed'
    sprint.endDate = sprint.endDate || new Date()
    sprint.updatedAt = new Date()

    this.emit('sprint:completed', sprint)
  }

  async addTicketToSprint(ticketId: string, sprintId: string): Promise<void> {
    const ticket = this.tickets.get(ticketId)
    const sprint = this.sprints.get(sprintId)
    
    if (!ticket || !sprint) {
      throw new Error('Ticket or sprint not found')
    }

    if (!sprint.tickets.includes(ticketId)) {
      sprint.tickets.push(ticketId)
      sprint.updatedAt = new Date()
    }

    this.emit('ticket:added-to-sprint', { ticketId, sprintId })
  }

  // Query methods
  getProject(id: string): Project | undefined {
    return this.projects.get(id)
  }

  getProjectByKey(key: string): Project | undefined {
    return Array.from(this.projects.values()).find(p => p.key === key.toUpperCase())
  }

  getTicket(id: string): Ticket | undefined {
    return this.tickets.get(id)
  }

  getTicketByKey(key: string): Ticket | undefined {
    return Array.from(this.tickets.values()).find(t => t.key === key.toUpperCase())
  }

  getProjectTickets(projectId: string): Ticket[] {
    const project = this.projects.get(projectId)
    if (!project) return []
    
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.key.startsWith(project.key))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  getTicketsByStatus(projectId: string, status: Ticket['status']): Ticket[] {
    return this.getProjectTickets(projectId).filter(ticket => ticket.status === status)
  }

  getTicketsByAssignee(assignee: string): Ticket[] {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.assignee === assignee)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  getSprint(id: string): Sprint | undefined {
    return this.sprints.get(id)
  }

  getProjectSprints(projectId: string): Sprint[] {
    return Array.from(this.sprints.values())
      .filter(sprint => sprint.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  getActiveSprintForProject(projectId: string): Sprint | undefined {
    return Array.from(this.sprints.values())
      .find(sprint => sprint.projectId === projectId && sprint.state === 'active')
  }

  searchTickets(query: {
    text?: string
    projectId?: string
    assignee?: string
    status?: Ticket['status']
    type?: Ticket['type']
    priority?: Ticket['priority']
    labels?: string[]
    createdAfter?: Date
    createdBefore?: Date
  }): Ticket[] {
    let results = Array.from(this.tickets.values())

    if (query.text) {
      const searchText = query.text.toLowerCase()
      results = results.filter(ticket => 
        ticket.title.toLowerCase().includes(searchText) ||
        ticket.description.toLowerCase().includes(searchText) ||
        ticket.key.toLowerCase().includes(searchText)
      )
    }

    if (query.projectId) {
      const project = this.projects.get(query.projectId)
      if (project) {
        results = results.filter(ticket => ticket.key.startsWith(project.key))
      }
    }

    if (query.assignee) {
      results = results.filter(ticket => ticket.assignee === query.assignee)
    }

    if (query.status) {
      results = results.filter(ticket => ticket.status === query.status)
    }

    if (query.type) {
      results = results.filter(ticket => ticket.type === query.type)
    }

    if (query.priority) {
      results = results.filter(ticket => ticket.priority === query.priority)
    }

    if (query.labels && query.labels.length > 0) {
      results = results.filter(ticket => 
        query.labels!.some(label => ticket.labels.includes(label))
      )
    }

    if (query.createdAfter) {
      results = results.filter(ticket => ticket.createdAt >= query.createdAfter!)
    }

    if (query.createdBefore) {
      results = results.filter(ticket => ticket.createdAt <= query.createdBefore!)
    }

    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  // Analytics and reporting
  getProjectStats(projectId: string): {
    totalTickets: number
    ticketsByStatus: Record<string, number>
    ticketsByType: Record<string, number>
    ticketsByPriority: Record<string, number>
    averageResolutionTime: number
    totalStoryPoints: number
    completedStoryPoints: number
  } {
    const tickets = this.getProjectTickets(projectId)
    const completedTickets = tickets.filter(t => t.status === 'done' && t.resolutionDate)
    
    const averageResolutionTime = completedTickets.length > 0
      ? completedTickets.reduce((sum, ticket) => {
          const resolution = ticket.resolutionDate!.getTime() - ticket.createdAt.getTime()
          return sum + resolution
        }, 0) / completedTickets.length / (1000 * 60 * 60 * 24) // days
      : 0

    return {
      totalTickets: tickets.length,
      ticketsByStatus: this.groupBy(tickets, 'status'),
      ticketsByType: this.groupBy(tickets, 'type'),
      ticketsByPriority: this.groupBy(tickets, 'priority'),
      averageResolutionTime,
      totalStoryPoints: tickets.reduce((sum, t) => sum + (t.storyPoints || 0), 0),
      completedStoryPoints: tickets
        .filter(t => t.status === 'done')
        .reduce((sum, t) => sum + (t.storyPoints || 0), 0)
    }
  }

  private getReciprocalLinkType(linkType: Ticket['linkedIssues'][0]['linkType']): Ticket['linkedIssues'][0]['linkType'] | null {
    const reciprocals: Record<string, string> = {
      'blocks': 'is_blocked_by',
      'is_blocked_by': 'blocks',
      'duplicates': 'is_duplicated_by',
      'is_duplicated_by': 'duplicates'
    }
    return reciprocals[linkType] as Ticket['linkedIssues'][0]['linkType'] || null
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = String(item[key])
      groups[value] = (groups[value] || 0) + 1
      return groups
    }, {} as Record<string, number>)
  }
}