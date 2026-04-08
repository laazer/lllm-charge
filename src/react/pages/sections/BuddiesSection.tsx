import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '../../lib/api-client'
import { useProject } from '../../store/project-store'
import type {
  Buddy,
  BuddyMessage,
  BuddyPersonalityTrait,
  BuddyExpertiseArea,
  BuddyBehaviorMode,
  BuddyCommunicationStyle,
} from '../../types'

const PERSONALITY_TRAITS: BuddyPersonalityTrait[] = [
  'helpful', 'sarcastic', 'encouraging', 'technical',
  'casual', 'formal', 'humorous', 'philosophical',
]

const EXPERTISE_AREAS: BuddyExpertiseArea[] = [
  'frontend', 'backend', 'devops', 'data-science',
  'mobile', 'security', 'testing', 'architecture', 'general',
]

const BEHAVIOR_MODES: { value: BuddyBehaviorMode; label: string; description: string }[] = [
  { value: 'reactive-only', label: 'Reactive', description: 'Responds only when asked' },
  { value: 'proactive-suggestions', label: 'Proactive', description: 'Suggests improvements unprompted' },
  { value: 'pair-programming', label: 'Pair Programming', description: 'Collaborates and thinks out loud' },
  { value: 'code-review', label: 'Code Review', description: 'Focuses on reviewing and catching bugs' },
]

const COMMUNICATION_STYLES: { value: BuddyCommunicationStyle; label: string; description: string }[] = [
  { value: 'concise', label: 'Concise', description: 'Short and to the point' },
  { value: 'verbose', label: 'Verbose', description: 'Detailed explanations with examples' },
  { value: 'socratic', label: 'Socratic', description: 'Guides through questions' },
]

const AVATAR_OPTIONS = [
  '🤖', '🧠', '🦊', '🐙', '🦉', '🐺', '🦁', '🐲',
  '🧙', '🥷', '👾', '🎯', '⚡', '🔮', '🛡️', '🚀',
]

interface BuddyFormData {
  name: string
  avatar: string
  personalityTraits: BuddyPersonalityTrait[]
  expertiseAreas: BuddyExpertiseArea[]
  behaviorMode: BuddyBehaviorMode
  communicationStyle: BuddyCommunicationStyle
  customSystemPrompt: string
  contextWindowSize: number
}

const DEFAULT_FORM: BuddyFormData = {
  name: '',
  avatar: '🤖',
  personalityTraits: ['helpful', 'technical'],
  expertiseAreas: ['general'],
  behaviorMode: 'reactive-only',
  communicationStyle: 'concise',
  customSystemPrompt: '',
  contextWindowSize: 20,
}

type ViewMode = 'gallery' | 'config' | 'chat'

