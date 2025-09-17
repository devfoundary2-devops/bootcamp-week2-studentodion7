const promClient = require('prom-client');
const { trace, context } = require('@opentelemetry/api');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'shopmicro_backend_',
});

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'shopmicro_backend_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'shopmicro_backend_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

const httpRequestSize = new promClient.Histogram({
  name: 'shopmicro_backend_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

const httpResponseSize = new promClient.Histogram({
  name: 'shopmicro_backend_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

const activeConnections = new promClient.Gauge({
  name: 'shopmicro_backend_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

const dbConnectionsActive = new promClient.Gauge({
  name: 'shopmicro_backend_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

const redisConnectionsActive = new promClient.Gauge({
  name: 'shopmicro_backend_redis_connections_active',
  help: 'Number of active Redis connections',
  registers: [register],
});

const businessMetrics = {
  userRegistrations: new promClient.Counter({
    name: 'shopmicro_backend_user_registrations_total',
    help: 'Total number of user registrations',
    registers: [register],
  }),
  userLogins: new promClient.Counter({
    name: 'shopmicro_backend_user_logins_total',
    help: 'Total number of user logins',
    labelNames: ['status'],
    registers: [register],
  }),
  productViews: new promClient.Counter({
    name: 'shopmicro_backend_product_views_total',
    help: 'Total number of product views',
    labelNames: ['product_id'],
    registers: [register],
  }),
  apiErrors: new promClient.Counter({
    name: 'shopmicro_backend_api_errors_total',
    help: 'Total number of API errors',
    labelNames: ['error_type', 'endpoint'],
    registers: [register],
  }),
};

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Get current span for correlation
  const span = trace.getActiveSpan();
  if (span) {
    const traceId = span.spanContext().traceId;
    req.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);
  }

  // Track request size
  const requestSize = parseInt(req.headers['content-length'] || '0', 10);
  if (requestSize > 0) {
    httpRequestSize
      .labels(req.method, req.route?.path || req.path || 'unknown')
      .observe(requestSize);
  }

  // Increment active connections
  activeConnections.inc();

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000; // Convert to seconds
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.labels(req.method, route, statusCode).inc();
    httpRequestDuration.labels(req.method, route, statusCode).observe(responseTime);

    // Track response size
    const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;
    if (responseSize > 0) {
      httpResponseSize.labels(req.method, route, statusCode).observe(responseSize);
    }

    // Decrement active connections
    activeConnections.dec();

    // Track errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      businessMetrics.apiErrors.labels(errorType, route).inc();
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Function to get Prometheus metrics
const getMetrics = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
};

// Function to update database connection metrics
const updateDbMetrics = (activeConnections) => {
  dbConnectionsActive.set(activeConnections);
};

// Function to update Redis connection metrics
const updateRedisMetrics = (activeConnections) => {
  redisConnectionsActive.set(activeConnections);
};

// Business metrics helpers
const recordUserRegistration = () => {
  businessMetrics.userRegistrations.inc();
};

const recordUserLogin = (success = true) => {
  businessMetrics.userLogins.labels(success ? 'success' : 'failure').inc();
};

const recordProductView = (productId) => {
  businessMetrics.productViews.labels(productId.toString()).inc();
};

module.exports = {
  metricsMiddleware,
  getMetrics,
  updateDbMetrics,
  updateRedisMetrics,
  recordUserRegistration,
  recordUserLogin,
  recordProductView,
  register,
};