// Intelligent documentation caching with automatic detection and 365-day expiration
// FEATURE: Auto-detects needed docs from code context and user queries
import * as path from 'path';
import * as fs from 'fs/promises';
export class SmartDocsCache {
    docsIntelligence;
    knowledgeBase;
    projectPath;
    config;
    downloadQueue = new Set();
    downloadInProgress = new Set();
    lastProjectScan;
    detectedPatterns = [];
    constructor(docsIntelligence, knowledgeBase, projectPath, config = {
        autoDownload: true,
        minConfidenceThreshold: 0.8,
        maxDocsPerSession: 5,
        backgroundDownload: true,
        expirationDays: 365
    }) {
        this.docsIntelligence = docsIntelligence;
        this.knowledgeBase = knowledgeBase;
        this.projectPath = projectPath;
        this.config = config;
    }
    async processQuery(query) {
        const detectedDocs = await this.detectNeededDocs(query);
        const missingDocs = await this.filterMissingDocs(detectedDocs);
        if (missingDocs.length > 0 && this.config.autoDownload) {
            await this.queueDocsForDownload(missingDocs);
        }
        return missingDocs;
    }
    async detectNeededDocs(query) {
        const patterns = await this.analyzeQueryPatterns(query);
        const projectPatterns = await this.analyzeProjectPatterns();
        // Combine query and project context
        const allPatterns = [...patterns, ...projectPatterns];
        const docsNeeded = [];
        for (const pattern of allPatterns) {
            if (pattern.confidence >= this.config.minConfidenceThreshold) {
                if (pattern.language)
                    docsNeeded.push(pattern.language);
                if (pattern.framework)
                    docsNeeded.push(pattern.framework);
                if (pattern.tools)
                    docsNeeded.push(...pattern.tools);
                if (pattern.libraries)
                    docsNeeded.push(...pattern.libraries);
            }
        }
        return [...new Set(docsNeeded)].slice(0, this.config.maxDocsPerSession);
    }
    async analyzeQueryPatterns(query) {
        const patterns = [];
        const lowerQuery = query.toLowerCase();
        // Language detection patterns
        const languagePatterns = {
            javascript: /\b(javascript|js|node|npm|yarn|es6|es2015|babel)\b/i,
            typescript: /\b(typescript|ts|tsc|tsconfig)\b/i,
            python: /\b(python|py|pip|conda|flask|django|fastapi)\b/i,
            react: /\b(react|jsx|tsx|usestate|useeffect|component|hooks?)\b/i,
            vue: /\b(vue|vuejs|nuxt|vite)\b/i,
            angular: /\b(angular|ng|typescript|component|service|directive)\b/i,
            go: /\b(golang?|go\s+mod|goroutine|channel)\b/i,
            rust: /\b(rust|cargo|rustup|crate)\b/i,
            docker: /\b(docker|dockerfile|container|image|compose)\b/i,
            kubernetes: /\b(kubernetes|k8s|kubectl|helm|pod|deployment)\b/i,
            git: /\b(git|github|gitlab|commit|branch|merge|rebase)\b/i,
            bash: /\b(bash|shell|script|command|terminal)\b/i
        };
        for (const [docName, pattern] of Object.entries(languagePatterns)) {
            const matches = lowerQuery.match(pattern);
            if (matches) {
                const confidence = this.calculatePatternConfidence(matches, query);
                if (this.isFramework(docName)) {
                    patterns.push({ framework: docName, confidence });
                }
                else if (this.isTool(docName)) {
                    patterns.push({ tools: [docName], confidence });
                }
                else {
                    patterns.push({ language: docName, confidence });
                }
            }
        }
        return patterns;
    }
    async analyzeProjectPatterns() {
        // Only scan project once per session or when files change
        if (this.lastProjectScan && (Date.now() - this.lastProjectScan.getTime() < 5 * 60 * 1000)) {
            return this.detectedPatterns;
        }
        const patterns = [];
        try {
            // Check package.json for dependencies
            const packageJsonPath = path.join(this.projectPath, 'package.json');
            if (await this.fileExists(packageJsonPath)) {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                for (const dep of Object.keys(deps)) {
                    const docName = this.mapDependencyToDoc(dep);
                    if (docName) {
                        patterns.push({
                            language: this.isLanguage(docName) ? docName : undefined,
                            framework: this.isFramework(docName) ? docName : undefined,
                            libraries: this.isLibrary(docName) ? [docName] : undefined,
                            confidence: 0.9
                        });
                    }
                }
            }
            // Check for common config files
            const configFiles = [
                { file: 'tsconfig.json', doc: 'typescript', confidence: 0.95 },
                { file: 'Dockerfile', doc: 'docker', confidence: 0.9 },
                { file: 'docker-compose.yml', doc: 'docker', confidence: 0.9 },
                { file: 'go.mod', doc: 'go', confidence: 0.95 },
                { file: 'Cargo.toml', doc: 'rust', confidence: 0.95 },
                { file: 'requirements.txt', doc: 'python', confidence: 0.9 },
                { file: 'Pipfile', doc: 'python', confidence: 0.9 },
                { file: '.gitignore', doc: 'git', confidence: 0.7 }
            ];
            for (const { file, doc, confidence } of configFiles) {
                if (await this.fileExists(path.join(this.projectPath, file))) {
                    if (this.isFramework(doc)) {
                        patterns.push({ framework: doc, confidence });
                    }
                    else if (this.isTool(doc)) {
                        patterns.push({ tools: [doc], confidence });
                    }
                    else {
                        patterns.push({ language: doc, confidence });
                    }
                }
            }
            this.detectedPatterns = patterns;
            this.lastProjectScan = new Date();
        }
        catch (error) {
            console.warn('Error analyzing project patterns:', error);
        }
        return patterns;
    }
    async filterMissingDocs(docs) {
        const status = await this.docsIntelligence.getDocumentationStatus();
        return docs.filter(doc => !status.installed.includes(doc));
    }
    async queueDocsForDownload(docs) {
        const newDocs = docs.filter(doc => !this.downloadQueue.has(doc) && !this.downloadInProgress.has(doc));
        newDocs.forEach(doc => this.downloadQueue.add(doc));
        if (this.config.backgroundDownload && newDocs.length > 0) {
            // Don't await - run in background
            this.processDownloadQueue().catch(error => {
                console.warn('Background download failed:', error);
            });
        }
    }
    async processDownloadQueue() {
        const downloaded = [];
        const failed = [];
        const toProcess = Array.from(this.downloadQueue).slice(0, this.config.maxDocsPerSession);
        for (const doc of toProcess) {
            this.downloadQueue.delete(doc);
            this.downloadInProgress.add(doc);
            try {
                console.log(`📚 Auto-downloading documentation: ${doc}`);
                await this.docsIntelligence.indexDocumentation([doc]);
                downloaded.push(doc);
                console.log(`✅ Successfully cached documentation: ${doc}`);
            }
            catch (error) {
                console.warn(`❌ Failed to download documentation for ${doc}:`, error);
                failed.push(doc);
            }
            finally {
                this.downloadInProgress.delete(doc);
            }
        }
        return { downloaded, failed };
    }
    async cleanupExpiredDocs() {
        const maxAge = this.config.expirationDays * 24 * 60 * 60 * 1000;
        const cleaned = await this.knowledgeBase.cleanupExpiredDocs(maxAge);
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired documentation entries`);
        }
    }
    async getQueueStatus() {
        return {
            queued: Array.from(this.downloadQueue),
            inProgress: Array.from(this.downloadInProgress)
        };
    }
    calculatePatternConfidence(matches, query) {
        const matchCount = matches.length;
        const queryLength = query.split(' ').length;
        // More matches in shorter queries = higher confidence
        let confidence = Math.min(1.0, (matchCount / queryLength) * 2);
        // Boost confidence for exact matches
        if (matches.some(match => match === match.toLowerCase())) {
            confidence += 0.2;
        }
        return Math.min(1.0, confidence);
    }
    mapDependencyToDoc(dep) {
        const depMap = {
            'react': 'react',
            '@types/react': 'react',
            'vue': 'vue',
            'angular': 'angular',
            'express': 'express',
            'fastapi': 'python',
            'flask': 'python',
            'django': 'python',
            'typescript': 'typescript',
            'eslint': 'javascript',
            'prettier': 'javascript',
            'webpack': 'javascript',
            'vite': 'vue',
            'next': 'react',
            'nuxt': 'vue'
        };
        return depMap[dep] || null;
    }
    isLanguage(doc) {
        return ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'csharp'].includes(doc);
    }
    isFramework(doc) {
        return ['react', 'vue', 'angular', 'express', 'fastapi', 'flask', 'django'].includes(doc);
    }
    isTool(doc) {
        return ['docker', 'kubernetes', 'git', 'bash', 'npm', 'yarn'].includes(doc);
    }
    isLibrary(doc) {
        return ['lodash', 'axios', 'moment', 'jquery'].includes(doc);
    }
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}
