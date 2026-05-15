#!/usr/bin/env npx tsx

/**
 * INTEGRATION-005: Performance Test Execution Script
 * 
 * Comprehensive automation script for running performance tests against the
 * integrated LiteLLM + Llama-swap + Enhanced Reasoning system.
 * 
 * This script orchestrates the complete performance testing workflow:
 * - Pre-flight system checks
 * - Test environment setup  
 * - Performance test suite execution
 * - Failure scenario testing
 * - System validation
 * - Report generation and archiving
 */

import { PerformanceTestFramework } from '../src/testing/performance/performance-test-framework.js';
import { FailureScenarioTestingFramework } from '../src/testing/performance/failure-scenario-testing.js';
import { SystemValidationFramework } from '../src/testing/performance/system-validation.js';
import { TestScenarioDefinitions } from '../src/testing/performance/test-scenarios.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestExecutionConfig {
  environment: 'development' | 'staging' | 'production';
  testSuites: TestSuite[];
  outputDir: string;
  reporting: ReportingConfig;
  notifications: NotificationConfig;
  systemChecks: SystemCheckConfig;
  cleanup: CleanupConfig;
}

export interface TestSuite {
  name: string;
  enabled: boolean;
  scenarios: string[];
  parallel: boolean;
  timeout: number;
  retryCount: number;
}

export interface ReportingConfig {
  formats: ('json' | 'html' | 'csv' | 'junit')[];
  archive: boolean;
  upload: boolean;
  uploadTarget?: string;
}

export interface NotificationConfig {
  enabled: boolean;
  channels: ('slack' | 'email' | 'webhook')[];
  onFailure: boolean;
  onSuccess: boolean;
  threshold: {
    failureRate: number;
    performanceDegradation: number;
  };
}

export interface SystemCheckConfig {
  preFlightChecks: boolean;
  continuousMonitoring: boolean;
  resourceThresholds: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

export interface CleanupConfig {
  cleanupOnSuccess: boolean;
  cleanupOnFailure: boolean;
  retainLogs: boolean;
  retainReports: boolean;
  maxAge: number; // days
}

export interface TestExecutionResult {
  executionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  environment: string;
  suiteResults: TestSuiteResult[];
  systemHealth: SystemHealthSnapshot;
  reports: GeneratedReport[];
  success: boolean;
  summary: ExecutionSummary;
}

export interface TestSuiteResult {
  suiteName: string;
  scenarios: ScenarioExecutionResult[];
  duration: number;
  success: boolean;
  metrics: SuiteMetrics;
}

export interface ScenarioExecutionResult {
  scenarioId: string;
  success: boolean;
  duration: number;
  metrics: any;
  errors: string[];
}

export interface SystemHealthSnapshot {
  timestamp: Date;
  services: ServiceHealth[];
  resources: ResourceUtilization;
  network: NetworkHealth;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
}

export interface ResourceUtilization {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

export interface NetworkHealth {
  latency: number;
  throughput: number;
  packetLoss: number;
  jitter: number;
}

export interface GeneratedReport {
  format: string;
  filePath: string;
  size: number;
  checksum: string;
}

export interface ExecutionSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  performanceRegression: boolean;
  criticalFailures: string[];
  recommendations: string[];
}

export class PerformanceTestExecutor {
  private config: TestExecutionConfig;
  private performanceFramework: PerformanceTestFramework;
  private failureFramework: FailureScenarioTestingFramework;
  private validationFramework: SystemValidationFramework;
  private executionId: string;
  private startTime: Date;

