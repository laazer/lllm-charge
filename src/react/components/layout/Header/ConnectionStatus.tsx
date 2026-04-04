import React, { useState } from 'react'
import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useWebSocket } from '../../../store/websocket-store'

export function ConnectionStatus() {
  const [showTooltip, setShowTooltip] = useState(false)
  const { 
    isConnected, 
    connectionState, 
    lastMessageTime, 
    reconnectAttempts,
    isReconnecting 
  } = useWebSocket()

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500'
    if (isReconnecting) return 'bg-yellow-500 animate-pulse'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    if (isConnected) return 'Connected'
    if (isReconnecting) return 'Reconnecting...'
    return 'Disconnected'
  }

  const formatLastSeen = () => {
    if (!lastMessageTime) return 'Never'
    const diff = Date.now() - lastMessageTime
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700
                 transition-all duration-200"
        title="Connection Status"
      >
        {/* Connection Indicator Dot */}
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          {isReconnecting && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-yellow-500 animate-ping opacity-75" />
          )}
        </div>

        {/* Connection Icon */}
        {isConnected ? (
          <WifiIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
        ) : (
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 
                      border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl
                      z-50 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">WebSocket Status</span>
              <span className={`text-sm px-2 py-1 rounded-full ${
                isConnected 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}>
                {getStatusText()}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>State:</span>
                <span className="font-mono">{connectionState}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Last Message:</span>
                <span>{formatLastSeen()}</span>
              </div>
              
              {reconnectAttempts > 0 && (
                <div className="flex justify-between">
                  <span>Reconnect Attempts:</span>
                  <span>{reconnectAttempts}</span>
                </div>
              )}
            </div>

            {!isConnected && (
              <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Real-time updates are unavailable. The dashboard will continue to work with API polling.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close tooltip */}
      {showTooltip && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowTooltip(false)}
        />
      )}
    </div>
  )
}