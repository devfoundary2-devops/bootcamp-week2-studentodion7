const winston = require('winston');
const expressWinston = require('express-winston');
const { v4: uuidv4 } = require('uuid');
const { trace } = require('@opentelemetry/api');

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: 'shopmicro-backend',
      environment: process.env.NODE_ENV || 'development',
      ...meta
    });
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'shopmicro-backend',
    version: '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // In production, you might want to add file transports or external log services
  ],
});

// Middleware to add correlation ID and tracing context
const correlationMiddleware = (req, res, next) => {
  // Generate or extract correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  // Get trace context if available
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    req.traceId = spanContext.traceId;
    req.spanId = spanContext.spanId;
    res.setHeader('X-Trace-Id', spanContext.traceId);
  }

  next();
};

// Express Winston middleware for request logging
const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
  expressFormat: false,
  colorize: false,
  dynamicMeta: (req, res) => {
    return {
      correlationId: req.correlationId,
      traceId: req.traceId,
      spanId: req.spanId,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      contentLength: res.get('content-length'),
    };
  },
});

// Express Winston middleware for error logging
const errorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
  meta: true,
  msg: 'Error: {{err.message}}',
  dynamicMeta: (req, res, err) => {
    return {
      correlationId: req.correlationId,
      traceId: req.traceId,
      spanId: req.spanId,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      },
      response: {
        statusCode: res.statusCode,
      },
    };
  },
});

// Enhanced logger with correlation context
const createContextualLogger = (req) => {
  return logger.child({
    correlationId: req?.correlationId,
    traceId: req?.traceId,
    spanId: req?.spanId,
    userId: req?.user?.id,
  });
};

// Business event logger
const logBusinessEvent = (eventType, data, req = null) => {
  const contextualLogger = req ? createContextualLogger(req) : logger;
  
  contextualLogger.info('Business event', {
    eventType,
    eventData: data,
    timestamp: new Date().toISOString(),
  });
};

// Security event logger
const logSecurityEvent = (eventType, data, req = null) => {
  const contextualLogger = req ? createContextualLogger(req) : logger;
  
  contextualLogger.warn('Security event', {
    eventType,
    eventData: data,
    timestamp: new Date().toISOString(),
    severity: 'high',
  });
};

// Performance logger
const logPerformanceEvent = (operation, duration, metadata = {}, req = null) => {
  const contextualLogger = req ? createContextualLogger(req) : logger;
  
  contextualLogger.info('Performance event', {
    operation,
    duration,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

// Database operation logger
const logDatabaseOperation = (operation, table, duration, req = null) => {
  const contextualLogger = req ? createContextualLogger(req) : logger;
  
  contextualLogger.debug('Database operation', {
    operation,
    table,
    duration,
    timestamp: new Date().toISOString(),
  });
};

// Cache operation logger
const logCacheOperation = (operation, key, hit, duration, req = null) => {
  const contextualLogger = req ? createContextualLogger(req) : logger;
  
  contextualLogger.debug('Cache operation', {
    operation,
    key,
    hit,
    duration,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  logger,
  correlationMiddleware,
  requestLogger,
  errorLogger,
  createContextualLogger,
  logBusinessEvent,
  logSecurityEvent,
  logPerformanceEvent,
  logDatabaseOperation,
  logCacheOperation,
};
