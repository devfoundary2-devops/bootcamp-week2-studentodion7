#!/bin/bash

echo "🚀 Deploying ShopMicro Kubernetes Bootcamp Lab"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check prerequisites
print_status $BLUE "Step 1: Checking Prerequisites..."

# Check if minikube is installed
if ! command -v minikube &> /dev/null; then
    print_status $RED "❌ Minikube is not installed"
    echo "Install with: brew install minikube"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_status $RED "❌ kubectl is not installed"
    echo "Install with: brew install kubectl"
    exit 1
fi

# Check if docker is running
if ! docker info &> /dev/null; then
    print_status $RED "❌ Docker is not running"
    echo "Please start Docker Desktop"
    exit 1
fi

print_status $GREEN "✅ All prerequisites met"

# Start Minikube
print_status $BLUE "Step 2: Starting Minikube Cluster..."

# Check if minikube is already running
if minikube status | grep -q "Running"; then
    print_status $YELLOW "⚠️  Minikube is already running"
else
    print_status $YELLOW "Starting Minikube with 6GB RAM and 4 CPUs..."
    minikube start --memory=6144 --cpus=4 --disk-size=20g
    
    if [ $? -ne 0 ]; then
        print_status $RED "❌ Failed to start Minikube"
        exit 1
    fi
fi

# Enable addons
print_status $YELLOW "Enabling Minikube addons..."
minikube addons enable ingress
minikube addons enable metrics-server

print_status $GREEN "✅ Minikube cluster ready"

# Build and load Docker images
print_status $BLUE "Step 3: Building and Loading Docker Images..."

print_status $YELLOW "Building backend image..."
docker build -t shopmicro-backend:latest ./backend

print_status $YELLOW "Building frontend image..."
docker build -t shopmicro-frontend:latest ./frontend

print_status $YELLOW "Building ML service image..."
docker build -t shopmicro-ml-service:latest ./ml-service

print_status $YELLOW "Loading images into Minikube..."
minikube image load shopmicro-backend:latest
minikube image load shopmicro-frontend:latest
minikube image load shopmicro-ml-service:latest

print_status $GREEN "✅ Images built and loaded"

# Deploy to Kubernetes
print_status $BLUE "Step 4: Deploying to Kubernetes..."

print_status $YELLOW "Creating namespace..."
kubectl apply -f k8s/namespace.yaml

print_status $YELLOW "Deploying infrastructure services..."
kubectl apply -f k8s/deployments/postgres.yaml
kubectl apply -f k8s/deployments/redis.yaml

print_status $YELLOW "Waiting for infrastructure to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment postgres -n shopmicro
kubectl wait --for=condition=available --timeout=120s deployment redis -n shopmicro

print_status $YELLOW "Deploying observability stack..."
kubectl apply -f k8s/deployments/mimir.yaml
kubectl apply -f k8s/deployments/loki.yaml
kubectl apply -f k8s/deployments/tempo.yaml
kubectl apply -f k8s/deployments/alloy.yaml

print_status $YELLOW "Waiting for observability services..."
sleep 30

print_status $YELLOW "Deploying application services..."
kubectl apply -f k8s/deployments/backend.yaml
kubectl apply -f k8s/deployments/ml-service.yaml
kubectl apply -f k8s/deployments/frontend.yaml

print_status $YELLOW "Deploying Grafana..."
kubectl apply -f k8s/deployments/grafana.yaml

print_status $YELLOW "Waiting for all deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment --all -n shopmicro

print_status $GREEN "✅ All services deployed"

# Verify deployment
print_status $BLUE "Step 5: Verifying Deployment..."

print_status $YELLOW "Checking pod status..."
kubectl get pods -n shopmicro

# Count running pods
RUNNING_PODS=$(kubectl get pods -n shopmicro --no-headers | grep Running | wc -l)
TOTAL_PODS=$(kubectl get pods -n shopmicro --no-headers | wc -l)

if [ "$RUNNING_PODS" -eq "$TOTAL_PODS" ]; then
    print_status $GREEN "✅ All $TOTAL_PODS pods are running"
else
    print_status $YELLOW "⚠️  $RUNNING_PODS/$TOTAL_PODS pods are running"
fi

# Setup port forwarding
print_status $BLUE "Step 6: Setting up Port Forwarding..."

print_status $YELLOW "Setting up port forwards..."

