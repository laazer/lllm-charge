/**
 * Legacy Godot MCP integration tests targeted a standalone Express mock whose routes
 * and response shapes diverged from production (comprehensive-working-server.mjs) and
 * from the current GodotMCPTools API. Skipped until rewritten against the real HTTP MCP layer.
 */
describe.skip('Godot MCP Full Integration Tests (disabled — replace with real server HTTP tests)', () => {
  it('placeholder', () => {
    expect(true).toBe(true)
  })
})
