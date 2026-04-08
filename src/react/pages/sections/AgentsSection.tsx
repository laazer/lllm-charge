import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserGroupIcon, CpuChipIcon, ClockIcon, CheckCircleIcon, PencilIcon, XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline'
import { apiClient } from '../../lib/api-client'
import { useProject } from '../../store/project-store'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import { ReasoningButton } from '../../components/ui/ReasoningButton'
import type { Agent } from '../../types'

const AgentsSection: React.FC = () => {
  const { currentProjectId } = useProject()
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Agent>>({})

  const queryClient = useQueryClient()

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['agents', currentProjectId],
    queryFn: () => apiClient.getAgents(currentProjectId),
  })

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Agent> }) => 
      apiClient.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', currentProjectId] })
      setEditingAgent(null)
      setEditForm({})
    },
  })

  const deleteAgentMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', currentProjectId] })
      setSelectedAgent(null)
    },
  })

  // Edit handlers
  const startEditing = (agent: Agent) => {
    setEditingAgent(agent.id)
    setEditForm({
      name: agent.name,
      description: agent.description,
      primaryRole: agent.primaryRole,
      capabilities: { ...agent.capabilities }
    })
  }

  const cancelEditing = () => {
    setEditingAgent(null)
    setEditForm({})
  }

  const saveAgent = async (agentId: string) => {
    if (editForm.name && editForm.primaryRole && editForm.capabilities) {
      updateAgentMutation.mutate({
        id: agentId,
        data: editForm
      })
    }
  }

  const deleteAgent = (agentId: string, agentName: string) => {
    if (window.confirm(`Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) {
      deleteAgentMutation.mutate(agentId)
    }
  }

  const updateEditForm = (field: string, value: any) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateCapability = (capability: string, value: number) => {
    setEditForm(prev => {
      const c = prev.capabilities
      return {
        ...prev,
        capabilities: {
          reasoning: c?.reasoning ?? 0,
          creativity: c?.creativity ?? 0,
          technical: c?.technical ?? 0,
          communication: c?.communication ?? 0,
          [capability]: Math.min(1, Math.max(0, value)),
        },
      }
    })
  }

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.primaryRole.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || agent.primaryRole === roleFilter

    return matchesSearch && matchesRole
  })

  // Calculate statistics
  const stats = agents.reduce(
    (acc, agent) => {
      acc.total++
      acc.roles[agent.primaryRole] = (acc.roles[agent.primaryRole] || 0) + 1
      
      if (agent.stats) {
        acc.totalTasks += agent.stats.tasksCompleted || 0
        if (agent.stats.successRate) {
          acc.avgSuccessRate = (acc.avgSuccessRate + agent.stats.successRate) / 2
        }
      }

      // Calculate average capabilities
      Object.entries(agent.capabilities).forEach(([key, value]) => {
        if (!acc.avgCapabilities[key as keyof typeof acc.avgCapabilities]) {
          acc.avgCapabilities[key as keyof typeof acc.avgCapabilities] = 0
        }
        acc.avgCapabilities[key as keyof typeof acc.avgCapabilities] += value
      })

      return acc
    },
    { 
      total: 0, 
      roles: {} as Record<string, number>,
      totalTasks: 0,
      avgSuccessRate: 0,
      avgCapabilities: { reasoning: 0, creativity: 0, technical: 0, communication: 0 }
    }
  )

  // Average capabilities
  Object.keys(stats.avgCapabilities).forEach(key => {
    stats.avgCapabilities[key as keyof typeof stats.avgCapabilities] /= Math.max(agents.length, 1)
  })

  const getRoleIcon = (role: string) => {
    const icons = {
      architect: CpuChipIcon,
      frontend: CpuChipIcon,
      backend: CpuChipIcon,
      data: CpuChipIcon,
      qa: CheckCircleIcon,
      manager: UserGroupIcon,
      orchestrator: CpuChipIcon,
      documentation: CpuChipIcon,
      analyst: CpuChipIcon,
      performance: CpuChipIcon,
      writer: CpuChipIcon,
      tester: CheckCircleIcon
    }
    return icons[role as keyof typeof icons] || UserGroupIcon
  }

  const getRoleColor = (role: string) => {
    const colors = {
      architect: 'purple',
      frontend: 'blue',
      backend: 'green',
      data: 'orange',
      qa: 'red',
      manager: 'gray',
      orchestrator: 'indigo',
      documentation: 'yellow',
      analyst: 'teal',
      performance: 'pink',
      writer: 'emerald',
      tester: 'red'
    }
    return colors[role as keyof typeof colors] || 'gray'
  }

  const getCapabilityColor = (value: number) => {
    if (value >= 0.9) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    if (value >= 0.8) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
    if (value >= 0.7) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
    if (value >= 0.6) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-32"></div>
          ))}
        </div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg font-semibold mb-2">Failed to load agents</div>
        <div className="text-gray-500">Please check your connection and try again.</div>
      </div>
    )
  }

  const uniqueRoles = Array.from(new Set(agents.map(agent => agent.primaryRole)))

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Total Agents"
          value={stats.total}
          status="info"
          description="All agents in system"
          icon={UserGroupIcon}
        />
        <MetricCard
          title="Avg Success Rate"
          value={Math.round(stats.avgSuccessRate * 100)}
          color="green"
          size="sm"
          unit="%"
          change={{ value: 0, period: "overall", isPositive: true }}
        />
        <MetricCard
          title="Total Tasks"
          value={stats.totalTasks}
          color="blue"
          size="sm"
          unit=""
          change={{ value: 0, period: "completed", isPositive: true }}
        />
        <MetricCard
          title="Avg Technical"
          value={Math.round(stats.avgCapabilities.technical * 100)}
          color="purple"
          size="sm"
          unit="%"
          change={{ value: 0, period: "capability", isPositive: true }}
        />
      </div>

      {/* Capabilities Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Reasoning"
          value={Math.round(stats.avgCapabilities.reasoning * 100)}
          color="blue"
          size="sm"
          unit="%"
          change={{ value: 0, period: "avg", isPositive: true }}
        />
        <MetricCard
          title="Creativity"
          value={Math.round(stats.avgCapabilities.creativity * 100)}
          color="purple"
          size="sm"
          unit="%"
          change={{ value: 0, period: "avg", isPositive: true }}
        />
        <MetricCard
          title="Technical"
          value={Math.round(stats.avgCapabilities.technical * 100)}
          color="green"
          size="sm"
          unit="%"
          change={{ value: 0, period: "avg", isPositive: true }}
        />
        <MetricCard
          title="Communication"
          value={Math.round(stats.avgCapabilities.communication * 100)}
          color="orange"
          size="sm"
          unit="%"
          change={{ value: 0, period: "avg", isPositive: true }}
        />
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Agent Management</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search agents..."
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredAgents.length} of {agents.length} agents
          </span>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => {
            const RoleIcon = getRoleIcon(agent.primaryRole)
            const roleColor = getRoleColor(agent.primaryRole)
            
            return (
              <div
                key={agent.id}
                className={`bg-white dark:bg-gray-800 border-2 rounded-lg shadow transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-1
                  ${selectedAgent?.id === agent.id ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
                onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
              >
                <div className="p-6">
                  {/* Agent Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-${roleColor}-100`}>
                        <RoleIcon className={`h-6 w-6 text-${roleColor}-600`} />
                      </div>
                      <div className="flex-1">
                        {editingAgent === agent.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editForm.name || ''}
                              onChange={(e) => updateEditForm('name', e.target.value)}
                              className="w-full text-lg font-semibold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Agent name"
                            />
                            <input
                              type="text"
                              value={editForm.primaryRole || ''}
                              onChange={(e) => updateEditForm('primaryRole', e.target.value)}
                              className="w-full text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Primary role"
                            />
                          </div>
                        ) : (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-${roleColor}-100 text-${roleColor}-800`}>
                              {agent.primaryRole}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingAgent === agent.id ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              saveAgent(agent.id)
                            }}
                            disabled={updateAgentMutation.isPending}
                            className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                            title="Save changes"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelEditing()
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800"
                            title="Cancel editing"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div onClick={(e) => e.stopPropagation()}>
                            <ReasoningButton
                              prompt={`Analyze this AI agent and suggest improvements:\n\nName: ${agent.name}\nRole: ${agent.primaryRole}\nDescription: ${agent.description || 'No description'}\nCapabilities: Reasoning=${agent.capabilities.reasoning}, Creativity=${agent.capabilities.creativity}, Technical=${agent.capabilities.technical}, Communication=${agent.capabilities.communication}`}
                              label="Analyze"
                            />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(agent)
                            }}
                            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                            title="Edit agent"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteAgent(agent.id, agent.name)
                            }}
                            disabled={deleteAgentMutation.isPending}
                            className="p-1 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Delete agent"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Agent Description */}
                  {editingAgent === agent.id ? (
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) => updateEditForm('description', e.target.value)}
                      className="w-full text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mb-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Agent description"
                      rows={3}
                    />
                  ) : (
                    agent.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                        {agent.description}
                      </p>
                    )
                  )}

                  {/* Capabilities */}
                  <div className="space-y-2 mb-4">
                    {Object.entries(editingAgent === agent.id && editForm.capabilities ? editForm.capabilities : agent.capabilities).map(([capability, value]) => (
                      <div key={capability} className="flex justify-between items-center">
                        <span className="text-sm capitalize text-gray-600 dark:text-gray-300">{capability}:</span>
                        {editingAgent === agent.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((editForm.capabilities?.[capability as keyof typeof editForm.capabilities] || 0) * 100)}
                              onChange={(e) => updateCapability(capability, parseInt(e.target.value) / 100)}
                              className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className={`px-2 py-0.5 rounded text-xs font-medium min-w-[3rem] text-center ${getCapabilityColor(editForm.capabilities?.[capability as keyof typeof editForm.capabilities] || 0)}`}>
                              {Math.round((editForm.capabilities?.[capability as keyof typeof editForm.capabilities] || 0) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCapabilityColor(value)}`}>
                            {Math.round(value * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Agent Stats */}
                  {agent.stats && (
                    <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="font-semibold text-blue-600">{agent.stats.tasksCompleted || 0}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Tasks</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="font-semibold text-green-600">
                          {Math.round((agent.stats.successRate || 0) * 100)}%
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Success</div>
                      </div>
                    </div>
                  )}

                  {/* Last Updated */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Updated {new Date(agent.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {agent.status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                        ${agent.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                        ${agent.status === 'inactive' ? 'bg-gray-100 text-gray-800' : ''}
                        ${agent.status === 'training' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${agent.status === 'deployed' ? 'bg-blue-100 text-blue-800' : ''}
                      `}>
                        {agent.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedAgent?.id === agent.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Agent Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Agent ID:</span>
                        <span className="font-mono text-gray-800 dark:text-gray-200">{agent.id}</span>
                      </div>
                      {agent.projectId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Project ID:</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">{agent.projectId}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Created:</span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {new Date(agent.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {agent.stats?.avgResponseTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Avg Response Time:</span>
                          <span className="text-gray-800 dark:text-gray-200">
                            {agent.stats.avgResponseTime}ms
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredAgents.length === 0 && (
          <div className="text-center py-12">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No agents found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || roleFilter !== 'all' 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by creating your first agent.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentsSection