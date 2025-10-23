/**
 * AuthIntegration Instance
 * 
 * Singleton instance of the AuthIntegration service for use throughout the application.
 * This ensures consistent authentication behavior across all components.
 */

import { AuthIntegration } from '@/lib/services/auth-integration';
import { authConfig } from '@/lib/config/auth-config';

// Create singleton instance
let authInstance: AuthIntegration | null = null;

/**
 * Get the AuthIntegration instance
 * Creates and initializes the instance if it doesn't exist
 */
export async function getAuthInstance(): Promise<AuthIntegration> {
  if (!authInstance) {
    console.log('🔧 Creating new AuthIntegration instance...');
    authInstance = new AuthIntegration(authConfig);
    console.log('🔧 Initializing AuthIntegration...');
    await authInstance.initialize();
    console.log('✅ AuthIntegration initialized successfully');
  }
  
  return authInstance;
}

/**
 * Reset the auth instance (useful for testing)
 */
export function resetAuthInstance(): void {
  authInstance = null;
}

export { AuthIntegration } from '@/lib/services/auth-integration';
export type { LoginCredentials, LoginResponse, RegisterData } from '@/lib/services/auth-integration';