import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../src/react/store/theme-store';
import { ProjectProvider } from '../../../src/react/store/project-store';
import { GodotMCPSection } from '../../../src/react/pages/sections/GodotMCPSection';
import '@testing-library/jest-dom';
// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
    apiClient: {
        getProject: jest.fn(),
        getProjects: jest.fn().mockResolvedValue([]),
    }
}));
const { apiClient } = require('../../../src/react/lib/api-client');
const mockProjectAnalysis = {
    success: true,
    data: {
        name: 'Space Explorer',
        path: '/home/user/godot-projects/space-explorer',
        version: '4.2',
        isValid: true,
        scenes: { total: 8, mainScene: 'Main.tscn', autoloadScenes: 2 },
        scripts: { total: 14, gdscriptCount: 12, csharpCount: 2, errors: 0 },
        assets: { textures: 20, sounds: 5, models: 3, animations: 10, totalSize: 42.5 },
        exportSettings: { platforms: ['Windows', 'Linux'], lastBuildTime: null, buildStatus: 'success' },
    },
};
const mockToolsList = {
    tools: [
        { name: 'godot_scene_analyzer', description: 'Analyze Godot scene files', category: 'Game Dev', isActive: true, lastUsed: null, usageCount: 0, inputSchema: { properties: { scenePath: { type: 'string' } } } },
        { name: 'gdscript_optimizer', description: 'Optimize GDScript code', category: 'Game Dev', isActive: true, lastUsed: null, usageCount: 0, inputSchema: { properties: { scriptPath: { type: 'string' } } } },
        { name: 'component_generator', description: 'Generate game components', category: 'Game Dev', isActive: true, lastUsed: null, usageCount: 0, inputSchema: { properties: { componentType: { type: 'string' } } } },
        { name: 'godot_project_analyzer', description: 'Analyze Godot project', category: 'Game Dev', isActive: true, lastUsed: null, usageCount: 5, inputSchema: { properties: {} } },
    ],
};
const mockMCPStatus = {
    isHealthy: true,
    tools: {
        total: 4, totalCalls: 12, errors: 0, errorRate: 0,
        mostUsed: [
            { name: 'godot_project_analyzer', count: 5, lastUsed: '2026-04-06T10:00:00Z' },
            { name: 'godot_scene_analyzer', count: 4, lastUsed: '2026-04-06T09:00:00Z' },
        ],
    },
};
function createFetchMock(overrides = {}) {
    return jest.fn((url) => {
        if (overrides[url])
            return Promise.resolve(overrides[url]);
        for (const [key, value] of Object.entries(overrides)) {
            if (url.includes(key))
                return Promise.resolve(value);
        }
        if (url.includes('/mcp/tools'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockToolsList) });
        if (url.includes('/mcp/status'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMCPStatus) });
        if (url.includes('/mcp/call/godot_project_analyzer'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProjectAnalysis) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
}
describe('Godot MCP Dashboard Verification', () => {
    let queryClient;
    const originalFetch = global.fetch;
    beforeEach(() => {
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        apiClient.getProject.mockResolvedValue({
            id: 'proj-1',
            codeGraphPath: '/home/user/godot-projects/space-explorer',
        });
        global.fetch = createFetchMock();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });
    const renderGodotDashboard = () => {
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
    describe('Dashboard Rendering with Real Data', () => {
        test('should render the dashboard header', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument();
            });
        });
        test('should fetch data from API endpoints on load', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith('/mcp/tools');
                expect(global.fetch).toHaveBeenCalledWith('/mcp/status');
            });
        });
        test('should call godot_project_analyzer with the selected project path', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                const calls = global.fetch.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_project_analyzer'));
                expect(calls.length).toBeGreaterThan(0);
                const body = JSON.parse(calls[0][1].body);
                expect(body.projectPath).toBe('/home/user/godot-projects/space-explorer');
            });
        });
        test('should display the real project name from API', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText(/Space Explorer/)).toBeInTheDocument();
            }, { timeout: 3000 });
        });
        test('should display real project statistics from API', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('4.2')).toBeInTheDocument();
                expect(screen.getByText('8')).toBeInTheDocument();
                expect(screen.getByText('14')).toBeInTheDocument();
                expect(screen.getByText('42.5 MB')).toBeInTheDocument();
            });
        });
    });
    describe('Performance Metrics', () => {
        test('should render performance metric cards', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Scene Load Time')).toBeInTheDocument();
                expect(screen.getByText('Memory Usage')).toBeInTheDocument();
                expect(screen.getByText('Build Status')).toBeInTheDocument();
                expect(screen.getByText('Asset Count')).toBeInTheDocument();
            });
        });
        test('should display asset breakdown', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Textures')).toBeInTheDocument();
                expect(screen.getByText('Audio Files')).toBeInTheDocument();
                expect(screen.getByText('3D Models')).toBeInTheDocument();
                expect(screen.getByText('Animations')).toBeInTheDocument();
            });
        });
    });
    describe('Tools from API', () => {
        test('should display tools fetched from /mcp/tools', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Godot Development Tools')).toBeInTheDocument();
                expect(screen.getAllByText('godot_scene_analyzer').length).toBeGreaterThan(0);
                expect(screen.getAllByText('gdscript_optimizer').length).toBeGreaterThan(0);
                expect(screen.getAllByText('component_generator').length).toBeGreaterThan(0);
                expect(screen.getAllByText('godot_project_analyzer').length).toBeGreaterThan(0);
            }, { timeout: 3000 });
        });
        test('should open tool modal on click', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Godot Development Tools')).toBeInTheDocument();
            }, { timeout: 3000 });
            // Click the first instance (in the tools table)
            const toolElements = screen.getAllByText('godot_scene_analyzer');
            fireEvent.click(toolElements[0]);
            await waitFor(() => {
                expect(screen.getByText(/Godot Tool/)).toBeInTheDocument();
            }, { timeout: 3000 });
        });
    });
    describe('Most Used Tools', () => {
        test('should display most used tools from /mcp/status', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Most Used Godot Tools')).toBeInTheDocument();
                expect(screen.getByText('5 uses')).toBeInTheDocument();
                expect(screen.getByText('4 uses')).toBeInTheDocument();
            });
        });
    });
    describe('Interactive Features', () => {
        test('Analyze Project button calls real API', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Analyze Project')).toBeInTheDocument();
            });
            const freshFetch = createFetchMock();
            global.fetch = freshFetch;
            fireEvent.click(screen.getByText('Analyze Project'));
            await waitFor(() => {
                const calls = freshFetch.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_project_analyzer'));
                expect(calls.length).toBeGreaterThan(0);
            });
        });
        test('Refresh button reloads data from APIs', async () => {
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('Refresh')).toBeInTheDocument();
            });
            const freshFetch = createFetchMock();
            global.fetch = freshFetch;
            fireEvent.click(screen.getByText('Refresh'));
            await waitFor(() => {
                expect(freshFetch).toHaveBeenCalledWith('/mcp/tools');
                expect(freshFetch).toHaveBeenCalledWith('/mcp/status');
            });
        });
    });
    describe('No Project State', () => {
        test('should show no-project message when analysis returns null', async () => {
            global.fetch = createFetchMock({
                '/mcp/call/godot_project_analyzer': { ok: true, json: () => Promise.resolve({ success: false }) },
            });
            apiClient.getProject.mockResolvedValue({ id: 'proj-1', codeGraphPath: '/tmp/bad-path' });
            renderGodotDashboard();
            await waitFor(() => {
                expect(screen.getByText('No Godot Project Selected')).toBeInTheDocument();
            });
        });
    });
});