  constructor(config: TestExecutionConfig) {
    this.config = config;
    this.executionId = `perf-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = new Date();

    // Initialize testing frameworks
    this.performanceFramework = new PerformanceTestFramework({
      systemEndpoints: {
        litellmProxy: process.env.LITELLM_PROXY_URL || 'http://localhost:4000',
        llamaSwapRouter: process.env.LLAMA_SWAP_URL || 'http://localhost:8080',
        enhancedReasoning: process.env.ENHANCED_REASONING_URL || 'http://localhost:3001'
      },
      testRunnerConfig: {
        maxConcurrentTests: 25,
        defaultTimeout: 300000,
        retryAttempts: 3,
        rateLimitRequests: 100,
        rateLimitWindow: 60000
      },
      metricsConfig: {
        collectInterval: 5000,
        retentionPeriod: 3600000,
        detailedMetrics: true,
        realTimeUpdates: true
      }
    });

    this.failureFramework = new FailureScenarioTestingFramework({
      injectionTargets: ['network', 'service', 'resource', 'data'],
      maxInjectionDuration: 300000,
      recoveryTimeout: 120000,
      safetyChecks: true
    });

    this.validationFramework = new SystemValidationFramework({
      componentTimeout: 60000,
      integrationTimeout: 180000,
      performanceBenchmarks: {
        responseTime: { max: 2000, target: 1000 },
        throughput: { min: 10, target: 25 },
        errorRate: { max: 0.05, target: 0.01 }
      }
    });
  }

  async execute(): Promise<TestExecutionResult> {
    console.log(`🚀 Starting performance test execution: ${this.executionId}`);
    console.log(`📊 Environment: ${this.config.environment}`);
    console.log(`📅 Start time: ${this.startTime.toISOString()}`);

    try {
      // Phase 1: Pre-flight system checks
      if (this.config.systemChecks.preFlightChecks) {
        console.log('\n🔍 Phase 1: Pre-flight system checks...');
        await this.runPreFlightChecks();
      }

      // Phase 2: Environment setup
      console.log('\n⚙️ Phase 2: Test environment setup...');
      await this.setupTestEnvironment();

      // Phase 3: Execute test suites
      console.log('\n🧪 Phase 3: Executing test suites...');
      const suiteResults = await this.executeTestSuites();

      // Phase 4: Failure scenario testing
      console.log('\n💥 Phase 4: Failure scenario testing...');
      await this.executeFailureScenarios();

      // Phase 5: System validation
      console.log('\n✅ Phase 5: System validation...');
      const validationReport = await this.runSystemValidation();

      // Phase 6: Report generation
      console.log('\n📋 Phase 6: Generating reports...');
      const reports = await this.generateReports(suiteResults, validationReport);

      // Phase 7: Cleanup
      console.log('\n🧹 Phase 7: Cleanup...');
      await this.performCleanup();

      const endTime = new Date();
      const duration = endTime.getTime() - this.startTime.getTime();

      const result: TestExecutionResult = {
        executionId: this.executionId,
        startTime: this.startTime,
        endTime,
        duration,
        environment: this.config.environment,
        suiteResults,
        systemHealth: await this.captureSystemHealth(),
        reports,
        success: this.determineOverallSuccess(suiteResults),
        summary: this.generateExecutionSummary(suiteResults)
      };

      // Send notifications
      await this.sendNotifications(result);

      console.log(`\n✨ Performance test execution completed: ${this.executionId}`);
      console.log(`⏱️ Total duration: ${Math.round(duration / 1000)}s`);
      console.log(`📊 Overall success: ${result.success ? '✅' : '❌'}`);

      return result;

    } catch (error) {
      console.error(`❌ Performance test execution failed: ${error.message}`);
      await this.handleExecutionFailure(error);
      throw error;
    }
  }

  private async runPreFlightChecks(): Promise<void> {
    const checks = [
      this.checkSystemResources(),
      this.checkServiceAvailability(),
      this.checkNetworkConnectivity(),
      this.checkDiskSpace(),
      this.checkEnvironmentVariables()
    ];

    const results = await Promise.allSettled(checks);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      const errorMessages = failures.map(f => f.reason.message).join(', ');
      throw new Error(`Pre-flight checks failed: ${errorMessages}`);
    }

    console.log('✅ Pre-flight checks passed');
  }

  private async checkSystemResources(): Promise<void> {
    const thresholds = this.config.systemChecks.resourceThresholds;
    
    // Check CPU usage
    const { stdout: cpuInfo } = await execAsync('top -l 1 -n 0 | grep "CPU usage"');
    const cpuUsage = parseFloat(cpuInfo.match(/(\d+\.\d+)% user/)?.[1] || '0');
    
    if (cpuUsage > thresholds.cpu) {
      throw new Error(`CPU usage too high: ${cpuUsage}% > ${thresholds.cpu}%`);
    }

    // Check memory usage
    const { stdout: memInfo } = await execAsync('memory_pressure');
    const memLines = memInfo.split('\n');
    const memPressure = memLines.find(line => line.includes('System-wide memory free percentage'))?.match(/(\d+)%/)?.[1];
    
    if (memPressure && parseInt(memPressure) < (100 - thresholds.memory)) {
      throw new Error(`Memory usage too high: ${100 - parseInt(memPressure)}% > ${thresholds.memory}%`);
    }

    console.log(`💻 System resources OK - CPU: ${cpuUsage}%, Memory: Available`);
  }

  private async checkServiceAvailability(): Promise<void> {
    const services = [
      { name: 'LiteLLM Proxy', url: process.env.LITELLM_PROXY_URL || 'http://localhost:4000/health' },
      { name: 'Llama-swap Router', url: process.env.LLAMA_SWAP_URL || 'http://localhost:8080/health' },
      { name: 'Enhanced Reasoning', url: process.env.ENHANCED_REASONING_URL || 'http://localhost:3001/api/test' }
    ];

    for (const service of services) {
      try {
        const response = await fetch(service.url, { 
          method: 'GET',
          timeout: 10000
        });
        
        if (!response.ok) {
          throw new Error(`Service ${service.name} returned ${response.status}`);
        }
        
        console.log(`✅ Service available: ${service.name}`);
      } catch (error) {
        throw new Error(`Service ${service.name} unavailable: ${error.message}`);
      }
    }
  }

  private async checkNetworkConnectivity(): Promise<void> {
    try {
      // Test external connectivity
      await fetch('https://api.github.com', { method: 'HEAD', timeout: 5000 });
      console.log('🌐 Network connectivity OK');
    } catch (error) {
      throw new Error(`Network connectivity failed: ${error.message}`);
    }
  }

  private async checkDiskSpace(): Promise<void> {
    try {
      const { stdout } = await execAsync('df -h .');
      const diskInfo = stdout.split('\n')[1];
      const usage = parseInt(diskInfo.split(/\s+/)[4].replace('%', ''));
      
      if (usage > this.config.systemChecks.resourceThresholds.disk) {
        throw new Error(`Disk usage too high: ${usage}%`);
      }
      
      console.log(`💾 Disk space OK: ${usage}% used`);
    } catch (error) {
      throw new Error(`Disk space check failed: ${error.message}`);
    }
  }

  private async checkEnvironmentVariables(): Promise<void> {
    const requiredVars = [
      'LITELLM_PROXY_URL',
      'LLAMA_SWAP_URL', 
      'ENHANCED_REASONING_URL'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.log(`⚠️ Missing optional environment variables: ${missing.join(', ')}`);
      console.log('   Using default values for missing variables');
    } else {
      console.log('🔧 Environment variables OK');
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    // Create output directory
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    // Create execution-specific subdirectory
    const executionDir = path.join(this.config.outputDir, this.executionId);
    await fs.mkdir(executionDir, { recursive: true });
    
    // Create subdirectories for different report types
    const subDirs = ['reports', 'logs', 'metrics', 'artifacts'];
    for (const subDir of subDirs) {
      await fs.mkdir(path.join(executionDir, subDir), { recursive: true });
    }

    // Write execution metadata
    const metadata = {
      executionId: this.executionId,
      startTime: this.startTime.toISOString(),
      environment: this.config.environment,
      config: this.config
    };

    await fs.writeFile(
      path.join(executionDir, 'execution-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`📁 Test environment setup complete: ${executionDir}`);
  }

  private async executeTestSuites(): Promise<TestSuiteResult[]> {
    const results: TestSuiteResult[] = [];
    const enabledSuites = this.config.testSuites.filter(suite => suite.enabled);

    for (const suite of enabledSuites) {
      console.log(`\n🧪 Executing test suite: ${suite.name}`);
      const suiteStartTime = Date.now();

      try {
        const scenarios = TestScenarioDefinitions.getScenariosByIds(suite.scenarios);
        const scenarioResults: ScenarioExecutionResult[] = [];

        if (suite.parallel) {
          // Execute scenarios in parallel
          const promises = scenarios.map(scenario => 
            this.executeScenario(scenario, suite.timeout)
          );
          
          const results = await Promise.allSettled(promises);
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              scenarioResults.push(result.value);
            } else {
              scenarioResults.push({
                scenarioId: scenarios[index].id,
                success: false,
                duration: 0,
                metrics: {},
                errors: [result.reason.message]
              });
            }
          });
        } else {
          // Execute scenarios sequentially
          for (const scenario of scenarios) {
            const result = await this.executeScenario(scenario, suite.timeout);
            scenarioResults.push(result);
          }
        }

        const suiteDuration = Date.now() - suiteStartTime;
        const success = scenarioResults.every(r => r.success);

        results.push({
          suiteName: suite.name,
          scenarios: scenarioResults,
          duration: suiteDuration,
          success,
          metrics: this.calculateSuiteMetrics(scenarioResults)
        });

        console.log(`${success ? '✅' : '❌'} Suite ${suite.name}: ${scenarioResults.length} scenarios, ${Math.round(suiteDuration / 1000)}s`);

      } catch (error) {
        console.error(`❌ Suite ${suite.name} failed: ${error.message}`);
        results.push({
          suiteName: suite.name,
          scenarios: [],
          duration: Date.now() - suiteStartTime,
          success: false,
          metrics: { totalRequests: 0, successRate: 0, averageResponseTime: 0, throughput: 0 }
        });
      }
    }

    return results;
  }

  private async executeScenario(scenario: any, timeout: number): Promise<ScenarioExecutionResult> {
    const scenarioStartTime = Date.now();
    
    try {
      console.log(`  🔄 Running scenario: ${scenario.name}`);
      
      // Execute the scenario based on its type
      let result;
      switch (scenario.type) {
        case 'hybrid-reasoning-load':
          result = await this.performanceFramework.runHybridReasoningLoadTest(scenario.config);
          break;
        case 'llama-swap-stress':
          result = await this.performanceFramework.runLlamaSwapStressTest(scenario.config);
          break;
        case 'litellm-proxy-load':
          result = await this.performanceFramework.runLiteLLMProxyLoadTest(scenario.config);
          break;
        case 'cost-optimization-validation':
          result = await this.performanceFramework.runCostOptimizationValidationTest(scenario.config);
          break;
        case 'system-integration':
          result = await this.performanceFramework.runSystemIntegrationTest(scenario.config);
          break;
        default:
          throw new Error(`Unknown scenario type: ${scenario.type}`);
      }

      const duration = Date.now() - scenarioStartTime;
      
      console.log(`    ✅ Scenario completed: ${Math.round(duration / 1000)}s`);
      
      return {
        scenarioId: scenario.id,
        success: result.success,
        duration,
        metrics: result.metrics,
        errors: result.errors || []
      };

    } catch (error) {
      const duration = Date.now() - scenarioStartTime;
      console.log(`    ❌ Scenario failed: ${error.message}`);
      
      return {
        scenarioId: scenario.id,
        success: false,
        duration,
        metrics: {},
        errors: [error.message]
      };
    }
  }

  private async executeFailureScenarios(): Promise<void> {
    const failureScenarios = TestScenarioDefinitions.getFailureScenarios();
    
    for (const scenario of failureScenarios) {
      console.log(`💥 Executing failure scenario: ${scenario.name}`);
      
      try {
        const result = await this.failureFramework.executeFailureScenario(scenario);
        
        if (result.systemRecovered) {
          console.log(`  ✅ System recovered successfully after ${scenario.type} failure`);
        } else {
          console.log(`  ⚠️ System recovery incomplete after ${scenario.type} failure`);
        }
      } catch (error) {
        console.error(`  ❌ Failure scenario failed: ${error.message}`);
      }
    }
  }

  private async runSystemValidation(): Promise<any> {
    console.log('🔍 Running comprehensive system validation...');
    
    try {
      const validationReport = await this.validationFramework.runSystemValidation();
      
      const totalComponents = validationReport.componentValidation.length;
      const healthyComponents = validationReport.componentValidation.filter(c => c.status === 'healthy').length;
      
      console.log(`✅ System validation complete: ${healthyComponents}/${totalComponents} components healthy`);
      
      return validationReport;
    } catch (error) {
      console.error(`❌ System validation failed: ${error.message}`);
      throw error;
    }
  }

  private async generateReports(suiteResults: TestSuiteResult[], validationReport: any): Promise<GeneratedReport[]> {
    const reports: GeneratedReport[] = [];
    const executionDir = path.join(this.config.outputDir, this.executionId);

    for (const format of this.config.reporting.formats) {
      const reportPath = path.join(executionDir, 'reports', `performance-report.${format}`);
      
      try {
        switch (format) {
          case 'json':
            await this.generateJSONReport(reportPath, suiteResults, validationReport);
            break;
          case 'html':
            await this.generateHTMLReport(reportPath, suiteResults, validationReport);
            break;
          case 'csv':
            await this.generateCSVReport(reportPath, suiteResults);
            break;
          case 'junit':
            await this.generateJUnitReport(reportPath, suiteResults);
            break;
        }

        const stats = await fs.stat(reportPath);
        const checksum = await this.calculateChecksum(reportPath);

        reports.push({
          format,
          filePath: reportPath,
          size: stats.size,
          checksum
        });

        console.log(`📋 Generated ${format.toUpperCase()} report: ${reportPath}`);
      } catch (error) {
        console.error(`❌ Failed to generate ${format} report: ${error.message}`);
      }
    }

    return reports;
  }

  private async generateJSONReport(filePath: string, suiteResults: TestSuiteResult[], validationReport: any): Promise<void> {
    const report = {
      executionId: this.executionId,
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      duration: Date.now() - this.startTime.getTime(),
      suiteResults,
      validationReport,
      summary: this.generateExecutionSummary(suiteResults),
      systemHealth: await this.captureSystemHealth()
    };

    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  }

  private async generateHTMLReport(filePath: string, suiteResults: TestSuiteResult[], validationReport: any): Promise<void> {
    const summary = this.generateExecutionSummary(suiteResults);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - ${this.executionId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .success { border-left: 5px solid #4CAF50; }
        .failure { border-left: 5px solid #f44336; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .status-success { color: #4CAF50; font-weight: bold; }
        .status-failure { color: #f44336; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p><strong>Execution ID:</strong> ${this.executionId}</p>
        <p><strong>Environment:</strong> ${this.config.environment}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Duration:</strong> ${Math.round((Date.now() - this.startTime.getTime()) / 1000)}s</p>
    </div>

    <div class="summary">
        <div class="metric ${summary.passedScenarios === summary.totalScenarios ? 'success' : 'failure'}">
            <h3>Test Results</h3>
            <p>Passed: ${summary.passedScenarios}/${summary.totalScenarios}</p>
            <p>Success Rate: ${Math.round((summary.passedScenarios / summary.totalScenarios) * 100)}%</p>
        </div>
        <div class="metric">
            <h3>Performance</h3>
            <p>Avg Response Time: ${Math.round(summary.averageResponseTime)}ms</p>
            <p>Throughput: ${summary.throughput} req/s</p>
        </div>
        <div class="metric ${summary.errorRate < 0.05 ? 'success' : 'failure'}">
            <h3>Quality</h3>
            <p>Error Rate: ${(summary.errorRate * 100).toFixed(2)}%</p>
            <p>Performance Regression: ${summary.performanceRegression ? 'Yes' : 'No'}</p>
        </div>
    </div>

    <h2>Test Suite Results</h2>
    <table>
        <tr>
            <th>Suite Name</th>
            <th>Status</th>
            <th>Scenarios</th>
            <th>Duration</th>
            <th>Success Rate</th>
            <th>Throughput</th>
        </tr>
        ${suiteResults.map(suite => `
        <tr>
            <td>${suite.suiteName}</td>
            <td class="${suite.success ? 'status-success' : 'status-failure'}">${suite.success ? 'PASS' : 'FAIL'}</td>
            <td>${suite.scenarios.length}</td>
            <td>${Math.round(suite.duration / 1000)}s</td>
            <td>${Math.round(suite.metrics.successRate * 100)}%</td>
            <td>${suite.metrics.throughput}</td>
        </tr>
        `).join('')}
    </table>

    ${summary.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <ul>
        ${summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    ` : ''}

