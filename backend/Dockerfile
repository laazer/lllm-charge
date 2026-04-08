# Multi-stage production Docker build for LLM-Charge Python Backend
FROM python:3.11-slim as builder

# Set build environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim as production

# Set production environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    APP_ENV=production \
    WORKERS=4 \
    MAX_WORKERS=8 \
    TIMEOUT=60 \
    KEEPALIVE=2

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create application user with specific UID/GID for security
RUN groupadd -r -g 1000 llmcharge && \
    useradd -r -u 1000 -g llmcharge -d /app -s /bin/bash llmcharge

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder stage
COPY --from=builder /root/.local /home/llmcharge/.local

# Create application directories with proper permissions
RUN mkdir -p /app/logs /app/data /app/uploads /app/static /app/config \
    && chown -R llmcharge:llmcharge /app

# Copy application code with proper ownership
COPY --chown=llmcharge:llmcharge app ./app
COPY --chown=llmcharge:llmcharge pyproject.toml .
COPY --chown=llmcharge:llmcharge requirements.txt .

# Copy configuration files
COPY --chown=llmcharge:llmcharge config ./config

# Switch to application user
USER llmcharge

# Add local Python packages to PATH
ENV PATH="/home/llmcharge/.local/bin:${PATH}"

# Expose application port
EXPOSE 8000

# Add comprehensive health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import requests; import sys; \
    try: \
        r = requests.get('http://localhost:8000/health', timeout=5); \
        sys.exit(0 if r.status_code == 200 else 1) \
    except: \
        sys.exit(1)" || exit 1

# Production startup command with optimized settings
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--access-log", \
     "--log-level", "info", \
     "--timeout-keep-alive", "2"]