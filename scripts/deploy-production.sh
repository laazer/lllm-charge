#!/bin/bash

# Production Deployment Script for LLM-Charge Platform
# Usage: ./scripts/deploy-production.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
DEPLOY_ENV="production"
BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

trap cleanup EXIT

# Help function
show_help() {
    cat << EOF
Production Deployment Script for LLM-Charge Platform

Usage: $0 [OPTIONS]

OPTIONS:
    -h, --help          Show this help message
    -b, --backup        Create backup before deployment
    -s, --skip-tests    Skip running tests before deployment
    -f, --force         Force deployment without confirmation
    -v, --verbose       Enable verbose output
    --rollback          Rollback to previous version
    --status            Check deployment status

EXAMPLES:
    $0                  # Standard production deployment
    $0 -b -v           # Deployment with backup and verbose output
    $0 --rollback      # Rollback to previous version
    $0 --status        # Check current deployment status

EOF
}

# Parse command line arguments
BACKUP_BEFORE_DEPLOY=false
SKIP_TESTS=false
FORCE_DEPLOY=false
VERBOSE=false
ROLLBACK=false
CHECK_STATUS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--backup)
            BACKUP_BEFORE_DEPLOY=true
            shift
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --status)
            CHECK_STATUS=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Enable verbose mode if requested
if [[ "$VERBOSE" == true ]]; then
    set -x
fi

# Check deployment status
check_deployment_status() {
    log_info "Checking deployment status..."
    
    # Check if containers are running
    if docker-compose -f "$BACKEND_DIR/docker-compose.yml" ps | grep -q "Up"; then
        log_success "LLM-Charge services are running"
        docker-compose -f "$BACKEND_DIR/docker-compose.yml" ps
    else
        log_warn "LLM-Charge services are not running"
    fi
    
    # Check service health
    log_info "Checking service health..."
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        log_success "Backend service is healthy"
    else
        log_warn "Backend service health check failed"
    fi
    
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Frontend service is healthy"
    else
        log_warn "Frontend service health check failed"
    fi
}

