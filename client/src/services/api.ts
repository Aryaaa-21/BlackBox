import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '../types';

// Get API URL from env with fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true, // Send and receive HTTP-only authentication cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach JWT token from localStorage as fallback
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('blackbox_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error extraction
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Check if error is due to network failure (e.g. offline / server down)
    if (!error.response) {
      const networkError: ApiError = {
        success: false,
        message: 'Network error or server is unreachable',
        code: 'NETWORK_UNAVAILABLE',
      };
      return Promise.reject(networkError);
    }

    // Extract standardized API error payload
    const responseData = error.response.data;
    const standardError: ApiError = {
      success: false,
      message: responseData?.message || error.message || 'An unexpected error occurred',
      code: responseData?.code || `HTTP_${error.response.status}`,
      details: responseData?.details,
    };

    // If 401 unauthorized, notify application
    if (error.response.status === 401) {
      window.dispatchEvent(new CustomEvent('blackbox:auth-expired'));
    }

    return Promise.reject(standardError);
  }
);
