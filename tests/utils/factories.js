/**
 * Test Data Factories
 *
 * Reusable factory functions for creating mock objects in tests.
 * Each factory returns a valid default object that can be overridden with partial data.
 */
let counter = 0;
function nextId(prefix) {
    counter++;
    return `${prefix}-${Date.now()}-${counter}`;
}
const NOW = '2026-04-01T12:00:00.000Z';
export function createMockProject(overrides = {}) {
    return {
        id: nextId('proj'),
        name: 'Test Project',
        key: 'TESTPROJ',
        description: 'A test project',
        type: 'software',
        lead: 'Test Lead',
        codeGraphPath: '/test/project',
        createdAt: NOW,
        updatedAt: NOW,
        data: {},
        ...overrides,
    };
}
export function createMockSpec(overrides = {}) {
    return {
        id: nextId('spec'),
        title: 'Test Spec',
        description: 'A test specification',
        status: 'active',
        priority: 'medium',
        projectId: null,
        tags: ['test'],
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}
export function createMockSkillSpec(overrides = {}) {
    return createMockSpec({
        title: 'Test Skill',
        description: 'A test skill capability',
        tags: ['skill', 'test', 'capability'],
        ...overrides,
    });
}
export function createMockAgent(overrides = {}) {
    return {
        id: nextId('agent'),
        name: 'Test Agent',
        description: 'A test agent',
        primaryRole: 'analyst',
        capabilities: { reasoning: 0.8, creativity: 0.7, technical: 0.9, communication: 0.75 },
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}
export function createMockReasoningLog(overrides = {}) {
    return {
        timestamp: NOW,
        prompt: 'Test prompt',
        response: 'Test response',
        complexity: 'medium',
        localAttempted: true,
        localSuccess: true,
        fallbackReason: null,
        provider: 'lm-studio',
        responseTime: 1500,
        cost: 0,
        tokensUsed: 150,
        skillsUsed: [],
        ...overrides,
    };
}
export function createMockMemoryNote(overrides = {}) {
    return {
        id: nextId('note'),
        title: 'Test Note',
        content: 'Test note content',
        tags: ['test'],
        projectId: 'main-project',
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}
export function createMockCodeGraphStatus(overrides = {}) {
    return {
        totalNodes: 3190,
        totalEdges: 12175,
        filesIndexed: 196,
        nodesByKind: { method: 1638, import: 633, interface: 301, function: 154, class: 75 },
        edgesByKind: { calls: 6868, contains: 2987, imports: 2320 },
        isAvailable: true,
        dbPath: '/test/.codegraph/codegraph.db',
        ...overrides,
    };
}
export function createMockFetchResponse(data, options = {}) {
    return {
        ok: options.ok ?? true,
        status: options.status ?? 200,
        json: async () => data,
    };
}
/**
 * Create multiple mock objects at once.
 */
export function createMockProjects(count, overrides = {}) {
    return Array.from({ length: count }, (_, i) => createMockProject({ name: `Project ${i + 1}`, key: `PROJ${i + 1}`, ...overrides }));
}
export function createMockSpecs(count, overrides = {}) {
    return Array.from({ length: count }, (_, i) => createMockSpec({ title: `Spec ${i + 1}`, ...overrides }));
}
export function createMockReasoningLogs(count, overrides = {}) {
    return Array.from({ length: count }, (_, i) => createMockReasoningLog({
        prompt: `Test prompt ${i + 1}`,
        localSuccess: i % 3 !== 0, // 2/3 local success
        provider: i % 3 === 0 ? 'openai' : 'lm-studio',
        responseTime: 1000 + i * 200,
        ...overrides,
    }));
}
