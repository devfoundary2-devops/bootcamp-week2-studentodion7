import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
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