# Rollback function
rollback_deployment() {
    log_info "Rolling back to previous deployment..."
    
    # Stop current services
    log_info "Stopping current services..."
    cd "$BACKEND_DIR"
    docker-compose -f docker-compose.yml down
    
    # Restore from backup
    if [[ -d "$PROJECT_ROOT/backups" ]]; then
        LATEST_BACKUP=$(ls -td "$PROJECT_ROOT/backups"/* | head -1)
        if [[ -n "$LATEST_BACKUP" ]]; then
            log_info "Restoring from backup: $LATEST_BACKUP"
            cp -r "$LATEST_BACKUP"/* "$PROJECT_ROOT/"
            log_success "Backup restored successfully"
        else
            error_exit "No backup found for rollback"
        fi
    else
        error_exit "Backup directory not found"
    fi
    
    # Restart services
    log_info "Restarting services..."
    docker-compose -f docker-compose.yml up -d
    
    log_success "Rollback completed successfully"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error_exit "Docker is not running. Please start Docker and try again."
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        error_exit "docker-compose is not installed or not in PATH"
    fi
    
    # Check if environment file exists
    if [[ ! -f "$BACKEND_DIR/.env.production" ]]; then
        error_exit "Production environment file not found: $BACKEND_DIR/.env.production"
    fi
    
    # Check if required directories exist
    mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs"
    
    log_success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" == true ]]; then
        log_info "Creating backup before deployment..."
        mkdir -p "$BACKUP_DIR"
        
        # Backup data directory
        if [[ -d "$PROJECT_ROOT/data" ]]; then
            cp -r "$PROJECT_ROOT/data" "$BACKUP_DIR/"
            log_info "Data directory backed up"
        fi
        
        # Backup logs directory
        if [[ -d "$PROJECT_ROOT/logs" ]]; then
            cp -r "$PROJECT_ROOT/logs" "$BACKUP_DIR/"
            log_info "Logs directory backed up"
        fi
        
        # Backup configuration files
        cp "$BACKEND_DIR/.env.production" "$BACKUP_DIR/"
        cp "$BACKEND_DIR/docker-compose.yml" "$BACKUP_DIR/"
        
        log_success "Backup created at: $BACKUP_DIR"
    fi
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == false ]]; then
        log_info "Running tests before deployment..."
        
        cd "$PROJECT_ROOT"
        
        # Run backend tests
        if [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
            log_info "Running Python backend tests..."
            cd "$BACKEND_DIR"
            if command -v pytest > /dev/null 2>&1; then
                python -m pytest tests/ -v || error_exit "Backend tests failed"
            else
                log_warn "pytest not found, skipping Python tests"
            fi
            cd "$PROJECT_ROOT"
        fi
        
        # Run Node.js tests
        if [[ -f "package.json" ]]; then
            log_info "Running Node.js tests..."
            npm test || error_exit "Node.js tests failed"
        fi
        
        log_success "All tests passed"
    else
        log_warn "Skipping tests as requested"
    fi
}

# Build and deploy
deploy_services() {
    log_info "Building and deploying LLM-Charge services..."
    
    cd "$BACKEND_DIR"
    
    # Copy production environment file
    cp .env.production .env
    
    # Pull latest images
    log_info "Pulling latest base images..."
    docker-compose -f docker-compose.yml pull
    
    # Build services
    log_info "Building services..."
    docker-compose -f docker-compose.yml build --no-cache
    
    # Stop existing services
    log_info "Stopping existing services..."
    docker-compose -f docker-compose.yml down --remove-orphans
    
    # Start services
    log_info "Starting services..."
    docker-compose -f docker-compose.yml up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Verify deployment
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            log_success "Backend service is healthy"
            break
        else
            log_warn "Attempt $attempt/$max_attempts: Backend service not yet healthy"
            sleep 10
            ((attempt++))
        fi
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error_exit "Backend service failed to become healthy after $max_attempts attempts"
    fi
    
    log_success "Deployment completed successfully"
}

# Post-deployment tasks
post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    # Run database migrations if needed
    log_info "Checking for database migrations..."
    docker-compose -f "$BACKEND_DIR/docker-compose.yml" exec -T llm-charge-backend python -m alembic upgrade head || log_warn "Database migration check failed"
    
    # Warm up caches
    log_info "Warming up application caches..."
    curl -sf http://localhost:8000/health > /dev/null 2>&1 || log_warn "Cache warm-up failed"
    
    # Display deployment information
    log_info "Deployment Information:"
    echo "  Backend URL: http://localhost:8000"
    echo "  Frontend URL: http://localhost:3000"
    echo "  Health Check: http://localhost:8000/health"
    echo "  Metrics: http://localhost:9090 (Prometheus)"
    echo "  API Docs: http://localhost:8000/docs"
    
    log_success "Post-deployment tasks completed"
}

# Confirmation prompt
confirm_deployment() {
    if [[ "$FORCE_DEPLOY" == false ]]; then
        echo
        log_warn "You are about to deploy to PRODUCTION environment."
        echo "This will:"
        echo "  - Stop existing services"
        echo "  - Build new container images"
        echo "  - Start new services with production configuration"
        echo "  - Potentially cause service downtime"
        echo
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [[ "$confirm" != "yes" ]]; then
            log_info "Deployment cancelled by user"
            exit 0
        fi
    fi
}

# Main deployment function
main() {
    log_info "Starting LLM-Charge production deployment..."
    log_info "Deployment environment: $DEPLOY_ENV"
    log_info "Project root: $PROJECT_ROOT"
    log_info "Backend directory: $BACKEND_DIR"
    
    # Handle special commands
    if [[ "$CHECK_STATUS" == true ]]; then
        check_deployment_status
        exit 0
    fi
    
    if [[ "$ROLLBACK" == true ]]; then
        rollback_deployment
        exit 0
    fi
    
    # Standard deployment flow
    pre_deployment_checks
    confirm_deployment
    create_backup
    run_tests
    deploy_services
    post_deployment_tasks
    
    log_success "🎉 Production deployment completed successfully!"
    log_info "Services are now running. Monitor the logs for any issues:"
    log_info "  Backend logs: docker-compose -f $BACKEND_DIR/docker-compose.yml logs -f llm-charge-backend"
    log_info "  Frontend logs: docker-compose -f $BACKEND_DIR/docker-compose.yml logs -f llm-charge-frontend"
}

# Run main function
main "$@"