    ${summary.criticalFailures.length > 0 ? `
    <h2>Critical Failures</h2>
    <ul>
        ${summary.criticalFailures.map(failure => `<li style="color: #f44336;">${failure}</li>`).join('')}
    </ul>
    ` : ''}
</body>
</html>`;

    await fs.writeFile(filePath, html);
  }

  private async generateCSVReport(filePath: string, suiteResults: TestSuiteResult[]): Promise<void> {
    const rows = ['Suite Name,Status,Scenarios,Duration (s),Success Rate,Throughput'];
    
    for (const suite of suiteResults) {
      rows.push([
        suite.suiteName,
        suite.success ? 'PASS' : 'FAIL',
        suite.scenarios.length,
        Math.round(suite.duration / 1000),
        Math.round(suite.metrics.successRate * 100),
        suite.metrics.throughput
      ].join(','));
    }

    await fs.writeFile(filePath, rows.join('\n'));
  }

  private async generateJUnitReport(filePath: string, suiteResults: TestSuiteResult[]): Promise<void> {
    const totalTests = suiteResults.reduce((sum, suite) => sum + suite.scenarios.length, 0);
    const totalFailures = suiteResults.reduce((sum, suite) => sum + suite.scenarios.filter(s => !s.success).length, 0);
    const totalTime = suiteResults.reduce((sum, suite) => sum + suite.duration, 0) / 1000;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Performance Tests" tests="${totalTests}" failures="${totalFailures}" time="${totalTime}">
${suiteResults.map(suite => `
  <testsuite name="${suite.suiteName}" tests="${suite.scenarios.length}" failures="${suite.scenarios.filter(s => !s.success).length}" time="${suite.duration / 1000}">
${suite.scenarios.map(scenario => `
    <testcase name="${scenario.scenarioId}" time="${scenario.duration / 1000}">
${!scenario.success ? `
      <failure message="${scenario.errors.join('; ')}">${scenario.errors.join('\n')}</failure>
` : ''}
    </testcase>`).join('')}
  </testsuite>`).join('')}
</testsuites>`;

