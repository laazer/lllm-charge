# LLM-Charge Docker Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    git \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data and logs directories
RUN mkdir -p data logs data/cache data/agent-workspace

# Set proper permissions
RUN chown -R node:node /app
USER node

# Expose ports
EXPOSE 3001 3002 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start command
CMD ["npm", "start"]