import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '../store/websocket-store'
import { useProject } from '../store/project-store'
import { apiClient } from '../lib/api-client'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { StatusCard } from '../components/ui/Cards/StatusCard'
import { MetricCard } from '../components/ui/Cards/MetricCard'
import { 
  FolderIcon,
  UserGroupIcon,
  DocumentIcon,
  DocumentTextIcon,
  WifiIcon,
  ChartBarIcon,
  ClockIcon,
  BoltIcon,
  Cog8ToothIcon
} from '@heroicons/react/24/outline'

function ActiveSpecsList() {
  const { currentProjectId } = useProject()
  const { data: specs = [], isLoading } = useQuery({
    queryKey: ['specs', currentProjectId],
    queryFn: () => apiClient.getSpecs(currentProjectId),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (isLoading) {
    return <LoadingSpinner size="sm" />
  }

  // Filter active specs and limit to 5 most recent
  const activeSpecs = specs
    .filter(spec => spec.status === 'active' || spec.status === 'in_progress')
    .slice(0, 5)

  if (activeSpecs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <DocumentIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No active specifications</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeSpecs.map((spec) => (
        <div key={spec.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {spec.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {spec.description}
            </p>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              spec.status === 'active' 
                ? 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400'
                : spec.status === 'in_progress'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {spec.status}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              spec.priority === 'critical' 
                ? 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400'
                : spec.priority === 'high'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-400'
                : spec.priority === 'medium'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {spec.priority}
            </span>
          </div>
        </div>
      ))}
      {activeSpecs.length === 5 && (
        <div className="text-center pt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing 5 most recent active specs
          </span>
        </div>
      )}
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { metrics, isConnected } = useWebSocket()
  const { currentProjectId } = useProject()

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  })

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', currentProjectId],
    queryFn: () => apiClient.getAgents(currentProjectId),
  })

  const { data: specs, isLoading: specsLoading } = useQuery({
    queryKey: ['specs', currentProjectId],
    queryFn: () => apiClient.getSpecs(currentProjectId),
  })

  if (projectsLoading || agentsLoading || specsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Dashboard metrics calculations
  const totalRequests = metrics?.totalRequests || 0
  const successRate = metrics?.successRate || 0
  const avgResponseTime = metrics?.avgResponseTime || 0
  const totalSavings = metrics?.totalSavings || 0
  
  // Cron system metrics
  const cronSystem = metrics?.cronSystem || {}
  const cronStatus = cronSystem.schedulerRunning ? 'success' : 'warning'
  const cronDescription = `${cronSystem.totalJobs || 0} jobs, ${cronSystem.activeJobs || 0} active`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Welcome to LLM-Charge - Your AI-powered development assistant
        </p>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatusCard
          title="Projects"
          value={projects?.length || 0}
          status="info"
          description="Active projects in workspace"
          icon={FolderIcon}
        />
        <StatusCard
          title="Agents"
          value={agents?.length || 0}
          status="success"
          description="AI agents deployed"
          icon={UserGroupIcon}
        />
        <StatusCard
          title="Specifications"
          value={specs?.length || 0}
          status="info"
          description="Documentation specs"
          icon={DocumentTextIcon}
        />
        <StatusCard
          title="Cron Jobs"
          value={cronSystem.schedulerRunning ? `${cronSystem.totalJobs || 0} Jobs` : 'Offline'}
          status={cronStatus}
          description={cronDescription}
          icon={Cog8ToothIcon}
        />
        <StatusCard
          title="WebSocket"
          value={isConnected ? 'Connected' : 'Disconnected'}
          status={isConnected ? 'success' : 'error'}
          description="Real-time connection status"
          icon={WifiIcon}
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          icon={ChartBarIcon}
          color="blue"
        />
        <MetricCard
          title="Success Rate"
          value={`${parseFloat(successRate).toFixed(1)}`}
          unit="%"
          icon={BoltIcon}
          color="green"
        />
        <MetricCard
          title="Avg Response Time"
          value={avgResponseTime.toFixed(0)}
          unit="ms"
          icon={ClockIcon}
          color="yellow"
        />
        <MetricCard
          title="Cron Executions"
          value={cronSystem.recentExecutions || 0}
          icon={Cog8ToothIcon}
          color="gray"
        />
        <MetricCard
          title="Cost Savings"
          value={`$${totalSavings.toFixed(2)}`}
          icon={ChartBarIcon}
          color="purple"
        />
      </div>

      {/* Real-time Metrics */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Real-time Metrics
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Requests
                </p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {metrics.totalRequests?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Success Rate
                </p>
                <p className="text-xl font-semibold text-green-600">
                  {metrics.successRate ? `${parseFloat(metrics.successRate).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Avg Response Time
                </p>
                <p className="text-xl font-semibold text-blue-600">
                  {metrics.avgResponseTime ? `${metrics.avgResponseTime.toFixed(0)}ms` : '0ms'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Specifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Specifications
          </h2>
        </div>
        <div className="p-6">
          <ActiveSpecsList />
        </div>
      </div>
    </div>
  )
}

export default Dashboard