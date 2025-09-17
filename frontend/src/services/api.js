import axios from 'axios';
import monitoringService from './monitoring';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token and monitoring
api.interceptors.request.use(
  (config) => {
    // Add auth token
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add correlation ID for tracing
    const correlationId = monitoringService.generateCorrelationId();
    config.headers['X-Correlation-Id'] = correlationId;
    
    // Add request start time for monitoring
    config.metadata = { 
      startTime: performance.now(),
      correlationId,
      timestamp: new Date().toISOString()
    };
    
    return config;
  },
  (error) => {
    monitoringService.recordError({
      type: 'api_request_error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and monitoring
api.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const endTime = performance.now();
    const duration = endTime - response.config.metadata.startTime;
    
    // Record successful API call
    monitoringService.recordApiCall(
      response.config.method.toUpperCase(),
      response.config.url,
      duration,
      response.status
    );
    
    // Add response headers to monitoring context
    const traceId = response.headers['x-trace-id'];
    const correlationId = response.headers['x-correlation-id'] || response.config.metadata.correlationId;
    
    if (traceId || correlationId) {
      monitoringService.recordMetric('api_trace_context', {
        traceId,
        correlationId,
        method: response.config.method.toUpperCase(),
        url: response.config.url,
        status: response.status,
        duration
      });
    }
    
    return response.data;
  },
  (error) => {
    // Calculate request duration even for errors
    const endTime = performance.now();
    const duration = error.config?.metadata ? 
      endTime - error.config.metadata.startTime : 0;
    
    const status = error.response?.status || 0;
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
    const url = error.config?.url || 'unknown';
    
    // Record failed API call
    monitoringService.recordApiCall(method, url, duration, status, error);
    
    // Record detailed error information
    monitoringService.recordError({
      type: 'api_response_error',
      message: error.message,
      status,
      method,
      url,
      responseData: error.response?.data,
      duration,
      correlationId: error.config?.metadata?.correlationId,
      timestamp: new Date().toISOString()
    });
    
    // Handle specific error cases
    if (status === 401) {
      localStorage.removeItem('authToken');
      monitoringService.recordBusinessEvent('user_logged_out', {
        reason: 'token_expired',
        automatic: true
      });
      window.location.href = '/login';
    } else if (status >= 500) {
      monitoringService.recordBusinessEvent('server_error_encountered', {
        status,
        method,
        url,
        correlationId: error.config?.metadata?.correlationId
      });
    }
    
    return Promise.reject(error);
  }
);

// Product API calls
export const getProducts = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.category) queryParams.append('category', params.category);
  if (params.search) queryParams.append('search', params.search);

  return await api.get(`/api/products?${queryParams.toString()}`);
};

export const getProduct = async (id) => {
  return await api.get(`/api/products/${id}`);
};

export const createProduct = async (productData) => {
  return await api.post('/api/products', productData);
};

export const updateProduct = async (id, productData) => {
  return await api.put(`/api/products/${id}`, productData);
};

export const deleteProduct = async (id) => {
  return await api.delete(`/api/products/${id}`);
};

export const getCategories = async () => {
  return await api.get('/api/products/meta/categories');
};

// User API calls
export const getUsers = async () => {
  return await api.get('/api/users');
};

export const getUser = async (id) => {
  return await api.get(`/api/users/${id}`);
};

export const getUserProfile = async (id) => {
  return await api.get(`/api/users/${id}/profile`);
};

export const createUser = async (userData) => {
  return await api.post('/api/users', userData);
};

export const login = async (credentials) => {
  return await api.post('/api/users/login', credentials);
};

// Health check API calls
export const getHealth = async () => {
  return await api.get('/health');
};

export const getDetailedHealth = async () => {
  return await api.get('/health/detailed');
};

export const getMetrics = async () => {
  return await api.get('/metrics');
};

// ML Service API calls (placeholder for future implementation)
export const getRecommendations = async (userId) => {
  try {
    return await api.get(`/api/ml/recommendations/${userId}`);
  } catch (error) {
    // Return mock data if ML service is not available
    return {
      recommendations: [
        { id: 1, name: 'Recommended Laptop', score: 0.95 },
        { id: 3, name: 'Recommended Headphones', score: 0.87 },
        { id: 5, name: 'Recommended Coffee Mug', score: 0.75 }
      ]
    };
  }
};

export default api;