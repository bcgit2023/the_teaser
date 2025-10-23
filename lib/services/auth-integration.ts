/**
 * AuthIntegration Service
 * 
 * Unified authentication service that integrates all authentication components
 * including EnhancedAuthService, RBACService, and SecurityMiddleware.
 */

import { DatabaseManager } from '@/lib/database/database-manager';
import { EnhancedAuthService } from './enhanced-auth-service';
import { RBACService, Permission, AccessResult } from './rbac-service';
import { SecurityMiddleware } from './security-middleware';
import { 
  UserProfile, 
  UserRole,
  SecurityAuditLog 
} from '@/types/auth';

export interface AuthIntegrationConfig {
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    passwordSaltRounds: number;
  };
  security: {
    password: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number;
      preventReuse: number;
    };
    session: {
      maxAge: number;
      secure: boolean;
      httpOnly: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      rolling: boolean;
    };
    rateLimit: {
      windowMs: number;
      max: number;
      skipSuccessfulRequests: boolean;
    };
    cors: {
      origin: string[];
      credentials: boolean;
    };
    requireEmailVerification: boolean;
    lockout: {
      maxFailedAttempts: number;
      lockoutDuration: number;
    };
  };
  rbac: {
    enableRoleHierarchy: boolean;
    defaultRole: UserRole;
  };
  features: {
    enableAuditLogging: boolean;
    enablePasswordHistory: boolean;
    enableAccountLockout: boolean;
    enableEmailVerification: boolean;
  };
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  full_name?: string;
  profile_data?: any;
}

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
  ip_address?: string;
  user_agent?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  refreshToken?: string;
  session?: any;
  message?: string;
  error?: string;
}

export interface LoginSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * AuthIntegration - Unified Authentication Service
 * 
 * This service integrates all authentication components to provide
 * a single interface for authentication operations.
 */
export class AuthIntegration {
  private dbManager: DatabaseManager;
  private authService: EnhancedAuthService;
  private rbacService: RBACService;
  private securityMiddleware: SecurityMiddleware;
  private config: AuthIntegrationConfig;
  private isInitialized: boolean = false;

  constructor(config: AuthIntegrationConfig) {
    this.config = config;
    this.dbManager = DatabaseManager.getInstance();
    this.authService = new EnhancedAuthService(this.dbManager, {
      jwtSecret: this.config.auth.jwtSecret,
      jwtExpiresIn: this.config.auth.jwtExpiresIn,
      refreshTokenExpiresIn: this.config.auth.refreshTokenExpiresIn,
      passwordSaltRounds: this.config.auth.passwordSaltRounds,
      security: {
        max_login_attempts: this.config.security.lockout.maxFailedAttempts,
        lockout_duration_minutes: this.config.security.lockout.lockoutDuration,
        password_reset_token_expiry_hours: 24,
        email_verification_token_expiry_hours: 24,
        session_timeout_minutes: this.config.security.session.maxAge / (1000 * 60),
        require_2fa_for_admin: false,
        require_email_verification: this.config.security.requireEmailVerification,
        audit_log_retention_days: 90,
        suspicious_activity_threshold: 5
      }
    });
    this.rbacService = new RBACService(this.dbManager);
    this.securityMiddleware = new SecurityMiddleware(this.dbManager, this.config.security);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    try {
      // Initialize database manager first
      await this.dbManager.initializeIfNeeded();
      
      // Initialize database tables
      await this.authService.initializeTables();
      await this.rbacService.initializeTables();
      
      this.isInitialized = true;
      console.log('✅ AuthIntegration initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AuthIntegration:', error);
      throw error;
    }
  }

  // ============================================================================
  // User Registration
  // ============================================================================

