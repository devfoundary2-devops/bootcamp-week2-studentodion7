# Day 1: Application Architecture & Docker Fundamentals

## Overview

Today we'll explore containerization fundamentals, understand microservices
architecture, and get hands-on experience with Docker and Docker Compose for
local development.

## Learning Objectives

By the end of this session, you will be able to:

- Understand microservices architecture principles
- Create optimized Dockerfiles for different types of applications
- Use Docker Compose for multi-service orchestration
- Implement container networking and volume management
- Set up a complete development environment with containers

## Prerequisites

- Docker installed locally
- Basic understanding of command line
- Node.js and Python familiarity (helpful but not required)

## Session Agenda (3 hours)

### Hour 1: Architecture Overview & Docker Basics (60 min)

- **Introduction to ShopMicro Project** (15 min)
- **Microservices Architecture Principles** (20 min)
- **Docker Fundamentals** (25 min)

### Hour 2: Dockerfile Creation & Optimization (60 min)

- **Creating Dockerfiles** (30 min)
- **Multi-stage Builds** (15 min)
- **Security Best Practices** (15 min)

### Hour 3: Docker Compose & Local Development (60 min)

- **Docker Compose Basics** (20 min)
- **Service Orchestration** (25 min)
- **Development Workflow** (15 min)

---

## 1. Introduction to ShopMicro Project

### Project Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   ML Service    │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Python)      │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 3002    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │     Infrastructure      │
                    │                         │
                    │  ┌─────────┐ ┌────────┐ │
                    │  │PostgreSQL│ │ Redis  │ │
                    │  │Port: 5432│ │Port:6379│ │
                    │  └─────────┘ └────────┘ │
                    └─────────────────────────┘
```

### Service Breakdown

1. **Frontend (React.js)**
   - User interface
   - Static file serving with Nginx
   - Communicates with backend API

2. **Backend (Node.js/Express)**
   - REST API
   - Business logic
   - Database interactions

3. **ML Service (Python/Flask)**
   - Recommendation engine
   - Machine learning models
   - Caching with Redis

4. **Infrastructure**
   - PostgreSQL database
   - Redis cache
   - Monitoring stack

## 2. Docker Fundamentals

### Key Concepts

#### Images vs Containers

- **Image**: Read-only template with application code and dependencies
- **Container**: Running instance of an image

#### Dockerfile Basics

```dockerfile
FROM node:18-alpine          # Base image
WORKDIR /usr/src/app        # Working directory
COPY package*.json ./       # Copy dependency files
RUN npm ci --only=production # Install dependencies
COPY . .                    # Copy application code
EXPOSE 3001                 # Document port
CMD ["node", "server.js"]   # Command to run
```

## 3. Hands-on Exercise: Creating Dockerfiles

### Exercise 1: Backend Dockerfile

Let's examine and build the backend service:

```bash
# Navigate to backend directory
cd backend

# Build the Docker image
docker build -t shopmicro-backend:latest .

# Run the container
docker run -p 3001:3001 --name backend-container shopmicro-backend:latest
```

**Key Points:**

- Multi-stage build for optimization
- Security: non-root user, minimal base image
- Health checks for monitoring
- Proper layer caching for faster builds

### Exercise 2: Frontend Dockerfile

```bash
cd ../frontend

# Build for development
docker build --target development -t shopmicro-frontend:dev .

# Build for production
docker build --target production -t shopmicro-frontend:prod .

# Run production build
docker run -p 80:80 shopmicro-frontend:prod
```

**Key Points:**

- Multi-stage build: build -> production
- Nginx for static file serving
- Security headers configuration
- Optimized for production deployment

### Exercise 3: ML Service Dockerfile

```bash
cd ../ml-service

# Build the ML service
docker build -t shopmicro-ml:latest .

# Run with environment variables
docker run -p 3002:3002 -e FLASK_ENV=development shopmicro-ml:latest
```

## 4. Docker Compose Deep Dive

### Why Docker Compose?

- Orchestrates multiple services
- Manages dependencies and startup order
- Provides networking and volume management
- Enables reproducible development environments

### Our Docker Compose Structure

```yaml
version: '3.8'