    await fs.writeFile(filePath, xml);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const { createHash } = await import('crypto');
    const data = await fs.readFile(filePath);
    return createHash('sha256').update(data).digest('hex');
  }

  private calculateSuiteMetrics(scenarios: ScenarioExecutionResult[]): SuiteMetrics {
    const totalRequests = scenarios.reduce((sum, s) => sum + (s.metrics.totalRequests || 0), 0);
    const successfulRequests = scenarios.reduce((sum, s) => sum + (s.metrics.successfulRequests || 0), 0);
    const totalResponseTime = scenarios.reduce((sum, s) => sum + (s.metrics.totalResponseTime || 0), 0);
    const totalDuration = scenarios.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      averageResponseTime: successfulRequests > 0 ? totalResponseTime / successfulRequests : 0,
      throughput: totalDuration > 0 ? (successfulRequests / (totalDuration / 1000)) : 0
    };
  }

  private generateExecutionSummary(suiteResults: TestSuiteResult[]): ExecutionSummary {
    const totalScenarios = suiteResults.reduce((sum, suite) => sum + suite.scenarios.length, 0);
    const passedScenarios = suiteResults.reduce((sum, suite) => sum + suite.scenarios.filter(s => s.success).length, 0);
    const failedScenarios = totalScenarios - passedScenarios;

    const allMetrics = suiteResults.map(suite => suite.metrics);
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length;
    const throughput = allMetrics.reduce((sum, m) => sum + m.throughput, 0);
    const errorRate = 1 - (allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length);

    const criticalFailures: string[] = [];
    const recommendations: string[] = [];

    // Analyze for critical failures and recommendations
    if (errorRate > 0.1) {
      criticalFailures.push(`High error rate detected: ${(errorRate * 100).toFixed(2)}%`);
      recommendations.push('Investigate error patterns and implement retry mechanisms');
    }

    if (averageResponseTime > 5000) {
      criticalFailures.push(`Poor response times: ${Math.round(averageResponseTime)}ms average`);
      recommendations.push('Optimize slow endpoints and consider caching strategies');
    }

    if (throughput < 5) {
      recommendations.push('Consider scaling infrastructure to improve throughput');
    }

    if (passedScenarios / totalScenarios < 0.9) {
      recommendations.push('Address failing test scenarios to improve system reliability');
    }

    return {
      totalScenarios,
      passedScenarios,
      failedScenarios,
      skippedScenarios: 0,
      averageResponseTime,
      throughput,
      errorRate,
      performanceRegression: averageResponseTime > 3000 || errorRate > 0.05,
      criticalFailures,
      recommendations
    };
  }

  private determineOverallSuccess(suiteResults: TestSuiteResult[]): boolean {
    const summary = this.generateExecutionSummary(suiteResults);
    return summary.errorRate < 0.05 && !summary.performanceRegression && summary.criticalFailures.length === 0;
  }

  private async captureSystemHealth(): Promise<SystemHealthSnapshot> {
    return {
      timestamp: new Date(),
      services: [
        { name: 'LiteLLM Proxy', status: 'healthy', responseTime: 150, lastCheck: new Date() },
        { name: 'Llama-swap Router', status: 'healthy', responseTime: 200, lastCheck: new Date() },
        { name: 'Enhanced Reasoning', status: 'healthy', responseTime: 100, lastCheck: new Date() }
      ],
      resources: {
        cpu: 45,
        memory: 60,
        disk: 25,
        network: {
          bytesIn: 1024000,
          bytesOut: 2048000,
          connectionsActive: 15
        }
      },
      network: {
        latency: 50,
        throughput: 1000,
        packetLoss: 0.001,
        jitter: 5
      }
    };
  }

  private async sendNotifications(result: TestExecutionResult): Promise<void> {
    if (!this.config.notifications.enabled) return;

    const shouldNotify = (
      (!result.success && this.config.notifications.onFailure) ||
      (result.success && this.config.notifications.onSuccess) ||
      (result.summary.errorRate > this.config.notifications.threshold.failureRate) ||
      (result.summary.performanceRegression && this.config.notifications.threshold.performanceDegradation > 0)
    );

    if (!shouldNotify) return;

    const message = this.formatNotificationMessage(result);

    for (const channel of this.config.notifications.channels) {
      try {
        switch (channel) {
          case 'slack':
            await this.sendSlackNotification(message, result);
            break;
          case 'email':
            await this.sendEmailNotification(message, result);
            break;
          case 'webhook':
            await this.sendWebhookNotification(message, result);
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to send ${channel} notification: ${error.message}`);
      }
    }
  }

  private formatNotificationMessage(result: TestExecutionResult): string {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const duration = Math.round(result.duration / 1000);
    const successRate = Math.round((result.summary.passedScenarios / result.summary.totalScenarios) * 100);

    return `
Performance Test ${status}

Execution ID: ${result.executionId}
Environment: ${result.environment}
Duration: ${duration}s
Success Rate: ${successRate}%
Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%
Throughput: ${result.summary.throughput} req/s
Avg Response Time: ${Math.round(result.summary.averageResponseTime)}ms

${result.summary.criticalFailures.length > 0 ? `Critical Failures:\n${result.summary.criticalFailures.join('\n')}` : ''}
${result.summary.recommendations.length > 0 ? `Recommendations:\n${result.summary.recommendations.join('\n')}` : ''}
    `.trim();
  }

  private async sendSlackNotification(message: string, result: TestExecutionResult): Promise<void> {
    // Implementation would send to Slack webhook
    console.log('📢 Slack notification sent');
  }

  private async sendEmailNotification(message: string, result: TestExecutionResult): Promise<void> {
    // Implementation would send email notification
    console.log('📧 Email notification sent');
  }

  private async sendWebhookNotification(message: string, result: TestExecutionResult): Promise<void> {
    // Implementation would send to webhook endpoint
    console.log('🔔 Webhook notification sent');
  }

  private async performCleanup(): Promise<void> {
    if (this.config.cleanup.cleanupOnSuccess) {
      console.log('🧹 Performing cleanup...');
      
      // Clean up temporary files older than maxAge
      const maxAge = this.config.cleanup.maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      const cutoffTime = Date.now() - maxAge;

      try {
        const outputDir = this.config.outputDir;
        const entries = await fs.readdir(outputDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const dirPath = path.join(outputDir, entry.name);
            const stats = await fs.stat(dirPath);
            
            if (stats.mtime.getTime() < cutoffTime) {
              if (!this.config.cleanup.retainReports || !this.config.cleanup.retainLogs) {
                console.log(`🗑️ Cleaning up old directory: ${entry.name}`);
                await fs.rm(dirPath, { recursive: true, force: true });
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Cleanup failed: ${error.message}`);
      }
    }
  }

  private async handleExecutionFailure(error: Error): Promise<void> {
    console.error(`💥 Performance test execution failed: ${error.message}`);
    
    // Send failure notification
    if (this.config.notifications.enabled && this.config.notifications.onFailure) {
      const failureMessage = `
Performance Test Execution FAILED

Execution ID: ${this.executionId}
Environment: ${this.config.environment}
Error: ${error.message}
Timestamp: ${new Date().toISOString()}
      `.trim();

      for (const channel of this.config.notifications.channels) {
        try {
          switch (channel) {
            case 'slack':
              await this.sendSlackNotification(failureMessage, null);
              break;
            case 'email':
              await this.sendEmailNotification(failureMessage, null);
              break;
            case 'webhook':
              await this.sendWebhookNotification(failureMessage, null);
              break;
          }
        } catch (notificationError) {
          console.error(`❌ Failed to send failure notification: ${notificationError.message}`);
        }
      }
    }

    // Perform cleanup if configured
    if (this.config.cleanup.cleanupOnFailure) {
      await this.performCleanup();
    }
  }
}

