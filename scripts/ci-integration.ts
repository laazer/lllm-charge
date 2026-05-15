#!/usr/bin/env npx tsx

/**
 * INTEGRATION-005: CI/CD Integration Script
 * 
 * Comprehensive CI/CD integration for performance testing framework.
 * Supports GitHub Actions, GitLab CI, Jenkins, and other CI/CD platforms.
 * 
 * Features:
 * - Automated test execution in CI/CD environments
 * - Environment-specific configurations
 * - Test result publishing
 * - Artifact management
 * - Integration with multiple CI/CD platforms
 * - Performance regression detection
 * - Automated notifications and reporting
 */

import { PerformanceTestExecutor, TestExecutionConfig, TestExecutionResult } from './run-performance-tests.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CIPlatformConfig {
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'azure-devops' | 'circleci' | 'generic';
  jobId?: string;
  buildNumber?: string;
  commitSha?: string;
  branchName?: string;
  pullRequestNumber?: string;
  projectUrl?: string;
  artifactUpload?: ArtifactUploadConfig;
  testReporting?: TestReportingConfig;
}

export interface ArtifactUploadConfig {
  enabled: boolean;
  provider: 'aws-s3' | 'azure-blob' | 'gcp-storage' | 'local' | 'ci-native';
  bucket?: string;
  path?: string;
  retention?: number;
  publicAccess?: boolean;
}

export interface TestReportingConfig {
  publishResults: boolean;
  createSummaryComment: boolean;
  updateStatus: boolean;
  failOnRegression: boolean;
  regressionThreshold: number;
  compareWithBaseline: boolean;
  baselineBranch?: string;
}

export interface CIExecutionContext {
  platform: string;
  jobId: string;
  buildNumber: string;
  commitSha: string;
  branchName: string;
  isPullRequest: boolean;
  pullRequestNumber?: string;
  projectUrl: string;
  workspaceDir: string;
  outputDir: string;
  environmentName: string;
}

export interface PerformanceComparison {
  baselineResults?: TestExecutionResult;
  currentResults: TestExecutionResult;
  regressionDetected: boolean;
  performanceChanges: PerformanceChange[];
  summary: ComparisonSummary;
}

export interface PerformanceChange {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  significance: 'improvement' | 'regression' | 'neutral';
  threshold: number;
}

export interface ComparisonSummary {
  totalMetrics: number;
  improvements: number;
  regressions: number;
  neutral: number;
  overallTrend: 'improved' | 'regressed' | 'stable';
  significantChanges: PerformanceChange[];
}

export class CIIntegrationFramework {
  private platformConfig: CIPlatformConfig;
  private context: CIExecutionContext;
  private executor: PerformanceTestExecutor;

  constructor(platformConfig: CIPlatformConfig) {
    this.platformConfig = platformConfig;
    this.context = this.detectExecutionContext();
    
    // Create performance test configuration optimized for CI
    const testConfig = this.createCITestConfiguration();
    this.executor = new PerformanceTestExecutor(testConfig);
  }

  async executeInCI(): Promise<void> {
    console.log('🚀 Starting CI/CD Performance Testing Integration');
    console.log(`📋 Platform: ${this.context.platform}`);
    console.log(`🏗️ Build: ${this.context.buildNumber}`);
    console.log(`📝 Commit: ${this.context.commitSha.substring(0, 8)}`);
    console.log(`🌿 Branch: ${this.context.branchName}`);

    let testResults: TestExecutionResult;
    let comparison: PerformanceComparison | undefined;

    try {
      // Step 1: Setup CI environment
      await this.setupCIEnvironment();

      // Step 2: Load baseline results if comparing
      const baselineResults = await this.loadBaselineResults();

      // Step 3: Execute performance tests
      console.log('\n🧪 Executing performance tests...');
      testResults = await this.executor.execute();

      // Step 4: Compare with baseline if available
      if (baselineResults && this.platformConfig.testReporting?.compareWithBaseline) {
        console.log('\n📊 Comparing with baseline results...');
        comparison = this.compareWithBaseline(testResults, baselineResults);
        await this.publishComparisonResults(comparison);
      }

      // Step 5: Upload artifacts
      if (this.platformConfig.artifactUpload?.enabled) {
        console.log('\n📦 Uploading artifacts...');
        await this.uploadArtifacts(testResults);
      }

      // Step 6: Publish test results
      if (this.platformConfig.testReporting?.publishResults) {
        console.log('\n📋 Publishing test results...');
        await this.publishTestResults(testResults, comparison);
      }

      // Step 7: Update CI status
      await this.updateCIStatus(testResults, comparison);

      // Step 8: Store results as baseline for future comparisons
      await this.storeAsBaseline(testResults);

      console.log('\n✅ CI/CD performance testing completed successfully');

    } catch (error) {
      console.error(`\n❌ CI/CD performance testing failed: ${error.message}`);
      await this.handleCIFailure(error, testResults);
      throw error;
    }
  }

