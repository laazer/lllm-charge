import React from 'react'
import { useWebSocket } from '../../../store/websocket-store'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../lib/api-client'

export function DashboardFooter() {
  const { isConnected, lastMessageTime } = useWebSocket()
  
  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiClient.getMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const formatUptime = (startTime?: number) => {
    if (!startTime) return 'Unknown'
    const uptime = Date.now() - startTime
    const hours = Math.floor(uptime / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const formatLastUpdate = () => {
    if (!lastMessageTime) return 'Never'
    const diff = Date.now() - lastMessageTime
    if (diff < 10000) return 'Just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    return `${Math.floor(diff / 60000)}m ago`
  }

  return (
    <footer className="border-t border-gray-200 dark:border-slate-700 
                     bg-gray-50 dark:bg-slate-800/50
                     glass:bg-white/5 glass:backdrop-blur-md glass:border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          {/* Left side - System status */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <div>
              <span>Last Update: {formatLastUpdate()}</span>
            </div>

            {metrics && (
              <div>
                <span>System Load: {metrics.systemLoad?.cpu.toFixed(1)}% CPU</span>
              </div>
            )}
          </div>

          {/* Right side - Application info */}
          <div className="flex items-center space-x-6">
            {metrics && (
              <div className="flex items-center space-x-4">
                <span>Uptime: {formatUptime(metrics.startTime)}</span>
                <span>Requests: {metrics.totalRequests || 0}</span>
                <span>Savings: {metrics.totalSavings || '$0.00'}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <span>LLM-Charge v1.0.0</span>
              <span>•</span>
              <a 
                href="https://github.com/your-username/lllm-charge" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}