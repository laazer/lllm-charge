// RLM integration engine for recursive reasoning with local-first approach
// FEATURE: Recursive language model execution with environment isolation
import { PythonShell } from 'python-shell';
import * as path from 'path';
import * as fs from 'fs/promises';
export class RLMEngine {
    config;
    sessions;
    pythonPath;
    rlmScript;
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.pythonPath = 'python3';
        this.rlmScript = path.join(__dirname, '../../assets/rlm_bridge.py');
    }
    async initialize() {
        await this.setupRLMBridge();
        await this.testPythonEnvironment();
    }
    async startReasoningSession(query, context) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            query,
            iterations: [],
            environment: this.config.environment,
            startTime: new Date(),
            status: 'running'
        };
        this.sessions.set(sessionId, session);
        try {
            const result = await this.executeRLMQuery(sessionId, query, context);
            session.status = 'completed';
            session.endTime = new Date();
            session.result = result;
            return result;
        }
        catch (error) {
            session.status = 'failed';
            session.endTime = new Date();
            throw error;
        }
    }
    async executeRLMQuery(sessionId, query, context) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Session ${sessionId} not found`);
        const rlmConfig = {
            backend: 'ollama',
            backend_kwargs: {
                base_url: 'http://localhost:11434',
                model_name: 'llama3.2'
            },
            environment: this.config.environment,
            environment_kwargs: this.getEnvironmentKwargs(),
            max_depth: this.config.maxDepth,
            timeout_ms: this.config.timeoutMs,
            max_iterations: this.config.maxIterations,
            verbose: true
        };
        const fullPrompt = context ? `Context:\n${context}\n\nQuery: ${query}` : query;
        return new Promise((resolve, reject) => {
            const options = {
                mode: 'text',
                pythonPath: this.pythonPath,
                scriptPath: path.dirname(this.rlmScript),
                args: [
                    '--config', JSON.stringify(rlmConfig),
                    '--query', fullPrompt,
                    '--session-id', sessionId
                ]
            };
            PythonShell.run(path.basename(this.rlmScript), options, (err, results) => {
                if (err) {
                    reject(new Error(`RLM execution failed: ${err.message}`));
                }
                else {
                    const output = results?.join('\n') || '';
                    this.parseRLMOutput(sessionId, output);
                    resolve(output);
                }
            });
        });
    }
    async getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    async listSessions() {
        return Array.from(this.sessions.values());
    }
    async stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.status === 'running') {
            session.status = 'timeout';
            session.endTime = new Date();
        }
    }
    async setupRLMBridge() {
        const bridgeScript = `
#!/usr/bin/env python3
import sys
import json
import argparse
from datetime import datetime

# Import the RLM library from the rlm project
sys.path.insert(0, '${path.join(__dirname, '../../rlm')}')

from rlm import RLM
from rlm.logger import RLMLogger

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True, help='RLM configuration JSON')
    parser.add_argument('--query', required=True, help='Query to execute')
    parser.add_argument('--session-id', required=True, help='Session identifier')
    
    args = parser.parse_args()
    
    try:
        config = json.loads(args.config)
        
        # Create RLM instance with local-first configuration
        rlm = RLM(
            backend=config.get('backend', 'ollama'),
            backend_kwargs=config.get('backend_kwargs', {}),
            environment=config.get('environment', 'local'),
            environment_kwargs=config.get('environment_kwargs', {}),
            logger=RLMLogger(log_dir=f".llm-charge/sessions/{args.session_id}")
        )
        
        # Execute the query
        completion = rlm.completion(args.query)
        
        # Output results
        result = {
            'response': completion.response,
            'metadata': {
                'model': completion.model,
                'tokens': completion.usage_summary.total_tokens if completion.usage_summary else 0,
                'iterations': len(completion.metadata.iterations) if completion.metadata else 0,
                'cost': completion.usage_summary.estimated_cost if completion.usage_summary else 0
            }
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
`;
        await fs.writeFile(this.rlmScript, bridgeScript);
        await fs.chmod(this.rlmScript, 0o755);
    }
    async testPythonEnvironment() {
        return new Promise((resolve, reject) => {
            PythonShell.run('--version', {}, (err, results) => {
                if (err) {
                    reject(new Error('Python environment not available'));
                }
                else {
                    console.log('Python environment ready:', results?.[0]);
                    resolve();
                }
            });
        });
    }
    getEnvironmentKwargs() {
        switch (this.config.environment) {
            case 'docker':
                return {
                    image: 'python:3.11-slim',
                    memory_limit: '2g',
                    timeout: 300
                };
            case 'modal':
                return {
                    image: 'modal-labs/modal-python:3.11',
                    memory_gb: 2,
                    timeout_min: 5
                };
            case 'e2b':
                return {
                    template: 'base',
                    timeout_min: 5
                };
            default:
                return {};
        }
    }
    parseRLMOutput(sessionId, output) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        try {
            const result = JSON.parse(output);
            if (result.error) {
                throw new Error(result.error);
            }
            // Parse iterations if available in metadata
            if (result.metadata && result.metadata.iterations) {
                session.iterations = result.metadata.iterations.map((iter, index) => ({
                    step: index + 1,
                    prompt: iter.prompt || '',
                    response: iter.response || '',
                    codeBlocks: this.extractCodeBlocks(iter.response || ''),
                    executions: iter.executions || [],
                    duration: iter.duration || 0
                }));
            }
        }
        catch (error) {
            console.warn('Failed to parse RLM output:', error);
        }
    }
    extractCodeBlocks(text) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks = [];
        let match;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            const language = match[1] || 'text';
            const code = match[2].trim();
            blocks.push({
                language,
                code,
                isExecutable: ['python', 'javascript', 'typescript', 'bash', 'sh'].includes(language.toLowerCase())
            });
        }
        return blocks;
    }
    generateSessionId() {
        return `rlm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