  async register(userData: RegisterData): Promise<LoginResponse> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Validate password strength
      const passwordValidation = await this.securityMiddleware.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: `Password validation failed: ${passwordValidation.errors.join(', ')}`
        };
      }

      // Register user with enhanced auth service
      const { password, ...userDataWithoutPassword } = userData;
      const result = await this.authService.register(userDataWithoutPassword, password, {
        ip_address: userData.profile_data?.ip_address,
        user_agent: userData.profile_data?.user_agent
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          message: result.message
        };
      }

      const user = result.user;
      
      // Log successful registration
      if (this.config.features.enableAuditLogging && user) {
        await this.logSecurityEvent({
          id: this.generateId(),
          user_id: user.id,
          event_type: 'account_creation',
          event_category: 'authentication',
          description: 'User registered successfully',
          ip_address: userData.profile_data?.ip_address,
          user_agent: userData.profile_data?.user_agent,
          risk_level: 'low',
          success: true,
          created_at: new Date().toISOString()
        });
      }

      return {
        success: true,
        user,
        message: 'Registration successful'
      };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Log failed registration
      if (this.config.features.enableAuditLogging) {
        await this.logSecurityEvent({
          id: this.generateId(),
          user_id: '',
          event_type: 'account_creation',
          event_category: 'authentication',
          description: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ip_address: userData.profile_data?.ip_address,
          user_agent: userData.profile_data?.user_agent,
          risk_level: 'medium',
          success: false,
          created_at: new Date().toISOString()
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  // ============================================================================
  // User Login
  // ============================================================================

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    console.log('🚀 AuthIntegration.login called with:', { 
      email: credentials.email, 
      username: credentials.username,
      hasPassword: !!credentials.password,
      ip_address: credentials.ip_address,
      user_agent: credentials.user_agent
    });
    
    try {
      if (!this.isInitialized) {
        console.log('🔧 AuthIntegration not initialized, initializing...');
        await this.initialize();
        console.log('✅ AuthIntegration initialized');
      }

      // Attempt login - the EnhancedAuthService handles account lockout internally
      const authCredentials = {
        email: credentials.email,
        username: credentials.username,
        password: credentials.password
      };
      
      const context = {
        ip_address: credentials.ip_address,
        user_agent: credentials.user_agent
      };
      
      console.log('🔍 Calling authService.login with:', { authCredentials, context });
      console.log('🔍 authService instance:', !!this.authService);
      console.log('🔍 authService type:', this.authService?.constructor?.name);
      console.log('🔍 authCredentials:', { ...authCredentials, password: '[REDACTED]' });
      console.log('🔍 context:', context);
      let result;
      try {
        result = await this.authService.login(authCredentials, context);
        console.log('🔍 authService.login result:', result);
      } catch (loginError) {
        console.error('❌ Exception in authService.login:', loginError);
        throw loginError;
      }

      if (result.success && result.user) {
        // The EnhancedAuthService already handles clearing failed attempts on successful login
        
        // Log successful login
        if (this.config.features.enableAuditLogging) {
          await this.logSecurityEvent({
            id: this.generateId(),
            user_id: result.user.id,
            event_type: 'login_success',
            event_category: 'authentication',
            description: 'User logged in successfully',
            ip_address: credentials.ip_address,
            user_agent: credentials.user_agent,
            risk_level: 'low',
            success: true,
            created_at: new Date().toISOString()
          });
        }
      } else {
        // Record failed login attempt
        const identifier = credentials.username || credentials.email;
        if (identifier) {
          await this.authService.recordFailedAttempt(identifier, credentials.ip_address || '', 'invalid_credentials', credentials.user_agent);
        }
        
        // Log failed login
        if (this.config.features.enableAuditLogging) {
          await this.logSecurityEvent({
            id: this.generateId(),
            user_id: '',
            event_type: 'login_failure',
            event_category: 'authentication',
            description: `Login attempt failed: ${identifier ? 'Invalid credentials' : 'No identifier provided'}`,
            ip_address: credentials.ip_address,
            user_agent: credentials.user_agent,
            risk_level: 'medium',
            success: false,
            created_at: new Date().toISOString()
          });
        }
      }
      
      return result;
    } catch (error) {
      // Record failed login attempt
      const identifier = credentials.username || credentials.email;
      if (identifier) {
        await this.authService.recordFailedAttempt(identifier, credentials.ip_address || '', 'invalid_credentials', credentials.user_agent);
      }
      
      // Log failed login
      if (this.config.features.enableAuditLogging) {
        await this.logSecurityEvent({
          id: this.generateId(),
          user_id: '',
          event_type: 'login_failure',
          event_category: 'authentication',
          description: `Login attempt failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ip_address: credentials.ip_address,
          user_agent: credentials.user_agent,
          risk_level: 'medium',
          success: false,
          created_at: new Date().toISOString()
        });
      }
      
      throw error;
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async validateSession(token: string): Promise<{ valid: boolean; user?: UserProfile; session?: LoginSession }> {
    try {
      return await this.authService.validateSession(token);
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  }

  async logout(token: string): Promise<boolean> {
    try {
      return await this.authService.logout(token);
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // ============================================================================
  // Access Control
  // ============================================================================

  async checkAccess(userId: string, resource: string, action: string): Promise<AccessResult> {
    try {
      return await this.rbacService.checkAccess(userId, resource, action);
    } catch (error) {
      console.error('Access check error:', error);
      return {
        granted: false,
        reason: 'Access check failed',
        permissions: [],
        role: 'student' as UserRole
      };
    }
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      return await this.rbacService.getPermissionsByUser(userId);
    } catch (error) {
      console.error('Get user permissions error:', error);
      return [];
    }
  }

  // ============================================================================
  // User Management
  // ============================================================================

  async getUserById(id: string): Promise<UserProfile | null> {
    try {
      const adapter = this.dbManager.getAdapter();
      return await adapter.getUserById(id);
    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    try {
      const adapter = this.dbManager.getAdapter();
      return await adapter.getUserByUsername(username);
    } catch (error) {
      console.error('Get user by username error:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const adapter = this.dbManager.getAdapter();
      return await adapter.getUserByEmail(email);
    } catch (error) {
      console.error('Get user by email error:', error);
      return null;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      return await this.authService.changePassword(userId, currentPassword, newPassword);
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async logSecurityEvent(event: SecurityAuditLog): Promise<void> {
    try {
      // In a real implementation, this would save to the database
      console.log('Security Event:', event);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getAuthService(): EnhancedAuthService {
    return this.authService;
  }

  getRBACService(): RBACService {
    return this.rbacService;
  }

  getSecurityMiddleware(): SecurityMiddleware {
    return this.securityMiddleware;
  }

  getConfig(): AuthIntegrationConfig {
    return this.config;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}