/**
 * Authentication Hook
 * 
 * Provides client-side authentication state management and session handling
 */

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'student' | 'teacher' | 'parent';
  full_name?: string;
  profile_picture?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionId?: string;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  validateSession: () => Promise<boolean>;
}

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
  role: 'student' | 'teacher' | 'parent';
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
}

// ============================================================================
// Auth Context
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============================================================================
// Auth Hook Implementation
// ============================================================================

export const useAuthState = (): AuthContextType => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  });

  const router = useRouter();

  // ============================================================================
  // Session Validation
  // ============================================================================

  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.user) {
          setAuthState({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            sessionId: data.sessionId
          });
          return true;
        }
      }

      // Session invalid or expired
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
      return false;

    } catch (error) {
      console.error('Session validation error:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
      return false;
    }
  }, []);

  // ============================================================================
  // Login
  // ============================================================================

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAuthState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          sessionId: data.sessionId
        });

        return {
          success: true,
          user: data.user
        };
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: data.error || 'Login failed'
        };
      }

    } catch (error) {
      console.error('Login error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    }
  }, []);

  // ============================================================================
  // Logout
  // ============================================================================

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Call logout API to invalidate session
      await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'include'
      });

    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of API call result
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });

      // Redirect to login page
      router.push('/login');
    }
  }, [router]);

  // ============================================================================
  // Refresh Session
  // ============================================================================

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      // Get refresh token from localStorage or cookie
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        return false;
      }

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Store new refresh token
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
          
          // Validate the new session
          return await validateSession();
        }
      }

      return false;

    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  }, [validateSession]);

  // ============================================================================
  // Initialize Auth State
  // ============================================================================

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Try to validate existing session
      const isValid = await validateSession();
      
      if (!isValid && mounted) {
        // Try to refresh session if validation failed
        const refreshed = await refreshSession();
        
        if (!refreshed && mounted) {
          // No valid session, set as unauthenticated
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [validateSession, refreshSession]);

  // ============================================================================
  // Auto-refresh Session
  // ============================================================================

  useEffect(() => {
    if (!authState.isAuthenticated) {
      return;
    }

    // Set up automatic session refresh every 10 minutes
    const refreshInterval = setInterval(async () => {
      const isValid = await validateSession();
      if (!isValid) {
        // Try to refresh if validation failed
        const refreshed = await refreshSession();
        if (!refreshed) {
          // Force logout if refresh also failed
          await logout();
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, [authState.isAuthenticated, validateSession, refreshSession, logout]);

  return {
    ...authState,
    login,
    logout,
    refreshSession,
    validateSession
  };
};

// ============================================================================
// Auth Provider Component
// ============================================================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authState = useAuthState();

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};