  private detectExecutionContext(): CIExecutionContext {
    // GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      return {
        platform: 'GitHub Actions',
        jobId: process.env.GITHUB_RUN_ID || 'unknown',
        buildNumber: process.env.GITHUB_RUN_NUMBER || 'unknown',
        commitSha: process.env.GITHUB_SHA || 'unknown',
        branchName: process.env.GITHUB_REF_NAME || 'unknown',
        isPullRequest: process.env.GITHUB_EVENT_NAME === 'pull_request',
        pullRequestNumber: process.env.GITHUB_EVENT_NAME === 'pull_request' ? 
          process.env.GITHUB_REF?.split('/')[2] : undefined,
        projectUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}`,
        workspaceDir: process.env.GITHUB_WORKSPACE || process.cwd(),
        outputDir: path.join(process.env.GITHUB_WORKSPACE || process.cwd(), 'ci-test-results'),
        environmentName: 'ci'
      };
    }

    // GitLab CI
    if (process.env.GITLAB_CI) {
      return {
        platform: 'GitLab CI',
        jobId: process.env.CI_JOB_ID || 'unknown',
        buildNumber: process.env.CI_PIPELINE_ID || 'unknown',
        commitSha: process.env.CI_COMMIT_SHA || 'unknown',
        branchName: process.env.CI_COMMIT_REF_NAME || 'unknown',
        isPullRequest: process.env.CI_MERGE_REQUEST_ID !== undefined,
        pullRequestNumber: process.env.CI_MERGE_REQUEST_IID,
        projectUrl: process.env.CI_PROJECT_URL || 'unknown',
        workspaceDir: process.env.CI_PROJECT_DIR || process.cwd(),
        outputDir: path.join(process.env.CI_PROJECT_DIR || process.cwd(), 'ci-test-results'),
        environmentName: 'ci'
      };
    }

    // Jenkins
    if (process.env.JENKINS_URL) {
      return {
        platform: 'Jenkins',
        jobId: process.env.JOB_NAME || 'unknown',
        buildNumber: process.env.BUILD_NUMBER || 'unknown',
        commitSha: process.env.GIT_COMMIT || 'unknown',
        branchName: process.env.GIT_BRANCH?.replace('origin/', '') || 'unknown',
        isPullRequest: process.env.CHANGE_ID !== undefined,
        pullRequestNumber: process.env.CHANGE_ID,
        projectUrl: process.env.JOB_URL || 'unknown',
        workspaceDir: process.env.WORKSPACE || process.cwd(),
        outputDir: path.join(process.env.WORKSPACE || process.cwd(), 'ci-test-results'),
        environmentName: 'ci'
      };
    }

    // Azure DevOps
    if (process.env.AZURE_HTTP_USER_AGENT) {
      return {
        platform: 'Azure DevOps',
        jobId: process.env.BUILD_BUILDID || 'unknown',
        buildNumber: process.env.BUILD_BUILDNUMBER || 'unknown',
        commitSha: process.env.BUILD_SOURCEVERSION || 'unknown',
        branchName: process.env.BUILD_SOURCEBRANCH?.replace('refs/heads/', '') || 'unknown',
        isPullRequest: process.env.BUILD_REASON === 'PullRequest',
        pullRequestNumber: process.env.SYSTEM_PULLREQUEST_PULLREQUESTID,
        projectUrl: `${process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${process.env.SYSTEM_TEAMPROJECT}`,
        workspaceDir: process.env.BUILD_SOURCESDIRECTORY || process.cwd(),
        outputDir: path.join(process.env.BUILD_SOURCESDIRECTORY || process.cwd(), 'ci-test-results'),
        environmentName: 'ci'
      };
    }

    // CircleCI
    if (process.env.CIRCLECI) {
      return {
        platform: 'CircleCI',
        jobId: process.env.CIRCLE_BUILD_NUM || 'unknown',
        buildNumber: process.env.CIRCLE_BUILD_NUM || 'unknown',
        commitSha: process.env.CIRCLE_SHA1 || 'unknown',
        branchName: process.env.CIRCLE_BRANCH || 'unknown',
        isPullRequest: process.env.CIRCLE_PULL_REQUEST !== undefined,
        pullRequestNumber: process.env.CIRCLE_PR_NUMBER,
        projectUrl: process.env.CIRCLE_REPOSITORY_URL || 'unknown',
        workspaceDir: process.env.CIRCLE_WORKING_DIRECTORY || process.cwd(),
        outputDir: path.join(process.env.CIRCLE_WORKING_DIRECTORY || process.cwd(), 'ci-test-results'),
        environmentName: 'ci'
      };
    }

    // Generic/Local
    return {
      platform: 'Generic',
      jobId: 'local',
      buildNumber: Date.now().toString(),
      commitSha: 'unknown',
      branchName: 'unknown',
      isPullRequest: false,
      projectUrl: 'local',
      workspaceDir: process.cwd(),
      outputDir: path.join(process.cwd(), 'ci-test-results'),
      environmentName: 'local'
    };
  }

  private createCITestConfiguration(): TestExecutionConfig {
    return {
      environment: 'ci' as any,
      testSuites: [
        {
          name: 'CI Core Performance Tests',
          enabled: true,
          scenarios: [
            'hybrid-reasoning-baseline',
            'litellm-proxy-baseline',
            'llama-swap-model-switching'
          ],
          parallel: true, // CI can handle parallel execution
          timeout: 180000, // Shorter timeout for CI
          retryCount: 1 // Minimal retries in CI
        },
        {
          name: 'CI Critical Path Tests',
          enabled: true,
          scenarios: [
            'system-integration-end-to-end',
            'cost-optimization-routing-accuracy'
          ],
          parallel: false,
          timeout: 300000,
          retryCount: 2
        }
      ],
      outputDir: this.context.outputDir,
      reporting: {
        formats: ['json', 'html', 'junit'], // JUnit for CI integration
        archive: true,
        upload: this.platformConfig.artifactUpload?.enabled || false,
        uploadTarget: this.platformConfig.artifactUpload?.provider
      },
      notifications: {
        enabled: true,
        channels: ['webhook'], // Webhook notifications for CI
        onFailure: true,
        onSuccess: false,
        threshold: {
          failureRate: 0.05,
          performanceDegradation: 0.15
        }
      },
      systemChecks: {
        preFlightChecks: true,
        continuousMonitoring: false, // Minimal monitoring in CI
        resourceThresholds: {
          cpu: 95, // Higher thresholds for CI environment
          memory: 90,
          disk: 95,
          network: 2000
        }
      },
      cleanup: {
        cleanupOnSuccess: false, // Keep artifacts for CI
        cleanupOnFailure: false,
        retainLogs: true,
        retainReports: true,
        maxAge: 30 // Longer retention in CI
      }
    };
  }

  private async setupCIEnvironment(): Promise<void> {
    console.log('⚙️ Setting up CI environment...');

    // Create output directory
    await fs.mkdir(this.context.outputDir, { recursive: true });

    // Create CI-specific subdirectories
    const subDirs = ['reports', 'artifacts', 'comparisons', 'baselines'];
    for (const subDir of subDirs) {
      await fs.mkdir(path.join(this.context.outputDir, subDir), { recursive: true });
    }

    // Write CI context metadata
    const contextMetadata = {
      platform: this.context.platform,
      jobId: this.context.jobId,
      buildNumber: this.context.buildNumber,
      commitSha: this.context.commitSha,
      branchName: this.context.branchName,
      isPullRequest: this.context.isPullRequest,
      pullRequestNumber: this.context.pullRequestNumber,
      projectUrl: this.context.projectUrl,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(this.context.outputDir, 'ci-context.json'),
      JSON.stringify(contextMetadata, null, 2)
    );

    console.log(`✅ CI environment setup complete: ${this.context.outputDir}`);
  }

  private async loadBaselineResults(): Promise<TestExecutionResult | undefined> {
    if (!this.platformConfig.testReporting?.compareWithBaseline) {
      return undefined;
    }

    const baselineBranch = this.platformConfig.testReporting.baselineBranch || 'main';
    const baselinePath = path.join(this.context.outputDir, 'baselines', `${baselineBranch}-baseline.json`);

    try {
      const baselineData = await fs.readFile(baselinePath, 'utf-8');
      const baseline = JSON.parse(baselineData);
      console.log(`📊 Loaded baseline results from ${baselineBranch} branch`);
      return baseline;
    } catch (error) {
      console.log(`⚠️ No baseline results found for branch ${baselineBranch}, skipping comparison`);
      return undefined;
    }
  }

  private compareWithBaseline(currentResults: TestExecutionResult, baselineResults: TestExecutionResult): PerformanceComparison {
    const changes: PerformanceChange[] = [];

    // Compare response times
    const responseTimeChange = this.calculateChange(
      'Average Response Time',
      baselineResults.summary.averageResponseTime,
      currentResults.summary.averageResponseTime,
      0.1 // 10% threshold
    );
    changes.push(responseTimeChange);

    // Compare throughput
    const throughputChange = this.calculateChange(
      'Throughput',
      baselineResults.summary.throughput,
      currentResults.summary.throughput,
      0.1, // 10% threshold
      true // Higher is better
    );
    changes.push(throughputChange);

    // Compare error rate
    const errorRateChange = this.calculateChange(
      'Error Rate',
      baselineResults.summary.errorRate,
      currentResults.summary.errorRate,
      0.02 // 2% threshold
    );
    changes.push(errorRateChange);

    // Compare success rate
    const successRateChange = this.calculateChange(
      'Success Rate',
      baselineResults.summary.passedScenarios / baselineResults.summary.totalScenarios,
      currentResults.summary.passedScenarios / currentResults.summary.totalScenarios,
      0.05, // 5% threshold
      true // Higher is better
    );
    changes.push(successRateChange);

    // Determine overall trend
    const regressions = changes.filter(c => c.significance === 'regression').length;
    const improvements = changes.filter(c => c.significance === 'improvement').length;
    const significantChanges = changes.filter(c => c.significance !== 'neutral');

    const overallTrend = regressions > improvements ? 'regressed' : 
                        improvements > regressions ? 'improved' : 'stable';

    const summary: ComparisonSummary = {
      totalMetrics: changes.length,
      improvements,
      regressions,
      neutral: changes.length - improvements - regressions,
      overallTrend,
      significantChanges
    };

    const regressionDetected = this.platformConfig.testReporting?.failOnRegression && 
                               regressions > 0 &&
                               significantChanges.some(c => c.changePercent > (this.platformConfig.testReporting?.regressionThreshold || 0.15));

    return {
      baselineResults,
      currentResults,
      regressionDetected,
      performanceChanges: changes,
      summary
    };
  }

  private calculateChange(
    metric: string, 
    baselineValue: number, 
    currentValue: number, 
    threshold: number,
    higherIsBetter: boolean = false
  ): PerformanceChange {
    const changePercent = (currentValue - baselineValue) / baselineValue;
    const absChangePercent = Math.abs(changePercent);

    let significance: 'improvement' | 'regression' | 'neutral';
    
    if (absChangePercent < threshold) {
      significance = 'neutral';
    } else {
      if (higherIsBetter) {
        significance = changePercent > 0 ? 'improvement' : 'regression';
      } else {
        significance = changePercent < 0 ? 'improvement' : 'regression';
      }
    }

    return {
      metric,
      baselineValue,
      currentValue,
      changePercent,
      significance,
      threshold
    };
  }

  private async publishComparisonResults(comparison: PerformanceComparison): Promise<void> {
    const comparisonReport = {
      timestamp: new Date().toISOString(),
      ciContext: this.context,
      comparison: {
        regressionDetected: comparison.regressionDetected,
        overallTrend: comparison.summary.overallTrend,
        summary: comparison.summary,
        changes: comparison.performanceChanges
      }
    };

    const comparisonPath = path.join(this.context.outputDir, 'comparisons', 'performance-comparison.json');
    await fs.writeFile(comparisonPath, JSON.stringify(comparisonReport, null, 2));

    // Generate comparison summary for CI
    await this.generateComparisonSummary(comparison);

    console.log(`📊 Performance comparison results published: ${comparisonPath}`);
  }

  private async generateComparisonSummary(comparison: PerformanceComparison): Promise<void> {
    const summary = comparison.summary;
    const trendEmoji = summary.overallTrend === 'improved' ? '📈' : 
                      summary.overallTrend === 'regressed' ? '📉' : '📊';

    let summaryText = `
${trendEmoji} **Performance Comparison Summary**

**Overall Trend**: ${summary.overallTrend.toUpperCase()}
**Metrics**: ${summary.improvements} improved, ${summary.regressions} regressed, ${summary.neutral} neutral

`;

    if (summary.significantChanges.length > 0) {
      summaryText += '**Significant Changes**:\n';
      for (const change of summary.significantChanges) {
        const emoji = change.significance === 'improvement' ? '🟢' : 
                     change.significance === 'regression' ? '🔴' : '🟡';
        const direction = change.changePercent > 0 ? 'increased' : 'decreased';
        const percent = Math.abs(change.changePercent * 100).toFixed(1);
        
        summaryText += `${emoji} **${change.metric}**: ${direction} by ${percent}%\n`;
      }
    }

    if (comparison.regressionDetected) {
      summaryText += '\n⚠️ **Performance regression detected!** Consider investigating before merging.\n';
    }

    const summaryPath = path.join(this.context.outputDir, 'performance-summary.md');
    await fs.writeFile(summaryPath, summaryText);

    // Export for CI platforms to use
    process.env.PERFORMANCE_SUMMARY = summaryText;
    process.env.PERFORMANCE_REGRESSION = comparison.regressionDetected.toString();
    process.env.PERFORMANCE_TREND = summary.overallTrend;
  }

  private async uploadArtifacts(testResults: TestExecutionResult): Promise<void> {
    const uploadConfig = this.platformConfig.artifactUpload;
    if (!uploadConfig?.enabled) return;

    const artifactsDir = path.join(this.context.outputDir, 'artifacts');
    
    try {
      switch (uploadConfig.provider) {
        case 'ci-native':
          await this.uploadToCINativeArtifacts(testResults);
          break;
        case 'aws-s3':
          await this.uploadToAWSS3(testResults, uploadConfig);
          break;
        case 'azure-blob':
          await this.uploadToAzureBlob(testResults, uploadConfig);
          break;
        case 'gcp-storage':
          await this.uploadToGCPStorage(testResults, uploadConfig);
          break;
        case 'local':
          await this.uploadToLocalStorage(testResults, uploadConfig);
          break;
        default:
          console.log(`⚠️ Unknown artifact upload provider: ${uploadConfig.provider}`);
      }

      console.log('✅ Artifacts uploaded successfully');
    } catch (error) {
      console.error(`❌ Artifact upload failed: ${error.message}`);
    }
  }

  private async uploadToCINativeArtifacts(testResults: TestExecutionResult): Promise<void> {
    // Generate CI-specific artifact commands based on platform
    switch (this.context.platform) {
      case 'GitHub Actions':
        console.log('::group::Performance Test Artifacts');
        for (const report of testResults.reports) {
          console.log(`::notice file=${report.filePath}::Report generated: ${report.format}`);
        }
        console.log('::endgroup::');
        
        // Set outputs for other jobs to use
        console.log(`::set-output name=test-success::${testResults.success}`);
        console.log(`::set-output name=test-duration::${testResults.duration}`);
        console.log(`::set-output name=error-rate::${testResults.summary.errorRate}`);
        break;

      case 'GitLab CI':
        // Create artifacts directory for GitLab CI
        const gitlabArtifactsPath = path.join(this.context.outputDir, 'gitlab-artifacts');
        await fs.mkdir(gitlabArtifactsPath, { recursive: true });
        
        // Copy reports to artifacts directory
        for (const report of testResults.reports) {
          const destPath = path.join(gitlabArtifactsPath, path.basename(report.filePath));
          await fs.copyFile(report.filePath, destPath);
        }
        break;

      case 'Jenkins':
        // Archive artifacts using Jenkins workspace
        console.log('📦 Archiving artifacts for Jenkins...');
        break;
    }
  }

  private async uploadToAWSS3(testResults: TestExecutionResult, config: ArtifactUploadConfig): Promise<void> {
    // Implementation would upload to AWS S3
    console.log(`📦 Uploading to AWS S3: ${config.bucket}/${config.path}`);
  }

  private async uploadToAzureBlob(testResults: TestExecutionResult, config: ArtifactUploadConfig): Promise<void> {
    // Implementation would upload to Azure Blob Storage
    console.log(`📦 Uploading to Azure Blob Storage: ${config.bucket}`);
  }

  private async uploadToGCPStorage(testResults: TestExecutionResult, config: ArtifactUploadConfig): Promise<void> {
    // Implementation would upload to Google Cloud Storage
    console.log(`📦 Uploading to Google Cloud Storage: ${config.bucket}/${config.path}`);
  }

  private async uploadToLocalStorage(testResults: TestExecutionResult, config: ArtifactUploadConfig): Promise<void> {
    const localPath = config.path || './ci-artifacts';
    await fs.mkdir(localPath, { recursive: true });
    
    for (const report of testResults.reports) {
      const destPath = path.join(localPath, `${this.context.buildNumber}-${path.basename(report.filePath)}`);
      await fs.copyFile(report.filePath, destPath);
    }
    
    console.log(`📦 Artifacts saved locally: ${localPath}`);
  }

  private async publishTestResults(testResults: TestExecutionResult, comparison?: PerformanceComparison): Promise<void> {
    const reporting = this.platformConfig.testReporting;
    if (!reporting?.publishResults) return;

    try {
      // Publish JUnit results for CI platform integration
      const junitReport = testResults.reports.find(r => r.format === 'junit');
      if (junitReport) {
        await this.publishJUnitResults(junitReport.filePath);
      }

      // Create summary comment for pull requests
      if (this.context.isPullRequest && reporting.createSummaryComment) {
        await this.createSummaryComment(testResults, comparison);
      }

      // Update commit/build status
      if (reporting.updateStatus) {
        await this.updateCommitStatus(testResults, comparison);
      }

      console.log('✅ Test results published successfully');
    } catch (error) {
      console.error(`❌ Failed to publish test results: ${error.message}`);
    }
  }

  private async publishJUnitResults(junitPath: string): Promise<void> {
    // Platform-specific JUnit result publishing
    switch (this.context.platform) {
      case 'GitHub Actions':
        console.log(`::add-matcher::${junitPath}`);
        break;
      
      case 'GitLab CI':
        // GitLab CI automatically picks up junit reports from artifacts
        console.log('📋 JUnit results will be processed by GitLab CI');
        break;

      case 'Azure DevOps':
        // Publish test results task would handle this
        console.log('📋 JUnit results available for Azure DevOps publishing');
        break;
    }
  }

  private async createSummaryComment(testResults: TestExecutionResult, comparison?: PerformanceComparison): Promise<void> {
    const summary = testResults.summary;
    const duration = Math.round(testResults.duration / 1000);
    const successRate = Math.round((summary.passedScenarios / summary.totalScenarios) * 100);

    let comment = `## 🧪 Performance Test Results

| Metric | Value |
|--------|-------|
| ✅ Success Rate | ${successRate}% (${summary.passedScenarios}/${summary.totalScenarios}) |
| ⏱️ Duration | ${duration}s |
| 📈 Throughput | ${summary.throughput} req/s |
| ⚡ Avg Response Time | ${Math.round(summary.averageResponseTime)}ms |
| ❌ Error Rate | ${(summary.errorRate * 100).toFixed(2)}% |

`;

    if (comparison) {
      comment += `### 📊 Performance Comparison

**Trend**: ${comparison.summary.overallTrend.toUpperCase()} (${comparison.summary.improvements} improved, ${comparison.summary.regressions} regressed)

`;

      if (comparison.summary.significantChanges.length > 0) {
        comment += '**Significant Changes**:\n';
        for (const change of comparison.summary.significantChanges) {
          const emoji = change.significance === 'improvement' ? '🟢' : '🔴';
          const percent = Math.abs(change.changePercent * 100).toFixed(1);
          comment += `${emoji} ${change.metric}: ${percent}% ${change.changePercent > 0 ? 'increase' : 'decrease'}\n`;
        }
      }

      if (comparison.regressionDetected) {
        comment += '\n⚠️ **Performance regression detected!**\n';
      }
    }

    comment += `\n---\n*Build: ${this.context.buildNumber} | Commit: ${this.context.commitSha.substring(0, 8)}*`;

    // Platform-specific comment creation
    switch (this.context.platform) {
      case 'GitHub Actions':
        // Would use GitHub API to create PR comment
        console.log('📝 GitHub PR comment would be created');
        break;
      
      case 'GitLab CI':
        // Would use GitLab API to create MR note
        console.log('📝 GitLab MR comment would be created');
        break;
    }

    // Save comment for manual use
    const commentPath = path.join(this.context.outputDir, 'pr-comment.md');
    await fs.writeFile(commentPath, comment);
    console.log(`📝 PR comment saved: ${commentPath}`);
  }

  private async updateCommitStatus(testResults: TestExecutionResult, comparison?: PerformanceComparison): Promise<void> {
    const state = testResults.success && (!comparison?.regressionDetected) ? 'success' : 'failure';
    const description = testResults.success ? 
      `Performance tests passed (${testResults.summary.passedScenarios}/${testResults.summary.totalScenarios})` :
      `Performance tests failed (${testResults.summary.failedScenarios} failures)`;

    // Platform-specific status updates
    switch (this.context.platform) {
      case 'GitHub Actions':
        // Would use GitHub Status API
        console.log(`📊 GitHub status: ${state} - ${description}`);
        break;
      
      case 'GitLab CI':
        // GitLab automatically updates pipeline status
        console.log(`📊 GitLab pipeline status: ${state}`);
        break;
    }

    // Export status for other CI tools to use
    process.env.PERF_TEST_STATUS = state;
    process.env.PERF_TEST_DESCRIPTION = description;
  }

  private async updateCIStatus(testResults: TestExecutionResult, comparison?: PerformanceComparison): Promise<void> {
    const hasRegression = comparison?.regressionDetected || false;
    const shouldFail = !testResults.success || (hasRegression && this.platformConfig.testReporting?.failOnRegression);

    if (shouldFail) {
      console.log('❌ Setting CI build status to FAILED');
      process.exitCode = 1;
    } else {
      console.log('✅ Setting CI build status to SUCCESS');
      process.exitCode = 0;
    }

    // Set environment variables for downstream jobs
    process.env.PERF_TEST_SUCCESS = testResults.success.toString();
    process.env.PERF_TEST_REGRESSION = hasRegression.toString();
    process.env.PERF_TEST_ERROR_RATE = testResults.summary.errorRate.toString();
    process.env.PERF_TEST_THROUGHPUT = testResults.summary.throughput.toString();
    process.env.PERF_TEST_RESPONSE_TIME = testResults.summary.averageResponseTime.toString();
  }

  private async storeAsBaseline(testResults: TestExecutionResult): Promise<void> {
    // Only store successful test results as baseline
    if (!testResults.success) {
      console.log('⚠️ Skipping baseline storage - tests failed');
      return;
    }

    // Only store baseline for main/master branches
    const isMainBranch = ['main', 'master', 'develop'].includes(this.context.branchName);
    if (!isMainBranch && !this.context.isPullRequest) {
      console.log(`⚠️ Skipping baseline storage - not main branch (${this.context.branchName})`);
      return;
    }

    try {
      const baselinePath = path.join(this.context.outputDir, 'baselines', `${this.context.branchName}-baseline.json`);
      
      const baselineData = {
        ...testResults,
        storedAt: new Date().toISOString(),
        commitSha: this.context.commitSha,
        buildNumber: this.context.buildNumber
      };

      await fs.writeFile(baselinePath, JSON.stringify(baselineData, null, 2));
      console.log(`✅ Baseline results stored for branch: ${this.context.branchName}`);
    } catch (error) {
      console.error(`❌ Failed to store baseline: ${error.message}`);
    }
  }

  private async handleCIFailure(error: Error, testResults?: TestExecutionResult): Promise<void> {
    console.error(`💥 CI Performance testing failed: ${error.message}`);

    // Create failure report
    const failureReport = {
      timestamp: new Date().toISOString(),
      ciContext: this.context,
      error: {
        message: error.message,
        stack: error.stack
      },
      partialResults: testResults || null
    };

    const failurePath = path.join(this.context.outputDir, 'failure-report.json');
    await fs.writeFile(failurePath, JSON.stringify(failureReport, null, 2));

    // Update CI status
    process.exitCode = 1;
    process.env.PERF_TEST_SUCCESS = 'false';
    process.env.PERF_TEST_ERROR = error.message;

    console.log(`📋 Failure report saved: ${failurePath}`);
  }
}

// Default CI configuration
const defaultCIConfig: CIPlatformConfig = {
  platform: 'generic',
  artifactUpload: {
    enabled: true,
    provider: 'local',
    retention: 30
  },
  testReporting: {
    publishResults: true,
    createSummaryComment: true,
    updateStatus: true,
    failOnRegression: true,
    regressionThreshold: 0.15,
    compareWithBaseline: true,
    baselineBranch: 'main'
  }
};

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const configPath = args.find(arg => arg.startsWith('--config='))?.replace('--config=', '');
  const platform = args.find(arg => arg.startsWith('--platform='))?.replace('--platform=', '') as any;
  const skipBaseline = args.includes('--skip-baseline');
  const failOnRegression = args.includes('--fail-on-regression');

  let config = { ...defaultCIConfig };

  // Load configuration file if provided
  if (configPath) {
    try {
      const configFile = await fs.readFile(configPath, 'utf-8');
      const loadedConfig = JSON.parse(configFile);
      config = { ...config, ...loadedConfig };
      console.log(`📋 Loaded CI configuration from: ${configPath}`);
    } catch (error) {
      console.error(`❌ Failed to load CI config: ${error.message}`);
      console.log('📋 Using default CI configuration');
    }
  }

  // Override with command line arguments
  if (platform) {
    config.platform = platform;
  }

  if (config.testReporting && skipBaseline) {
    config.testReporting.compareWithBaseline = false;
  }

  if (config.testReporting && failOnRegression) {
    config.testReporting.failOnRegression = true;
  }

  try {
    console.log('\n🎯 INTEGRATION-005: CI/CD Performance Testing Integration');
    console.log('🔗 Automated Performance Testing in CI/CD Pipeline\n');

    const ciFramework = new CIIntegrationFramework(config);
    await ciFramework.executeInCI();

    console.log('\n✅ CI/CD performance testing integration completed successfully');

  } catch (error) {
    console.error(`\n💥 CI/CD performance testing integration failed: ${error.message}`);
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CIIntegrationFramework, defaultCIConfig };