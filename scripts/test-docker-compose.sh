#!/bin/bash

# ShopMicro Docker Compose Observability Stack Test
# This script tests the entire Docker Compose setup with observability

set -e

echo "🐳 ShopMicro Docker Compose Observability Test"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if Docker and Docker Compose are available
check_docker() {
    print_status $BLUE "Checking Docker setup..."
    
    if ! command -v docker &> /dev/null; then
        print_status $RED "❌ Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_status $RED "❌ Docker Compose is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_status $RED "❌ Docker daemon is not running"
        exit 1
    fi
    
    print_status $GREEN "✅ Docker setup is ready"
}

# Function to clean up existing containers
cleanup() {
    print_status $YELLOW "🧹 Cleaning up existing containers..."
    
    # Stop and remove containers
    docker-compose down -v --remove-orphans 2>/dev/null || true
    
    # Remove any dangling images
    docker image prune -f 2>/dev/null || true
    
    print_status $GREEN "✅ Cleanup completed"
}

# Function to build and start services
start_services() {
    print_status $BLUE "🚀 Building and starting services..."
    
    # Build images
    print_status $YELLOW "Building application images..."
    docker-compose build --no-cache
    
    # Start infrastructure services first
    print_status $YELLOW "Starting infrastructure services..."
    docker-compose up -d postgres redis mimir loki tempo alloy
    
    # Wait for infrastructure to be ready
    print_status $YELLOW "Waiting for infrastructure services..."
    sleep 30
    
    # Start application services
    print_status $YELLOW "Starting application services..."
    docker-compose up -d backend ml-service
    
    # Wait for applications to be ready
    print_status $YELLOW "Waiting for application services..."
    sleep 45
    
    # Start frontend and Grafana
    print_status $YELLOW "Starting frontend and Grafana..."
    docker-compose up -d frontend grafana
    
    # Wait for everything to be ready
    print_status $YELLOW "Waiting for all services to be ready..."
    sleep 30
    
    print_status $GREEN "✅ All services started"
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=20
    local attempt=1

    print_status $YELLOW "Checking $service_name health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f --max-time 10 "$health_url" > /dev/null 2>&1; then
            print_status $GREEN "✅ $service_name is healthy"
            return 0
        fi
        
        print_status $YELLOW "⏳ Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    print_status $RED "❌ $service_name health check failed"
    return 1
}

# Function to check container status
check_containers() {
    print_status $BLUE "🔍 Checking container status..."
    
    local containers=(
        "shopmicro-postgres"
        "shopmicro-redis"
        "shopmicro-backend"
        "shopmicro-ml-service"
        "shopmicro-frontend"
        "shopmicro-grafana"
        "shopmicro-mimir"
        "shopmicro-loki"
        "shopmicro-tempo"
        "shopmicro-alloy"
    )
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
            if [ "$status" = "healthy" ] || [ "$status" = "no-healthcheck" ]; then
                print_status $GREEN "✅ $container is running"
            else
                print_status $YELLOW "⚠️  $container is running but not healthy (status: $status)"
            fi
        else
            print_status $RED "❌ $container is not running"
        fi
    done
}

# Function to test service endpoints
test_endpoints() {
    print_status $BLUE "🧪 Testing service endpoints..."
    
    # Test backend health
    check_service_health "Backend" "http://localhost:3001/health"
    
    # Test ML service health
    check_service_health "ML Service" "http://localhost:3002/health"
    
    # Test Grafana
    check_service_health "Grafana" "http://localhost:3000/api/health"
    
    # Test observability stack
    check_service_health "Mimir" "http://localhost:9009/ready"
    check_service_health "Loki" "http://localhost:3100/ready"
    check_service_health "Tempo" "http://localhost:3200/ready"
    
    # Test Alloy (no standard health endpoint, check if it's responding)
    if curl -s --max-time 10 "http://localhost:12345" > /dev/null 2>&1; then
        print_status $GREEN "✅ Alloy is responding"
    else
        print_status $YELLOW "⚠️  Alloy may not be fully ready"
    fi
}

# Function to test metrics endpoints
test_metrics() {
    print_status $BLUE "📊 Testing metrics endpoints..."
    
    # Test backend metrics
    if curl -s --max-time 10 "http://localhost:3001/metrics" | grep -q "shopmicro_backend"; then
        print_status $GREEN "✅ Backend metrics are available"
    else
        print_status $RED "❌ Backend metrics are not available"
    fi
    
    # Test ML service metrics
    if curl -s --max-time 10 "http://localhost:3002/metrics" | grep -q "shopmicro_ml"; then
        print_status $GREEN "✅ ML Service metrics are available"
    else
        print_status $RED "❌ ML Service metrics are not available"
    fi
}

