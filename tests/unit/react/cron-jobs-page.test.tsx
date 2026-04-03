import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CronJobs from '../../../src/react/pages/CronJobs';
import { CronJobType, CronJobStatus } from '../../../src/core/cron-types';

// Mock the API client
const mockApiClient = {
  getCronJobs: jest.fn(),
  getCronJobDetails: jest.fn(),
  createCronJob: jest.fn(),
  updateCronJob: jest.fn(),
  deleteCronJob: jest.fn(),
  executeCronJob: jest.fn(),
  toggleCronJob: jest.fn(),
  getCronDashboard: jest.fn(),
  getCronTemplates: jest.fn(),
  createFromTemplate: jest.fn(),
  validateCronSchedule: jest.fn(),
  getCronSystemStatus: jest.fn(),
  getCronExecutionHistory: jest.fn()
};

jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: mockApiClient
}));

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  Cog8ToothIcon: () => <div data-testid="cog-icon" />,
  PlusIcon: () => <div data-testid="plus-icon" />,
  PlayIcon: () => <div data-testid="play-icon" />,
  PauseIcon: () => <div data-testid="pause-icon" />,
  TrashIcon: () => <div data-testid="trash-icon" />,
  PencilIcon: () => <div data-testid="pencil-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  CheckCircleIcon: () => <div data-testid="check-icon" />,
  ExclamationTriangleIcon: () => <div data-testid="warning-icon" />,
  XCircleIcon: () => <div data-testid="error-icon" />
}));

// Mock LoadingSpinner
jest.mock('../../../src/react/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ size }: { size?: string }) {
    return <div data-testid="loading-spinner" data-size={size}>Loading...</div>;
  };
});

// Mock StatusCard and MetricCard
jest.mock('../../../src/react/components/ui/Cards/StatusCard', () => {
  return function MockStatusCard({ title, value, status, description }: any) {
    return (
      <div data-testid="status-card">
        <div data-testid="card-title">{title}</div>
        <div data-testid="card-value">{value}</div>
        <div data-testid="card-status">{status}</div>
        <div data-testid="card-description">{description}</div>
      </div>
    );
  };
});

jest.mock('../../../src/react/components/ui/Cards/MetricCard', () => {
  return function MockMetricCard({ title, value, color }: any) {
    return (
      <div data-testid="metric-card">
        <div data-testid="metric-title">{title}</div>
        <div data-testid="metric-value">{value}</div>
        <div data-testid="metric-color">{color}</div>
      </div>
    );
  };
});