services:
  postgres:    # Database
  redis:       # Cache
  backend:     # API service
  frontend:    # Web interface
  ml-service:  # ML recommendations
  prometheus:  # Metrics collection
  grafana:     # Monitoring dashboards
  jaeger:      # Distributed tracing
```

### Exercise 4: Full Stack Deployment

```bash
# From the root directory
docker compose up --build

# Check service status
docker compose ps

# View logs
docker compose logs backend

# Scale a service
docker compose up --scale backend=3

# Shut down
docker compose down
```

### Key Compose Features Used

1. **Health Checks**

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

2. **Service Dependencies**

```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
```

3. **Volume Mounting**

```yaml
volumes:
  - ./backend:/usr/src/app      # Code mounting for development
  - postgres_data:/var/lib/postgresql/data  # Data persistence
```

4. **Environment Variables**

```yaml
environment:
  - NODE_ENV=development
  - POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/shopmicro
```

## 5. Container Networking

### Default Networks

Docker Compose creates a default network where services can communicate using service names as hostnames.

```bash
# Backend can reach database at:
postgres://postgres:postgres@postgres:5432/shopmicro

# Frontend can reach backend at:
http://backend:3001/api/products
```

### Custom Networks

```yaml
networks:
  shopmicro-network:
    driver: bridge
    name: shopmicro-network
```

## 6. Development Workflow

### Hot Reloading Setup

1. **Backend Development**

```bash
# Use nodemon for auto-restart
docker compose up backend
# Changes to backend/ automatically restart the service
```

2. **Frontend Development**

```bash
# React development server with hot reload
docker compose up frontend
# Changes reflect immediately in browser
```

3. **Volume Mounts for Development**

```yaml
volumes:
  - ./backend:/usr/src/app
  - backend_node_modules:/usr/src/app/node_modules  # Prevent overwrite
```

## 7. Debugging and Troubleshooting

### Common Commands

```bash
# View container logs
docker compose logs -f service-name

# Execute commands in running container
docker compose exec backend bash

# Check container resource usage
docker stats

# Inspect service configuration
docker compose config

# Clean up
docker compose down -v  # Remove volumes
docker system prune     # Clean unused resources
```

### Health Monitoring

```bash
# Check service health
curl http://localhost:3001/health

# View metrics
curl http://localhost:3001/metrics

# Check database connection
docker compose exec postgres pg_isready -U postgres
```

## 8. Best Practices Summary

### Dockerfile Best Practices

1. **Use specific base image tags** (not `latest`)
2. **Multi-stage builds** for smaller production images
3. **Layer caching optimization** (copy package.json first)
4. **Security**: non-root users, minimal base images
5. **Health checks** for monitoring
6. **Proper signal handling** with init systems

### Docker Compose Best Practices

1. **Use .env files** for environment configuration
2. **Named volumes** for data persistence
3. **Health checks** and proper dependencies
4. **Resource limits** for production
5. **Separate configs** for dev/staging/prod

## 9. Exercises and Challenges

### Exercise 5: Add a New Service

Add a simple Redis admin interface (RedisInsight) to the compose stack:

```yaml
redis-insight:
  image: redislabs/redisinsight:latest
  ports:
    - "8001:8001"
  depends_on:
    - redis
  networks:
    - shopmicro-network
```

### Exercise 6: Optimize Build Times

1. Create a `.dockerignore` file
2. Reorder Dockerfile instructions for better caching
3. Use build args for environment-specific builds

### Challenge: Production Optimization

1. Create production Docker Compose override file
2. Add resource limits and restart policies
3. Configure proper logging drivers

## 10. Next Steps

Tomorrow we'll build upon this foundation by:

- Implementing automated testing in containers
- Setting up CI/CD pipelines with GitHub Actions
- Building and pushing images to container registries
- Automating deployment processes

## Resources

### Docker Documentation

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)

### Tools

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Lens](https://k8slens.dev/) - Kubernetes IDE
- [ctop](https://github.com/bcicen/ctop) - Container monitoring

### Further Reading

- [The Twelve-Factor App](https://12factor.net/)
- [Container Security Best Practices](https://sysdig.com/blog/dockerfile-best-practices/)

---

**Ready to continue? Head to [Day 2: CI/CD Pipeline Implementation](../day2/README.md)**

