/**
 * Security Middleware Service
 * 
 * Provides comprehensive security features including:
 * - Password policies and validation
 * - Session management and security
 * - Security headers
 * - Rate limiting
 * - Input validation and sanitization
 * - CSRF protection
 * - XSS protection
 * 
 * Designed for easy integration with both Express.js and Next.js applications.
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { DatabaseManager } from '@/lib/database/database-manager';


export interface SecurityConfig {
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // days
    preventReuse: number; // number of previous passwords to check
  };
  session: {
    maxAge: number; // milliseconds
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
    origin: string | string[];
    credentials: boolean;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(_dbManager: DatabaseManager, config: SecurityConfig) {
    this.config = config;
  }

  // ============================================================================
  // Password Security
  // ============================================================================

  validatePassword(password: string, userInfo?: {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length check
    if (password.length < this.config.password.minLength) {
      errors.push(`Password must be at least ${this.config.password.minLength} characters long`);
    }

    // Character requirements
    if (this.config.password.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.password.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.password.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.password.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password patterns
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    // Personal information check
    if (userInfo) {
      if (this.containsPersonalInfo(password, userInfo)) {
        errors.push('Password should not contain personal information');
      }
    }

    // Sequential characters
    if (this.hasSequentialChars(password)) {
      warnings.push('Avoid using sequential characters in your password');
    }

    // Repeated characters
    if (this.hasRepeatedChars(password)) {
      warnings.push('Avoid using repeated characters in your password');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async checkPasswordHistory(_userId: string, _newPassword: string): Promise<boolean> {
    if (this.config.password.preventReuse === 0) {
      return true; // No history check required
    }

    // TODO: Implement with Supabase
    console.warn('checkPasswordHistory: Supabase implementation needed');
    
    // For now, allow all passwords (no history check)
    return true;
  }

  async savePasswordHistory(_userId: string, _passwordHash: string): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('savePasswordHistory: Supabase implementation needed');
    
    // Skip password history saving for now
    return;
  }

  // ============================================================================
  // Session Security
  // ============================================================================

  configureSession() {
    return {
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      rolling: this.config.session.rolling,
      cookie: {
        maxAge: this.config.session.maxAge,
        secure: this.config.session.secure,
        httpOnly: this.config.session.httpOnly,
        sameSite: this.config.session.sameSite
      }
    };
  }

  sessionValidation() {
    return async (req: any, res: Response, next: NextFunction) => {
      if (!req.session) {
        return next();
      }

      // Check session expiry
      if (req.session.expiresAt && new Date() > new Date(req.session.expiresAt)) {
        req.session.destroy((err: any) => {
          if (err) {
            console.error('Session destruction error:', err);
          }
        });
        return res.status(401).json({ error: 'Session expired' });
      }

      // Validate session token if present
      if (req.session.token) {
        // TODO: Implement with Supabase
        console.warn('sessionValidation: Supabase implementation needed');
        
        // Skip session validation for now
      }

      next();
    };
  }

  // ============================================================================
  // Security Headers
  // ============================================================================

  securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  corsConfiguration() {
    return {
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count']
    };
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  createRateLimit(options?: Partial<typeof this.config.rateLimit>) {
    const config = { ...this.config.rateLimit, ...options };
    
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      skipSuccessfulRequests: config.skipSuccessfulRequests,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.round(config.windowMs / 1000)
        });
      }
    });
  }

  // Specific rate limiters for different endpoints
  loginRateLimit() {
    return this.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      skipSuccessfulRequests: true
    });
  }

  registrationRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 registrations per hour
      skipSuccessfulRequests: false
    });
  }

  passwordResetRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 password reset requests per hour
      skipSuccessfulRequests: false
    });
  }

  // ============================================================================
  // Input Validation and Sanitization
  // ============================================================================

  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  validateUsername(username: string): ValidationResult {
    const errors: string[] = [];

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 30) {
      errors.push('Username must be no more than 30 characters long');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    if (/^[_-]/.test(username) || /[_-]$/.test(username)) {
      errors.push('Username cannot start or end with underscore or hyphen');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  // ============================================================================
  // CSRF Protection
  // ============================================================================

  csrfProtection() {
    return (_req: any, _res: Response, next: NextFunction) => {
      // TODO: Implement with Supabase session management
      console.warn('CSRF protection temporarily disabled - implement with Supabase');
      
      // Skip CSRF for now
      next();
    };
  }

  generateCSRFToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // ============================================================================
  // Security Monitoring
  // ============================================================================

  securityMonitoring() {
    return (req: Request, _res: Response, next: NextFunction) => {
      // Log suspicious activities
      const suspiciousPatterns = [
        /\.\./,  // Directory traversal
        /<script/i,  // XSS attempts
        /union.*select/i,  // SQL injection
        /javascript:/i,  // JavaScript injection
        /eval\(/i,  // Code injection
      ];

      const requestData = JSON.stringify({
        url: req.url,
        body: req.body,
        query: req.query,
        headers: req.headers
      });

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestData)) {
          this.logSecurityEvent({
            type: 'suspicious_request',
            description: `Suspicious pattern detected: ${pattern.source}`,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            request_data: requestData,
            risk_level: 'high'
          });
          break;
        }
      }

      next();
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'shadow', 'superman', 'michael',
      'football', 'baseball', 'liverpool', 'jordan', 'princess'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  private containsPersonalInfo(password: string, userInfo: {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): boolean {
    const lowerPassword = password.toLowerCase();
    
    const personalData = [
      userInfo.email?.split('@')[0]?.toLowerCase(),
      userInfo.username?.toLowerCase(),
      userInfo.firstName?.toLowerCase(),
      userInfo.lastName?.toLowerCase()
    ].filter(Boolean);

    return personalData.some(data => 
      data && data.length > 2 && lowerPassword.includes(data)
    );
  }

  private hasSequentialChars(password: string): boolean {
    const sequences = ['123', '234', '345', '456', '567', '678', '789', 'abc', 'bcd', 'cde'];
    return sequences.some(seq => password.toLowerCase().includes(seq));
  }

  private hasRepeatedChars(password: string): boolean {
    return /(.)\1{2,}/.test(password); // 3 or more repeated characters
  }

  private async logSecurityEvent(eventData: {
    type: string;
    description: string;
    ip_address?: string;
    user_agent?: string;
    request_data?: string;
    risk_level: 'low' | 'medium' | 'high';
  }): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('logSecurityEvent: Supabase implementation needed');
    
    // Log to console for now
    console.log(`Security Event [${eventData.risk_level}]: ${eventData.type} - ${eventData.description}`);
  }



  // ============================================================================
  // Database Schema for Security Features
  // ============================================================================

  async initializeSecurityTables(): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('initializeSecurityTables: Supabase implementation needed');
    console.log('Security tables initialization skipped - Supabase migration needed');
  }
}