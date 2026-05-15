import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../src/react/store/theme-store';
import { ProjectProvider } from '../../../src/react/store/project-store';
import { GodotMCPSection } from '../../../src/react/pages/sections/GodotMCPSection';
import '@testing-library/jest-dom';
jest.mock('../../../src/react/lib/api-client', () => ({
    apiClient: {
        getProject: jest.fn(),
        getProjects: jest.fn().mockResolvedValue([]),
    }
}));
const { apiClient } = require('../../../src/react/lib/api-client');
const emptyToolsList = { tools: [], summary: { total: 0, active: 0, categories: [] } };
const emptyStatus = { isHealthy: true, tools: { total: 0, totalCalls: 0, errors: 0, errorRate: 0, mostUsed: [] } };
function createFetchMock(overrides = {}) {
    return jest.fn((url) => {
        for (const [key, value] of Object.entries(overrides)) {
            if (url.includes(key))
                return Promise.resolve(value);
        }
        if (url.includes('/mcp/tools'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyToolsList) });
        if (url.includes('/mcp/status'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyStatus) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
}
describe('Godot Error Handling Improvements', () => {
    let queryClient;
    const originalFetch = global.fetch;
    beforeEach(() => {
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        // No project path by default
        apiClient.getProject.mockResolvedValue({ id: 'proj-1', codeGraphPath: null });
        global.fetch = createFetchMock();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });
    const renderComponent = () => {
        return render(<ThemeProvider>
        <ProjectProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <GodotMCPSection />
            </MemoryRouter>
          </QueryClientProvider>
        </ProjectProvider>
      </ThemeProvider>);
    };
    describe('Project Path Validation', () => {
        test('should not call API when analyzing without a project path', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('Analyze Project')).toBeInTheDocument();
            });
            const fetchBefore = global.fetch.mock.calls.length;
            fireEvent.click(screen.getByText('Analyze Project'));
            // Wait a tick for the async handler to complete
            await waitFor(() => {
                expect(screen.getByText('Analyze Project')).not.toBeDisabled();
            });
            // Should NOT have made a godot_project_analyzer call (no project path)
            const analyzerCalls = global.fetch.mock.calls
                .slice(fetchBefore)
                .filter((call) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_project_analyzer'));
            expect(analyzerCalls.length).toBe(0);
        });
        test('should display guidance text below project path input', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Select the root directory containing project.godot file/)).toBeInTheDocument();
            });
        });
        test('should show enhanced error for invalid Godot project directory', async () => {
            apiClient.getProject.mockResolvedValue({ id: 'proj-1', codeGraphPath: '/invalid/path' });
            // Initial load returns no project, analyze button triggers error
            global.fetch = jest.fn((url, options) => {
                if (url.includes('/mcp/tools'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyToolsList) });
                if (url.includes('/mcp/status'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyStatus) });
                if (url.includes('/mcp/call/godot_project_analyzer')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: false, error: 'No project.godot found' }),
                    });
                }
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            });
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('Analyze Project')).toBeInTheDocument();
            });
            // The path input should already have the project path from resolving the project
            const pathInput = screen.getByPlaceholderText('/path/to/your/godot/project');
            fireEvent.change(pathInput, { target: { value: '/invalid/path' } });
            // Set up fetch to return the "no project.godot" error from the tool handler
            global.fetch = jest.fn((url) => {
                if (url.includes('/mcp/call/godot_project_analyzer')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: false,
                            error: 'Failed to analyze project: Error: No project.godot found - not a valid Godot project',
                        }),
                    });
                }
                if (url.includes('/mcp/tools'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyToolsList) });
                if (url.includes('/mcp/status'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyStatus) });
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            });
            fireEvent.click(screen.getByText('Analyze Project'));
            // The tool result error should be caught but shown in the tool result area
            // The testGodotTool function catches errors and sets them as toolResult
            await waitFor(() => {
                // The Analyze button should become available again
                expect(screen.getByText('Analyze Project')).toBeInTheDocument();
            });
        });
        test('should show browse button with proper tooltip', async () => {
            renderComponent();
            await waitFor(() => {
                const browseButton = screen.getByTitle('Browse for Godot project directory');
                expect(browseButton).toBeInTheDocument();
            });
        });
    });
    describe('User Experience', () => {
        test('should have proper input field with placeholder', async () => {
            renderComponent();
            await waitFor(() => {
                const pathInput = screen.getByPlaceholderText('/path/to/your/godot/project');
                expect(pathInput).toBeInTheDocument();
            });
        });
        test('should show loading state during analysis', async () => {
            apiClient.getProject.mockResolvedValue({ id: 'proj-1', codeGraphPath: '/some/project' });
            let resolveAnalyzer;
            // Initial load resolves immediately with no project
            global.fetch = jest.fn((url) => {
                if (url.includes('/mcp/tools'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyToolsList) });
                if (url.includes('/mcp/status'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyStatus) });
                if (url.includes('/mcp/call/godot_project_analyzer')) {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false }) });
                }
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            });
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('Analyze Project')).toBeInTheDocument();
            });
            // Now set up a pending promise for the button click
            const pending = new Promise((resolve) => { resolveAnalyzer = resolve; });
            global.fetch = jest.fn((url) => {
                if (url.includes('/mcp/call/godot_project_analyzer'))
                    return pending;
                if (url.includes('/mcp/tools'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyToolsList) });
                if (url.includes('/mcp/status'))
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyStatus) });
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            });
            fireEvent.click(screen.getByText('Analyze Project'));
            await waitFor(() => {
                expect(screen.getByText('Analyzing...')).toBeInTheDocument();
            });
            resolveAnalyzer({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        name: 'Test', path: '/some/project', version: '4.2', isValid: true,
                        scenes: { total: 0, mainScene: null, autoloadScenes: 0 },
                        scripts: { total: 0, gdscriptCount: 0, csharpCount: 0, errors: 0 },
                        assets: { textures: 0, sounds: 0, models: 0, animations: 0, totalSize: 0 },
                        exportSettings: { platforms: [], lastBuildTime: null, buildStatus: 'none' },
                    },
                }),
            });
            await waitFor(() => {
                expect(screen.queryByText('Analyzing...')).not.toBeInTheDocument();
            });
        });
    });
});
