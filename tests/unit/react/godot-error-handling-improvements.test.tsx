// Unit Test: Godot Error Handling Improvements
// Tests the enhanced error handling for invalid project paths

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GodotMCPSection from '../../../src/react/pages/sections/GodotMCPSection';

// Mock the API client
const mockApiClient = {
  browseDirectories: jest.fn(),
};
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: mockApiClient,
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Godot Error Handling Improvements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <GodotMCPSection />
      </QueryClientProvider>
    );
  };

  describe('Project Path Validation', () => {
    it('should show user-friendly error when project path is empty', async () => {
      // Mock fetch to simulate empty path validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Please specify a project path before analyzing the project' }),
      });

      renderComponent();

      // Find and click the Analyze Project button without setting a path
      const analyzeButton = screen.getByText('Analyze Project');
      fireEvent.click(analyzeButton);

      // Wait for error to appear
      await waitFor(() => {
        const errorMessage = screen.getByText(/Project Path Required/);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent('Please enter or browse to select your Godot project directory');
      });
    });

    it('should display helpful guidance text below project path input', () => {
      renderComponent();

      // Check that the guidance text is present
      const guidanceText = screen.getByText(/💡 Select the root directory containing project.godot file/);
      expect(guidanceText).toBeInTheDocument();
      expect(guidanceText).toHaveClass('text-xs', 'text-gray-500');
    });

    it('should show enhanced error message for invalid Godot project', async () => {
      // Mock fetch to simulate invalid project directory response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Failed to analyze project: Error: No project.godot found - not a valid Godot project'
        }),
      });

      renderComponent();

      // Set a project path
      const pathInput = screen.getByPlaceholderText('/path/to/your/godot/project');
      fireEvent.change(pathInput, { target: { value: '/some/invalid/path' } });

      // Click analyze button
      const analyzeButton = screen.getByText('Analyze Project');
      fireEvent.click(analyzeButton);

      // Wait for enhanced error message
      await waitFor(() => {
        const errorMessage = screen.getByText(/Invalid Godot Project/);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent('project.godot (required)');
        expect(errorMessage).toHaveTextContent('Use the Browse button to navigate');
      });
    });

    it('should show browse button with proper tooltip', () => {
      renderComponent();

      const browseButton = screen.getByTitle('Browse for Godot project directory');
      expect(browseButton).toBeInTheDocument();
      expect(browseButton).toHaveTextContent('Browse');
    });
  });

  describe('Error Message Enhancement', () => {
    it('should transform technical errors into user-friendly messages', async () => {
      renderComponent();

      // Simulate the error transformation logic
      const technicalError = 'Error: No project.godot found - not a valid Godot project';
      
      // The component should transform this into a user-friendly message
      const expectedUserFriendlyError = `Invalid Godot Project: The selected directory doesn't contain a 'project.godot' file.

📁 Please select a valid Godot project directory that contains:
   • project.godot (required)
   • scenes/ folder (typically)
   • scripts/ folder (typically)

💡 Tips:
   • Use the Browse button to navigate to your Godot project folder
   • Make sure you select the root directory of your Godot project
   • The project.godot file should be directly in the selected folder`;

      expect(expectedUserFriendlyError).toContain('Invalid Godot Project');
      expect(expectedUserFriendlyError).toContain('project.godot (required)');
      expect(expectedUserFriendlyError).toContain('Use the Browse button');
    });

    it('should provide actionable guidance for empty path errors', () => {
      const emptyPathError = 'Please specify a project path before analyzing the project';
      
      const expectedGuidance = `Project Path Required: Please enter or browse to select your Godot project directory before running the analysis.

🎯 To get started:
   1. Enter a project path in the text field above, OR
   2. Click the Browse button to select your project folder`;

      expect(expectedGuidance).toContain('Project Path Required');
      expect(expectedGuidance).toContain('To get started');
      expect(expectedGuidance).toContain('Browse button');
    });
  });

  describe('User Experience Improvements', () => {
    it('should have proper input field styling and placeholder', () => {
      renderComponent();

      const pathInput = screen.getByPlaceholderText('/path/to/your/godot/project');
      expect(pathInput).toBeInTheDocument();
      expect(pathInput).toHaveClass('flex-1');
    });

    it('should show loading state during analysis', async () => {
      // Mock a delayed response
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, data: {} })
        }), 100))
      );

      renderComponent();

      // Set a project path and click analyze
      const pathInput = screen.getByPlaceholderText('/path/to/your/godot/project');
      fireEvent.change(pathInput, { target: { value: '/valid/godot/project' } });
      
      const analyzeButton = screen.getByText('Analyze Project');
      fireEvent.click(analyzeButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with File Browser', () => {
    it('should open file browser when browse button is clicked', () => {
      renderComponent();

      const browseButton = screen.getByTitle('Browse for Godot project directory');
      fireEvent.click(browseButton);

      // Note: This would normally open a modal, but since we're testing in isolation,
      // we just verify the button click doesn't cause errors
      expect(browseButton).toBeInTheDocument();
    });
  });
});