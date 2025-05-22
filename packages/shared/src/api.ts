// Generic API response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

// Error handling
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// Authentication types
export interface AuthPayload {
  email: string;
  name?: string;
}

