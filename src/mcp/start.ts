#!/usr/bin/env node
import { LLMChargeServer } from './llm-charge-server.js'

const server = new LLMChargeServer()
server.start().catch(console.error)
