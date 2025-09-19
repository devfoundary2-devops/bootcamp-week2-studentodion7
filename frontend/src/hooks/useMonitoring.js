import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import monitoringService from '../services/monitoring';

// Hook for use inside Router context (with route tracking)
export const useMonitoringWithRoutes = () => {
  const location = useLocation();

  // Track route changes
  useEffect(() => {
    const previousPath = sessionStorage.getItem('previousPath');
    const currentPath = location.pathname;
    
    if (previousPath && previousPath !== currentPath) {
      monitoringService.recordRouteChange(previousPath, currentPath);
    }
    
    sessionStorage.setItem('previousPath', currentPath);
  }, [location]);

  // Monitoring functions
  const recordBusinessEvent = useCallback((eventType, data) => {
    monitoringService.recordBusinessEvent(eventType, data);
  }, []);

  const recordError = useCallback((error, context = {}) => {
    monitoringService.recordError({
      type: 'application_error',
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }, []);

  const recordMetric = useCallback((type, data) => {
    monitoringService.recordMetric(type, data);
  }, []);

  const setUserId = useCallback((userId) => {
    monitoringService.setUserId(userId);
  }, []);

  const measurePerformance = useCallback((operationName, operation) => {
    const startTime = performance.now();
    const startTimestamp = new Date().toISOString();
    
    try {
      const result = operation();
      
      // Handle both sync and async operations
      if (result && typeof result.then === 'function') {
        return result
          .then((asyncResult) => {
            const endTime = performance.now();
            recordMetric('performance_measurement', {
              operationName,
              duration: endTime - startTime,
              startTime: startTimestamp,
              endTime: new Date().toISOString(),
              success: true
            });
            return asyncResult;
          })
          .catch((error) => {
            const endTime = performance.now();
            recordMetric('performance_measurement', {
              operationName,
              duration: endTime - startTime,
              startTime: startTimestamp,
              endTime: new Date().toISOString(),
              success: false,
              error: error.message
            });
            recordError(error, { operation: operationName });
            throw error;
          });
      } else {
        const endTime = performance.now();
        recordMetric('performance_measurement', {
          operationName,
          duration: endTime - startTime,
          startTime: startTimestamp,
          endTime: new Date().toISOString(),
          success: true
        });
        return result;
      }
    } catch (error) {
      const endTime = performance.now();
      recordMetric('performance_measurement', {
        operationName,
        duration: endTime - startTime,
        startTime: startTimestamp,
        endTime: new Date().toISOString(),
        success: false,
        error: error.message
      });
      recordError(error, { operation: operationName });
      throw error;
    }
  }, [recordMetric, recordError]);

  return {
    recordBusinessEvent,
    recordError,
    recordMetric,
    setUserId,
    measurePerformance
  };
};

// Hook for use outside Router context (without route tracking)
export const useMonitoring = () => {
  // Monitoring functions (without route tracking)
  const recordBusinessEvent = useCallback((eventType, data) => {
    monitoringService.recordBusinessEvent(eventType, data);
  }, []);

  const recordError = useCallback((error, context = {}) => {
    monitoringService.recordError({
      type: 'application_error',
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }, []);

  const recordMetric = useCallback((type, data) => {
    monitoringService.recordMetric(type, data);
  }, []);

  const setUserId = useCallback((userId) => {
    monitoringService.setUserId(userId);
  }, []);

  const measurePerformance = useCallback((operationName, operation) => {
    const startTime = performance.now();
    const startTimestamp = new Date().toISOString();
    
    try {
      const result = operation();
      
      // Handle both sync and async operations
      if (result && typeof result.then === 'function') {
        return result
          .then((asyncResult) => {
            const endTime = performance.now();
            recordMetric('performance_measurement', {
              operationName,
              duration: endTime - startTime,
              startTime: startTimestamp,
              endTime: new Date().toISOString(),
              success: true
            });
            return asyncResult;
          })
          .catch((error) => {
            const endTime = performance.now();
            recordMetric('performance_measurement', {
              operationName,
              duration: endTime - startTime,
              startTime: startTimestamp,
              endTime: new Date().toISOString(),
              success: false,
              error: error.message
            });
            recordError(error, { operation: operationName });
            throw error;
          });
      } else {
        const endTime = performance.now();
        recordMetric('performance_measurement', {
          operationName,
          duration: endTime - startTime,
          startTime: startTimestamp,
          endTime: new Date().toISOString(),
          success: true
        });
        return result;
      }
    } catch (error) {
      const endTime = performance.now();
      recordMetric('performance_measurement', {
        operationName,
        duration: endTime - startTime,
        startTime: startTimestamp,
        endTime: new Date().toISOString(),
        success: false,
        error: error.message
      });
      recordError(error, { operation: operationName });
      throw error;
    }
  }, [recordMetric, recordError]);

  return {
    recordBusinessEvent,
    recordError,
    recordMetric,
    setUserId,
    measurePerformance
  };
};

// Higher-order component for monitoring React components
export const withMonitoring = (WrappedComponent, componentName) => {
  return function MonitoredComponent(props) {
    const { recordError, recordMetric } = useMonitoring();

    useEffect(() => {
      recordMetric('component_mount', {
        componentName,
        timestamp: new Date().toISOString()
      });

      return () => {
        recordMetric('component_unmount', {
          componentName,
          timestamp: new Date().toISOString()
        });
      };
    }, [recordMetric]);

    const handleError = (error, errorInfo) => {
      recordError(error, {
        componentName,
        errorInfo,
        props: JSON.stringify(props, null, 2).slice(0, 1000) // Limit size
      });
    };

    try {
      return <WrappedComponent {...props} onError={handleError} />;
    } catch (error) {
      handleError(error, { phase: 'render' });
      throw error;
    }
  };
};

export default useMonitoring;
