# Quick Start Guide - ShopMicro DevOps Bootcamp

## Prerequisites

### Required Software

```bash
# Docker and Docker Compose
docker --version  # Should be 24.0+ 
docker compose --version  # Should be 2.0+

# Node.js (for local development)
node --version  # Should be 18+
npm --version

# Python (for ML service)
python --version  # Should be 3.11+
pip --version

# Git
git --version
```

### System Requirements

- **RAM**: Minimum 8GB, Recommended 16GB
- **Storage**: 10GB free space
- **OS**: macOS, Windows 10/11, or Linux

## Quick Setup (5 minutes)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd bootcamp/week2

# Make scripts executable (Linux/macOS)
chmod +x scripts/*.sh
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration if needed
nano .env  # or your preferred editor
```

### 3. Start All Services

```bash
# Build and start all services
docker compose up --build

# Or start in background
docker compose up -d --build
```

### 4. Verify Installation

```bash
# Check all services are running
docker compose ps

# Test endpoints
curl http://localhost:3001/health    # Backend health
curl http://localhost:3000           # Frontend
curl http://localhost:3002/health    # ML service health
```

## Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | <http://localhost:3000> | React application |
| Backend API | <http://localhost:3001> | REST API |
| ML Service | <http://localhost:3002> | Recommendations |
| Grafana | <http://localhost:3003> | Monitoring (admin/admin) |
| Prometheus | <http://localhost:9090> | Metrics collection |
| Jaeger | <http://localhost:16686> | Distributed tracing |

## Common Issues & Solutions

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
# Kill the process
kill -9 <PID>
```

### Services Not Starting

```bash
# Check logs
docker compose logs <service-name>

# Rebuild without cache
docker compose build --no-cache <service-name>
```

### Permission Issues (Linux)

```bash
# Fix permissions
sudo chown -R $USER:$USER .
```

### Out of Memory

```bash
# Increase Docker memory limit in Docker Desktop settings
# Or clean up unused containers/images
docker system prune -a
```

## Daily Progression

- **Day 1**: ✅ Docker fundamentals (you are here)
- **Day 2**: CI/CD pipelines with GitHub Actions
- **Day 3**: Kubernetes deployment and scaling
- **Day 4**: Observability with Prometheus & Grafana
- **Day 5**: Security, performance, and production readiness

## Quick Commands Reference

```bash
# Development workflow
docker compose up backend frontend    # Start only app services
docker compose logs -f backend        # Follow backend logs
docker compose exec backend sh        # Shell into backend container
docker compose down -v               # Stop and remove volumes

# Monitoring
docker compose ps                     # Service status
docker stats                         # Resource usage
docker compose top                   # Running processes

# Troubleshooting
docker compose config                # Validate compose file
docker compose pull                  # Update base images
docker compose restart backend       # Restart single service
```

## Getting Help

1. **Check logs first**: `docker compose logs <service>`
2. **Verify health**: Visit health endpoints
3. **Review documentation**: Each day has detailed guides
4. **Common issues**: Check troubleshooting sections
5. **Discord/Slack**: Ask in the bootcamp channel

---

**🚀 Ready to start? Begin with [Day 1](day1/README.md)**
