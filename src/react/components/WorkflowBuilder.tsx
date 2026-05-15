import React, { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api-client'
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  ArrowRightIcon,
  UserGroupIcon,
  CogIcon,
  DocumentIcon
} from '@heroicons/react/24/outline'

interface Agent {
  id: string
  name: string
  description: string
  primaryRole: string
  capabilities: {
    reasoning: number
    creativity: number
    technical: number
    communication: number
  }
}

interface WorkflowNode {
  id: string
  type: 'trigger' | 'agent' | 'action' | 'condition'
  name: string
  description?: string
  agentId?: string
  position: { x: number; y: number }
  data?: Record<string, any>
}

interface WorkflowConnection {
  id: string
  source: string
  target: string
}

interface WorkflowBuilderProps {
  onClose: () => void
  existingWorkflow?: any
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ onClose, existingWorkflow }) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [connections, setConnections] = useState<WorkflowConnection[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [draggedNode, setDraggedNode] = useState<WorkflowNode | null>(null)
  const [workflowName, setWorkflowName] = useState('New Workflow')

  // Fetch available agents
  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.getAgents(),
  })

  // Node types that can be added to workflow
  const nodeTypes = [
    { type: 'trigger', name: 'Manual Trigger', icon: '🚀', color: 'bg-green-500' },
    { type: 'trigger', name: 'Webhook Trigger', icon: '🔗', color: 'bg-blue-500' },
    { type: 'agent', name: 'AI Agent', icon: '🤖', color: 'bg-purple-500' },
    { type: 'action', name: 'HTTP Request', icon: '📡', color: 'bg-orange-500' },
    { type: 'action', name: 'Code Execute', icon: '💻', color: 'bg-gray-600' },
    { type: 'condition', name: 'If/Else', icon: '🔀', color: 'bg-yellow-500' },
  ]

  const addNode = useCallback((nodeType: any, position?: { x: number; y: number }) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: nodeType.type,
      name: nodeType.name,
      position: position || { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: nodeType.type === 'agent' ? { agentId: '' } : {}
    }
    setNodes(prev => [...prev, newNode])
  }, [])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId))
    setConnections(prev => prev.filter(conn => conn.source !== nodeId && conn.target !== nodeId))
    if (selectedNode === nodeId) {
      setSelectedNode(null)
    }
  }, [selectedNode])

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ))
  }, [])

  const addConnection = useCallback((sourceId: string, targetId: string) => {
    const connectionId = `conn_${sourceId}_${targetId}`
    const existingConnection = connections.find(conn => 
      conn.source === sourceId && conn.target === targetId
    )
    
    if (!existingConnection && sourceId !== targetId) {
      setConnections(prev => [...prev, { id: connectionId, source: sourceId, target: targetId }])
    }
  }, [connections])

  const renderNode = (node: WorkflowNode) => {
    const nodeType = nodeTypes.find(nt => nt.type === node.type && nt.name === node.name)
    const isSelected = selectedNode === node.id
    
    return (
      <div
        key={node.id}
        className={`absolute bg-white dark:bg-gray-800 rounded-lg border-2 p-4 cursor-pointer transform transition-all duration-200 hover:scale-105 ${
          isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 dark:border-gray-600'
        }`}
        style={{ 
          left: node.position.x, 
          top: node.position.y,
          minWidth: '200px'
        }}
        onClick={() => setSelectedNode(node.id)}
        onDoubleClick={() => deleteNode(node.id)}
      >
        {/* Node Header */}
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-xl">{nodeType?.icon || '⚙️'}</span>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
              {node.name}
            </h3>
            {node.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{node.description}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteNode(node.id)
            }}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Agent Selection for Agent Nodes */}
        {node.type === 'agent' && (
          <div className="mt-2">
            <select
              value={node.data?.agentId || ''}
              onChange={(e) => {
                const selectedAgent = agents.find(agent => agent.id === e.target.value)
                updateNode(node.id, {
                  data: { ...node.data, agentId: e.target.value },
                  description: selectedAgent?.description
                })
              }}
              className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Select Agent...</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.primaryRole})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Connection Points */}
        <div className="flex justify-between mt-2">
          {/* Input connection point */}
          {node.type !== 'trigger' && (
            <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-white -ml-6 mt-1 cursor-pointer hover:bg-blue-500" />
          )}
          
          {/* Output connection point */}
          <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-white -mr-6 mt-1 ml-auto cursor-pointer hover:bg-blue-500" />
        </div>
      </div>
    )
  }

  const renderConnection = (connection: WorkflowConnection) => {
    const sourceNode = nodes.find(n => n.id === connection.source)
    const targetNode = nodes.find(n => n.id === connection.target)
    
    if (!sourceNode || !targetNode || !connection.id) return null

    const startX = sourceNode.position.x + 200  // Node width
    const startY = sourceNode.position.y + 40   // Node center
    const endX = targetNode.position.x
    const endY = targetNode.position.y + 40

    const controlX1 = startX + (endX - startX) / 3
    const controlX2 = endX - (endX - startX) / 3

    const path = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`

    return (
      <g key={connection.id}>
        <path
          d={path}
          stroke="#3b82f6"
          strokeWidth="2"
          fill="none"
          className="hover:stroke-blue-700 cursor-pointer"
          onClick={() => {
            // Remove connection on click
            setConnections(prev => prev.filter(conn => conn.id !== connection.id))
          }}
        />
        <path
          d={`M ${endX} ${endY} L ${endX - 10} ${endY - 5} L ${endX - 10} ${endY + 5} Z`}
          fill="#3b82f6"
        />
      </g>
    )
  }

  const saveWorkflow = async () => {
    const workflowData = {
      name: workflowName,
      description: `Workflow with ${nodes.length} nodes and ${connections.length} connections`,
      nodes: nodes.map(node => ({
        ...node,
        agentId: node.type === 'agent' ? node.data?.agentId : undefined
      })),
      connections,
      status: 'draft',
      type: 'n8n-style'
    }

    try {
      await apiClient.createWorkflow(workflowData)
      alert('Workflow saved successfully!')
      onClose()
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full max-w-7xl max-h-full m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-xl font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={saveWorkflow}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Save Workflow
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with node types and agents */}
          <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Node Types</h3>
            <div className="space-y-2 mb-6">
              {nodeTypes.map((nodeType, index) => (
                <button
                  key={index}
                  onClick={() => addNode(nodeType)}
                  className="w-full flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-lg">{nodeType.icon}</span>
                  <span className="text-sm font-medium">{nodeType.name}</span>
                </button>
              ))}
            </div>

            {/* Available Agents */}
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Available Agents ({agents.length})</h3>
            <div className="space-y-2">
              {agents.slice(0, 10).map(agent => (
                <div
                  key={agent.id}
                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <UserGroupIcon className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {agent.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {agent.primaryRole}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {agent.description?.substring(0, 80)}...
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Main canvas */}
          <div className="flex-1 relative bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 1 }}
            >
              {connections
                .filter(connection => connection.id && connection.source && connection.target)
                .map(renderConnection)
                .filter(Boolean)}
            </svg>
            
            <div className="absolute inset-0 p-4" style={{ zIndex: 2 }}>
              {nodes.filter(node => node.id).map(renderNode)}
            </div>

            {/* Instructions */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <CogIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Build Your Workflow</h3>
                  <p>Drag node types from the sidebar to create your n8n-style workflow</p>
                  <p className="text-sm mt-2">Select agents from the library to integrate AI capabilities</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Nodes: {nodes.length} | Connections: {connections.length}</span>
            <span>Agent Library: {agents.length} available agents</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkflowBuilder