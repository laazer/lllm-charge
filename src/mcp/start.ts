#!/usr/bin/env node
import { LLMChargeServer } from './llm-charge-server.js'

const config: any = {}
const server = new LLMChargeServer(config, process.cwd())
server.start().catch(console.error)