const BuddiesSection: React.FC = () => {
  const { currentProjectId } = useProject()
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')
  const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null)
  const [editingBuddy, setEditingBuddy] = useState<Buddy | null>(null)
  const [formData, setFormData] = useState<BuddyFormData>(DEFAULT_FORM)
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()

  const { data: buddies = [], isLoading, error } = useQuery({
    queryKey: ['buddies', currentProjectId],
    queryFn: () => apiClient.getBuddies(currentProjectId),
  })

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['buddyMessages', selectedBuddy?.id],
    queryFn: () => selectedBuddy ? apiClient.getBuddyMessages(selectedBuddy.id) : Promise.resolve([]),
    enabled: !!selectedBuddy && viewMode === 'chat',
  })

  const createBuddyMutation = useMutation({
    mutationFn: (data: BuddyFormData) => apiClient.createBuddy({
      name: data.name,
      avatar: data.avatar,
      personalityTraits: data.personalityTraits,
      expertiseAreas: data.expertiseAreas,
      behaviorMode: data.behaviorMode,
      communicationStyle: data.communicationStyle,
      customSystemPrompt: data.customSystemPrompt || undefined,
      contextWindowSize: data.contextWindowSize,
      projectId: currentProjectId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buddies', currentProjectId] })
      setViewMode('gallery')
      setFormData(DEFAULT_FORM)
      setEditingBuddy(null)
    },
  })

  const updateBuddyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BuddyFormData }) =>
      apiClient.updateBuddy(id, {
        name: data.name,
        avatar: data.avatar,
        personalityTraits: data.personalityTraits,
        expertiseAreas: data.expertiseAreas,
        behaviorMode: data.behaviorMode,
        communicationStyle: data.communicationStyle,
        customSystemPrompt: data.customSystemPrompt || undefined,
        contextWindowSize: data.contextWindowSize,
      }),
    onSuccess: (updatedBuddy) => {
      queryClient.invalidateQueries({ queryKey: ['buddies', currentProjectId] })
      setSelectedBuddy(updatedBuddy)
      setViewMode('gallery')
      setEditingBuddy(null)
      setFormData(DEFAULT_FORM)
    },
  })

  const deleteBuddyMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteBuddy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buddies', currentProjectId] })
      setSelectedBuddy(null)
      setViewMode('gallery')
    },
  })

  const chatMutation = useMutation({
    mutationFn: ({ buddyId, message }: { buddyId: string; message: string }) =>
      apiClient.chatWithBuddy(buddyId, message),
    onSuccess: () => {
      refetchMessages()
      setChatInput('')
    },
  })

  const clearMessagesMutation = useMutation({
    mutationFn: (buddyId: string) => apiClient.clearBuddyMessages(buddyId),
    onSuccess: () => {
      refetchMessages()
      queryClient.invalidateQueries({ queryKey: ['buddies', currentProjectId] })
    },
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openCreateForm = () => {
    setEditingBuddy(null)
    setFormData(DEFAULT_FORM)
    setViewMode('config')
  }

  const openEditForm = (buddy: Buddy) => {
    setEditingBuddy(buddy)
    setFormData({
      name: buddy.config.name,
      avatar: buddy.config.avatar,
      personalityTraits: buddy.config.personalityTraits,
      expertiseAreas: buddy.config.expertiseAreas,
      behaviorMode: buddy.config.behaviorMode,
      communicationStyle: buddy.config.communicationStyle,
      customSystemPrompt: buddy.config.customSystemPrompt || '',
      contextWindowSize: buddy.config.contextWindowSize || 20,
    })
    setViewMode('config')
  }

  const openChat = (buddy: Buddy) => {
    setSelectedBuddy(buddy)
    setViewMode('chat')
  }

  const handleSubmitForm = () => {
    if (!formData.name.trim()) return
    if (editingBuddy) {
      updateBuddyMutation.mutate({ id: editingBuddy.id, data: formData })
    } else {
      createBuddyMutation.mutate(formData)
    }
  }

  const handleSendMessage = () => {
    if (!chatInput.trim() || !selectedBuddy) return
    chatMutation.mutate({ buddyId: selectedBuddy.id, message: chatInput })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const toggleTrait = (trait: BuddyPersonalityTrait) => {
    setFormData(prev => ({
      ...prev,
      personalityTraits: prev.personalityTraits.includes(trait)
        ? prev.personalityTraits.filter(t => t !== trait)
        : [...prev.personalityTraits, trait],
    }))
  }

  const toggleExpertise = (area: BuddyExpertiseArea) => {
    setFormData(prev => ({
      ...prev,
      expertiseAreas: prev.expertiseAreas.includes(area)
        ? prev.expertiseAreas.filter(a => a !== area)
        : [...prev.expertiseAreas, area],
    }))
  }

  const deleteBuddy = (buddyId: string, buddyName: string) => {
    if (window.confirm(`Delete "${buddyName}" and all conversation history? This cannot be undone.`)) {
      deleteBuddyMutation.mutate(buddyId)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-48"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg font-semibold mb-2">Failed to load buddies</div>
        <div className="text-gray-500">Please check your connection and try again.</div>
      </div>
    )
  }

  // ========== CHAT VIEW ==========
  if (viewMode === 'chat' && selectedBuddy) {
    return (
      <div className="flex flex-col h-[calc(100vh-280px)] bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{selectedBuddy.config.avatar}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedBuddy.config.name}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="capitalize">{selectedBuddy.config.behaviorMode.replace('-', ' ')}</span>
                <span>-</span>
                <span>{selectedBuddy.config.expertiseAreas.join(', ')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => selectedBuddy && clearMessagesMutation.mutate(selectedBuddy.id)}
              className="p-2 text-gray-500 hover:text-red-500 transition-colors"
              title="Clear conversation"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => openEditForm(selectedBuddy)}
              className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
              title="Edit buddy"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => { setViewMode('gallery'); setSelectedBuddy(null) }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Back to gallery"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <SparklesIcon className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">Start chatting with {selectedBuddy.config.name}</p>
              <p className="text-sm mt-1">Your conversation will appear here</p>
            </div>
          )}
          {messages.map((msg: BuddyMessage) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                {msg.role === 'buddy' && (
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm">{selectedBuddy.config.avatar}</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {selectedBuddy.config.name}
                    </span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{selectedBuddy.config.avatar}</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-end space-x-3">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedBuddy.config.name}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || chatMutation.isPending}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========== CONFIG VIEW ==========
  if (viewMode === 'config') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editingBuddy ? `Edit ${editingBuddy.config.name}` : 'Create New Buddy'}
          </h2>
          <button
            onClick={() => { setViewMode('gallery'); setEditingBuddy(null); setFormData(DEFAULT_FORM) }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 max-w-3xl">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Give your buddy a name..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Avatar
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setFormData(prev => ({ ...prev, avatar: emoji }))}
                  className={`w-12 h-12 text-2xl rounded-lg border-2 flex items-center justify-center transition-all
                    ${formData.avatar === emoji
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-110'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Personality Traits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Personality Traits
            </label>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TRAITS.map((trait) => (
                <button
                  key={trait}
                  onClick={() => toggleTrait(trait)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all
                    ${formData.personalityTraits.includes(trait)
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 ring-2 ring-purple-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {trait}
                </button>
              ))}
            </div>
          </div>

          {/* Expertise Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expertise Areas
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_AREAS.map((area) => (
                <button
                  key={area}
                  onClick={() => toggleExpertise(area)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all
                    ${formData.expertiseAreas.includes(area)
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 ring-2 ring-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* Behavior Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Behavior Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BEHAVIOR_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setFormData(prev => ({ ...prev, behaviorMode: mode.value }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all
                    ${formData.behaviorMode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{mode.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Communication Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Communication Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COMMUNICATION_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setFormData(prev => ({ ...prev, communicationStyle: style.value }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all
                    ${formData.communicationStyle === style.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{style.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Context Window Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Context Window Size
              <span className="ml-2 text-xs text-gray-400">({formData.contextWindowSize} messages)</span>
            </label>
            <input
              type="range"
              min="5"
              max="100"
              value={formData.contextWindowSize}
              onChange={(e) => setFormData(prev => ({ ...prev, contextWindowSize: parseInt(e.target.value, 10) }))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5</span>
              <span>100</span>
            </div>
          </div>

          {/* Custom System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom System Prompt
              <span className="ml-2 text-xs text-gray-400">(overrides generated prompt)</span>
            </label>
            <textarea
              value={formData.customSystemPrompt}
              onChange={(e) => setFormData(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
              placeholder="Leave empty to auto-generate from personality and expertise settings..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setViewMode('gallery'); setEditingBuddy(null); setFormData(DEFAULT_FORM) }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                         rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitForm}
              disabled={!formData.name.trim() || createBuddyMutation.isPending || updateBuddyMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createBuddyMutation.isPending || updateBuddyMutation.isPending
                ? 'Saving...'
                : editingBuddy ? 'Save Changes' : 'Create Buddy'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========== GALLERY VIEW ==========
  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{buddies.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Buddies</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center space-x-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <SparklesIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {buddies.filter(b => b.isActive).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {buddies.reduce((sum, b) => sum + (b.conversationCount || 0), 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Messages</div>
          </div>
        </div>
      </div>

      {/* Buddy Cards Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Buddies</h2>
          <button
            onClick={openCreateForm}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>New Buddy</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Create New Card */}
          <button
            onClick={openCreateForm}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6
                       hover:border-blue-400 dark:hover:border-blue-500 transition-colors
                       flex flex-col items-center justify-center min-h-[200px] group"
          >
            <PlusIcon className="h-10 w-10 text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="mt-2 text-sm text-gray-500 group-hover:text-blue-500 transition-colors">
              Create a new buddy
            </span>
          </button>

          {/* Buddy Cards */}
          {buddies.map((buddy) => (
            <div
              key={buddy.id}
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700
                         rounded-lg shadow hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-4xl">{buddy.config.avatar}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {buddy.config.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize
                        ${buddy.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                        {buddy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditForm(buddy)}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteBuddy(buddy.id, buddy.config.name)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Traits */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {buddy.config.personalityTraits.map((trait) => (
                    <span
                      key={trait}
                      className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700
                                 dark:bg-purple-900/30 dark:text-purple-300 capitalize"
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {/* Expertise */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {buddy.config.expertiseAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700
                                 dark:bg-green-900/30 dark:text-green-300 capitalize"
                    >
                      {area}
                    </span>
                  ))}
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span className="capitalize">{buddy.config.behaviorMode.replace(/-/g, ' ')}</span>
                  <span>{buddy.conversationCount || 0} messages</span>
                </div>

                {/* Chat Button */}
                <button
                  onClick={() => openChat(buddy)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2
                             bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  <span>Chat</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {buddies.length === 0 && (
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No buddies yet</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Create your first AI buddy to get started with customizable companions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default BuddiesSection