# Function to generate test traffic
generate_test_traffic() {
    print_status $BLUE "🚀 Generating test traffic..."
    
    # Test backend endpoints
    for i in {1..5}; do
        curl -s --max-time 10 "http://localhost:3001/health" > /dev/null &
        curl -s --max-time 10 "http://localhost:3001/api/products" > /dev/null &
    done
    
    # Test ML service endpoints
    for i in {1..3}; do
        curl -s --max-time 10 "http://localhost:3002/health" > /dev/null &
        curl -s --max-time 10 "http://localhost:3002/api/recommendations/1" > /dev/null &
    done
    
    # Test frontend metrics endpoint
    test_payload='{
        "sessionId": "docker-test-session",
        "userId": "docker-test-user",
        "metrics": [
            {
                "type": "web_vital",
                "data": {"name": "CLS", "value": 0.1, "rating": "good"},
                "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
            }
        ],
        "errors": [],
        "pageViews": [{"path": "/docker-test", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}],
        "userInteractions": []
    }'
    
    curl -s --max-time 10 -X POST "http://localhost:3001/api/frontend-metrics" \
         -H "Content-Type: application/json" \
         -d "$test_payload" > /dev/null &
    
    wait
    print_status $GREEN "✅ Test traffic generated"
}

# Function to test observability integration
test_observability() {
    print_status $BLUE "🔍 Testing observability integration..."
    
    # Wait for metrics to be scraped
    print_status $YELLOW "Waiting for metrics to be collected..."
    sleep 60
    
    # Test if Grafana can query Mimir
    if curl -s --max-time 15 -u admin:admin "http://localhost:3000/api/datasources/proxy/1/api/v1/query?query=up" | grep -q "success"; then
        print_status $GREEN "✅ Grafana can query Mimir"
    else
        print_status $YELLOW "⚠️  Grafana-Mimir integration may need more time"
    fi
    
    # Check if metrics are being collected
    if curl -s --max-time 15 "http://localhost:9009/api/v1/query?query=shopmicro_backend_http_requests_total" | grep -q "data"; then
        print_status $GREEN "✅ Application metrics are being collected"
    else
        print_status $YELLOW "⚠️  Application metrics may need more time to appear"
    fi
}

# Function to show service logs
show_logs() {
    print_status $BLUE "📋 Showing recent service logs..."
    
    echo
    print_status $YELLOW "Backend logs:"
    docker-compose logs --tail=10 backend
    
    echo
    print_status $YELLOW "ML Service logs:"
    docker-compose logs --tail=10 ml-service
    
    echo
    print_status $YELLOW "Alloy logs:"
    docker-compose logs --tail=10 alloy
}

# Function to display access information
show_access_info() {
    print_status $GREEN "🎉 Docker Compose setup completed!"
    echo
    
    print_status $BLUE "📊 Service Access Information:"
    echo "  • Frontend Application: http://localhost:8080"
    echo "  • Backend API: http://localhost:3001"
    echo "  • ML Service: http://localhost:3002"
    echo "  • Grafana Dashboard: http://localhost:3000 (admin/admin)"
    echo "  • Mimir (Metrics): http://localhost:9009"
    echo "  • Loki (Logs): http://localhost:3100"
    echo "  • Tempo (Traces): http://localhost:3200"
    echo "  • Alloy (Agent): http://localhost:12345"
    echo
    
    print_status $BLUE "📈 Metrics Endpoints:"
    echo "  • Backend Metrics: http://localhost:3001/metrics"
    echo "  • ML Service Metrics: http://localhost:3002/metrics"
    echo
    
    print_status $BLUE "🔧 Management Commands:"
    echo "  • View logs: docker-compose logs -f [service_name]"
    echo "  • Stop services: docker-compose down"
    echo "  • Restart service: docker-compose restart [service_name]"
    echo "  • View containers: docker-compose ps"
    echo
    
    print_status $YELLOW "💡 Next Steps:"
    echo "  1. Open Grafana at http://localhost:3000 (admin/admin)"
    echo "  2. Import the ShopMicro dashboards"
    echo "  3. Generate traffic by using the application at http://localhost:8080"
    echo "  4. Monitor metrics, logs, and traces in Grafana"
    echo "  5. Run the observability test: ./scripts/test-observability.sh"
}

# Main execution
main() {
    echo
    print_status $BLUE "Starting Docker Compose observability stack test..."
    echo
    
    # Check prerequisites
    check_docker
    
    # Navigate to project root
    cd "$(dirname "$0")/.."
    
    # Clean up any existing setup
    cleanup
    
    # Start all services
    start_services
    
    # Check container status
    check_containers
    
    echo
    
    # Test service endpoints
    test_endpoints
    
    echo
    
    # Test metrics
    test_metrics
    
    echo
    
    # Generate test traffic
    generate_test_traffic
    
    echo
    
    # Test observability integration
    test_observability
    
    echo
    
    # Show recent logs for debugging
    show_logs
    
    echo
    
    # Display access information
    show_access_info
}

# Handle script arguments
case "${1:-}" in
    "cleanup")
        cd "$(dirname "$0")/.."
        cleanup
        ;;
    "logs")
        cd "$(dirname "$0")/.."
        show_logs
        ;;
    "status")
        cd "$(dirname "$0")/.."
        check_containers
        ;;
    *)
        main "$@"
        ;;
esac
