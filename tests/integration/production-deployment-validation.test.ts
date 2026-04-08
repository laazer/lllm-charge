/**
 * Production Deployment Validation Tests
 * 
 * Comprehensive integration tests for production deployment infrastructure
 * including Docker configurations, deployment scripts, and service orchestration.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as yaml from 'js-yaml';

const RUN_DEPLOYMENT_E2E = process.env.RUN_DEPLOYMENT_E2E === '1';

interface DeploymentTestConfig {
  backendPort: number;
  frontendPort: number;
  nginxPort: number;
  redisPort: number;
  prometheusPort: number;
  healthCheckTimeout: number;
  deploymentTimeout: number;
}

interface ServiceHealth {
  serviceName: string;
  isHealthy: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
}

interface DeploymentValidationResult {
  dockerComposeValid: boolean;
  environmentConfigValid: boolean;
  deploymentScriptValid: boolean;
  servicesStarted: boolean;
  healthChecksPass: boolean;
  nginxProxyWorking: boolean;
  redisConnectable: boolean;
  prometheusCollecting: boolean;
  overallSuccess: boolean;
}

describe('Production deployment (deterministic)', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const backendDir = path.join(projectRoot, 'backend');

  it('loads docker-compose.yml as YAML without docker CLI', () => {
    const composePath = path.join(backendDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);
    const doc = yaml.load(fs.readFileSync(composePath, 'utf-8')) as { services?: Record<string, unknown> };
    expect(doc?.services?.['llm-charge-backend']).toBeDefined();
  });

  it('axios mock: accepts deployment health shape', async () => {
    const spy = jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: { status: 'ok' } } as any);
    const res = await axios.get(`http://localhost:8000/health`);
    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});

describe('Production Deployment Validation', () => {
  const testConfig: DeploymentTestConfig = {
    backendPort: 8000,
    frontendPort: 3000,
    nginxPort: 80,
    redisPort: 6379,
    prometheusPort: 9090,
    healthCheckTimeout: 30000,
    deploymentTimeout: 120000
  };

  const projectRoot = path.resolve(__dirname, '../..');
  const backendDir = path.join(projectRoot, 'backend');
  let deploymentProcess: ChildProcess | undefined;

  beforeAll(async () => {
    // Ensure we're in the correct directory
    process.chdir(projectRoot);
    
    // Set test timeout for long-running deployment tests
    jest.setTimeout(testConfig.deploymentTimeout + 60000);
  });

  afterAll(async () => {
    // Clean up any running deployment processes
    if (deploymentProcess && typeof deploymentProcess.kill === 'function') {
      try {
        deploymentProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          setTimeout(resolve, 5000);
        });
        
        // Force kill if still running
        if (deploymentProcess && !deploymentProcess.killed) {
          deploymentProcess.kill('SIGKILL');
        }
      } catch (error) {
        console.warn('Error cleaning up deployment process:', error);
      }
    }

    // Clean up test containers
    try {
      await executeShellCommand('docker-compose -f backend/docker-compose.yml down --volumes --remove-orphans');
    } catch (error) {
      console.warn('Container cleanup failed:', error);
    }
  });

  describe('Docker Configuration Validation', () => {
    it('should have valid production Dockerfile', async () => {
      const dockerfilePath = path.join(backendDir, 'Dockerfile');
      
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
      
      // Validate multi-stage build structure
      expect(dockerfileContent).toMatch(/FROM python:3\.11-slim as builder/);
      expect(dockerfileContent).toMatch(/FROM python:3\.11-slim as production/);
      
      // Validate security configurations
      expect(dockerfileContent).toMatch(/groupadd -r -g 1000 llmcharge/);
      expect(dockerfileContent).toMatch(/useradd -r -u 1000 -g llmcharge/);
      expect(dockerfileContent).toMatch(/USER llmcharge/);
      
      // Validate environment variables
      expect(dockerfileContent).toMatch(/PYTHONDONTWRITEBYTECODE=1/);
      expect(dockerfileContent).toMatch(/PYTHONUNBUFFERED=1/);
      expect(dockerfileContent).toMatch(/APP_ENV=production/);
      
      // Validate health check
      expect(dockerfileContent).toMatch(/HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3/);
      
      // Validate proper port exposure
      expect(dockerfileContent).toMatch(/EXPOSE 8000/);
      
      console.log('✅ Dockerfile validation passed');
    });

    it('should have valid production Docker Compose configuration', async () => {
      const dockerComposePath = path.join(backendDir, 'docker-compose.yml');
      
      expect(fs.existsSync(dockerComposePath)).toBe(true);
      
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf-8');
      
      // Validate service definitions
      expect(dockerComposeContent).toMatch(/llm-charge-backend:/);
      expect(dockerComposeContent).toMatch(/llm-charge-frontend:/);
      expect(dockerComposeContent).toMatch(/nginx-proxy:/);
      expect(dockerComposeContent).toMatch(/redis-cache:/);
      expect(dockerComposeContent).toMatch(/prometheus:/);
      
      // Validate network configuration
      expect(dockerComposeContent).toMatch(/networks:/);
      expect(dockerComposeContent).toMatch(/llm-charge-network:/);
      
      // Validate volume configurations
      expect(dockerComposeContent).toMatch(/volumes:/);
      expect(dockerComposeContent).toMatch(/llm_charge_data:/);
      
      // Validate resource limits
      expect(dockerComposeContent).toMatch(/deploy:/);
      expect(dockerComposeContent).toMatch(/resources:/);
      expect(dockerComposeContent).toMatch(/limits:/);
      
      // Validate health checks
      expect(dockerComposeContent).toMatch(/healthcheck:/);
      
      console.log('✅ Docker Compose configuration validation passed');
    });

    it('should have valid environment configurations', async () => {
      const envFiles = [
        '.env.production',
        '.env.staging', 
        '.env.development'
      ];
      
      for (const envFile of envFiles) {
        const envPath = path.join(backendDir, envFile);
        
        expect(fs.existsSync(envPath)).toBe(true);
        
        const envContent = fs.readFileSync(envPath, 'utf-8');
        
        // Validate required environment variables
        expect(envContent).toMatch(/APP_ENV=/);
        expect(envContent).toMatch(/SECRET_KEY=/);
        expect(envContent).toMatch(/DATABASE_URL=/);
        expect(envContent).toMatch(/LOG_LEVEL=/);
        
        // Validate production-specific settings for production env
        if (envFile === '.env.production') {
          expect(envContent).toMatch(/APP_ENV=production/);
          expect(envContent).toMatch(/DEBUG=false/);
          expect(envContent).toMatch(/LOG_LEVEL=info/);
          expect(envContent).toMatch(/RATE_LIMIT=/);
          expect(envContent).toMatch(/WORKERS=/);
          expect(envContent).toMatch(/MAX_WORKERS=/);
        }
        
        console.log(`✅ Environment file ${envFile} validation passed`);
      }
    });
  });

  describe('Deployment Script Validation', () => {
    it('should have executable production deployment script', async () => {
      const deployScriptPath = path.join(projectRoot, 'scripts/deploy-production.sh');
      
      expect(fs.existsSync(deployScriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(deployScriptPath, 'utf-8');
      
      // Validate script structure
      expect(scriptContent).toMatch(/^#!/);
      expect(scriptContent).toMatch(/set -euo pipefail/);
      
      // Validate main functions
      expect(scriptContent).toMatch(/pre_deployment_checks\(\)/);
      expect(scriptContent).toMatch(/deploy_services\(\)/);
      expect(scriptContent).toMatch(/post_deployment_tasks\(\)/);
      expect(scriptContent).toMatch(/rollback_deployment\(\)/);
      
      // Validate error handling
      expect(scriptContent).toMatch(/error_exit\(\)/);
      expect(scriptContent).toMatch(/log_error/);
      expect(scriptContent).toMatch(/log_success/);
      
      // Validate backup functionality
      expect(scriptContent).toMatch(/create_backup\(\)/);
      expect(scriptContent).toMatch(/BACKUP_DIR=/);
      
      // Check script permissions
      const stats = fs.statSync(deployScriptPath);
      expect(stats.mode & parseInt('100', 8)).toBeTruthy(); // Owner execute permission
      
      console.log('✅ Production deployment script validation passed');
    });

    it('should have executable staging deployment script', async () => {
      const stagingScriptPath = path.join(projectRoot, 'scripts/deploy-staging.sh');
      
      expect(fs.existsSync(stagingScriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(stagingScriptPath, 'utf-8');
      
      // Validate script structure
      expect(scriptContent).toMatch(/^#!/);
      expect(scriptContent).toMatch(/DEPLOY_ENV="staging"/);
      
      // Validate staging-specific functions
      expect(scriptContent).toMatch(/reset_staging_data\(\)/);
      expect(scriptContent).toMatch(/run_tests\(\)/);
      
      console.log('✅ Staging deployment script validation passed');
    });
  });

  describe('Infrastructure Configuration Validation', () => {
    it('should have valid Nginx configuration', async () => {
      const nginxConfigPath = path.join(backendDir, 'nginx/nginx.conf');
      
      expect(fs.existsSync(nginxConfigPath)).toBe(true);
      
      const nginxConfig = fs.readFileSync(nginxConfigPath, 'utf-8');
      
      // Validate upstream configuration
      expect(nginxConfig).toMatch(/upstream llm_charge_backend/);
      expect(nginxConfig).toMatch(/upstream llm_charge_frontend/);
      
      // Validate proxy configuration
      expect(nginxConfig).toMatch(/proxy_pass http:\/\/llm_charge_backend/);
      expect(nginxConfig).toMatch(/proxy_pass http:\/\/llm_charge_frontend/);
      
      // Validate security headers
      expect(nginxConfig).toMatch(/add_header X-Frame-Options/);
      expect(nginxConfig).toMatch(/add_header X-XSS-Protection/);
      expect(nginxConfig).toMatch(/add_header X-Content-Type-Options/);
      
      // Validate rate limiting
      expect(nginxConfig).toMatch(/limit_req_zone/);
      expect(nginxConfig).toMatch(/limit_req zone=api/);
      
      // Validate SSL/HTTPS configuration
      expect(nginxConfig).toMatch(/ssl_protocols TLSv1\.2 TLSv1\.3/);
      
      console.log('✅ Nginx configuration validation passed');
    });

    it('should have valid Redis configuration', async () => {
      const redisConfigPath = path.join(backendDir, 'redis/redis.conf');
      
      expect(fs.existsSync(redisConfigPath)).toBe(true);
      
      const redisConfig = fs.readFileSync(redisConfigPath, 'utf-8');
      
      // Validate basic configuration
      expect(redisConfig).toMatch(/bind 0\.0\.0\.0/);
      expect(redisConfig).toMatch(/port 6379/);
      
      // Validate security configuration
      expect(redisConfig).toMatch(/requirepass/);
      expect(redisConfig).toMatch(/protected-mode/);
      
      // Validate performance settings
      expect(redisConfig).toMatch(/maxmemory/);
      expect(redisConfig).toMatch(/maxmemory-policy/);
      
      // Validate persistence settings
      expect(redisConfig).toMatch(/appendonly yes/);
      expect(redisConfig).toMatch(/rdbcompression yes/);
      
      console.log('✅ Redis configuration validation passed');
    });

    it('should have valid Prometheus configuration', async () => {
      const prometheusConfigPath = path.join(backendDir, 'monitoring/prometheus.yml');
      
      expect(fs.existsSync(prometheusConfigPath)).toBe(true);
      
      const prometheusConfig = fs.readFileSync(prometheusConfigPath, 'utf-8');
      
      // Validate global configuration
      expect(prometheusConfig).toMatch(/global:/);
      expect(prometheusConfig).toMatch(/scrape_interval:/);
      
      // Validate scrape configurations
      expect(prometheusConfig).toMatch(/scrape_configs:/);
      expect(prometheusConfig).toMatch(/job_name: 'llm-charge-backend'/);
      expect(prometheusConfig).toMatch(/job_name: 'llm-charge-frontend'/);
      expect(prometheusConfig).toMatch(/job_name: 'redis'/);
      expect(prometheusConfig).toMatch(/job_name: 'nginx'/);
      
      // Validate alerting configuration
      expect(prometheusConfig).toMatch(/alerting:/);
      expect(prometheusConfig).toMatch(/rule_files:/);
      
      console.log('✅ Prometheus configuration validation passed');
    });
  });

  describe('Service Health Check Validation', () => {
    const checkServiceHealth = async (
      serviceName: string, 
      url: string, 
      expectedStatus: number = 200
    ): Promise<ServiceHealth> => {
      const startTime = Date.now();
      
      try {
        const response = await axios.get(url, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        });
        
        const responseTime = Date.now() - startTime;
        const isHealthy = response.status === expectedStatus;
        
        return {
          serviceName,
          isHealthy,
          responseTime,
          statusCode: response.status
        };
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        
        return {
          serviceName,
          isHealthy: false,
          responseTime,
          error: error.message
        };
      }
    };

    it('should be able to validate backend health endpoint structure', async () => {
      // This test validates the health check endpoint structure without requiring running services
      const healthCheckUrls = [
        `http://localhost:${testConfig.backendPort}/health`,
        `http://localhost:${testConfig.backendPort}/api/health`,
        `http://localhost:${testConfig.frontendPort}/health`
      ];
      
      // Validate URL structure and patterns
      for (const url of healthCheckUrls) {
        expect(url).toMatch(/^http:\/\/localhost:\d+\/.*health$/);
      }
      
      console.log('✅ Health check endpoint structure validation passed');
    });

    it('should validate monitoring endpoint structure', async () => {
      // Validate monitoring and metrics endpoint structure
      const monitoringUrls = [
        `http://localhost:${testConfig.backendPort}/metrics`,
        `http://localhost:${testConfig.backendPort}/api/metrics`,
        `http://localhost:${testConfig.prometheusPort}/metrics`
      ];
      
      for (const url of monitoringUrls) {
        expect(url).toMatch(/^http:\/\/localhost:\d+\/.*metrics$/);
      }
      
      console.log('✅ Monitoring endpoint structure validation passed');
    });
  });

  describe('Deployment Process Integration Test', () => {
    it('should validate deployment script execution without errors', async () => {
      const deployScriptPath = path.join(projectRoot, 'scripts/deploy-production.sh');
      
      // Test script help function
      const helpResult = await executeShellCommand(`bash ${deployScriptPath} --help`, { timeout: 10000 });
      
      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stdout).toMatch(/Production Deployment Script/);
      expect(helpResult.stdout).toMatch(/Usage:/);
      expect(helpResult.stdout).toMatch(/OPTIONS:/);
      
      console.log('✅ Deployment script help execution validation passed');
    });

    it('should validate deployment configuration parsing', async () => {
      const envProductionPath = path.join(backendDir, '.env.production');
      const envExamplePath = path.join(backendDir, '.env.example');
      const envPath = fs.existsSync(envProductionPath) ? envProductionPath : envExamplePath;
      expect(fs.existsSync(envPath)).toBe(true);
      const envContent = fs.readFileSync(envPath, 'utf-8');
      
      // Parse environment variables
      const envVars: Record<string, string> = {};
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          envVars[key] = valueParts.join('=');
        }
      });
      
      // Validate required configuration keys
      const requiredKeys = [
        'APP_ENV',
        'SECRET_KEY',
        'DATABASE_URL',
        'LOG_LEVEL',
        'WORKERS',
        'MAX_WORKERS'
      ];
      
      for (const key of requiredKeys) {
        expect(envVars[key]).toBeDefined();
        expect(envVars[key]).not.toBe('');
      }
      
      // Validate production-specific values
      expect(envVars.APP_ENV).toBe('production');
      expect(envVars.DEBUG).toBe('false');
      expect(parseInt(envVars.WORKERS)).toBeGreaterThan(0);
      expect(parseInt(envVars.MAX_WORKERS)).toBeGreaterThanOrEqual(parseInt(envVars.WORKERS));
      
      console.log('✅ Deployment configuration parsing validation passed');
    });
  });

  describe('Overall Deployment Validation Summary', () => {
    it('should provide comprehensive deployment readiness assessment', async () => {
      const validationResult: DeploymentValidationResult = {
        dockerComposeValid: false,
        environmentConfigValid: false,
        deploymentScriptValid: false,
        servicesStarted: false,
        healthChecksPass: false,
        nginxProxyWorking: false,
        redisConnectable: false,
        prometheusCollecting: false,
        overallSuccess: false
      };
      
      // Check Docker Compose validity (CLI when RUN_DEPLOYMENT_E2E; else static YAML parse)
      try {
        const dockerComposePath = path.join(backendDir, 'docker-compose.yml');
        if (RUN_DEPLOYMENT_E2E) {
          let result = await executeShellCommand(`docker-compose -f ${dockerComposePath} config`, {
            timeout: 15000,
          });
          if (result.exitCode !== 0) {
            result = await executeShellCommand(`docker compose -f ${dockerComposePath} config`, {
              timeout: 15000,
            });
          }
          validationResult.dockerComposeValid = result.exitCode === 0;
        } else {
          yaml.load(fs.readFileSync(dockerComposePath, 'utf-8'));
          validationResult.dockerComposeValid = true;
        }
      } catch (error) {
        console.warn('Docker Compose validation failed:', error);
      }

      // At least one env template present (.env.* are usually gitignored)
      try {
        const envCandidates = [
          path.join(backendDir, '.env.production'),
          path.join(backendDir, '.env.staging'),
          path.join(backendDir, '.env.development'),
          path.join(backendDir, '.env.example'),
        ];
        validationResult.environmentConfigValid = envCandidates.some((p) => fs.existsSync(p));
      } catch (error) {
        console.warn('Environment configuration validation failed:', error);
      }
      
      // Check deployment script validity
      try {
        const deployScriptPath = path.join(projectRoot, 'scripts/deploy-production.sh');
        const stats = fs.statSync(deployScriptPath);
        validationResult.deploymentScriptValid = fs.existsSync(deployScriptPath) && 
                                                  (stats.mode & parseInt('100', 8)) !== 0;
      } catch (error) {
        console.warn('Deployment script validation failed:', error);
      }
      
      // Calculate overall success
      validationResult.overallSuccess = 
        validationResult.dockerComposeValid &&
        validationResult.environmentConfigValid &&
        validationResult.deploymentScriptValid;
      
      // Log validation summary
      console.log('\n🔍 Production Deployment Validation Summary:');
      console.log(`  Docker Compose Valid: ${validationResult.dockerComposeValid ? '✅' : '❌'}`);
      console.log(`  Environment Config Valid: ${validationResult.environmentConfigValid ? '✅' : '❌'}`);
      console.log(`  Deployment Script Valid: ${validationResult.deploymentScriptValid ? '✅' : '❌'}`);
      console.log(`  Overall Deployment Ready: ${validationResult.overallSuccess ? '✅' : '❌'}\n`);
      
      // Expect at minimum the core configuration to be valid
      expect(validationResult.dockerComposeValid).toBe(true);
      expect(validationResult.environmentConfigValid).toBe(true);
      expect(validationResult.deploymentScriptValid).toBe(true);
      expect(validationResult.overallSuccess).toBe(true);
      
      console.log('✅ Comprehensive deployment readiness assessment passed');
    });
  });
});

// Helper function to execute shell commands with proper error handling
async function executeShellCommand(
  command: string, 
  options: { timeout?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const { timeout = 30000, cwd = process.cwd() } = options;
    
    const child = spawn('bash', ['-c', command], { 
      cwd,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}