describe('CronJobs Page', () => {
  let queryClient: QueryClient;

  const mockCronJobs = [
    {
      id: 'job-1',
      name: 'Daily Cleanup',
      description: 'Clean up temporary files daily',
      schedule: '0 2 * * *',
      type: CronJobType.CLEANUP,
      status: CronJobStatus.PENDING,
      enabled: true,
      priority: 'high',
      lastRun: '2024-04-01T02:00:00.000Z',
      nextRun: '2024-04-02T02:00:00.000Z',
      runCount: 15,
      failureCount: 1,
      tags: ['cleanup', 'daily']
    },
    {
      id: 'job-2',
      name: 'Weekly Reports',
      description: 'Generate weekly analytics reports',
      schedule: '0 8 * * 1',
      type: CronJobType.ANALYTICS,
      status: CronJobStatus.COMPLETED,
      enabled: true,
      priority: 'medium',
      lastRun: '2024-03-25T08:00:00.000Z',
      nextRun: '2024-04-01T08:00:00.000Z',
      runCount: 8,
      failureCount: 0,
      tags: ['analytics', 'weekly']
    },
    {
      id: 'job-3',
      name: 'System Optimization',
      description: 'Optimize system performance',
      schedule: '0 */6 * * *',
      type: CronJobType.OPTIMIZATION,
      status: CronJobStatus.RUNNING,
      enabled: true,
      priority: 'critical',
      runCount: 42,
      failureCount: 2,
      tags: ['optimization', 'performance']
    }
  ];

  const mockDashboardMetrics = {
    totalJobs: 3,
    activeJobs: 3,
    runningJobs: 1,
    failedJobs: 0,
    completedJobs: 1,
    pendingJobs: 1,
    systemHealth: {
      status: 'healthy',
      uptime: 86400,
      lastFailure: null
    },
    executionStats: {
      totalExecutions: 65,
      successfulExecutions: 62,
      failedExecutions: 3,
      averageDuration: 2500
    }
  };

  const mockTemplates = [
    {
      name: 'Database Cleanup',
      description: 'Clean up old database records',
      jobType: CronJobType.CLEANUP,
      defaultSchedule: '0 3 * * *',
      category: 'maintenance',
      tags: ['database', 'cleanup'],
      configExample: { retention: '30d' }
    },
    {
      name: 'Performance Monitoring',
      description: 'Monitor system performance metrics',
      jobType: CronJobType.MONITORING,
      defaultSchedule: '*/15 * * * *',
      category: 'monitoring',
      tags: ['performance', 'metrics'],
      configExample: { thresholds: { cpu: 80, memory: 85 } }
    }
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockApiClient.getCronJobs.mockResolvedValue({
      success: true,
      jobs: mockCronJobs,
      total: mockCronJobs.length,
      message: 'Retrieved cron jobs successfully'
    });

    mockApiClient.getCronDashboard.mockResolvedValue({
      success: true,
      metrics: mockDashboardMetrics,
      message: 'Retrieved dashboard metrics successfully'
    });

    mockApiClient.getCronTemplates.mockResolvedValue({
      success: true,
      templates: mockTemplates,
      message: 'Retrieved templates successfully'
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CronJobs />
      </QueryClientProvider>
    );
  };

  describe('Initial Rendering', () => {
    it('should render cron jobs page with header', async () => {
      renderComponent();

      expect(screen.getByText('Cron Jobs')).toBeInTheDocument();
      expect(screen.getByText(/Scheduled background tasks and automation/)).toBeInTheDocument();
    });

    it('should show loading spinner initially', () => {
      renderComponent();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should display dashboard metrics after loading', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByTestId('status-card')).toHaveLength(4);
        expect(screen.getAllByTestId('metric-card')).toHaveLength(4);
      });

      // Verify status cards
      expect(screen.getByText('Total Jobs')).toBeInTheDocument();
      expect(screen.getByText('Active Jobs')).toBeInTheDocument();
      expect(screen.getByText('Running Jobs')).toBeInTheDocument();
      expect(screen.getByText('System Status')).toBeInTheDocument();

      // Verify metric cards
      expect(screen.getByText('Executions')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('Avg Duration')).toBeInTheDocument();
      expect(screen.getByText('Failed Jobs')).toBeInTheDocument();
    });
  });

  describe('Cron Jobs List', () => {
    it('should display list of cron jobs', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Daily Cleanup')).toBeInTheDocument();
        expect(screen.getByText('Weekly Reports')).toBeInTheDocument();
        expect(screen.getByText('System Optimization')).toBeInTheDocument();
      });
    });

    it('should show job details correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Clean up temporary files daily')).toBeInTheDocument();
        expect(screen.getByText('0 2 * * *')).toBeInTheDocument();
        expect(screen.getByText('cleanup')).toBeInTheDocument();
        expect(screen.getByText('daily')).toBeInTheDocument();
      });
    });

    it('should display job status indicators', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('running')).toBeInTheDocument();
      });
    });

    it('should show job priority levels', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('critical')).toBeInTheDocument();
      });
    });

    it('should display execution counts', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/15 runs/)).toBeInTheDocument();
        expect(screen.getByText(/8 runs/)).toBeInTheDocument();
        expect(screen.getByText(/42 runs/)).toBeInTheDocument();
      });
    });
  });

  describe('Job Management Actions', () => {
    it('should have create new job button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create New Job')).toBeInTheDocument();
        expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
      });
    });

    it('should show action buttons for each job', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByTestId('play-icon')).toHaveLength(2); // For enabled non-running jobs
        expect(screen.getAllByTestId('pause-icon')).toHaveLength(1); // For running job
        expect(screen.getAllByTestId('pencil-icon')).toHaveLength(3); // Edit buttons
        expect(screen.getAllByTestId('trash-icon')).toHaveLength(3); // Delete buttons
      });
    });

    it('should handle job execution', async () => {
      mockApiClient.executeCronJob.mockResolvedValue({
        success: true,
        execution: {
          id: 'exec-123',
          status: CronJobStatus.COMPLETED
        },
        message: 'Job executed successfully'
      });

      renderComponent();

      await waitFor(() => {
        const executeButtons = screen.getAllByTestId('play-icon');
        fireEvent.click(executeButtons[0]);
      });

      expect(mockApiClient.executeCronJob).toHaveBeenCalledWith('job-1');
    });

    it('should handle job toggle (enable/disable)', async () => {
      mockApiClient.toggleCronJob.mockResolvedValue({
        success: true,
        message: 'Job disabled successfully'
      });

      renderComponent();

      await waitFor(() => {
        const pauseButtons = screen.getAllByTestId('pause-icon');
        fireEvent.click(pauseButtons[0]);
      });

      expect(mockApiClient.toggleCronJob).toHaveBeenCalledWith('job-3', false);
    });

    it('should handle job deletion with confirmation', async () => {
      // Mock window.confirm
      const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
      
      mockApiClient.deleteCronJob.mockResolvedValue({
        success: true,
        message: 'Job deleted successfully'
      });

      renderComponent();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('trash-icon');
        fireEvent.click(deleteButtons[0]);
      });

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this cron job?');
      expect(mockApiClient.deleteCronJob).toHaveBeenCalledWith('job-1');

      confirmSpy.mockRestore();
    });

    it('should not delete job if confirmation is cancelled', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false);

      renderComponent();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('trash-icon');
        fireEvent.click(deleteButtons[0]);
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockApiClient.deleteCronJob).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Filtering and Search', () => {
    it('should have filter controls', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search jobs/)).toBeInTheDocument();
        expect(screen.getByText('All Types')).toBeInTheDocument();
        expect(screen.getByText('All Statuses')).toBeInTheDocument();
        expect(screen.getByText('All Priorities')).toBeInTheDocument();
      });
    });

    it('should filter jobs by search term', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search jobs/);
        fireEvent.change(searchInput, { target: { value: 'cleanup' } });
      });

      // Should show filtered results
      await waitFor(() => {
        expect(screen.getByText('Daily Cleanup')).toBeInTheDocument();
        expect(screen.queryByText('Weekly Reports')).not.toBeInTheDocument();
      });
    });

    it('should filter jobs by type', async () => {
      renderComponent();

      await waitFor(() => {
        const typeFilter = screen.getByText('All Types');
        fireEvent.click(typeFilter);
        fireEvent.click(screen.getByText('Analytics'));
      });

      // Should show only analytics jobs
      await waitFor(() => {
        expect(screen.getByText('Weekly Reports')).toBeInTheDocument();
        expect(screen.queryByText('Daily Cleanup')).not.toBeInTheDocument();
      });
    });

    it('should filter jobs by status', async () => {
      renderComponent();

      await waitFor(() => {
        const statusFilter = screen.getByText('All Statuses');
        fireEvent.click(statusFilter);
        fireEvent.click(screen.getByText('Running'));
      });

      // Should show only running jobs
      await waitFor(() => {
        expect(screen.getByText('System Optimization')).toBeInTheDocument();
        expect(screen.queryByText('Daily Cleanup')).not.toBeInTheDocument();
      });
    });

    it('should filter jobs by priority', async () => {
      renderComponent();

      await waitFor(() => {
        const priorityFilter = screen.getByText('All Priorities');
        fireEvent.click(priorityFilter);
        fireEvent.click(screen.getByText('Critical'));
      });

      // Should show only critical priority jobs
      await waitFor(() => {
        expect(screen.getByText('System Optimization')).toBeInTheDocument();
        expect(screen.queryByText('Daily Cleanup')).not.toBeInTheDocument();
      });
    });
  });

  describe('Job Creation Modal', () => {
    it('should open create job modal when button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        const createButton = screen.getByText('Create New Job');
        fireEvent.click(createButton);
      });

      expect(screen.getByText('Create New Cron Job')).toBeInTheDocument();
      expect(screen.getByLabelText(/Job Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Schedule/)).toBeInTheDocument();
    });

    it('should have template selection option', async () => {
      renderComponent();

      await waitFor(() => {
        const createButton = screen.getByText('Create New Job');
        fireEvent.click(createButton);
      });

      expect(screen.getByText('Use Template')).toBeInTheDocument();
      expect(screen.getByText('Database Cleanup')).toBeInTheDocument();
      expect(screen.getByText('Performance Monitoring')).toBeInTheDocument();
    });

    it('should create job with form data', async () => {
      mockApiClient.createCronJob.mockResolvedValue({
        success: true,
        jobId: 'new-job-123',
        message: 'Job created successfully',
        nextRun: '2024-04-02T10:00:00.000Z'
      });

      renderComponent();

      await waitFor(() => {
        const createButton = screen.getByText('Create New Job');
        fireEvent.click(createButton);
      });

      // Fill form
      fireEvent.change(screen.getByLabelText(/Job Name/), {
        target: { value: 'New Test Job' }
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test job description' }
      });
      fireEvent.change(screen.getByLabelText(/Schedule/), {
        target: { value: '0 */4 * * *' }
      });

      // Submit form
      fireEvent.click(screen.getByText('Create Job'));

      expect(mockApiClient.createCronJob).toHaveBeenCalledWith({
        name: 'New Test Job',
        description: 'Test job description',
        schedule: '0 */4 * * *',
        jobType: expect.any(String),
        config: expect.any(Object),
        priority: expect.any(String),
        tags: expect.any(Array),
        enabled: true
      });
    });

    it('should create job from template', async () => {
      mockApiClient.createFromTemplate.mockResolvedValue({
        success: true,
        jobId: 'template-job-123',
        message: 'Job created from template successfully',
        nextRun: '2024-04-02T03:00:00.000Z'
      });

      renderComponent();

      await waitFor(() => {
        const createButton = screen.getByText('Create New Job');
        fireEvent.click(createButton);
      });

      // Select template
      fireEvent.click(screen.getByText('Database Cleanup'));
      
      // Fill required fields
      fireEvent.change(screen.getByLabelText(/Job Name/), {
        target: { value: 'My Database Cleanup' }
      });

      // Submit form
      fireEvent.click(screen.getByText('Create Job'));

      expect(mockApiClient.createFromTemplate).toHaveBeenCalledWith({
        templateName: 'Database Cleanup',
        name: 'My Database Cleanup',
        config: expect.any(Object)
      });
    });

    it('should validate schedule expression', async () => {
      mockApiClient.validateCronSchedule.mockResolvedValue({
        success: true,
        valid: true,
        description: 'Every 4 hours',
        nextRuns: ['2024-04-02T04:00:00.000Z', '2024-04-02T08:00:00.000Z'],
        message: 'Valid cron expression'
      });

      renderComponent();

      await waitFor(() => {
        const createButton = screen.getByText('Create New Job');
        fireEvent.click(createButton);
      });

      const scheduleInput = screen.getByLabelText(/Schedule/);
      fireEvent.change(scheduleInput, { target: { value: '0 */4 * * *' } });
      fireEvent.blur(scheduleInput);

      await waitFor(() => {
        expect(screen.getByText('Every 4 hours')).toBeInTheDocument();
      });

      expect(mockApiClient.validateCronSchedule).toHaveBeenCalledWith({
        schedule: '0 */4 * * *',
        nextRunCount: 3
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when jobs fail to load', async () => {
      mockApiClient.getCronJobs.mockRejectedValue(new Error('API Error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load cron jobs/)).toBeInTheDocument();
      });
    });

    it('should display error message when dashboard metrics fail to load', async () => {
      mockApiClient.getCronDashboard.mockRejectedValue(new Error('Dashboard Error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard metrics/)).toBeInTheDocument();
      });
    });

    it('should handle job action errors gracefully', async () => {
      mockApiClient.executeCronJob.mockRejectedValue(new Error('Execution failed'));

      renderComponent();

      await waitFor(() => {
        const executeButtons = screen.getAllByTestId('play-icon');
        fireEvent.click(executeButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to execute job/)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data periodically', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApiClient.getCronJobs).toHaveBeenCalledTimes(1);
        expect(mockApiClient.getCronDashboard).toHaveBeenCalledTimes(1);
      });

      // Fast-forward time to trigger refresh
      jest.advanceTimersByTime(30000); // 30 seconds

      await waitFor(() => {
        expect(mockApiClient.getCronJobs).toHaveBeenCalledTimes(2);
        expect(mockApiClient.getCronDashboard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderComponent();

      await waitFor(() => {
        const container = screen.getByTestId('cron-jobs-container');
        expect(container).toHaveClass('grid-cols-1');
      });
    });

    it('should show desktop layout for larger screens', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1280,
      });

      renderComponent();

      await waitFor(() => {
        const container = screen.getByTestId('cron-jobs-container');
        expect(container).toHaveClass('lg:grid-cols-3');
      });
    });
  });
});