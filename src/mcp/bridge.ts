#!/usr/bin/env node
/**
 * MCP Bridge — proxies stdio MCP protocol to the running HTTP server.
 *
 * Requires the comprehensive server to be running:
 *   npm run local   OR   npm run dev:server:comprehensive
 *
 * Nothing is printed to stdout (that channel is the JSON protocol).
 * All diagnostics go to stderr.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const BASE_URL = process.env.LLM_CHARGE_URL ?? 'http://localhost:3001'
const log = (...args: unknown[]) => process.stderr.write('[llm-charge] ' + args.join(' ') + '\n')

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

const server = new Server(
  { name: 'llm-charge', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const { tools } = await get<{ tools: any[] }>('/mcp/tools')
  return {
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
    })),
  }
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const result = await post<any>(`/mcp/call/${name}`, args ?? {})
  // Server returns { content: [...] } already in MCP format
  if (result?.content) return result
  // Wrap plain responses
  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
})

async function main() {
  // Verify the server is reachable before connecting stdio
  try {
    await get('/mcp/status')
    log(`Connected to ${BASE_URL}`)
  } catch {
    log(`ERROR: Cannot reach ${BASE_URL} — start the server first with: npm run local`)
    process.exit(1)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  log('Bridge ready')
}

main().catch(err => {
  log('Fatal:', err)
  process.exit(1)
})
