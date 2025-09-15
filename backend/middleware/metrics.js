// Simple metrics middleware for monitoring requests
// In production, use actual monitoring libraries like prom-client

let metrics = {
  requests: {
    total: 0,
    by_method: {},
    by_status: {},
    by_endpoint: {}
  },
  response_times: [],
  errors: {
    total: 0,
    by_type: {}
  }
};

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Increment total requests
  metrics.requests.total++;
  
  // Track by method
  metrics.requests.by_method[req.method] = 
    (metrics.requests.by_method[req.method] || 0) + 1;
  
  // Track by endpoint (simplified path)
  const endpoint = req.route?.path || req.path || 'unknown';
  metrics.requests.by_endpoint[endpoint] = 
    (metrics.requests.by_endpoint[endpoint] || 0) + 1;

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Track response time
    metrics.response_times.push(responseTime);
    
    // Keep only last 1000 response times to prevent memory leak
    if (metrics.response_times.length > 1000) {
      metrics.response_times = metrics.response_times.slice(-1000);
    }
    
    // Track by status code
    const statusCode = res.statusCode;
    metrics.requests.by_status[statusCode] = 
      (metrics.requests.by_status[statusCode] || 0) + 1;
    
    // Track errors
    if (statusCode >= 400) {
      metrics.errors.total++;
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      metrics.errors.by_type[errorType] = 
        (metrics.errors.by_type[errorType] || 0) + 1;
    }
    
    // Call original end method
    originalEnd.apply(res, args);
  };
  
  next();
};

// Endpoint to expose metrics (Prometheus-like format)
const getMetrics = (req, res) => {
  const now = Date.now();
  const avgResponseTime = metrics.response_times.length > 0 
    ? metrics.response_times.reduce((a, b) => a + b, 0) / metrics.response_times.length 
    : 0;
  
  const p95ResponseTime = metrics.response_times.length > 0
    ? calculatePercentile(metrics.response_times, 95)
    : 0;

  const metricsData = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requests: {
      ...metrics.requests,
      rate: metrics.requests.total / process.uptime() // requests per second
    },
    response_time: {
      average: Math.round(avgResponseTime),
      p95: Math.round(p95ResponseTime),
      samples: metrics.response_times.length
    },
    errors: metrics.errors,
    memory: process.memoryUsage(),
    system: {
      cpu_usage: process.cpuUsage(),
      platform: process.platform,
      node_version: process.version
    }
  };

  res.json(metricsData);
};

// Calculate percentile from sorted array
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Reset metrics (useful for testing)
const resetMetrics = () => {
  metrics = {
    requests: {
      total: 0,
      by_method: {},
      by_status: {},
      by_endpoint: {}
    },
    response_times: [],
    errors: {
      total: 0,
      by_type: {}
    }
  };
};

module.exports = {
  metricsMiddleware,
  getMetrics,
  resetMetrics
};