#!/bin/bash

echo "🚀 ShopMicro Quick Start Script"
echo "==============================="

# Check if backend is running
echo "Checking backend status..."
if curl -s --max-time 5 http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is already running"
else
    echo "❌ Backend is not running"
    echo "Starting backend service..."
    
    # Start the backend service
    docker compose up -d backend --build
    
    # Wait a bit for it to start
    echo "Waiting for backend to start..."
    sleep 10
    
    # Check again
    if curl -s --max-time 5 http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend started successfully"
    else
        echo "❌ Backend failed to start. Check logs with: docker compose logs backend"
    fi
fi

echo ""
echo "📊 Service Status:"
echo "  • Frontend: http://localhost:8080 (should be running)"
echo "  • Backend: http://localhost:3001"
echo ""
echo "🔧 Useful Commands:"
echo "  • Check all services: docker compose ps"
echo "  • View backend logs: docker compose logs backend -f"
echo "  • Restart backend: docker compose restart backend"
echo "  • Start all services: docker compose up -d"
echo ""

# Test backend health if it's running
if curl -s --max-time 5 http://localhost:3001/health > /dev/null 2>&1; then
    echo "🧪 Backend Health Check:"
    curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
fi
