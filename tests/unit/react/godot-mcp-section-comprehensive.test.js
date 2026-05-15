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
const mockProjectData = {
    success: true,
    data: {
        name: 'Dungeon Crawler',
        path: '/projects/dungeon-crawler',
        version: '4.2',
        isValid: true,
        scenes: { total: 12, mainScene: 'World.tscn', autoloadScenes: 1 },
        scripts: { total: 20, gdscriptCount: 18, csharpCount: 2, errors: 1 },
        assets: { textures: 30, sounds: 8, models: 5, animations: 15, totalSize: 78.3 },
        exportSettings: { platforms: ['Windows', 'Linux', 'macOS'], lastBuildTime: null, buildStatus: 'success' },
    },
};
const mockToolsList = {
    tools: [
        { name: 'godot_scene_analyzer', description: 'Analyze Godot scene files for performance bottlenecks', category: 'Game Dev', isActive: true, lastUsed: '2026-04-06T08:00:00Z', usageCount: 10, inputSchema: { properties: { scenePath: { type: 'string' } } } },
        { name: 'gdscript_optimizer', description: 'Suggest performance improvements for GDScript', category: 'Game Dev', isActive: true, lastUsed: '2026-04-06T07:00:00Z', usageCount: 7, inputSchema: { properties: { scriptPath: { type: 'string' } } } },
        { name: 'component_generator', description: 'Generate common game components', category: 'Game Dev', isActive: true, lastUsed: null, usageCount: 3, inputSchema: { properties: { componentType: { type: 'string' } } } },
        { name: 'godot_project_analyzer', description: 'Analyze entire Godot project structure', category: 'Game Dev', isActive: true, lastUsed: '2026-04-06T09:00:00Z', usageCount: 15, inputSchema: { properties: {} } },
    ],
};
const mockMCPStatus = {
    isHealthy: true,
    tools: {
        total: 4, totalCalls: 35, errors: 1, errorRate: 2.86,
        mostUsed: [
            { name: 'godot_project_analyzer', count: 15, lastUsed: '2026-04-06T09:00:00Z' },
            { name: 'godot_scene_analyzer', count: 10, lastUsed: '2026-04-06T08:00:00Z' },
            { name: 'gdscript_optimizer', count: 7, lastUsed: '2026-04-06T07:00:00Z' },
        ],
    },
};
function createFetchMock(overrides = {}) {
    return jest.fn((url) => {
        for (const [key, value] of Object.entries(overrides)) {
            if (url.includes(key))
                return Promise.resolve(value);
        }
        if (url.includes('/mcp/tools'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockToolsList) });
        if (url.includes('/mcp/status'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMCPStatus) });
        if (url.includes('/mcp/call/godot_project_analyzer'))
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProjectData) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
}
describe('GodotMCPSection Comprehensive Tests', () => {
    let queryClient;
    const originalFetch = global.fetch;
    beforeEach(() => {
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        apiClient.getProject.mockResolvedValue({ id: 'proj-dc', codeGraphPath: '/projects/dungeon-crawler' });
        global.fetch = createFetchMock();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });
    const renderGodotSection = () => {
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
    describe('Component Initialization', () => {
        test('should render without crashing', () => {
            expect(() => renderGodotSection()).not.toThrow();
        });
        test('should display main header', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument();
            });
        });
    });
    describe('Project Information from API', () => {
        test('should display the project name from the API response', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText(/Dungeon Crawler/)).toBeInTheDocument();
            });
        });
        test('should display project statistics from the API', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('12')).toBeInTheDocument();
                expect(screen.getByText('20')).toBeInTheDocument();
                expect(screen.getByText('78.3 MB')).toBeInTheDocument();
            });
        });
        test('should pass project path from selected project to API', async () => {
            renderGodotSection();
            await waitFor(() => {
                const calls = global.fetch.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_project_analyzer'));
                expect(calls.length).toBeGreaterThan(0);
                const body = JSON.parse(calls[0][1].body);
                expect(body.projectPath).toBe('/projects/dungeon-crawler');
            });
        });
    });
    describe('Tools from API', () => {
        test('should display all four Godot tools from /mcp/tools', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getAllByText('godot_scene_analyzer').length).toBeGreaterThan(0);
                expect(screen.getAllByText('gdscript_optimizer').length).toBeGreaterThan(0);
                expect(screen.getAllByText('component_generator').length).toBeGreaterThan(0);
                expect(screen.getAllByText('godot_project_analyzer').length).toBeGreaterThan(0);
            }, { timeout: 3000 });
        });
        test('should display tool descriptions from the API', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('Analyze Godot scene files for performance bottlenecks')).toBeInTheDocument();
                expect(screen.getByText('Suggest performance improvements for GDScript')).toBeInTheDocument();
            });
        });
    });
    describe('Tool Modal with Real API Calls', () => {
        test('should open modal and show tool details', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('Godot Development Tools')).toBeInTheDocument();
            }, { timeout: 3000 });
            fireEvent.click(screen.getAllByText('godot_scene_analyzer')[0]);
            await waitFor(() => {
                expect(screen.getByText(/Godot Tool/)).toBeInTheDocument();
            }, { timeout: 3000 });
        });
        test('Run Tool button calls the API with projectPath', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('Godot Development Tools')).toBeInTheDocument();
            }, { timeout: 3000 });
            // Click on a tool row in the DataTable to open the modal
            // Find the <tr> element that contains 'godot_scene_analyzer' and click it
            const toolCells = screen.getAllByText('godot_scene_analyzer');
            const tableCell = toolCells.find(el => el.closest('tr'));
            expect(tableCell).toBeTruthy();
            fireEvent.click(tableCell.closest('tr'));
            await waitFor(() => {
                expect(screen.getByText('Run Tool')).toBeInTheDocument();
            }, { timeout: 3000 });
            const freshFetch = createFetchMock({
                '/mcp/call/godot_scene_analyzer': {
                    ok: true,
                    json: () => Promise.resolve({ success: true, data: { scenePath: './scenes/Main.tscn', nodeCount: 15, performance: 'Good' } }),
                },
            });
            global.fetch = freshFetch;
            fireEvent.click(screen.getByText('Run Tool'));
            await waitFor(() => {
                const calls = freshFetch.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_scene_analyzer'));
                expect(calls.length).toBe(1);
                const body = JSON.parse(calls[0][1].body);
                expect(body.projectPath).toBe('/projects/dungeon-crawler');
                expect(body.scenePath).toBe('./scenes/Main.tscn');
            }, { timeout: 3000 });
        });
    });
    describe('Most Used Tools from Real Status', () => {
        test('should show most used tools from /mcp/status in descending order', async () => {
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('Most Used Godot Tools')).toBeInTheDocument();
                expect(screen.getByText('15 uses')).toBeInTheDocument();
                expect(screen.getByText('10 uses')).toBeInTheDocument();
                expect(screen.getByText('7 uses')).toBeInTheDocument();
            });
        });
    });
    describe('Interactive Features', () => {
        test('Analyze Project button is functional', async () => {
            renderGodotSection();
            await waitFor(() => {
                const button = screen.getByText('Analyze Project');
                expect(button).toBeInTheDocument();
                expect(button.closest('button')).not.toBeDisabled();
            });
        });
        test('Refresh button is functional', async () => {
            renderGodotSection();
            await waitFor(() => {
                const button = screen.getByText('Refresh');
                expect(button).toBeInTheDocument();
                expect(button.closest('button')).not.toBeDisabled();
            });
        });
    });
    describe('Responsive Layout', () => {
        test('should display cards in a grid layout', async () => {
            renderGodotSection();
            await waitFor(() => {
                const grid = screen.getByText('Scene Load Time').closest('[class*="grid"]');
                expect(grid).toBeInTheDocument();
            });
        });
    });
    describe('Error Handling', () => {
        test('should show no-project message when analysis fails', async () => {
            global.fetch = createFetchMock({
                '/mcp/call/godot_project_analyzer': { ok: true, json: () => Promise.resolve({ success: false }) },
            });
            renderGodotSection();
            await waitFor(() => {
                expect(screen.getByText('No Godot Project Selected')).toBeInTheDocument();
            });
        });
    });
});
