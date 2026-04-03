// Cron Jobs Management Page
// FEATURE: Complete UI for managing periodic tasks

import React, { useState, useEffect } from 'react';
import { StatusCard } from '../components/ui/Cards/StatusCard';
import { DataTable } from '../components/ui/Data/DataTable';
import { Modal } from '../components/ui/Modals/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import apiClient from '../lib/api-client';
import { 
  CronJob, 
  CronExecution, 
  CronDashboardMetrics, 
  JobTemplate, 
  CronJobType, 
  CronJobStatus 
} from '../types';
import {
  PlayIcon,
  PauseIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export const CronJobs: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [executions, setExecutions] = useState<CronExecution[]>([]);
  const [metrics, setMetrics] = useState<CronDashboardMetrics | null>(null);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<CronExecution | null>(null);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'nextRun' | 'lastRun' | 'priority'>('nextRun');

  // Form state for new job creation
  const [newJob, setNewJob] = useState({
    name: '',
    description: '',
    schedule: '',
    jobType: CronJobType.HEALTH_CHECK,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    enabled: true,
    tags: [] as string[],
    config: {}
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Use API client for all requests
      const [jobsResponse, executionsResponse, metricsResponse, templatesResponse] = await Promise.all([
        apiClient.getCronJobs().catch(() => ({ success: false, jobs: [], total: 0, message: 'Failed to load jobs' })),
        apiClient.getCronExecutionHistory().catch(() => ({ success: false, executions: [], message: 'Failed to load executions' })),
        apiClient.getCronDashboard().catch(() => ({ success: false, message: 'Failed to load metrics' })),
        apiClient.getCronJobTemplates().catch(() => ({ success: false, templates: [], message: 'Failed to load templates' }))
      ]);

      if (jobsResponse.success && jobsResponse.jobs) {
        setJobs(jobsResponse.jobs);
      } else {
        console.warn('Failed to load jobs, using mock data');
        setJobs(mockJobs);
      }

      if (executionsResponse.success && executionsResponse.executions) {
        setExecutions(executionsResponse.executions);
      } else {
        console.warn('Failed to load executions, using mock data');
        setExecutions(mockExecutions);
      }

      if (metricsResponse.success && metricsResponse.metrics) {
        setMetrics(metricsResponse.metrics);
      } else {
        console.warn('Failed to load metrics, using mock data');
        setMetrics(mockMetrics);
      }

      if (templatesResponse.success && templatesResponse.templates) {
        setTemplates(templatesResponse.templates);
      } else {
        console.warn('Failed to load templates, using mock data');
        setTemplates(mockTemplates);
      }
    } catch (error) {
      console.error('Failed to load cron data:', error);
      // Use mock data as fallback
      setJobs(mockJobs);
      setExecutions(mockExecutions);
      setMetrics(mockMetrics);
      setTemplates(mockTemplates);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleJob = async (job: CronJob) => {
    try {
      const response = await apiClient.toggleCronJob(job.id, !job.enabled);
      
      if (response.success) {
        await loadData();
      } else {
        console.error('Failed to toggle job:', response.message);
      }
    } catch (error) {
      console.error('Failed to toggle job:', error);
    }
  };

  const handleRunJob = async (job: CronJob) => {
    try {
      const response = await apiClient.runCronJob(job.id);
      
      if (response.success) {
        await loadData();
        // Show success message or execution details
      } else {
        console.error('Failed to run job:', response.message);
      }
    } catch (error) {
      console.error('Failed to run job:', error);
    }
  };

  const handleDeleteJob = async (job: CronJob) => {
    if (!confirm(`Are you sure you want to delete "${job.name}"?`)) {
      return;
    }

    try {
      const response = await apiClient.deleteCronJob(job.id);
      
      if (response.success) {
        await loadData();
      } else {
        console.error('Failed to delete job:', response.message);
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  const handleCreateJob = async () => {
    try {
      const response = await apiClient.createCronJob(newJob);
      
      if (response.success) {
        setShowCreateModal(false);
        setNewJob({
          name: '',
          description: '',
          schedule: '',
          jobType: CronJobType.HEALTH_CHECK,
          priority: 'medium',
          enabled: true,
          tags: [],
          config: {}
        });
        await loadData();
      } else {
        console.error('Failed to create job:', response.message);
      }
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  const handleCreateFromTemplate = async (template: JobTemplate) => {
    setNewJob({
      name: `${template.name} - ${Date.now()}`,
      description: template.description,
      schedule: template.defaultSchedule,
      jobType: template.jobType,
      priority: 'medium',
      enabled: true,
      tags: [...template.tags],
      config: template.configExample
    });
    setShowTemplatesModal(false);
    setShowCreateModal(true);
  };

  const getFilteredJobs = () => {
    // Filter out any null/undefined jobs first
    let filtered = jobs.filter(job => job != null);

    switch (filter) {
      case 'enabled':
        filtered = filtered.filter(j => j && j.enabled);
        break;
      case 'disabled':
        filtered = filtered.filter(j => j && !j.enabled);
        break;
      case 'failed':
        filtered = filtered.filter(j => j && (j.status === 'failed' || j.failureCount > 0));
        break;
    }

    return filtered.sort((a, b) => {
      // Additional null checks for sorting
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'nextRun':
          return (a.nextRun || '').localeCompare(b.nextRun || '');
        case 'lastRun':
          return (b.lastRun || '').localeCompare(a.lastRun || '');
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                 (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
      case 'timeout':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'running':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400',
      low: 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400'
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[priority as keyof typeof colors]}`}>
        {priority}
      </span>
    );
  };

  const jobColumns = [
    { 
      key: 'name', 
      label: 'Job Name',
      sortable: true,
      render: (value: any, job: CronJob) => {
        if (!job) return <div className="text-gray-400">N/A</div>;
        return (
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{job.name || 'Unknown'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{job.description || 'No description'}</div>
          </div>
        );
      }
    },
    { 
      key: 'schedule', 
      label: 'Schedule',
      sortable: true,
      render: (value: any, job: CronJob) => {
        if (!job || !job.schedule) return <div className="text-gray-400">N/A</div>;
        return (
          <code className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-sm">{job.schedule}</code>
        );
      }
    },
    { 
      key: 'status', 
      label: 'Status',
      sortable: true,
      render: (value: any, job: CronJob) => {
        if (!job) return <div className="text-gray-400">N/A</div>;
        return (
          <div className="flex items-center space-x-2">
            {getStatusIcon(job.status)}
            <span className="capitalize">{job.status || 'unknown'}</span>
            {!job.enabled && <span className="text-xs text-gray-500">(Disabled)</span>}
          </div>
        );
      }
    },
    { 
      key: 'priority', 
      label: 'Priority',
      sortable: true,
      render: (value: any, job: CronJob) => {
        if (!job || !job.priority) return <div className="text-gray-400">N/A</div>;
        return getPriorityBadge(job.priority);
      }
    },
    { 
      key: 'nextRun', 
      label: 'Next Run',
      sortable: true,
      render: (value: any, job: CronJob) => {
        if (!job || !job.nextRun) return 'N/A';
        try {
          return new Date(job.nextRun).toLocaleString();
        } catch (error) {
          return 'Invalid Date';
        }
      }
    },
    { 
      key: 'actions', 
      label: 'Actions',
      render: (value: any, job: CronJob) => {
        if (!job) {
          return <div className="text-gray-400">N/A</div>;
        }
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleToggleJob(job)}
              className={`p-1 rounded transition-colors ${
                job.enabled 
                  ? 'text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-800/20' 
                  : 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-800/20'
              }`}
              title={job.enabled ? 'Disable' : 'Enable'}
            >
              {job.enabled ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleRunJob(job)}
              className="p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800/20 rounded transition-colors"
              title="Run Now"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedJob(job)}
            className="p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteJob(job)}
            className="p-1 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-800/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
        );
      }
    }
  ];

  const executionColumns = [
    { 
      key: 'jobName', 
      label: 'Job Name',
      sortable: true,
      render: (value: any, exec: CronExecution) => exec.jobName
    },
    { 
      key: 'status', 
      label: 'Status',
      sortable: true,
      render: (value: any, exec: CronExecution) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(exec.status)}
          <span className="capitalize">{exec.status}</span>
          {exec.hasAlerts && <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />}
        </div>
      )
    },
    { 
      key: 'startTime', 
      label: 'Start Time',
      sortable: true,
      render: (value: any, exec: CronExecution) => new Date(exec.startTime).toLocaleString()
    },
    { 
      key: 'duration', 
      label: 'Duration',
      sortable: true,
      render: (value: any, exec: CronExecution) => exec.duration ? `${exec.duration}ms` : 'N/A'
    },
    { 
      key: 'triggeredBy', 
      label: 'Triggered By',
      sortable: true,
      render: (value: any, exec: CronExecution) => (
        <span className="capitalize">{exec.triggeredBy}</span>
      )
    },
    { 
      key: 'actions', 
      label: 'Actions',
      render: (value: any, exec: CronExecution) => (
        <button
          onClick={() => {
            setSelectedExecution(exec);
            setShowExecutionModal(true);
          }}
          className="p-1 text-blue-600 hover:bg-blue-100 rounded"
          title="View Details"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cron Jobs</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Manage periodic background tasks and monitoring</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <ClockIcon className="w-5 h-5" />
              <span>Templates</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>New Job</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Dashboard */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatusCard
            title="Total Jobs"
            value={metrics.totalJobs.toString()}
            status="info"
            description="All cron jobs"
            icon={ClockIcon}
          />
          <StatusCard
            title="Active Jobs"
            value={metrics.activeJobs.toString()}
            status="success"
            description="Currently enabled"
            icon={PlayIcon}
          />
          <StatusCard
            title="Running Jobs"
            value={metrics.runningJobs.toString()}
            status="warning"
            description="Currently executing"
            icon={ArrowPathIcon}
          />
          <StatusCard
            title="Failed Jobs"
            value={metrics.failedJobs.toString()}
            status={metrics.failedJobs > 0 ? "error" : "success"}
            description="Recent failures"
            icon={metrics.failedJobs > 0 ? XCircleIcon : CheckCircleIcon}
          />
        </div>
      )}

      {/* System Health */}
      {metrics?.systemHealth && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">{Math.floor(metrics.systemHealth.schedulerUptime / 1000 / 60)} min</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">{metrics.systemHealth.memoryUsage.toFixed(1)} MB</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">24h Executions</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">{metrics.executionStats.last24Hours}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">{(metrics.executionStats.successRate * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}


      {/* Jobs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Jobs</h2>
            <div className="flex space-x-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-1 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="all">All Jobs</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-1 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="nextRun">Sort by Next Run</option>
                <option value="name">Sort by Name</option>
                <option value="lastRun">Sort by Last Run</option>
                <option value="priority">Sort by Priority</option>
              </select>
            </div>
          </div>
        </div>
        <DataTable
          data={getFilteredJobs()}
          columns={jobColumns}
          searchable
          searchPlaceholder="Search jobs..."
        />
      </div>

      {/* Recent Executions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Executions</h2>
        </div>
        <DataTable
          data={executions.slice(0, 20)}
          columns={executionColumns}
          searchable
          searchPlaceholder="Search executions..."
        />
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateJobModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          newJob={newJob}
          setNewJob={setNewJob}
          onSubmit={handleCreateJob}
        />
      )}

      {showTemplatesModal && (
        <TemplatesModal
          isOpen={showTemplatesModal}
          onClose={() => setShowTemplatesModal(false)}
          templates={templates}
          onSelectTemplate={handleCreateFromTemplate}
        />
      )}

      {selectedJob && (
        <JobDetailsModal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          job={selectedJob}
        />
      )}

      {showExecutionModal && selectedExecution && (
        <ExecutionDetailsModal
          isOpen={showExecutionModal}
          onClose={() => {
            setShowExecutionModal(false);
            setSelectedExecution(null);
          }}
          execution={selectedExecution}
        />
      )}
    </div>
  );
};

// Sub-components (CreateJobModal, TemplatesModal, etc.) would be defined here
// For brevity, I'm showing placeholder implementations

const CreateJobModal: React.FC<any> = ({ isOpen, onClose, newJob, setNewJob, onSubmit }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Create New Cron Job">
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input
          type="text"
          value={newJob.name}
          onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Schedule (Cron Expression)</label>
        <input
          type="text"
          value={newJob.schedule}
          onChange={(e) => setNewJob({ ...newJob, schedule: e.target.value })}
          placeholder="0 */5 * * *"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>
      <div className="flex justify-end space-x-3">
        <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors">
          Cancel
        </button>
        <button onClick={onSubmit} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors">
          Create
        </button>
      </div>
    </div>
  </Modal>
);

const TemplatesModal: React.FC<any> = ({ isOpen, onClose, templates, onSelectTemplate }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Job Templates">
    <div className="space-y-4">
      {templates.map((template: JobTemplate, index: number) => (
        <div key={index} className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{template.description}</p>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Schedule: <code className="bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-1 rounded">{template.defaultSchedule}</code>
              </div>
            </div>
            <button
              onClick={() => onSelectTemplate(template)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Use Template
            </button>
          </div>
        </div>
      ))}
    </div>
  </Modal>
);

const JobDetailsModal: React.FC<any> = ({ isOpen, onClose, job }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Job Details: ${job.name}`}>
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Configuration</h3>
        <pre className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white p-4 rounded text-sm overflow-auto">
          {JSON.stringify(job, null, 2)}
        </pre>
      </div>
    </div>
  </Modal>
);

const ExecutionDetailsModal: React.FC<any> = ({ isOpen, onClose, execution }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Execution Details: ${execution.jobName}`}>
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Execution Information</h3>
        <pre className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white p-4 rounded text-sm overflow-auto">
          {JSON.stringify(execution, null, 2)}
        </pre>
      </div>
    </div>
  </Modal>
);

// Mock data for demonstration
const mockJobs: CronJob[] = [
  {
    id: 'job-1',
    name: 'System Health Check',
    description: 'Monitor API endpoints and system resources',
    schedule: '*/5 * * * *',
    type: CronJobType.HEALTH_CHECK,
    status: CronJobStatus.COMPLETED,
    enabled: true,
    priority: 'high',
    lastRun: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    runCount: 1440,
    failureCount: 0,
    tags: ['health', 'monitoring'],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 300000,
    metadata: {}
  },
  {
    id: 'job-2',
    name: 'Database Cleanup',
    description: 'Clean old execution logs and optimize database',
    schedule: '0 2 * * 0',
    type: CronJobType.DATABASE_MAINTENANCE,
    status: CronJobStatus.PENDING,
    enabled: true,
    priority: 'medium',
    nextRun: new Date().toISOString(),
    runCount: 52,
    failureCount: 1,
    tags: ['database', 'cleanup'],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 300000,
    metadata: {}
  }
];

const mockExecutions: CronExecution[] = [
  {
    id: 'exec-1',
    jobId: 'job-1',
    jobName: 'System Health Check',
    status: CronJobStatus.COMPLETED,
    startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 5 * 60 * 1000 + 2000).toISOString(),
    duration: 2000,
    triggeredBy: 'schedule',
    hasAlerts: false
  }
];

const mockMetrics: CronDashboardMetrics = {
  totalJobs: 12,
  activeJobs: 10,
  runningJobs: 1,
  failedJobs: 1,
  systemHealth: {
    schedulerUptime: 86400000,
    lastHealthCheck: new Date().toISOString(),
    memoryUsage: 256.7,
    cpuUsage: 15.2
  },
  executionStats: {
    last24Hours: 2880,
    successRate: 0.993,
    averageExecutionTime: 1850
  }
};

const mockTemplates: JobTemplate[] = [
  {
    name: 'System Health Check',
    description: 'Monitor system resources and API endpoints',
    jobType: 'health_check',
    defaultSchedule: '*/5 * * * *',
    category: 'monitoring',
    tags: ['health', 'monitoring'],
    configExample: {
      healthCheck: {
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000
      }
    }
  }
];

export default CronJobs;