# Kill existing port forwards
pkill -f "kubectl port-forward" 2>/dev/null || true

# Start port forwards in background
kubectl port-forward -n shopmicro svc/grafana 3000:3000 > /dev/null 2>&1 &
kubectl port-forward -n shopmicro svc/frontend 8080:3000 > /dev/null 2>&1 &
kubectl port-forward -n shopmicro svc/backend 3001:3001 > /dev/null 2>&1 &

sleep 5

print_status $GREEN "✅ Port forwarding configured"

# Test services
print_status $BLUE "Step 7: Testing Services..."

# Test backend
if curl -s --max-time 10 "http://localhost:3001/health" | grep -q "healthy"; then
    print_status $GREEN "✅ Backend service is healthy"
else
    print_status $RED "❌ Backend service is not responding"
fi

# Test frontend
if curl -s --max-time 10 "http://localhost:8080" > /dev/null; then
    print_status $GREEN "✅ Frontend service is accessible"
else
    print_status $RED "❌ Frontend service is not responding"
fi

# Test Grafana
if curl -s --max-time 10 "http://localhost:3000/api/health" | grep -q "ok"; then
    print_status $GREEN "✅ Grafana is accessible"
else
    print_status $RED "❌ Grafana is not responding"
fi

print_status $BLUE "Step 8: Final Status Report"
echo "=========================="

print_status $BLUE "📊 Cluster Information:"
kubectl cluster-info

echo ""
print_status $BLUE "🏗️  Deployed Resources:"
kubectl get all -n shopmicro

echo ""
print_status $BLUE "🌐 Access URLs:"
echo "  • Frontend Application: http://localhost:8080"
echo "  • Backend API: http://localhost:3001"
echo "  • Grafana Dashboards: http://localhost:3000 (admin/admin)"

echo ""
print_status $BLUE "🔧 Useful Commands:"
echo "  • View pods: kubectl get pods -n shopmicro"
echo "  • View logs: kubectl logs -f <pod-name> -n shopmicro"
echo "  • Describe pod: kubectl describe pod <pod-name> -n shopmicro"
echo "  • Port forward: kubectl port-forward -n shopmicro svc/<service> <local-port>:<service-port>"

echo ""
print_status $GREEN "🎉 Kubernetes Lab Deployment Complete!"
print_status $YELLOW "💡 Students can now access the applications and verify the assessment criteria"

echo ""
print_status $BLUE "📋 Assessment Checklist:"
echo "  □ All pods are in Running state"
echo "  □ Backend health check passes"
echo "  □ Frontend is accessible"
echo "  □ Grafana shows dashboards with data"
echo "  □ Metrics are being collected"
echo "  □ No error logs in any component"

echo ""
print_status $YELLOW "🎮 Easter Egg Hunt Guide:"
echo "  🥚 #1: Find the secret bootcamp endpoint in the backend API"
echo "  🥚 #2: Try the Konami code on the frontend: ↑↑↓↓←→←→BA"
echo "  🥚 #3: Make a coffee request to the ML service API"
echo "  🥚 #4: Name a pod with 'gopher' or 'kubernetes' to unlock ASCII art"
echo "  🥚 #5: Add annotation 'retro.mode: \"1985\"' to the namespace"

echo ""
print_status $BLUE "🏆 Achievement System:"
echo "  🥇 Deployment Master: Deploy all services without restarts"
echo "  🥈 Troubleshoot Hero: Fix 2+ issues and document solutions"
echo "  🥉 Metrics Guru: Create custom Grafana dashboard"
echo "  🎯 Easter Egg Hunter: Find all 5 hidden easter eggs"
echo "  🚀 Performance Optimizer: Keep CPU usage under 50%"
echo "  🔍 Security Sentinel: Add security contexts to deployments"

echo ""
print_status $GREEN "🎊 Bonus Fun Commands to Try:"
echo "  • curl http://localhost:3001/api/bootcamp/secret"
echo "  • curl -X POST http://localhost:3002/api/coffee/drink -H 'Content-Type: application/json' -d '{\"engineer\":\"YourName\",\"type\":\"espresso\"}'"
echo "  • kubectl annotate namespace shopmicro retro.mode=\"1985\""
echo "  • kubectl patch deployment backend -n shopmicro -p '{\"spec\":{\"template\":{\"metadata\":{\"labels\":{\"pod-name\":\"gopher-backend\"}}}}}'"
