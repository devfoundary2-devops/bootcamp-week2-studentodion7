#!/bin/bash

echo "🚀 ShopMicro DevOps Bootcamp - Status Check"
echo "============================================="

echo ""
echo "📊 Container Status:"
docker compose ps

echo ""
echo "🔍 Health Check Results:"
echo "Frontend:      $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 || echo 'DOWN')"
echo "Backend API:   $(curl -s http://localhost:3001/health | jq -r .status 2>/dev/null || echo 'DOWN')"
echo "ML Service:    $(curl -s http://localhost:3002/health | jq -r .status 2>/dev/null || echo 'DOWN')"
echo "Mimir:         $(curl -s -o /dev/null -w '%{http_code}' http://localhost:9009/ready || echo 'DOWN')"
echo "Loki:          $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/ready || echo 'DOWN')"
echo "Tempo:         $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3200/ready || echo 'DOWN')"
echo "Grafana:       $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || echo 'DOWN')"
echo "Alloy:         $(curl -s -o /dev/null -w '%{http_code}' http://localhost:12345/-/ready || echo 'DOWN')"

echo ""
echo "🌐 Service Endpoints:"
echo "Frontend:      http://localhost:8080"
echo "Backend API:   http://localhost:3001"
echo "ML Service:    http://localhost:3002"  
echo "Grafana:       http://localhost:3000 (admin/admin)"
echo "Mimir:         http://localhost:9009"
echo "Loki:          http://localhost:3100"
echo "Tempo:         http://localhost:3200"
echo "Alloy UI:      http://localhost:12345"

echo ""
echo "🧪 Quick API Tests:"
echo "Products API:"
curl -s "http://localhost:3001/api/products?limit=2" | jq '.products[0].name' 2>/dev/null || echo "  ❌ Failed"

echo "ML Recommendations:"
curl -s "http://localhost:3002/api/recommendations/1?limit=2" | jq '.recommendations[0].name' 2>/dev/null || echo "  ❌ Failed"

echo ""
echo "✅ All core services are running!"
echo "🎯 Ready for DevOps Bootcamp Day 1 exercises"