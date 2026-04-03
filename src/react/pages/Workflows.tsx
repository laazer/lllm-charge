import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { 
  PlusIcon, 
  StopIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  AdjustmentsHorizontalIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'
import { apiClient } from '../lib/api-client'
import { StatusCard } from '../components/ui/Cards/StatusCard'
import { Modal, ModalBody } from '../components/ui/Modals/Modal'
import { OverflowMenu } from '../components/ui/Menus/OverflowMenu'
import { Workflow } from '../types'

const Workflows: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  // isDragOver state removed - no drag and drop functionality

  const { data: workflowsRaw = [], isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiClient.getWorkflows(),
  })

  // Filter out workflows with null IDs and normalize data structure
  const workflows = workflowsRaw
    .filter((workflow: any) => workflow.id !== null && workflow.id !== undefined)
    .map((workflow: any) => ({
      ...workflow,
      title: workflow.title || workflow.name || 'Untitled Workflow',
      name: workflow.name || workflow.title || 'Untitled Workflow'
    }))

  const createWorkflowMutation = useMutation({
    mutationFn: (workflowData: any) => apiClient.createWorkflow(workflowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      setIsCreatingWorkflow(false)
    },
  })

  const deleteWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => apiClient.deleteWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const handleCreateWorkflow = () => {
    const newWorkflow = {
      title: `Workflow ${Date.now()}`,
      description: 'A new n8n-style automation workflow',
      status: 'draft',
      priority: 'medium'
    }

    setIsCreatingWorkflow(true)
    createWorkflowMutation.mutate(newWorkflow)
  }

  const handleOpenWorkflowBuilder = () => {
    // Navigate to the actual n8n-style workflow builder in the same tab
    window.location.href = '/workflow-editor.html'
  }

  const handleDeleteWorkflow = async (workflowId: string, workflowTitle: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${workflowTitle}"?\n\nThis action cannot be undone.`
    )
    
    if (confirmed) {
      try {
        await deleteWorkflowMutation.mutateAsync(workflowId)
        console.log(`✅ Workflow deleted successfully: ${workflowId}`)
      } catch (error) {
        console.error('❌ Failed to delete workflow:', error)
        alert(`Failed to delete workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const handleBrowseTemplates = () => {
    setShowTemplates(true)
    setShowExamples(false)
  }

  const handleViewExamples = () => {
    setShowExamples(true)
    setShowTemplates(false)
  }

  // Workflow templates with complete nodes and edges
  const workflowTemplates = [
    {
      name: "Simple Code Review Workflow",
      description: "Basic code review with approval process",
      category: "Development",
      template: {
        title: "Code Review Workflow",
        description: "Automated code review and approval process",
        status: "draft" as const,
        priority: "medium" as const,
        nodes: [
          {
            id: "trigger-pr",
            type: "trigger",
            name: "Pull Request Trigger",
            position: { x: 100, y: 150 },
            data: { 
              triggerType: "webhook", 
              inputs: ["pull_request", "changed_files"] 
            }
          },
          {
            id: "code-analysis",
            type: "agent",
            name: "Code Analysis Agent",
            position: { x: 350, y: 150 },
            data: { 
              agentRole: "analyst",
              description: "Analyze code quality and security",
              inputs: ["changed_files"],
              outputs: ["analysis_report", "quality_score"]
            }
          },
          {
            id: "review-decision",
            type: "agent",
            name: "Review Decision Agent",
            position: { x: 600, y: 150 },
            data: {
              agentRole: "architect",
              description: "Make approval decision based on analysis",
              inputs: ["analysis_report", "quality_score"],
              outputs: ["approval_status", "feedback"]
            }
          },
          {
            id: "complete",
            type: "output",
            name: "Review Complete",
            position: { x: 850, y: 150 },
            data: { outputs: ["approval_status", "feedback"] }
          }
        ],
        edges: [
          { id: "trigger-to-analysis", source: "trigger-pr", target: "code-analysis" },
          { id: "analysis-to-decision", source: "code-analysis", target: "review-decision" },
          { id: "decision-to-complete", source: "review-decision", target: "complete" }
        ]
      }
    },
    {
      name: "Bug Fix Pipeline", 
      description: "Streamlined workflow for bug identification and resolution",
      category: "Development",
      template: {
        title: "Bug Fix Pipeline",
        description: "Streamlined workflow for identifying, fixing, and verifying bug fixes with comprehensive testing and monitoring",
        status: "draft" as const,
        priority: "medium" as const,
        nodes: [
          {
            id: "bug-report",
            type: "trigger",
            name: "Bug Report Trigger",
            position: { x: 100, y: 150 },
            data: { 
              triggerType: "manual", 
              inputs: ["bug_description", "severity", "environment"] 
            }
          },
          {
            id: "bug-analysis",
            type: "agent",
            name: "Bug Analysis Agent",
            position: { x: 350, y: 150 },
            data: { 
              agentRole: "analyst",
              description: "Analyze bug and determine fix strategy",
              inputs: ["bug_description", "severity"],
              outputs: ["root_cause", "fix_plan", "complexity"]
            }
          },
          {
            id: "bug-fix",
            type: "agent",
            name: "Bug Fix Implementation",
            position: { x: 600, y: 150 },
            data: {
              agentRole: "data",
              description: "Implement the bug fix with proper testing",
              inputs: ["root_cause", "fix_plan"],
              outputs: ["fix_code", "test_results"]
            }
          },
          {
            id: "bug-resolved",
            type: "output",
            name: "Bug Resolved",
            position: { x: 850, y: 150 },
            data: { outputs: ["fix_code", "test_results", "verification"] }
          }
        ],
        edges: [
          { id: "report-to-analysis", source: "bug-report", target: "bug-analysis" },
          { id: "analysis-to-fix", source: "bug-analysis", target: "bug-fix" },
          { id: "fix-to-resolved", source: "bug-fix", target: "bug-resolved" }
        ]
      }
    },
    {
      name: "Data Processing Pipeline",
      description: "Process incoming data through multiple AI agents for analysis and reporting",
      category: "Analytics",
      template: {
        title: "Data Processing Pipeline",
        description: "Process incoming data through multiple AI agents for analysis and reporting",
        status: "draft" as const,
        priority: "high" as const,
        nodes: [
          {
            id: "data-input",
            type: "trigger",
            name: "Data Input Trigger",
            position: { x: 100, y: 150 },
            data: { 
              triggerType: "webhook", 
              inputs: ["raw_data", "format", "source"] 
            }
          },
          {
            id: "data-analyzer",
            type: "agent",
            name: "Data Analysis Agent",
            position: { x: 350, y: 150 },
            data: { 
              agentRole: "analyst",
              description: "Analyze incoming data patterns and extract insights",
              inputs: ["raw_data", "format"],
              outputs: ["analysis_report", "insights", "anomalies"]
            }
          },
          {
            id: "report-generator",
            type: "agent",
            name: "Report Generation Agent",
            position: { x: 600, y: 150 },
            data: {
              agentRole: "documentation",
              description: "Generate comprehensive reports with visualizations",
              inputs: ["analysis_report", "insights"],
              outputs: ["final_report", "visualizations", "summary"]
            }
          },
          {
            id: "data-complete",
            type: "output",
            name: "Processing Complete",
            position: { x: 850, y: 150 },
            data: { outputs: ["final_report", "visualizations", "processed_data"] }
          }
        ],
        edges: [
          { id: "input-to-analyzer", source: "data-input", target: "data-analyzer" },
          { id: "analyzer-to-report", source: "data-analyzer", target: "report-generator" },
          { id: "report-to-complete", source: "report-generator", target: "data-complete" }
        ]
      }
    },
    {
      name: "User Onboarding Flow",
      description: "Complete user onboarding automation with email verification and profile setup",
      category: "Automation",
      template: {
        title: "User Onboarding Workflow",
        description: "Complete user onboarding automation with email verification, profile setup, and welcome sequence",
        status: "draft" as const,
        priority: "high" as const,
        nodes: [
          {
            id: "user-signup",
            type: "trigger",
            name: "User Signup Trigger",
            position: { x: 100, y: 150 },
            data: { 
              triggerType: "webhook", 
              inputs: ["user_data", "email", "registration_source"] 
            }
          },
          {
            id: "email-verification",
            type: "agent",
            name: "Email Verification Agent",
            position: { x: 350, y: 150 },
            data: { 
              agentRole: "communication",
              description: "Send verification email and wait for confirmation",
              inputs: ["email", "user_data"],
              outputs: ["verification_status", "verified_email"]
            }
          },
          {
            id: "profile-setup",
            type: "agent",
            name: "Profile Setup Assistant",
            position: { x: 600, y: 150 },
            data: {
              agentRole: "assistant",
              description: "Guide user through profile completion",
              inputs: ["verified_email", "user_data"],
              outputs: ["profile_complete", "user_preferences"]
            }
          },
          {
            id: "welcome-sequence",
            type: "agent",
            name: "Welcome Email Sequence",
            position: { x: 850, y: 150 },
            data: {
              agentRole: "communication",
              description: "Send personalized welcome email sequence",
              inputs: ["profile_complete", "user_preferences"],
              outputs: ["onboarding_complete", "next_steps"]
            }
          }
        ],
        edges: [
          { id: "signup-to-verify", source: "user-signup", target: "email-verification" },
          { id: "verify-to-profile", source: "email-verification", target: "profile-setup" },
          { id: "profile-to-welcome", source: "profile-setup", target: "welcome-sequence" }
        ]
      }
    }
  ]

  const handleCreateFromTemplate = (template: any) => {
    setIsCreatingWorkflow(true)
    createWorkflowMutation.mutate(template.template)
    setShowTemplates(false) // Close modal after creating workflow
  }

  // Drag and drop functionality removed as requested by user

  // Calculate workflow stats
  const stats = workflows.reduce(
    (acc: any, workflow: Workflow) => {
      acc.total++
      acc[workflow.status]++
      return acc
    },
    { total: 0, draft: 0, active: 0, completed: 0, paused: 0 }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Workflow Engine
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Build and manage n8n-style automation workflows
        </p>
      </div>

      {/* Workflow Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Total Workflows"
          value={stats.total}
          status="info"
          description="All automation workflows"
          icon={Cog6ToothIcon}
        />
        <StatusCard
          title="Active"
          value={stats.active}
          status="success"
          description="Running workflows"
          icon={CheckCircleIcon}
        />
        <StatusCard
          title="Draft"
          value={stats.draft}
          status="pending"
          description="In development"
          icon={ClockIcon}
        />
        <StatusCard
          title="Completed"
          value={stats.completed}
          status="success"
          description="Completed workflows"
          icon={CheckCircleIcon}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Create New Workflow */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
        
          <div className="flex items-center mb-4">
            <div className="text-4xl mr-3">⚡</div>
            <Cog6ToothIcon className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Workflow Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Create n8n-style automation workflows with visual drag-and-drop editor.
          </p>
          <div className="space-y-3">
            <button 
              onClick={handleCreateWorkflow}
              disabled={isCreatingWorkflow || createWorkflowMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isCreatingWorkflow || createWorkflowMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  <span>Create New Workflow</span>
                </>
              )}
            </button>
            <button 
              onClick={handleOpenWorkflowBuilder}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              <span>Open n8n-Style Workflow Builder</span>
            </button>
          </div>
        </div>

        {/* Templates & Examples */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center mb-4">
            <div className="text-4xl mr-3">📋</div>
            <CheckCircleIcon className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Workflow Templates
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Start with pre-built templates for common automation scenarios.
          </p>
          <div className="flex space-x-3">
            <button 
              onClick={handleBrowseTemplates}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              <span>Templates</span>
            </button>
            <OverflowMenu
              items={[
                {
                  id: 'view-examples',
                  label: 'View Examples',
                  icon: BeakerIcon,
                  onClick: handleViewExamples
                },
                {
                  id: 'workflow-docs',
                  label: 'Documentation',
                  icon: CheckCircleIcon,
                  onClick: () => window.open('/workflow-editor.html', '_blank')
                },
                {
                  id: 'export-workflows',
                  label: 'Export All',
                  icon: ArrowRightIcon,
                  onClick: () => console.log('Export all workflows')
                }
              ]}
              buttonVariant="outline"
              buttonLabel=""
            />
          </div>
        </div>
      </div>


      {/* Existing Workflows List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Existing Workflows
          </h3>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Loading workflows...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <NoSymbolIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">Failed to load workflows</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-8">
              <Cog6ToothIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No workflows yet</h4>
              <p className="text-gray-600 dark:text-gray-300">
                Create your first automation workflow to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {workflows.map((workflow: Workflow) => (
                <div
                  key={workflow.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{workflow.title}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize
                      ${workflow.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}
                      ${workflow.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' : ''}
                      ${workflow.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                      ${workflow.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                    `}>
                      {workflow.status}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {workflow.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Edit workflow"
                        onClick={() => window.location.href = `/workflow-editor.html?id=${workflow.id}`}
                      >
                        <Cog6ToothIcon className="h-4 w-4" />
                      </button>
                      <OverflowMenu
                        items={[
                          {
                            id: `duplicate-${workflow.id}`,
                            label: 'Duplicate',
                            icon: DocumentDuplicateIcon,
                            onClick: () => {
                              const duplicatedWorkflow = {
                                ...workflow,
                                title: `${workflow.title} (Copy)`,
                                status: 'draft' as const
                              }
                              createWorkflowMutation.mutate(duplicatedWorkflow)
                            }
                          },
                          {
                            id: `export-${workflow.id}`,
                            label: 'Export',
                            icon: ArrowRightIcon,
                            onClick: () => console.log('Export workflow:', workflow.id)
                          },
                          {
                            id: `delete-${workflow.id}`,
                            label: 'Delete',
                            icon: TrashIcon,
                            variant: 'danger' as const,
                            onClick: () => handleDeleteWorkflow(workflow.id, workflow.title || 'Untitled Workflow'),
                            disabled: deleteWorkflowMutation.isPending
                          }
                        ]}
                        buttonVariant="outline"
                        buttonLabel=""
                        position="bottom-left"
                        className="ml-2"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Examples Browser */}
      {showExamples && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Example Workflows
            </h3>
            <button
              onClick={() => setShowExamples(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="p-6">
            {(() => {
              const examples = workflows.filter(w => 
                w.title && !w.title.toLowerCase().includes('test') && 
                !w.title.toLowerCase().includes('workflow 17')
              )
              
              if (examples.length === 0) {
                return (
                  <div className="text-center py-8">
                    <BeakerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No examples yet</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      Create some workflows first, then they will appear here as examples for others to learn from!
                    </p>
                  </div>
                )
              }

              return (
                <>
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-dashed border-green-300 dark:border-green-700">
                    <div className="flex items-center">
                      <BeakerIcon className="h-5 w-5 text-green-500 mr-2" />
                      <p className="text-sm text-green-700 dark:text-green-300">
                        <strong>Learn from Examples:</strong> Click on any example workflow to open it in the editor
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {examples.map((example) => (
                      <div
                        key={example.id}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-green-300 dark:hover:border-green-600"
                        onClick={() => window.location.href = `/workflow-editor.html?id=${example.id}`}
                      >
                        <div className="flex items-center mb-3">
                          <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
                          <h4 className="font-medium text-gray-900 dark:text-white">{example.title}</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {example.description || 'Production workflow example'}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize
                            ${example.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}
                            ${example.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' : ''}
                            ${example.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                          `}>
                            {example.status}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Click to open →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Templates Browser Modal */}
      <Modal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        title="Workflow Templates"
        size="xl"
        closeOnOverlayClick={true}
        closeOnEscape={true}
      >
        <ModalBody className="p-6">
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700">
            <div className="flex items-center">
              <DocumentDuplicateIcon className="h-5 w-5 text-blue-500 mr-2" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Start with Templates:</strong> Click "Use Template" to create a new workflow from any template below
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflowTemplates.map((template, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-300 dark:hover:border-blue-600"
              >
                <div className="flex items-center mb-3">
                  <CheckCircleIcon className="h-6 w-6 text-blue-500 mr-2" />
                  <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {template.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {template.category}
                  </span>
                  <button
                    onClick={() => handleCreateFromTemplate(template)}
                    disabled={isCreatingWorkflow || createWorkflowMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ModalBody>
      </Modal>

    </div>
  )
}

export default Workflows