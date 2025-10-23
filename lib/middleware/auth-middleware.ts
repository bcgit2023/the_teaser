/**
 * Enhanced Authentication Middleware
 * 
 * Provides comprehensive authentication and authorization middleware
 * with support for JWT tokens, session management, and role-based access control.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { UserRole, SessionData, AuthenticatedRequest } from '@/types/auth';
import { DatabaseManager } from '@/lib/database/database-manager';
import { securityService } from '@/lib/services/security-service';
import { rbacService } from '@/lib/services/rbac-service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AuthMiddlewareConfig {
  requireAuth?: boolean;
  allowedRoles?: UserRole[];
  requiredPermissions?: string[];
  checkSession?: boolean;
  rateLimitKey?: string;
  csrfProtection?: boolean;
}

export interface AuthContext {
  user?: SessionData;
  session?: any;
  permissions?: string[];
  isAuthenticated: boolean;
  rateLimitInfo?: {
    remaining: number;
    resetTime: number;
  };
}

// ============================================================================
// JWT Utilities
// ============================================================================

export class JWTManager {
  private static readonly SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
  private static readonly REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  static generateTokens(payload: SessionData): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = jwt.sign(payload, this.SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'futurelearner',
      audience: 'futurelearner-app'
    });

    const refreshToken = jwt.sign(
      { userId: payload.userId, tokenType: 'refresh' },
      this.REFRESH_SECRET,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'futurelearner',
        audience: 'futurelearner-app'
      }
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string): SessionData | null {
    try {
      // First try with issuer/audience for new tokens
      const decoded = jwt.verify(token, this.SECRET, {
        issuer: 'futurelearner',
        audience: 'futurelearner-app'
      }) as SessionData;
      
      return decoded;
    } catch (error) {
      // Fallback to verification without issuer/audience for backward compatibility
      try {
        const decoded = jwt.verify(token, this.SECRET) as SessionData;
        return decoded;
      } catch (fallbackError) {
        return null;
      }
    }
  }

  static verifyRefreshToken(token: string): { userId: number; tokenType: string } | null {
    try {
      const decoded = jwt.verify(token, this.REFRESH_SECRET, {
        issuer: 'futurelearner',
        audience: 'futurelearner-app'
      }) as { userId: number; tokenType: string };
      
      if (decoded.tokenType !== 'refresh') {
        return null;
      }
      
      return decoded;
    } catch (error) {
      return null;
    }
  }

  static getTokenExpiry(token: string): number | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.exp ? decoded.exp * 1000 : null;
    } catch (error) {
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    
    return Date.now() >= expiry;
  }
}

// ============================================================================
// Session Manager
// ============================================================================

export class SessionManager {
  private static async getDb() {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.initializeIfNeeded();
    return dbManager.getAdapter();
  }

  static async createSession(
    userId: number,
    accessToken: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const sessionToken = securityService.generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const db = await this.getDb();

    await db.createSession({
      user_id: userId,
      token: sessionToken,
      refresh_token: refreshToken,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      is_active: true,
      login_method: 'jwt'
    });

    return sessionToken;
  }

  static async validateSession(sessionToken: string): Promise<SessionData | null> {
    try {
      const db = await this.getDb();
      const session = await db.getSessionByToken(sessionToken);
      
      if (!session || !session.is_active || new Date() > new Date(session.expires_at)) {
        return null;
      }

      // Update last activity
      await db.updateSessionActivity(sessionToken);

      // Get user data
      const user = await db.getUserById(session.user_id);
      if (!user || !user.is_active) {
        return null;
      }

      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        sessionId: sessionToken
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  static async refreshSession(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionToken: string;
  } | null> {
    try {
      // Verify refresh token
      const decoded = JWTManager.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return null;
      }

      const db = await this.getDb();
      // Get user data
      const user = await db.getUserById(decoded.userId);
      if (!user || !user.is_active) {
        return null;
      }

      // Generate new tokens
      const sessionData: SessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      };

      const tokens = JWTManager.generateTokens(sessionData);
      
      // Create new session
      const sessionToken = await this.createSession(
        user.id,
        tokens.accessToken,
        tokens.refreshToken
      );

      // Invalidate old session
      await db.invalidateSessionByRefreshToken(refreshToken);

      return {
        ...tokens,
        sessionToken
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return null;
    }
  }

  static async invalidateSession(sessionToken: string): Promise<void> {
    const db = await this.getDb();
    await db.invalidateSession(sessionToken);
  }

  static async invalidateAllUserSessions(userId: number): Promise<void> {
    const db = await this.getDb();
    await db.invalidateAllUserSessions(userId);
  }

  static async cleanupExpiredSessions(): Promise<void> {
    const db = await this.getDb();
    await db.cleanupExpiredSessions();
  }
}

// ============================================================================
// Authentication Middleware
// ============================================================================

export class AuthMiddleware {
  /**
   * Main authentication middleware
   */
  static async authenticate(
    request: NextRequest,
    config: AuthMiddlewareConfig = {}
  ): Promise<{
    response?: NextResponse;
    context: AuthContext;
  }> {
    const context: AuthContext = {
      isAuthenticated: false
    };

    try {
      // Rate limiting
      if (config.rateLimitKey) {
        const rateLimitResult = await this.checkRateLimit(request, config.rateLimitKey);
        context.rateLimitInfo = rateLimitResult;
        
        if (!rateLimitResult.allowed) {
          return {
            response: this.createErrorResponse('Too many requests', 429, {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
            }),
            context
          };
        }
      }

      // CSRF protection
      if (config.csrfProtection && this.isStateChangingRequest(request)) {
        const csrfValid = await this.validateCSRF(request);
        if (!csrfValid) {
          return {
            response: this.createErrorResponse('CSRF token invalid', 403),
            context
          };
        }
      }

      // Extract and validate token
      const token = this.extractToken(request);
      if (!token) {
        if (config.requireAuth) {
          return {
            response: this.createErrorResponse('Authentication required', 401),
            context
          };
        }
        return { context };
      }

      // Verify JWT token
      const sessionData = JWTManager.verifyAccessToken(token);
      if (!sessionData) {
        if (config.requireAuth) {
          return {
            response: this.createErrorResponse('Invalid token', 401),
            context
          };
        }
        return { context };
      }

      // Validate session if required
      if (config.checkSession && sessionData.sessionId) {
        const validSession = await SessionManager.validateSession(sessionData.sessionId);
        if (!validSession) {
          if (config.requireAuth) {
            return {
              response: this.createErrorResponse('Session expired', 401),
              context
            };
          }
          return { context };
        }
        context.user = validSession;
      } else {
        context.user = sessionData;
      }

      context.isAuthenticated = true;

      // Role-based authorization
      if (config.allowedRoles && config.allowedRoles.length > 0) {
        if (!config.allowedRoles.includes(context.user.role)) {
          return {
            response: this.createErrorResponse('Insufficient permissions', 403),
            context
          };
        }
      }

      // Permission-based authorization
      if (config.requiredPermissions && config.requiredPermissions.length > 0) {
        const userPermissions = rbacService.getRolePermissions(context.user.role);
        context.permissions = userPermissions;
        
        const hasPermissions = config.requiredPermissions.every(permission =>
          userPermissions.includes(permission)
        );
        
        if (!hasPermissions) {
          return {
            response: this.createErrorResponse('Insufficient permissions', 403),
            context
          };
        }
      }

      return { context };
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return {
        response: this.createErrorResponse('Authentication error', 500),
        context
      };
    }
  }

  /**
   * Create authenticated request with context
   */
  static createAuthenticatedRequest(
    request: NextRequest,
    context: AuthContext
  ): AuthenticatedRequest {
    const authRequest = request as AuthenticatedRequest;
    authRequest.auth = context;
    return authRequest;
  }

  /**
   * Middleware for API routes
   */
  static withAuth(
    handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
    config: AuthMiddlewareConfig = {}
  ) {
    return async (request: NextRequest): Promise<NextResponse> => {
      const { response, context } = await this.authenticate(request, config);
      
      if (response) {
        return response;
      }

      const authRequest = this.createAuthenticatedRequest(request, context);
      return handler(authRequest);
    };
  }

  /**
   * Role-based middleware
   */
  static requireRole(roles: UserRole | UserRole[]) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (
      handler: (request: AuthenticatedRequest) => Promise<NextResponse>
    ) => {
      return this.withAuth(handler, {
        requireAuth: true,
        allowedRoles
      });
    };
  }

  /**
   * Permission-based middleware
   */
  static requirePermission(permissions: string | string[]) {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    
    return (
      handler: (request: AuthenticatedRequest) => Promise<NextResponse>
    ) => {
      return this.withAuth(handler, {
        requireAuth: true,
        requiredPermissions
      });
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private static extractToken(request: NextRequest): string | null {
    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    const tokenCookie = request.cookies.get('auth-token');
    if (tokenCookie) {
      return tokenCookie.value;
    }

    return null;
  }

  private static async checkRateLimit(
    request: NextRequest,
    key: string
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const ip = this.getClientIP(request);
    const identifier = `${key}:${ip}`;
    
    return securityService.checkApiRequest(identifier);
  }

  private static async validateCSRF(request: NextRequest): Promise<boolean> {
    const sessionToken = request.cookies.get('session-token')?.value;
    const csrfToken = request.headers.get('x-csrf-token');
    
    if (!sessionToken || !csrfToken) {
      return false;
    }

    return securityService.validateCSRFToken(sessionToken, csrfToken);
  }

  private static isStateChangingRequest(request: NextRequest): boolean {
    const method = request.method.toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  }

  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return 'unknown';
  }

  private static createErrorResponse(
    message: string,
    status: number,
    headers?: Record<string, string>
  ): NextResponse {
    const response = NextResponse.json(
      { error: message, status },
      { status }
    );

    // Add security headers
    const securityHeaders = securityService.getSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add custom headers
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return response;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract user from authenticated request
 */
export function getAuthUser(request: AuthenticatedRequest): SessionData | null {
  return request.auth?.user || null;
}

/**
 * Check if user has specific role
 */
export function hasRole(request: AuthenticatedRequest, role: UserRole): boolean {
  const user = getAuthUser(request);
  return user?.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(request: AuthenticatedRequest, roles: UserRole[]): boolean {
  const user = getAuthUser(request);
  return user ? roles.includes(user.role) : false;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(request: AuthenticatedRequest, permission: string): boolean {
  const permissions = request.auth?.permissions || [];
  return permissions.includes(permission);
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(request: AuthenticatedRequest, permissions: string[]): boolean {
  const userPermissions = request.auth?.permissions || [];
  return permissions.every(permission => userPermissions.includes(permission));
}

// ============================================================================
// Convenience Exports
// ============================================================================

export const withAuth = AuthMiddleware.withAuth;
export const requireRole = AuthMiddleware.requireRole;
export const requirePermission = AuthMiddleware.requirePermission;