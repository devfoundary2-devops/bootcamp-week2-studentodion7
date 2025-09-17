const express = require('express');
const { createContextualLogger } = require('../middleware/logging');
const { trace } = require('@opentelemetry/api');

const router = express.Router();

// Endpoint to receive frontend metrics
router.post('/', async (req, res) => {
  const logger = createContextualLogger(req);
  
  try {
    const span = trace.getTracer('shopmicro-backend').startSpan('process_frontend_metrics');
    
    try {
      const {
        sessionId,
        userId,
        metrics = [],
        errors = [],
        pageViews = [],
        userInteractions = [],
        userAgent,
        url
      } = req.body;

      // Log received metrics
      logger.info('Frontend metrics received', {
        sessionId,
        userId,
        metricsCount: metrics.length,
        errorsCount: errors.length,
        pageViewsCount: pageViews.length,
        userInteractionsCount: userInteractions.length,
        userAgent,
        url
      });

      // Process Web Vitals metrics
      const webVitals = metrics.filter(m => m.type === 'web_vital');
      webVitals.forEach(metric => {
        logger.info('Web Vital metric', {
          sessionId,
          userId,
          name: metric.data.name,
          value: metric.data.value,
          rating: metric.data.rating,
          timestamp: metric.timestamp
        });
      });

      // Process API call metrics
      const apiCalls = metrics.filter(m => m.type === 'api_call');
      apiCalls.forEach(metric => {
        logger.info('Frontend API call', {
          sessionId,
          userId,
          method: metric.data.method,
          url: metric.data.url,
          duration: metric.data.duration,
          status: metric.data.status,
          error: metric.data.error,
          timestamp: metric.timestamp
        });
      });

      // Process page load metrics
      const pageLoads = metrics.filter(m => m.type === 'page_load');
      pageLoads.forEach(metric => {
        logger.info('Page load performance', {
          sessionId,
          userId,
          loadTime: metric.data.loadTime,
          domContentLoaded: metric.data.domContentLoaded,
          firstByte: metric.data.firstByte,
          url: metric.data.url,
          timestamp: metric.timestamp
        });
      });

      // Process business events
      const businessEvents = metrics.filter(m => m.type === 'business_event');
      businessEvents.forEach(metric => {
        logger.info('Frontend business event', {
          sessionId,
          userId,
          eventType: metric.data.eventType,
          eventData: metric.data.data,
          timestamp: metric.timestamp
        });
      });

      // Process component render metrics
      const componentMetrics = metrics.filter(m => m.type === 'component_render');
      componentMetrics.forEach(metric => {
        logger.debug('Component render performance', {
          sessionId,
          userId,
          componentName: metric.data.componentName,
          renderTime: metric.data.renderTime,
          timestamp: metric.timestamp
        });
      });

      // Process performance measurements
      const performanceMetrics = metrics.filter(m => m.type === 'performance_measurement');
      performanceMetrics.forEach(metric => {
        logger.info('Frontend performance measurement', {
          sessionId,
          userId,
          operationName: metric.data.operationName,
          duration: metric.data.duration,
          success: metric.data.success,
          error: metric.data.error,
          timestamp: metric.timestamp
        });
      });

      // Process errors
      errors.forEach(error => {
        logger.error('Frontend error', {
          sessionId,
          userId,
          errorType: error.type,
          message: error.message,
          stack: error.stack,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
          componentStack: error.componentStack,
          context: error.context,
          timestamp: error.timestamp,
          correlationId: error.correlationId
        });
      });

      // Process page views
      pageViews.forEach(pageView => {
        logger.info('Frontend page view', {
          sessionId,
          userId,
          path: pageView.path,
          referrer: pageView.referrer,
          timestamp: pageView.timestamp,
          correlationId: pageView.correlationId
        });
      });

      // Process user interactions (sample only to avoid too much noise)
      const sampledInteractions = userInteractions.filter((_, index) => index % 10 === 0); // Sample 10%
      sampledInteractions.forEach(interaction => {
        logger.debug('Frontend user interaction', {
          sessionId,
          userId,
          type: interaction.type,
          data: interaction.data,
          timestamp: interaction.timestamp,
          correlationId: interaction.correlationId
        });
      });

      // Respond with success
      res.json({
        success: true,
        processed: {
          metrics: metrics.length,
          errors: errors.length,
          pageViews: pageViews.length,
          userInteractions: userInteractions.length
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      span.end();
    }
  } catch (error) {
    logger.error('Error processing frontend metrics', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process frontend metrics',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
