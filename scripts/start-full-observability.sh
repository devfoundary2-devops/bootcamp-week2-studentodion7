#!/bin/bash

echo "🚀 Starting Full ShopMicro Observability Stack"
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

print_status $BLUE "Step 1: Starting Infrastructure Services..."
echo "Starting Postgres and Redis..."
docker compose up -d postgres redis

echo "Waiting for database services to be ready..."
sleep 15

echo "Starting observability infrastructure..."
docker compose up -d mimir loki tempo alloy

echo "Waiting for observability services to initialize..."
sleep 30

print_status $BLUE "Step 2: Starting Application Services..."
echo "Starting backend service..."
docker compose up -d backend --build

echo "Starting ML service..."
docker compose up -d ml-service --build

echo "Waiting for application services..."
sleep 20

print_status $BLUE "Step 3: Starting Grafana..."
docker compose up -d grafana

echo "Waiting for Grafana to start..."
sleep 15

print_status $BLUE "Step 4: Checking Service Health..."

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
            print_status $GREEN "✅ $service_name is healthy"
            return 0
        fi
        
        print_status $YELLOW "⏳ Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    print_status $RED "❌ $service_name health check failed"
    return 1
}

# Check all services
check_service "Backend" "http://localhost:3001/health"
check_service "ML Service" "http://localhost:3002/health"
check_service "Grafana" "http://localhost:3000/api/health"
check_service "Mimir" "http://localhost:9009/ready"
check_service "Loki" "http://localhost:3100/ready"
check_service "Tempo" "http://localhost:3200/ready"

# Check Alloy (no standard health endpoint)
if curl -s --max-time 5 "http://localhost:12345" > /dev/null 2>&1; then
    print_status $GREEN "✅ Alloy is responding"
else
    print_status $YELLOW "⚠️  Alloy may not be fully ready"
fi

print_status $BLUE "Step 5: Testing Data Flow..."

# Generate some test traffic to create metrics
echo "Generating test traffic..."
for i in {1..5}; do
    curl -s "http://localhost:3001/health" > /dev/null &
    curl -s "http://localhost:3001/api/products" > /dev/null &
    curl -s "http://localhost:3002/health" > /dev/null &
done

wait
sleep 10

# Test if metrics are being scraped
print_status $BLUE "Checking if metrics are being collected..."

# Check backend metrics endpoint
if curl -s "http://localhost:3001/metrics" | grep -q "shopmicro_backend"; then
    print_status $GREEN "✅ Backend metrics are available"
else
    print_status $RED "❌ Backend metrics are not available"
fi

# Check ML service metrics endpoint
if curl -s "http://localhost:3002/metrics" | grep -q "shopmicro_ml"; then
    print_status $GREEN "✅ ML Service metrics are available"
else
    print_status $RED "❌ ML Service metrics are not available"
fi

# Wait a bit for metrics to be scraped
print_status $YELLOW "Waiting for metrics to be scraped by Alloy..."
sleep 30

# Test Grafana data sources
print_status $BLUE "Testing Grafana data sources..."

# Test Mimir connection
MIMIR_TEST=$(curl -s -u admin:admin "http://localhost:3000/api/datasources/proxy/1/api/v1/query?query=up" | jq -r '.status' 2>/dev/null || echo "error")
if [ "$MIMIR_TEST" = "success" ]; then
    print_status $GREEN "✅ Grafana can query Mimir"
else
    print_status $YELLOW "⚠️  Grafana-Mimir connection needs more time"
fi

# Test if application metrics are in Mimir
APP_METRICS=$(curl -s "http://localhost:9009/api/v1/query?query=shopmicro_backend_http_requests_total" | jq -r '.data.result | length' 2>/dev/null || echo "0")
if [ "$APP_METRICS" != "0" ]; then
    print_status $GREEN "✅ Application metrics are in Mimir"
else
    print_status $YELLOW "⚠️  Application metrics may need more time to appear in Mimir"
fi

print_status $BLUE "Step 6: Service Summary"
echo "======================="

print_status $GREEN "🎉 Observability Stack Started!"
echo ""
print_status $BLUE "📊 Access URLs:"
echo "  • Frontend Application: http://localhost:8080"
echo "  • Backend API: http://localhost:3001"
echo "  • ML Service: http://localhost:3002"
echo "  • Grafana Dashboards: http://localhost:3000 (admin/admin)"
echo "  • Mimir (Metrics): http://localhost:9009"
echo "  • Loki (Logs): http://localhost:3100"
echo "  • Tempo (Traces): http://localhost:3200"
echo ""
print_status $BLUE "📈 Metrics Endpoints:"
echo "  • Backend Metrics: http://localhost:3001/metrics"
echo "  • ML Service Metrics: http://localhost:3002/metrics"
echo ""
print_status $BLUE "🔧 Troubleshooting:"
echo "  • View all containers: docker compose ps"
echo "  • Check Alloy logs: docker compose logs alloy -f"
echo "  • Check Grafana logs: docker compose logs grafana -f"
echo "  • Restart services: docker compose restart [service_name]"
echo ""
print_status $YELLOW "💡 Next Steps:"
echo "  1. Open Grafana at http://localhost:3000"
echo "  2. Login with admin/admin"
echo "  3. Go to Dashboards to view the ShopMicro dashboards"
echo "  4. Generate traffic by using the frontend at http://localhost:8080"
echo "  5. Wait 1-2 minutes for data to appear in dashboards"

print_status $GREEN "✨ Full observability stack is now running!"
