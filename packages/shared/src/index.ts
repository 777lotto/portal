// packages/shared/src/index.ts - Make sure all types are exported

// Export calendar types and functions
export * from './calendar';

// Export Stripe types
export * from './stripe';

// Export API types (excluding User to avoid conflict)
export type { 
  ApiResponse, 
  ApiError, 
  AuthPayload 
} from './api';

// Export all types from types.ts (this includes the main User type and Env)
export * from './types';
