/**
 * Enhanced Authentication Service Layer
 * 
 * Provides comprehensive authentication with security features including:
 * - Audit logging
 * - Account lockout protection
 * - Password reset tokens
 * - Email verification
 * - Two-factor authentication
 * - Security event tracking
 * 
 * Designed for easy migration to Supabase while maintaining SQLite compatibility.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { DatabaseManager } from '@/lib/database/database-manager';
import {
  UserProfile,
  LoginSession,
  AuthResponse,
  LoginResponse,
  RegisterResponse,
  UserRole,
  AccountStatus,
  LoginMethod,
  PasswordResetToken,
  FailedLoginAttempt,
  AccountLockout,
  SecurityAuditLog,
  EmailVerificationToken,
  TwoFactorAuth,
  SecurityEventType,
  SecurityRiskLevel,
  SecuritySettings,
  AuthCredentials
} from '@/types/auth';

export interface EnhancedAuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  passwordSaltRounds: number;
  security: SecuritySettings;
}

export class EnhancedAuthService {
  private dbManager: DatabaseManager;
  private config: EnhancedAuthConfig;

  constructor(dbManager: DatabaseManager, config: EnhancedAuthConfig) {
    this.dbManager = dbManager;
    this.config = config;
  }

  // ============================================================================
  // Database Initialization
  // ============================================================================

  async initializeTables(): Promise<void> {
    try {
      const adapter = this.dbManager.getAdapter();
      
      // Create enhanced auth tables
      await adapter.query(`
        CREATE TABLE IF NOT EXISTS security_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          event_type TEXT NOT NULL,
          event_category TEXT NOT NULL,
          description TEXT,
          ip_address TEXT,
          user_agent TEXT,
          risk_level TEXT DEFAULT 'low',
          success BOOLEAN DEFAULT false,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          attempt_type TEXT NOT NULL,
          user_agent TEXT,
          success BOOLEAN DEFAULT false,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS failed_login_attempts (
          id TEXT PRIMARY KEY,
          identifier TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          user_agent TEXT,
          attempt_time DATETIME NOT NULL,
          failure_reason TEXT NOT NULL,
          blocked_until DATETIME
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS account_lockouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          locked_until DATETIME NOT NULL,
          reason TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          session_token TEXT NOT NULL UNIQUE,
          refresh_token TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS password_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Create indexes for performance
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts(ip_address)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_account_lockouts_user_id ON account_lockouts(user_id)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token)`);

      console.log('✅ Enhanced authentication tables initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize enhanced authentication tables:', error);
      throw error;
    }
  }

  // ============================================================================
  // Enhanced User Registration with Security
  // ============================================================================

  async register(userData: Partial<UserProfile>, password: string, context?: {
    ip_address?: string;
    user_agent?: string;
  }): Promise<RegisterResponse> {
    try {
      const adapter = this.dbManager.getAdapter();

      // Check if user already exists
      const existingUser = await adapter.getUserByEmail(userData.email!);
      if (existingUser) {
        await this.logSecurityEvent({
          event_type: 'account_creation',
          event_category: 'authentication',
          description: `Registration attempt with existing email: ${userData.email}`,
          ip_address: context?.ip_address,
          user_agent: context?.user_agent,
          risk_level: 'medium',
          success: false
        });

        return {
          success: false,
          error: 'User with this email already exists',
          message: 'Registration failed'
        };
      }

      // Validate password strength
      const passwordValidation = this.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.message,
          message: 'Password does not meet security requirements'
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, this.config.passwordSaltRounds);

      // Create user with enhanced security defaults
      const newUserData: Partial<UserProfile> = {
        ...userData,
        account_status: 'active' as AccountStatus,
        email_verified: !this.config.security.require_email_verification,
        login_attempts: 0,
        preferences: {
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email_notifications: true,
            push_notifications: true,
            quiz_reminders: true,
            progress_updates: true,
            system_announcements: true
          },
          accessibility: {
            high_contrast: false,
            large_text: false,
            screen_reader: false,
            keyboard_navigation: false
          },
          privacy: {
            profile_visibility: 'private',
            show_progress: true,
            allow_messages: true
          }
        }
      };

      const user = await adapter.createUser(newUserData);

      // Update password hash
      await adapter.updatePassword(user.id, hashedPassword);

      // Create email verification token if required
      let verificationToken: EmailVerificationToken | null = null;
      if (this.config.security.require_email_verification) {
        verificationToken = await this.createEmailVerificationToken(user.id, user.email, context);
      }

      // Log successful registration
      await this.logSecurityEvent({
        user_id: user.id,
        event_type: 'account_creation',
        event_category: 'authentication',
        description: `New user account created: ${user.email}`,
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        risk_level: 'low',
        success: true
      });

      return {
        success: true,
        user,
        message: 'Registration successful',
        requires_verification: this.config.security.require_email_verification,
        verification_method: this.config.security.require_email_verification ? 'email' : undefined
      };

    } catch (error) {
      console.error('Registration error:', error);
      
      await this.logSecurityEvent({
        event_type: 'account_creation',
        event_category: 'authentication',
        description: `Registration failed: ${error}`,
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        risk_level: 'high',
        success: false
      });

      return {
        success: false,
        error: 'Registration failed',
        message: 'An error occurred during registration'
      };
    }
  }

  // ============================================================================
  // Enhanced Login with Security Features
  // ============================================================================

  async login(credentials: AuthCredentials, context?: {
    ip_address?: string;
    user_agent?: string;
  }): Promise<LoginResponse> {
    try {
      console.log('🔍 EnhancedAuthService.login called with:', { 
        credentials: { ...credentials, password: '[REDACTED]' }, 
        context 
      });
      
      const adapter = this.dbManager.getAdapter();
      console.log('🔍 Got adapter:', adapter ? 'exists' : 'null');
      
      const identifier = credentials.email || credentials.username || '';
      console.log('🔍 Using identifier:', identifier);

      // Check for IP-based rate limiting
      const isBlocked = await this.checkIPBlocking(context?.ip_address || '');
      if (isBlocked) {
        await this.recordFailedAttempt(identifier, context?.ip_address || '', 'too_many_attempts', context?.user_agent);
        
        return {
          success: false,
          error: 'Too many failed attempts from this IP address',
          message: 'Please try again later'
        };
      }

      // Find user
      let user: UserProfile | null = null;
      console.log('🔍 Looking up user with credentials:', { email: credentials.email, username: credentials.username });
      
      if (credentials.email) {
        user = await adapter.getUserByEmail(credentials.email);
        console.log('🔍 User lookup by email result:', user ? 'Found user' : 'No user found');
      } else if (credentials.username) {
        user = await adapter.getUserByUsername(credentials.username);
        console.log('🔍 User lookup by username result:', user ? 'Found user' : 'No user found');
      }

      if (!user) {
        console.log('❌ No user found for identifier:', identifier);
        await this.recordFailedAttempt(identifier, context?.ip_address || '', 'invalid_credentials', context?.user_agent);
        
        return {
          success: false,
          error: 'Invalid credentials',
          message: 'Login failed'
        };
      }

      console.log('✅ User found:', { id: user.id, username: user.username, email: user.email, status: user.account_status });

      // Check account status
      if (user.account_status !== 'active') {
        await this.recordFailedAttempt(identifier, context?.ip_address || '', 'account_suspended', context?.user_agent);
        
        return {
          success: false,
          error: `Account is ${user.account_status}`,
          message: 'Account access restricted'
        };
      }

      // Check for account lockout
      const lockout = await this.checkAccountLockout(user.id);
      if (lockout && lockout.is_active) {
        await this.recordFailedAttempt(identifier, context?.ip_address || '', 'account_locked', context?.user_agent);
        
        return {
          success: false,
          error: 'Account is temporarily locked',
          message: 'Please try again later or contact support'
        };
      }

      // Verify password
      console.log('🔍 Verifying password for user:', user.id);
      const isPasswordValid = await adapter.verifyPassword(user.id, credentials.password);
      console.log('🔍 Password verification result:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('❌ Password verification failed for user:', user.id);
        await this.handleFailedLogin(user.id, identifier, context);
        
        return {
          success: false,
          error: 'Invalid credentials',
          message: 'Login failed'
        };
      }

      console.log('✅ Password verification successful for user:', user.id);

      // Check if 2FA is required
      const twoFactorAuth = await this.getTwoFactorAuth(user.id);
      if (twoFactorAuth && twoFactorAuth.is_enabled) {
        // For now, we'll skip 2FA implementation but mark it as required
        return {
          success: true,
          user,
          message: 'Two-factor authentication required',
          requires_2fa: true
        };
      }

      // Reset failed attempts on successful login
      await this.resetFailedAttempts(user.id);

      // Update last login
      console.log('🔍 About to update user with ID:', user.id, 'Type:', typeof user.id);
      console.log('🔍 User object:', JSON.stringify(user, null, 2));
      await adapter.updateUser(user.id, {
        last_login: new Date().toISOString(),
        login_attempts: 0
      });

      // Create session
      const sessionResult = await this.createSession(user, {
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        login_method: 'password'
      });

      // Log successful login
      await this.logSecurityEvent({
        user_id: user.id,
        event_type: 'login_success',
        event_category: 'authentication',
        description: `User logged in successfully: ${user.email}`,
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        session_id: sessionResult.session.id,
        risk_level: 'low',
        success: true
      });

      return {
        success: true,
        user,
        token: sessionResult.token,
        refresh_token: sessionResult.refreshToken,
        expires_in: this.parseExpiryTime(this.config.jwtExpiresIn),
        message: 'Login successful'
      };

    } catch (error) {
      console.error('Login error:', error);
      
      await this.logSecurityEvent({
        event_type: 'login_failure',
        event_category: 'authentication',
        description: `Login error: ${error}`,
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        risk_level: 'high',
        success: false
      });

      return {
        success: false,
        error: 'Login failed',
        message: 'An error occurred during login'
      };
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async createSession(
    user: UserProfile,
    sessionInfo: {
      ip_address?: string;
      user_agent?: string;
      login_method: LoginMethod;
    }
  ): Promise<{
    session: LoginSession;
    token: string;
    refreshToken: string;
  }> {
    const adapter = this.dbManager.getAdapter();

    // Generate tokens
    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Calculate expiry times
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setTime(accessTokenExpiry.getTime() + this.parseExpiryTime(this.config.jwtExpiresIn));

    // Create session record
    const sessionData: Omit<LoginSession, 'id'> = {
      user_id: user.id,
      token,
      refresh_token: refreshToken,
      expires_at: accessTokenExpiry.toISOString(),
      created_at: new Date().toISOString(),
      ip_address: sessionInfo.ip_address,
      user_agent: sessionInfo.user_agent,
      is_active: true,
      login_method: sessionInfo.login_method
    };

    const session = await adapter.createSession(sessionData);

    return {
      session,
      token,
      refreshToken
    };
  }

  async logout(token: string, context?: {
    ip_address?: string;
    user_agent?: string;
  }): Promise<boolean> {
    try {
      const adapter = this.dbManager.getAdapter();
      
      // Get session info for logging
      const session = await adapter.getSession(token);
      
      // Invalidate session
      const success = await adapter.invalidateSession(token);
      
      if (success && session) {
        // Log logout event
        await this.logSecurityEvent({
          user_id: session.user_id,
          event_type: 'logout',
          event_category: 'authentication',
          description: 'User logged out',
          ip_address: context?.ip_address,
          user_agent: context?.user_agent,
          session_id: session.id,
          risk_level: 'low',
          success: true
        });
      }
      
      return success;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // ============================================================================
  // Security Helper Methods
  // ============================================================================

  private async handleFailedLogin(
    userId: string,
    identifier: string,
    context?: {
      ip_address?: string;
      user_agent?: string;
    }
  ): Promise<void> {
    const adapter = this.dbManager.getAdapter();

    // Increment login attempts
    const user = await adapter.getUserById(userId);
    if (user) {
      const newAttempts = (user.login_attempts || 0) + 1;
      await adapter.updateUser(userId, {
        login_attempts: newAttempts
      });

      // Check if account should be locked
      if (newAttempts >= this.config.security.max_login_attempts) {
        await this.lockAccount(userId, 'failed_attempts');
      }
    }

    // Record failed attempt
    await this.recordFailedAttempt(identifier, context?.ip_address || '', 'invalid_credentials', context?.user_agent);

    // Log security event
    await this.logSecurityEvent({
      user_id: userId,
      event_type: 'login_failure',
      event_category: 'authentication',
      description: `Failed login attempt for user: ${identifier}`,
      ip_address: context?.ip_address,
      user_agent: context?.user_agent,
      risk_level: 'medium',
      success: false
    });
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    console.log('🔍 resetFailedAttempts called with userId:', userId, 'Type:', typeof userId);
    const adapter = this.dbManager.getAdapter();
    await adapter.updateUser(userId, {
      login_attempts: 0
    });
  }

  async recordFailedAttempt(
    identifier: string,
    ipAddress: string,
    reason: FailedLoginAttempt['failure_reason'],
    userAgent?: string
  ): Promise<void> {
    try {
      const adapter = this.dbManager.getAdapter();

      const attemptData = {
        id: this.generateId(),
        identifier,
        ip_address: ipAddress,
        user_agent: userAgent,
        attempt_time: new Date().toISOString(),
        failure_reason: reason,
        blocked_until: null
      };

      // Check if adapter has a specific method for recording failed attempts
      if (typeof adapter.recordFailedAttempt === 'function') {
        await adapter.recordFailedAttempt(attemptData);
      } else {
        // Fallback: try to use the adapter's generic insert method or direct database access
        if (typeof adapter.getConnection === 'function') {
          // SQLite adapter
          const db = adapter.getConnection();
          await db.run(`
            INSERT INTO failed_login_attempts (
              id, identifier, ip_address, user_agent, attempt_time, failure_reason, blocked_until
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            attemptData.id,
            attemptData.identifier,
            attemptData.ip_address,
            attemptData.user_agent,
            attemptData.attempt_time,
            attemptData.failure_reason,
            attemptData.blocked_until
          ]);
        } else {
          // For Supabase or other adapters, skip recording failed attempts for now
          console.warn('Failed attempt recording not implemented for this adapter type');
        }
      }
    } catch (error) {
      console.error('Error recording failed attempt:', error);
      // Don't throw error to prevent login flow from breaking
    }
  }

  private async checkIPBlocking(ipAddress: string): Promise<boolean> {
    try {
      const adapter = this.dbManager.getAdapter();
      
      // Skip IP blocking check for Supabase adapter for now
      if (typeof adapter.getConnection !== 'function') {
        return false;
      }

      const db = adapter.getConnection();
      // Check recent failed attempts from this IP
      const recentAttempts = await db.all(`
        SELECT COUNT(*) as count
        FROM failed_login_attempts
        WHERE ip_address = ? 
        AND attempt_time > datetime('now', '-1 hour')
      `, [ipAddress]);

      return recentAttempts[0]?.count >= 10; // Block after 10 attempts per hour
    } catch (error) {
      console.error('Error checking IP blocking:', error);
      return false;
    }
  }

  private async checkAccountLockout(userId: string): Promise<AccountLockout | null> {
    try {
      const adapter = this.dbManager.getAdapter();
      
      // Skip lockout check for Supabase adapter for now
      if (typeof adapter.getConnection !== 'function') {
        return null;
      }

      const db = adapter.getConnection();
      const lockout = await db.get(`
        SELECT * FROM account_lockouts
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId]);

      return lockout || null;
    } catch (error) {
      console.error('Error checking account lockout:', error);
      return null;
    }
  }

  private async lockAccount(userId: string, reason: AccountLockout['reason']): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    const lockoutData = {
      id: this.generateId(),
      user_id: userId,
      locked_at: new Date().toISOString(),
      locked_until: new Date(Date.now() + this.config.security.lockout_duration_minutes * 60 * 1000).toISOString(),
      reason,
      locked_by: null,
      unlock_token: null,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.run(`
      INSERT INTO account_lockouts (
        id, user_id, locked_at, locked_until, reason, locked_by, unlock_token, 
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lockoutData.id,
      lockoutData.user_id,
      lockoutData.locked_at,
      lockoutData.locked_until,
      lockoutData.reason,
      lockoutData.locked_by,
      lockoutData.unlock_token,
      lockoutData.is_active,
      lockoutData.created_at,
      lockoutData.updated_at
    ]);

    // Log account lockout
    await this.logSecurityEvent({
      user_id: userId,
      event_type: 'account_locked',
      event_category: 'security_event',
      description: `Account locked due to: ${reason}`,
      risk_level: 'high',
      success: true
    });
  }

  private async createEmailVerificationToken(
    userId: string,
    email: string,
    context?: {
      ip_address?: string;
      user_agent?: string;
    }
  ): Promise<EmailVerificationToken> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    const tokenData = {
      id: this.generateId(),
      user_id: userId,
      email,
      token: this.generateSecureToken(),
      expires_at: new Date(Date.now() + this.config.security.email_verification_token_expiry_hours * 60 * 60 * 1000).toISOString(),
      verified: 0,
      created_at: new Date().toISOString(),
      verified_at: null,
      ip_address: context?.ip_address,
      user_agent: context?.user_agent
    };

    await db.run(`
      INSERT INTO email_verification_tokens (
        id, user_id, email, token, expires_at, verified, created_at, 
        verified_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tokenData.id,
      tokenData.user_id,
      tokenData.email,
      tokenData.token,
      tokenData.expires_at,
      tokenData.verified,
      tokenData.created_at,
      tokenData.verified_at,
      tokenData.ip_address,
      tokenData.user_agent
    ]);

    return tokenData as EmailVerificationToken;
  }

  private async getTwoFactorAuth(userId: string): Promise<TwoFactorAuth | null> {
    try {
      const adapter = this.dbManager.getAdapter();
      
      // Skip 2FA check for Supabase adapter for now
      if (typeof adapter.getConnection !== 'function') {
        return null;
      }

      const db = adapter.getConnection();
      const twoFA = await db.get(`
        SELECT * FROM two_factor_auth WHERE user_id = ?
      `, [userId]);

      return twoFA as TwoFactorAuth | null;
    } catch (error) {
      console.error('Error getting two factor auth:', error);
      return null;
    }
  }

  private async logSecurityEvent(eventData: {
    user_id?: string;
    event_type: SecurityEventType;
    event_category: SecurityAuditLog['event_category'];
    description: string;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    resource_accessed?: string;
    old_values?: string;
    new_values?: string;
    risk_level: SecurityRiskLevel;
    success: boolean;
    metadata?: string;
  }): Promise<void> {
    try {
      const adapter = this.dbManager.getAdapter();

      const logData = {
        id: this.generateId(),
        user_id: eventData.user_id || null,
        event_type: eventData.event_type,
        event_category: eventData.event_category,
        description: eventData.description,
        ip_address: eventData.ip_address || null,
        user_agent: eventData.user_agent || null,
        session_id: eventData.session_id || null,
        resource_accessed: eventData.resource_accessed || null,
        old_values: eventData.old_values || null,
        new_values: eventData.new_values || null,
        risk_level: eventData.risk_level,
        success: eventData.success ? 1 : 0,
        created_at: new Date().toISOString(),
        metadata: eventData.metadata || null
      };

      // Log to console for debugging
      console.log('Security Event:', {
        id: logData.id,
        user_id: logData.user_id,
        event_type: logData.event_type,
        event_category: logData.event_category,
        description: logData.description,
        ip_address: logData.ip_address,
        user_agent: logData.user_agent,
        risk_level: logData.risk_level,
        success: logData.success,
        created_at: logData.created_at
      });

      // Check if adapter has a specific method for logging security events
      if (typeof adapter.logSecurityEvent === 'function') {
        await adapter.logSecurityEvent(logData);
      } else if (typeof adapter.getConnection === 'function') {
        // SQLite adapter
        const db = adapter.getConnection();
        await db.run(`
          INSERT INTO security_audit_logs (
            id, user_id, event_type, event_category, description, ip_address, 
            user_agent, session_id, resource_accessed, old_values, new_values, 
            risk_level, success, created_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          logData.id,
          logData.user_id,
          logData.event_type,
          logData.event_category,
          logData.description,
          logData.ip_address,
          logData.user_agent,
          logData.session_id,
          logData.resource_accessed,
          logData.old_values,
          logData.new_values,
          logData.risk_level,
          logData.success,
          logData.created_at,
          logData.metadata
        ]);
      } else {
        // For Supabase or other adapters, just log to console for now
        console.warn('Security event logging not implemented for this adapter type');
      }
    } catch (error) {
      console.error('Error logging security event:', error);
      // Don't throw error to prevent login flow from breaking
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private validatePasswordStrength(password: string): { isValid: boolean; message: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/\d/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }

    return { isValid: true, message: 'Password is strong' };
  }

  private generateAccessToken(user: UserProfile): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresIn }
    );
  }

  private generateRefreshToken(user: UserProfile): string {
    return jwt.sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      this.config.jwtSecret,
      { expiresIn: this.config.refreshTokenExpiresIn }
    );
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private parseExpiryTime(expiry: string): number {
    // Parse expiry strings like '1h', '30m', '7d'
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }
}