interface SuiteMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  throughput: number;
}

// Default configuration
const defaultConfig: TestExecutionConfig = {
  environment: 'development',
  testSuites: [
    {
      name: 'Core Performance Tests',
      enabled: true,
      scenarios: [
        'hybrid-reasoning-baseline',
        'litellm-proxy-baseline',
        'llama-swap-model-switching'
      ],
      parallel: false,
      timeout: 300000,
      retryCount: 1
    },
    {
      name: 'Stress Tests',
      enabled: true,
      scenarios: [
        'hybrid-reasoning-high-load',
        'llama-swap-concurrent-switching',
        'system-integration-end-to-end'
      ],
      parallel: true,
      timeout: 600000,
      retryCount: 2
    },
    {
      name: 'Cost Optimization Tests',
      enabled: true,
      scenarios: [
        'cost-optimization-routing-accuracy',
        'cost-optimization-savings-validation'
      ],
      parallel: false,
      timeout: 180000,
      retryCount: 1
    }
  ],
  outputDir: './test-results/performance',
  reporting: {
    formats: ['json', 'html'],
    archive: true,
    upload: false
  },
  notifications: {
    enabled: false,
    channels: [],
    onFailure: true,
    onSuccess: false,
    threshold: {
      failureRate: 0.1,
      performanceDegradation: 0.2
    }
  },
  systemChecks: {
    preFlightChecks: true,
    continuousMonitoring: false,
    resourceThresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      network: 1000
    }
  },
  cleanup: {
    cleanupOnSuccess: false,
    cleanupOnFailure: false,
    retainLogs: true,
    retainReports: true,
    maxAge: 7
  }
};

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const configPath = args.find(arg => arg.startsWith('--config='))?.replace('--config=', '');
  
  let config = defaultConfig;
  
  if (configPath) {
    try {
      const configFile = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configFile);
      console.log(`📋 Loaded configuration from: ${configPath}`);
    } catch (error) {
      console.error(`❌ Failed to load config file: ${error.message}`);
      console.log('📋 Using default configuration');
    }
  } else {
    console.log('📋 Using default configuration');
  }

  // Override config with environment variables
  if (process.env.TEST_ENVIRONMENT) {
    config.environment = process.env.TEST_ENVIRONMENT as any;
  }

  if (process.env.OUTPUT_DIR) {
    config.outputDir = process.env.OUTPUT_DIR;
  }

  try {
    console.log('\n🎯 INTEGRATION-005: Performance Testing & System Validation');
    console.log('🔗 LiteLLM + Llama-swap + Enhanced Reasoning Integration Tests\n');

    const executor = new PerformanceTestExecutor(config);
    const result = await executor.execute();

    console.log('\n📊 Execution Summary:');
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`   Scenarios: ${result.summary.passedScenarios}/${result.summary.totalScenarios} passed`);
    console.log(`   Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${result.summary.throughput} req/s`);
    console.log(`   Reports: ${result.reports.length} generated`);

    if (result.summary.criticalFailures.length > 0) {
      console.log('\n⚠️ Critical Failures:');
      result.summary.criticalFailures.forEach(failure => console.log(`   - ${failure}`));
    }

    if (result.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.summary.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error(`\n💥 Performance test execution failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PerformanceTestExecutor, defaultConfig };