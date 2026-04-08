#!/bin/bash

# Staging Deployment Script for LLM-Charge Platform
# Usage: ./scripts/deploy-staging.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
DEPLOY_ENV="staging"

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

# Help function
show_help() {
    cat << EOF
Staging Deployment Script for LLM-Charge Platform

Usage: $0 [OPTIONS]

OPTIONS:
    -h, --help          Show this help message
    -c, --clean         Clean build (no cache)
    -t, --test          Run full test suite
    -f, --force         Force deployment without confirmation
    -v, --verbose       Enable verbose output
    --reset-data        Reset staging data to defaults

EXAMPLES:
    $0                  # Standard staging deployment
    $0 -c -t           # Clean build with full tests
    $0 --reset-data    # Deploy with fresh staging data

EOF
}

# Parse command line arguments
CLEAN_BUILD=false
RUN_TESTS=false
FORCE_DEPLOY=false
VERBOSE=false
RESET_DATA=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            CLEAN_BUILD=true
            shift
            ;;
        -t|--test)
            RUN_TESTS=true
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
        --reset-data)
            RESET_DATA=true
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

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error_exit "Docker is not running. Please start Docker and try again."
    fi
    
    # Check if environment file exists
    if [[ ! -f "$BACKEND_DIR/.env.staging" ]]; then
        error_exit "Staging environment file not found: $BACKEND_DIR/.env.staging"
    fi
    
    # Create staging directories
    mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs"
    
    log_success "Pre-deployment checks passed"
}

# Reset staging data
reset_staging_data() {
    if [[ "$RESET_DATA" == true ]]; then
        log_info "Resetting staging data..."
        
        # Remove existing staging database
        if [[ -f "$PROJECT_ROOT/data/llm-charge-staging.db" ]]; then
            rm "$PROJECT_ROOT/data/llm-charge-staging.db"
            log_info "Removed existing staging database"
        fi
        
        # Create fresh staging database with test data
        log_info "Creating fresh staging database..."
        # Add logic to create test data here
        
        log_success "Staging data reset completed"
    fi
}

# Run tests
run_tests() {
    if [[ "$RUN_TESTS" == true ]]; then
        log_info "Running test suite..."
        
        cd "$PROJECT_ROOT"
        
        # Run backend tests
        if [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
            log_info "Running Python tests..."
            cd "$BACKEND_DIR"
            python -m pytest tests/ -v --tb=short || error_exit "Python tests failed"
            cd "$PROJECT_ROOT"
        fi
        
        # Run Node.js tests
        if [[ -f "package.json" ]]; then
            log_info "Running Node.js tests..."
            npm test || error_exit "Node.js tests failed"
        fi
        
        log_success "All tests passed"
    fi
}

# Deploy to staging
deploy_staging() {
    log_info "Deploying to staging environment..."
    
    cd "$BACKEND_DIR"
    
    # Copy staging environment file
    cp .env.staging .env
    
    # Clean build if requested
    if [[ "$CLEAN_BUILD" == true ]]; then
        log_info "Performing clean build..."
        docker-compose -f docker-compose.yml down --volumes --remove-orphans
        docker system prune -f
    fi
    
    # Build and start services
    log_info "Building and starting services..."
    docker-compose -f docker-compose.yml build
    docker-compose -f docker-compose.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 20
    
    # Verify deployment
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            log_success "Staging deployment is healthy"
            break
        else
            log_warn "Attempt $attempt/$max_attempts: Service not yet ready"
            sleep 5
            ((attempt++))
        fi
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error_exit "Staging deployment failed to become healthy"
    fi
}

# Post-deployment tasks
post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    # Run any staging-specific setup
    log_info "Setting up staging environment..."
    
    # Load test data if needed
    if [[ "$RESET_DATA" == true ]]; then
        log_info "Loading test data..."
        # Add test data loading logic here
    fi
    
    # Display staging information
    log_info "Staging Environment Information:"
    echo "  Backend URL: http://localhost:8000"
    echo "  Frontend URL: http://localhost:3000"
    echo "  Health Check: http://localhost:8000/health"
    echo "  API Docs: http://localhost:8000/docs"
    echo "  Environment: staging"
    
    log_success "Staging deployment completed successfully"
}

# Confirmation prompt
confirm_deployment() {
    if [[ "$FORCE_DEPLOY" == false ]]; then
        echo
        log_warn "You are about to deploy to STAGING environment."
        read -p "Continue? (y/N): " confirm
        
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
}

# Main function
main() {
    log_info "Starting LLM-Charge staging deployment..."
    log_info "Environment: $DEPLOY_ENV"
    
    pre_deployment_checks
    confirm_deployment
    reset_staging_data
    run_tests
    deploy_staging
    post_deployment_tasks
    
    log_success "🎉 Staging deployment completed!"
    log_info "View logs with: docker-compose -f $BACKEND_DIR/docker-compose.yml logs -f"
}

# Run main function
main "$@"