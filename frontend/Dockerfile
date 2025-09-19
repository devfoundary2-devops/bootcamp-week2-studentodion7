# Multi-stage build for optimized React app
FROM node:20-alpine3.22 AS base

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /usr/src/app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

# Development stage
FROM base AS development
USER nodejs
COPY --chown=nodejs:nodejs package.json package-lock.json ./
RUN npm ci
COPY --chown=nodejs:nodejs . .
EXPOSE 3000
CMD ["npm", "start"]

# Build stage
FROM base AS builder
USER nodejs
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --omit=dev
COPY --chown=nodejs:nodejs . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Install security updates and tools
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Copy built app from builder stage
COPY --from=builder /usr/src/app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Create health endpoint for nginx
RUN echo '{"status":"healthy","service":"frontend"}' > /usr/share/nginx/html/health

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]