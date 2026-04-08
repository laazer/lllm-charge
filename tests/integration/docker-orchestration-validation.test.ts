/**
 * Docker Orchestration Validation Tests
 * 
 * Integration tests for Docker Compose service orchestration,
 * network configuration, volume management, and inter-service communication.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as yaml from 'js-yaml';

interface DockerService {
  name: string;
  image?: string;
  build?: any;
  ports?: string[] | number[];
  environment?: Record<string, string>;
  volumes?: string[];
  networks?: string[];
  healthcheck?: any;
  deploy?: any;
  depends_on?: string[];
  restart?: string;
  logging?: {
    driver: string;
    options?: Record<string, any>;
  };
}

interface DockerComposeConfig {
  version: string;
  services: Record<string, DockerService>;
  networks?: Record<string, any>;
  volumes?: Record<string, any>;
}

interface ServiceStatus {
  name: string;
  state: string;
  health: string;
  ports: string[];
  image: string;
  isRunning: boolean;
  error?: string;
}

interface NetworkConnectivity {
  fromService: string;
  toService: string;
  toPort: number;
  isReachable: boolean;
  responseTime?: number;
  error?: string;
}

describe('Docker Orchestration Validation', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const backendDir = path.join(projectRoot, 'backend');
  const dockerComposePath = path.join(backendDir, 'docker-compose.yml');
  
  let dockerComposeConfig: DockerComposeConfig;
  let isDockerAvailable = false;

  beforeAll(async () => {
    // Set extended timeout for Docker operations
    jest.setTimeout(180000); // 3 minutes for Docker operations
    
    // Check if Docker is available
    try {
      await executeDockerCommand('docker --version', { timeout: 10000 });
      await executeDockerCommand('docker-compose --version', { timeout: 10000 });
      isDockerAvailable = true;
      console.log('✅ Docker and docker-compose are available');
    } catch (error) {
      console.warn('⚠️ Docker not available, skipping container tests:', error);
      isDockerAvailable = false;
    }
    
    // Load Docker Compose configuration
    if (fs.existsSync(dockerComposePath)) {
      try {
        const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf-8');
        dockerComposeConfig = yaml.load(dockerComposeContent) as DockerComposeConfig;
        console.log('✅ Docker Compose configuration loaded successfully');
      } catch (error) {
        console.error('Failed to load Docker Compose configuration:', error);
        throw error;
      }
    }
  });

  afterAll(async () => {
    // Cleanup any test containers
    if (isDockerAvailable) {
      try {
        await executeDockerCommand(
          `docker-compose -f ${dockerComposePath} down --volumes --remove-orphans`,
          { timeout: 60000, cwd: backendDir }
        );
        console.log('✅ Test containers cleaned up');
      } catch (error) {
        console.warn('⚠️ Container cleanup warning:', error);
      }
    }
  });

  describe('Docker Compose Configuration Validation', () => {
    it('should have valid Docker Compose structure', () => {
      expect(fs.existsSync(dockerComposePath)).toBe(true);
      expect(dockerComposeConfig).toBeDefined();
      expect(dockerComposeConfig.version).toBeDefined();
      expect(dockerComposeConfig.services).toBeDefined();
      
      // Validate version compatibility (yaml may parse 3.8 as number)
      const ver = String(dockerComposeConfig.version ?? '');
      expect(['3.8', '3.9', '3.7'].some((v) => ver.startsWith(v))).toBe(true);
      
      console.log(`✅ Docker Compose version ${dockerComposeConfig.version} validation passed`);
    });

    it('should have all required services defined', () => {
      const requiredServices = [
        'llm-charge-backend',
        'llm-charge-frontend', 
        'nginx-proxy',
        'redis-cache',
        'prometheus'
      ];
      
      for (const serviceName of requiredServices) {
        expect(dockerComposeConfig.services[serviceName]).toBeDefined();
        console.log(`✅ Service ${serviceName} is defined`);
      }
      
      const serviceCount = Object.keys(dockerComposeConfig.services).length;
      expect(serviceCount).toBeGreaterThanOrEqual(requiredServices.length);
      
      console.log(`✅ All ${requiredServices.length} required services are defined`);
    });

    it('should have proper service configuration', () => {
      const services = dockerComposeConfig.services;
      
      // Validate backend service
      const backend = services['llm-charge-backend'];
      expect(backend).toBeDefined();
      expect(backend.build || backend.image).toBeDefined();
      expect(backend.environment).toBeDefined();
      expect(backend.healthcheck).toBeDefined();
      
      // Validate frontend service
      const frontend = services['llm-charge-frontend'];
      expect(frontend).toBeDefined();
      
      // Validate Nginx proxy
      const nginx = services['nginx-proxy'];
      expect(nginx).toBeDefined();
      expect(nginx.ports).toBeDefined();
      expect(nginx.volumes).toBeDefined();
      
      // Validate Redis cache
      const redis = services['redis-cache'];
      expect(redis).toBeDefined();
      expect(redis.image).toMatch(/redis/);
      expect(redis.volumes).toBeDefined();
      
      // Validate Prometheus monitoring
      const prometheus = services['prometheus'];
      expect(prometheus).toBeDefined();
      expect(prometheus.image).toMatch(/prometheus/);
      expect(prometheus.volumes).toBeDefined();
      
      console.log('✅ Service configurations validation passed');
    });

    it('should have proper network configuration', () => {
      if (dockerComposeConfig.networks) {
        expect(dockerComposeConfig.networks).toBeDefined();
        expect(dockerComposeConfig.networks['llm-charge-network']).toBeDefined();
        
        // Validate that services are connected to the network
        const services = dockerComposeConfig.services;
        for (const [serviceName, service] of Object.entries(services)) {
          if (service.networks) {
            expect(service.networks).toContain('llm-charge-network');
          }
        }
        
        console.log('✅ Network configuration validation passed');
      }
    });

    it('should have proper volume configuration', () => {
      if (dockerComposeConfig.volumes) {
        expect(dockerComposeConfig.volumes).toBeDefined();
        
        const expectedVolumes = ['llm-charge-data', 'prometheus-data', 'redis-data'];
        for (const volumeName of expectedVolumes) {
          if (dockerComposeConfig.volumes[volumeName]) {
            console.log(`✅ Volume ${volumeName} is configured`);
          }
        }
      }
      
      // Validate service volume mounts
      const services = dockerComposeConfig.services;
      const backend = services['llm-charge-backend'];
      if (backend.volumes) {
        expect(backend.volumes.some((vol: string) => vol.includes('llm_charge_data:/app/data'))).toBe(true);
      }
      
      console.log('✅ Volume configuration validation passed');
    });
  });

  describe('Docker Compose Syntax Validation', () => {
    it('should pass docker-compose config validation', async () => {
      if (!isDockerAvailable) {
        console.log('⏭️ Skipping Docker validation (Docker not available)');
        return;
      }

      try {
        const result = await executeDockerCommand(
          `docker-compose -f ${dockerComposePath} config`,
          { timeout: 30000, cwd: backendDir }
        );
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toBe('');
        
        // Validate that the config output is valid YAML
        const configOutput = yaml.load(result.stdout);
        expect(configOutput).toBeDefined();
        
        console.log('✅ Docker Compose syntax validation passed');
      } catch (error) {
        console.error('Docker Compose config validation failed:', error);
        throw error;
      }
    });

    it('should validate environment variable substitution', async () => {
      if (!isDockerAvailable) {
        console.log('⏭️ Skipping environment validation (Docker not available)');
        return;
      }

      // Create a test .env file
      const testEnvPath = path.join(backendDir, '.env.test');
      const testEnvContent = `
APP_ENV=test
SECRET_KEY=test-secret-key
DATABASE_URL=sqlite:///./test.db
LOG_LEVEL=debug
WORKERS=2
MAX_WORKERS=4
TIMEOUT=30
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT=100
`;
      
      fs.writeFileSync(testEnvPath, testEnvContent);
      
      try {
        const result = await executeDockerCommand(
          `docker-compose -f ${dockerComposePath} --env-file .env.test config`,
          { timeout: 30000, cwd: backendDir }
        );
        
        expect(result.exitCode).toBe(0);
        
        // Validate environment variable substitution in output
        expect(result.stdout).toMatch(/APP_ENV.*test/);
        
        console.log('✅ Environment variable substitution validation passed');
      } finally {
        // Clean up test env file
        if (fs.existsSync(testEnvPath)) {
          fs.unlinkSync(testEnvPath);
        }
      }
    });
  });

  describe('Service Build Validation', () => {
    it('should validate Docker build contexts', async () => {
      if (!isDockerAvailable) {
        console.log('⏭️ Skipping build validation (Docker not available)');
        return;
      }

      const services = dockerComposeConfig.services;
      
      for (const [serviceName, service] of Object.entries(services)) {
        if (service.build) {
          const buildContext = typeof service.build === 'string' 
            ? service.build 
            : service.build.context;
          
          if (buildContext) {
            const contextPath = path.resolve(backendDir, buildContext);
            expect(fs.existsSync(contextPath)).toBe(true);
            
            // Check for Dockerfile
            const dockerfilePath = path.join(contextPath, 'Dockerfile');
            expect(fs.existsSync(dockerfilePath)).toBe(true);
            
            console.log(`✅ Build context for ${serviceName} is valid`);
          }
        }
      }
    });

    it('should validate service image specifications', () => {
      const services = dockerComposeConfig.services;
      
      for (const [serviceName, service] of Object.entries(services)) {
        // Each service should have either build or image specified
        expect(service.build || service.image).toBeDefined();
        
        if (service.image) {
          // Validate image name format (including registry paths)
          expect(service.image).toMatch(/^[a-zA-Z0-9]([a-zA-Z0-9/_.-]*[a-zA-Z0-9])*(:[a-zA-Z0-9._-]+)?$/);
          console.log(`✅ Image specification for ${serviceName}: ${service.image}`);
        }
        
        if (service.build) {
          console.log(`✅ Build specification for ${serviceName} is configured`);
        }
      }
    });
  });

  describe('Service Health Check Validation', () => {
    it('should validate health check configurations', () => {
      const services = dockerComposeConfig.services;
      
      const criticalServices = ['llm-charge-backend', 'nginx-proxy', 'redis-cache'];
      
      for (const serviceName of criticalServices) {
        const service = services[serviceName];
        
        if (service && service.healthcheck) {
          expect(service.healthcheck.test).toBeDefined();
          expect(service.healthcheck.interval).toBeDefined();
          expect(service.healthcheck.timeout).toBeDefined();
          expect(service.healthcheck.retries).toBeDefined();
          
          console.log(`✅ Health check for ${serviceName} is properly configured`);
        }
      }
    });

    it('should validate resource limits and constraints', () => {
      const services = dockerComposeConfig.services;
      
      for (const [serviceName, service] of Object.entries(services)) {
        if (service.deploy && service.deploy.resources && service.deploy.resources.limits) {
          const limits = service.deploy.resources.limits;
          
          if (limits.cpus) {
            expect(typeof limits.cpus === 'string' || typeof limits.cpus === 'number').toBe(true);
          }
          
          if (limits.memory) {
            expect(typeof limits.memory === 'string').toBe(true);
            expect(limits.memory).toMatch(/^\d+[KMGT]?[Bb]?$/);
          }
          
          console.log(`✅ Resource limits for ${serviceName} are properly configured`);
        }
      }
    });
  });

  describe('Port and Networking Validation', () => {
    it('should validate port configurations and avoid conflicts', () => {
      const services = dockerComposeConfig.services;
      const usedPorts: Set<number> = new Set();
      
      for (const [serviceName, service] of Object.entries(services)) {
        if (service.ports) {
          for (const portMapping of service.ports) {
            const portString = typeof portMapping === 'string' ? portMapping : String(portMapping);
            const hostPort = portString.split(':')[0];
            const port = parseInt(hostPort);
            
            if (!isNaN(port)) {
              expect(usedPorts.has(port)).toBe(false); // No port conflicts
              usedPorts.add(port);
              
              // Validate port range
              expect(port).toBeGreaterThan(0);
              expect(port).toBeLessThan(65536);
            }
          }
          
          console.log(`✅ Port configuration for ${serviceName} is valid`);
        }
      }
      
      console.log(`✅ No port conflicts detected across ${usedPorts.size} exposed ports`);
    });

    it('should validate network connectivity requirements', () => {
      const services = dockerComposeConfig.services;
      
      // Validate that services that need to communicate are on the same network
      const backendService = services['llm-charge-backend'];
      const frontendService = services['llm-charge-frontend'];
      const nginxService = services['nginx-proxy'];
      const redisService = services['redis-cache'];
      
      if (dockerComposeConfig.networks) {
        // All services should be on the same network for inter-service communication
        const networkName = 'llm-charge-network';
        
        [backendService, frontendService, nginxService, redisService].forEach((service, index) => {
          if (service && service.networks) {
            expect(service.networks).toContain(networkName);
          }
        });
        
        console.log('✅ Network connectivity requirements validation passed');
      }
    });
  });

  describe('Service Dependency Validation', () => {
    it('should validate service startup dependencies', () => {
      const services = dockerComposeConfig.services;

      const depKeys = (deps: unknown): string[] => {
        if (!deps) return [];
        if (Array.isArray(deps)) return deps as string[];
        if (typeof deps === 'object') return Object.keys(deps as Record<string, unknown>);
        return [];
      };

      // Nginx should depend on backend and frontend (compose may use list or long form)
      const nginx = services['nginx-proxy'];
      if (nginx?.depends_on) {
        const nd = depKeys(nginx.depends_on);
        expect(nd).toContain('llm-charge-backend');
        expect(nd).toContain('llm-charge-frontend');
      }

      console.log('✅ Service dependency validation passed');
    });

    it('should validate restart policies', () => {
      const services = dockerComposeConfig.services;
      
      for (const [serviceName, service] of Object.entries(services)) {
        if (service.restart) {
          const validRestartPolicies = ['no', 'always', 'on-failure', 'unless-stopped'];
          expect(validRestartPolicies).toContain(service.restart);
          
          console.log(`✅ Restart policy for ${serviceName}: ${service.restart}`);
        }
      }
    });
  });

  describe('Production Readiness Validation', () => {
    it('should validate production environment configurations', () => {
      const services = dockerComposeConfig.services;
      
      // Validate that services have proper environment configurations
      for (const [serviceName, service] of Object.entries(services)) {
        if (service.environment) {
          // Check that sensitive information is not hardcoded
          const envVars = Array.isArray(service.environment) 
            ? service.environment 
            : Object.entries(service.environment).map(([k, v]) => `${k}=${v}`);
          
          for (const envVar of envVars) {
            const envString = typeof envVar === 'string' ? envVar : `${envVar}`;
            
            // Should not contain hardcoded secrets (allow environment variable references)
            // Check for hardcoded values (not starting with ${)
            expect(envString.toLowerCase()).not.toMatch(/password\s*=\s*[^$][^{]/);
            expect(envString.toLowerCase()).not.toMatch(/secret\s*=\s*[^$][^{]/);
            expect(envString.toLowerCase()).not.toMatch(/key\s*=\s*[^$][^{]/);
          }
          
          console.log(`✅ Environment configuration for ${serviceName} follows security best practices`);
        }
      }
    });

    it('should validate logging configurations', () => {
      const services = dockerComposeConfig.services;
      
      for (const [serviceName, service] of Object.entries(services)) {
        if (service.logging) {
          expect(service.logging.driver).toBeDefined();
          
          // Validate driver options if present
          if (service.logging.options) {
            expect(typeof service.logging.options).toBe('object');
          }
          
          console.log(`✅ Logging configuration for ${serviceName} is properly set`);
        }
      }
    });
  });
});

// Helper function to execute Docker commands with proper error handling
async function executeDockerCommand(
  command: string,
  options: { timeout?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const { timeout = 60000, cwd = process.cwd() } = options;
    
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
      reject(new Error(`Docker command timed out after ${timeout}ms: ${command}`));
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