import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { WebSocketMessage, MetricsData } from '../types'

interface WebSocketContextType {
  isConnected: boolean
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  metrics: MetricsData | null
  lastMessage: WebSocketMessage | null
  lastMessageTime: number | null
  reconnectAttempts: number
  isReconnecting: boolean
  sendMessage: (message: any) => void
  reconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

interface WebSocketProviderProps {
  children: React.ReactNode
  wsUrl: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function WebSocketProvider({ 
  children, 
  wsUrl, 
  reconnectInterval = 5000,
  maxReconnectAttempts = 5 
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnect = useRef(true)

  const connect = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus('connecting')
    console.log(`Attempting to connect to WebSocket: ${wsUrl}`)
    
    try {
      ws.current = new WebSocket(wsUrl)

      ws.current.onopen = () => {
        setIsConnected(true)
        setConnectionStatus('connected')
        setIsReconnecting(false)
        reconnectAttempts.current = 0
        console.log(`WebSocket connected successfully to ${wsUrl}`)
      }

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
          setLastMessageTime(Date.now())

          // Handle specific message types
          switch (message.type) {
            case 'metrics':
            case 'metrics_update':
              setMetrics(message.data)
              break
            case 'notification':
              // Handle notifications
              break
            case 'error':
              console.error('WebSocket error message:', message.data)
              break
            default:
              // Silently handle unknown message types to reduce console noise
              break
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.current.onclose = (event) => {
        setIsConnected(false)
        setConnectionStatus('disconnected')
        console.log(`WebSocket disconnected from ${wsUrl}:`, {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean
        })
        
        if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect()
        }
      }

      ws.current.onerror = (error) => {
        setConnectionStatus('error')
        console.error(`WebSocket error connecting to ${wsUrl}:`, {
          error,
          readyState: ws.current?.readyState,
          reconnectAttempt: reconnectAttempts.current
        })
        
        // Schedule reconnect on error if we haven't reached max attempts
        if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect()
        }
      }
    } catch (error) {
      setConnectionStatus('error')
      console.error('Failed to create WebSocket connection:', error)
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.warn(`WebSocket max reconnection attempts (${maxReconnectAttempts}) reached. Giving up.`)
      setIsReconnecting(false)
      return
    }

    setIsReconnecting(true)
    // Exponential backoff with jitter to prevent thundering herd
    const baseDelay = reconnectInterval * Math.pow(1.5, reconnectAttempts.current)
    const jitter = Math.random() * 1000 // Add 0-1s jitter
    const delay = Math.min(baseDelay + jitter, 30000)
    
    console.log(`WebSocket scheduling reconnect attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts} in ${Math.round(delay)}ms`)
    
    reconnectTimeout.current = setTimeout(() => {
      if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        console.log(`WebSocket reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`)
        connect()
      }
    }, delay)
  }

  const disconnect = () => {
    shouldReconnect.current = false
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
    }
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
  }

  const sendMessage = (message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
      }
    } else {
      console.warn('WebSocket is not connected. Cannot send message.')
    }
  }

  const reconnect = () => {
    reconnectAttempts.current = 0
    shouldReconnect.current = true
    disconnect()
    setTimeout(connect, 100)
  }

  useEffect(() => {
    shouldReconnect.current = true
    
    // Add a small delay for initial connection to prevent rapid reconnection
    const initialConnectTimer = setTimeout(() => {
      if (shouldReconnect.current) {
        connect()
      }
    }, 100)

    return () => {
      clearTimeout(initialConnectTimer)
      disconnect()
    }
  }, [wsUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnect.current = false
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  const value = {
    isConnected,
    connectionState: connectionStatus,
    connectionStatus,
    metrics,
    lastMessage,
    lastMessageTime,
    reconnectAttempts: reconnectAttempts.current,
    isReconnecting,
    sendMessage,
    reconnect,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

// Export as const to make Fast Refresh happy
export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}