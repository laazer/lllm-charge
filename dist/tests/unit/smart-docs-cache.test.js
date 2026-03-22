// Unit tests for SmartDocsCache
import { SmartDocsCache } from '../../src/intelligence/smart-docs-cache';
import { TEST_CONFIG } from '../setup';
import * as fs from 'fs/promises';
import * as path from 'path';
describe('SmartDocsCache', () => {
    let smartCache;
    let mockDocsIntelligence;
    let mockKnowledgeBase;
    let testProjectDir;
    beforeEach(async () => {
        testProjectDir = path.join(TEST_CONFIG.TEST_CACHE_DIR, 'smart-cache-test');
        await fs.mkdir(testProjectDir, { recursive: true });
        // Create mock dependencies
        mockKnowledgeBase = {
            initialize: jest.fn(),
            store: jest.fn(),
            searchSemantic: jest.fn(),
            updateLastAccessed: jest.fn(),
            cleanupExpiredDocs: jest.fn().mockResolvedValue(5),
            cleanup: jest.fn()
        };
        mockDocsIntelligence = {
            initialize: jest.fn(),
            indexDocumentation: jest.fn(),
            getDocumentationStatus: jest.fn().mockResolvedValue({
                installed: ['javascript', 'react'],
                available: ['javascript', 'react', 'typescript', 'python', 'docker'],
                storage_size: 1024 * 1024 * 10 // 10MB
            }),
            searchDocs: jest.fn()
        };
        smartCache = new SmartDocsCache(mockDocsIntelligence, mockKnowledgeBase, testProjectDir, {
            autoDownload: true,
            minConfidenceThreshold: 0.7,
            maxDocsPerSession: 3,
            backgroundDownload: true,
            expirationDays: 365
        });
    });
    afterEach(async () => {
        try {
            await fs.rm(testProjectDir, { recursive: true });
        }
        catch (error) {
            // Ignore cleanup errors
        }
    });
    describe('Query Pattern Detection', () => {
        it('should detect React documentation needs', async () => {
            const queries = [
                'How to use React useState hook?',
                'React useEffect dependencies',
                'JSX component syntax'
            ];
            for (const query of queries) {
                const detectedDocs = await smartCache.detectNeededDocs(query);
                expect(detectedDocs).toContain('react');
            }
        });
        it('should detect TypeScript documentation needs', async () => {
            const queries = [
                'TypeScript interface syntax',
                'TS generic constraints',
                'TypeScript union types'
            ];
            for (const query of queries) {
                const detectedDocs = await smartCache.detectNeededDocs(query);
                expect(detectedDocs).toContain('typescript');
            }
        });
        it('should detect Docker documentation needs', async () => {
            const queries = [
                'Docker compose up command',
                'Dockerfile multi-stage builds',
                'Container networking'
            ];
            for (const query of queries) {
                const detectedDocs = await smartCache.detectNeededDocs(query);
                expect(detectedDocs).toContain('docker');
            }
        });
        it('should detect multiple technologies in one query', async () => {
            const query = 'How to containerize a React TypeScript app with Docker?';
            const detectedDocs = await smartCache.detectNeededDocs(query);
            expect(detectedDocs).toEqual(expect.arrayContaining(['react', 'typescript', 'docker']));
        });
        it('should respect confidence thresholds', async () => {
            // Create instance with high confidence threshold
            const highThresholdCache = new SmartDocsCache(mockDocsIntelligence, mockKnowledgeBase, testProjectDir, {
                autoDownload: true,
                minConfidenceThreshold: 0.95,
                maxDocsPerSession: 5,
                backgroundDownload: true,
                expirationDays: 365
            });
            const vagueQuery = 'some development question';
            const detectedDocs = await highThresholdCache.detectNeededDocs(vagueQuery);
            expect(detectedDocs.length).toBeLessThanOrEqual(1); // Should detect very few with high threshold
        });
    });
    describe('Project Pattern Detection', () => {
        it('should detect Node.js project from package.json', async () => {
            await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
                dependencies: {
                    'react': '^18.0.0',
                    'typescript': '^5.0.0',
                    'express': '^4.18.0'
                }
            }));
            const detectedDocs = await smartCache.detectNeededDocs('general question');
            expect(detectedDocs).toEqual(expect.arrayContaining(['react', 'typescript', 'express']));
        });
        it('should detect TypeScript project from tsconfig.json', async () => {
            await fs.writeFile(path.join(testProjectDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
            const detectedDocs = await smartCache.detectNeededDocs('development question');
            expect(detectedDocs).toContain('typescript');
        });
        it('should detect Docker usage from Dockerfile', async () => {
            await fs.writeFile(path.join(testProjectDir, 'Dockerfile'), 'FROM node:18\nCOPY . .\nRUN npm install');
            const detectedDocs = await smartCache.detectNeededDocs('deployment question');
            expect(detectedDocs).toContain('docker');
        });
        it('should detect Go project from go.mod', async () => {
            await fs.writeFile(path.join(testProjectDir, 'go.mod'), 'module example.com/myapp\ngo 1.19');
            const detectedDocs = await smartCache.detectNeededDocs('coding question');
            expect(detectedDocs).toContain('go');
        });
    });
    describe('Auto-Download Queue Management', () => {
        it('should queue missing docs for download', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: ['javascript'],
                available: ['javascript', 'react', 'typescript'],
                storage_size: 1024
            });
            const missingDocs = await smartCache.processQuery('React TypeScript components');
            expect(missingDocs).toEqual(expect.arrayContaining(['react', 'typescript']));
        });
        it('should not queue already installed docs', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: ['react', 'typescript'],
                available: ['react', 'typescript', 'python'],
                storage_size: 1024
            });
            const missingDocs = await smartCache.processQuery('React TypeScript components');
            expect(missingDocs).not.toContain('react');
            expect(missingDocs).not.toContain('typescript');
        });
        it('should respect max docs per session limit', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react', 'vue', 'angular', 'typescript', 'python'],
                storage_size: 1024
            });
            const query = 'React Vue Angular TypeScript Python development';
            const missingDocs = await smartCache.processQuery(query);
            expect(missingDocs.length).toBeLessThanOrEqual(3); // maxDocsPerSession is 3
        });
        it('should track queue status correctly', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react', 'typescript'],
                storage_size: 1024
            });
            await smartCache.processQuery('React TypeScript question');
            const status = await smartCache.getQueueStatus();
            expect(status.queued.length).toBeGreaterThan(0);
            expect(status.inProgress.length).toBe(0); // Not processed yet
        });
    });
    describe('Background Download Processing', () => {
        it('should process download queue', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react'],
                storage_size: 1024
            });
            mockDocsIntelligence.indexDocumentation.mockResolvedValue();
            // Queue some docs
            await smartCache.processQuery('React development');
            // Process the queue
            const result = await smartCache.processDownloadQueue();
            expect(result.downloaded.length).toBeGreaterThan(0);
            expect(result.failed.length).toBe(0);
            expect(mockDocsIntelligence.indexDocumentation).toHaveBeenCalled();
        });
        it('should handle download failures gracefully', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react'],
                storage_size: 1024
            });
            mockDocsIntelligence.indexDocumentation.mockRejectedValue(new Error('Download failed'));
            await smartCache.processQuery('React development');
            const result = await smartCache.processDownloadQueue();
            expect(result.failed.length).toBeGreaterThan(0);
            expect(result.downloaded.length).toBe(0);
        });
        it('should not download same doc multiple times simultaneously', async () => {
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react'],
                storage_size: 1024
            });
            // Queue the same doc multiple times
            await smartCache.processQuery('React question 1');
            await smartCache.processQuery('React question 2');
            const status = await smartCache.getQueueStatus();
            const reactQueued = status.queued.filter(doc => doc === 'react').length;
            expect(reactQueued).toBeLessThanOrEqual(1); // Should only be queued once
        });
    });
    describe('Expiration and Cleanup', () => {
        it('should clean up expired documentation', async () => {
            await smartCache.cleanupExpiredDocs();
            expect(mockKnowledgeBase.cleanupExpiredDocs).toHaveBeenCalledWith(365 * 24 * 60 * 60 * 1000);
        });
        it('should use custom expiration periods', async () => {
            const customCache = new SmartDocsCache(mockDocsIntelligence, mockKnowledgeBase, testProjectDir, {
                autoDownload: true,
                minConfidenceThreshold: 0.7,
                maxDocsPerSession: 5,
                backgroundDownload: true,
                expirationDays: 30
            });
            await customCache.cleanupExpiredDocs();
            expect(mockKnowledgeBase.cleanupExpiredDocs).toHaveBeenCalledWith(30 * 24 * 60 * 60 * 1000);
        });
    });
    describe('Configuration Options', () => {
        it('should respect auto-download setting', async () => {
            const noAutoDownloadCache = new SmartDocsCache(mockDocsIntelligence, mockKnowledgeBase, testProjectDir, {
                autoDownload: false,
                minConfidenceThreshold: 0.7,
                maxDocsPerSession: 5,
                backgroundDownload: true,
                expirationDays: 365
            });
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react'],
                storage_size: 1024
            });
            const missingDocs = await noAutoDownloadCache.processQuery('React development');
            const status = await noAutoDownloadCache.getQueueStatus();
            expect(status.queued.length).toBe(0); // Should not queue when auto-download is off
        });
        it('should handle synchronous download when background is disabled', async () => {
            const syncCache = new SmartDocsCache(mockDocsIntelligence, mockKnowledgeBase, testProjectDir, {
                autoDownload: true,
                minConfidenceThreshold: 0.7,
                maxDocsPerSession: 5,
                backgroundDownload: false,
                expirationDays: 365
            });
            mockDocsIntelligence.getDocumentationStatus.mockResolvedValue({
                installed: [],
                available: ['react'],
                storage_size: 1024
            });
            // Should still work but not trigger immediate background processing
            const missingDocs = await syncCache.processQuery('React development');
            expect(missingDocs.length).toBeGreaterThan(0);
        });
    });
    describe('Performance and Efficiency', () => {
        it('should cache project analysis results', async () => {
            // Create project files
            await fs.writeFile(path.join(testProjectDir, 'package.json'), '{}');
            // First analysis
            const start1 = Date.now();
            await smartCache.detectNeededDocs('first query');
            const time1 = Date.now() - start1;
            // Second analysis (should be cached)
            const start2 = Date.now();
            await smartCache.detectNeededDocs('second query');
            const time2 = Date.now() - start2;
            expect(time2).toBeLessThan(time1); // Second should be faster due to caching
        });
        it('should handle large numbers of queries efficiently', async () => {
            const queries = Array.from({ length: 50 }, (_, i) => `Query ${i} about development`);
            const startTime = Date.now();
            const promises = queries.map(q => smartCache.processQuery(q));
            await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            expect(totalTime).toBeLessThan(5000); // Should handle 50 queries in under 5 seconds
        });
    });
});
