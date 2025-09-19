import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

class MonitoringService {
  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.metrics = [];
    this.errors = [];
    this.pageViews = [];
    this.userInteractions = [];
    
    this.initializeMonitoring();
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateCorrelationId() {
    return 'corr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  initializeMonitoring() {
    // Initialize Web Vitals monitoring
    this.initializeWebVitals();
    
    // Initialize error monitoring
    this.initializeErrorMonitoring();
    
    // Initialize navigation monitoring
    this.initializeNavigationMonitoring();
    
    // Initialize user interaction monitoring
    this.initializeUserInteractionMonitoring();
    
    // Send metrics periodically
    this.startMetricsReporting();
    
    console.log('Frontend monitoring initialized', { sessionId: this.sessionId });
  }

  initializeWebVitals() {
    const reportMetric = (metric) => {
      this.recordMetric('web_vital', {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType
      });
    };

    getCLS(reportMetric);
    getFID(reportMetric);
    getFCP(reportMetric);
    getLCP(reportMetric);
    getTTFB(reportMetric);
  }

  initializeErrorMonitoring() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.recordError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // React error boundary support
    window.reportReactError = (error, errorInfo) => {
      this.recordError({
        type: 'react_error',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    };
  }

  initializeNavigationMonitoring() {
    // Page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          this.recordMetric('page_load', {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstByte: navigation.responseStart - navigation.requestStart,
            dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcpConnect: navigation.connectEnd - navigation.connectStart,
            serverResponse: navigation.responseEnd - navigation.responseStart,
            domProcessing: navigation.domComplete - navigation.domLoading,
            url: window.location.href
          });
        }
      }, 0);
    });

    // Track page views
    this.recordPageView(window.location.pathname);
  }

  initializeUserInteractionMonitoring() {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target;
      const tagName = target.tagName.toLowerCase();
      const className = target.className;
      const id = target.id;
      const text = target.textContent?.slice(0, 50);

      this.recordUserInteraction('click', {
        tagName,
        className,
        id,
        text,
        x: event.clientX,
        y: event.clientY,
        timestamp: new Date().toISOString()
      });
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target;
      this.recordUserInteraction('form_submit', {
        formId: form.id,
        formClass: form.className,
        action: form.action,
        method: form.method,
        timestamp: new Date().toISOString()
      });
    });
  }

  recordMetric(type, data) {
    const metric = {
      type,
      data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      url: window.location.href,
      correlationId: this.generateCorrelationId()
    };

    this.metrics.push(metric);
    console.log('Metric recorded:', metric);
  }

  recordError(error) {
    const errorRecord = {
      ...error,
      sessionId: this.sessionId,
      userId: this.userId,
      correlationId: this.generateCorrelationId()
    };

    this.errors.push(errorRecord);
    console.error('Error recorded:', errorRecord);
  }

  recordPageView(path) {
    const pageView = {
      path,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      correlationId: this.generateCorrelationId()
    };

    this.pageViews.push(pageView);
    console.log('Page view recorded:', pageView);
  }

  recordUserInteraction(type, data) {
    const interaction = {
      type,
      data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      url: window.location.href,
      correlationId: this.generateCorrelationId()
    };

    this.userInteractions.push(interaction);
  }

  // API call monitoring
  recordApiCall(method, url, duration, status, error = null) {
    this.recordMetric('api_call', {
      method,
      url,
      duration,
      status,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : null,
      timestamp: new Date().toISOString()
    });
  }

  // Business event tracking
  recordBusinessEvent(eventType, data) {
    this.recordMetric('business_event', {
      eventType,
      data,
      timestamp: new Date().toISOString()
    });
  }

  setUserId(userId) {
    this.userId = userId;
    console.log('User ID set:', userId);
  }

  startMetricsReporting() {
    // Send metrics every 30 seconds
    setInterval(() => {
      this.sendMetrics();
    }, 30000);

    // Send metrics on page unload
    window.addEventListener('beforeunload', () => {
      this.sendMetrics(true);
    });

    // Send metrics on visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendMetrics();
      }
    });
  }

  async sendMetrics(isUnloading = false) {
    if (this.metrics.length === 0 && this.errors.length === 0 && 
        this.pageViews.length === 0 && this.userInteractions.length === 0) {
      return;
    }

    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      metrics: [...this.metrics],
      errors: [...this.errors],
      pageViews: [...this.pageViews],
      userInteractions: [...this.userInteractions],
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    try {
      const method = isUnloading ? 'sendBeacon' : 'fetch';
      
      if (method === 'sendBeacon' && navigator.sendBeacon) {
        navigator.sendBeacon(
          `${this.apiUrl}/api/frontend-metrics`,
          JSON.stringify(payload)
        );
      } else {
        await fetch(`${this.apiUrl}/api/frontend-metrics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-Id': this.generateCorrelationId()
          },
          body: JSON.stringify(payload),
          keepalive: isUnloading
        });
      }

      // Clear sent metrics
      this.metrics = [];
      this.errors = [];
      this.pageViews = [];
      this.userInteractions = [];

      console.log('Metrics sent successfully');
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }

  // Performance monitoring for React components
  measureComponentRender(componentName, renderFunction) {
    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();
    
    this.recordMetric('component_render', {
      componentName,
      renderTime: endTime - startTime,
      timestamp: new Date().toISOString()
    });

    return result;
  }

  // Route change tracking
  recordRouteChange(from, to) {
    this.recordMetric('route_change', {
      from,
      to,
      timestamp: new Date().toISOString()
    });
    
    this.recordPageView(to);
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;
