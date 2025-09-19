// Initialize OpenTelemetry tracing first
require('./telemetry');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');
const frontendMetricsRoutes = require('./routes/frontend-metrics');
const { metricsMiddleware, getMetrics } = require('./middleware/metrics');
const { 
  correlationMiddleware, 
  requestLogger, 
  errorLogger, 
  logger 
} = require('./middleware/logging');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:3000', // React dev server default
    'http://localhost:8080'  // Docker frontend port
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Middleware
app.use(compression());

// Correlation and tracing middleware (must be early)
app.use(correlationMiddleware);

// Request logging middleware
app.use(requestLogger);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Metrics middleware for monitoring
app.use(metricsMiddleware);

// Routes
app.use('/health', healthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/frontend-metrics', frontendMetricsRoutes);
app.get('/metrics', getMetrics);

// Error logging middleware (must be before error handlers)
app.use(errorLogger);

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', {
    correlationId: req.correlationId,
    traceId: req.traceId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  res.status(404).json({ 
    error: 'Not Found', 
    message: 'The requested resource was not found',
    correlationId: req.correlationId,
    traceId: req.traceId
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    correlationId: req.correlationId,
    traceId: req.traceId,
    method: req.method,
    url: req.url
  });
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    correlationId: req.correlationId,
    traceId: req.traceId
  });
});

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid
  });
});

// 🥚 Easter Egg #1: Secret Bootcamp Endpoint
app.get('/api/bootcamp/secret', (req, res) => {
  const secretMessage = {
    message: "🎉 Congratulations! You found the secret bootcamp endpoint!",
    achievement: "Secret Discoverer",
    hint: "The real treasure was the Kubernetes knowledge you gained along the way",
    badge: "🏆 Easter Egg Hunter - Level 1",
    nextHint: "Try the Konami code on the frontend: ↑↑↓↓←→←→BA"
  };
  
  logger.info('Secret endpoint accessed', { 
    ip: req.ip, 
    userAgent: req.get('User-Agent'),
    achievement: 'easter_egg_1_found'
  });
  
  res.json(secretMessage);
});

// 🥚 Easter Egg #4: Pod Whisperer Detection
app.get('/api/pod-identity', (req, res) => {
  const hostname = require('os').hostname();
  const isPodWhisperer = hostname.includes('gopher') || 
                        hostname.includes('kubernetes') || 
                        hostname.includes('k8s-mascot');
  
  if (isPodWhisperer) {
    logger.info(`
    🎉 POD WHISPERER DETECTED! 🎉
    
         .-"-.
        /     \\
       | () () |
        \\  ^  /
         |||||
         |||||
    
    You have unlocked the Pod Whisperer achievement!
    The Kubernetes Gopher approves of your naming skills!
    `);
  }
  
  res.json({
    hostname,
    isPodWhisperer,
    message: isPodWhisperer ? "🎊 Pod Whisperer Achievement Unlocked!" : "Try naming your pod with a Kubernetes mascot name"
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed. Process terminated.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed. Process terminated.');
    process.exit(0);
  });
});

module.exports = app;