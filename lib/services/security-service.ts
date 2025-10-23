/**
 * Security Service
 * 
 * Provides comprehensive security features including password policies,
 * session management, rate limiting, and security headers.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { UserProfile } from '@/types/auth';

// ============================================================================
// Security Configuration
// ============================================================================

export interface SecurityConfig {
  password: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventCommonPasswords: boolean;
    preventUserInfoInPassword: boolean;
    historyCount: number; // Number of previous passwords to remember
  };
  session: {
    maxConcurrentSessions: number;
    sessionTimeout: number; // in minutes
    extendOnActivity: boolean;
    secureOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  rateLimit: {
    loginAttempts: {
      maxAttempts: number;
      windowMs: number;
      blockDurationMs: number;
    };
    apiRequests: {
      maxRequests: number;
      windowMs: number;
    };
  };
  security: {
    enableCSRF: boolean;
    enableXSSProtection: boolean;
    enableContentTypeNoSniff: boolean;
    enableFrameOptions: boolean;
    enableHSTS: boolean;
    hstsMaxAge: number;
  };
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventUserInfoInPassword: true,
    historyCount: 5
  },
  session: {
    maxConcurrentSessions: 3,
    sessionTimeout: 60, // 1 hour
    extendOnActivity: true,
    secureOnly: true,
    sameSite: 'strict'
  },
  rateLimit: {
    loginAttempts: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000 // 30 minutes
    },
    apiRequests: {
      maxRequests: 100,
      windowMs: 15 * 60 * 1000 // 15 minutes
    }
  },
  security: {
    enableCSRF: true,
    enableXSSProtection: true,
    enableContentTypeNoSniff: true,
    enableFrameOptions: true,
    enableHSTS: true,
    hstsMaxAge: 31536000 // 1 year
  }
};

// ============================================================================
// Password Validation
// ============================================================================

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-100
  feedback: string[];
  warnings: string[];
}

export class PasswordValidator {
  private config: SecurityConfig['password'];
  private commonPasswords: Set<string>;

  constructor(config: SecurityConfig['password']) {
    this.config = config;
    this.commonPasswords = new Set(this.getCommonPasswords());
  }

  validate(password: string, userInfo?: Partial<UserProfile>): PasswordValidationResult {
    const feedback: string[] = [];
    const warnings: string[] = [];
    let score = 0;

    // Length validation
    if (password.length < this.config.minLength) {
      feedback.push(`Password must be at least ${this.config.minLength} characters long`);
    } else if (password.length >= this.config.minLength) {
      score += 20;
    }

    if (password.length > this.config.maxLength) {
      feedback.push(`Password must not exceed ${this.config.maxLength} characters`);
    }

    // Character requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    if (this.config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 15;
    }

    // Common password check
    if (this.config.preventCommonPasswords && this.isCommonPassword(password)) {
      feedback.push('This password is too common. Please choose a more unique password');
    } else {
      score += 10;
    }

    // User info in password check
    if (this.config.preventUserInfoInPassword && userInfo) {
      const userInfoViolations = this.checkUserInfoInPassword(password, userInfo);
      if (userInfoViolations.length > 0) {
        feedback.push('Password should not contain personal information');
        warnings.push(...userInfoViolations);
      } else {
        score += 10;
      }
    }

    // Additional complexity checks
    const complexityScore = this.calculateComplexityScore(password);
    score = Math.min(100, score + complexityScore);

    // Provide additional feedback based on score
    if (score < 40) {
      warnings.push('Password is very weak');
    } else if (score < 60) {
      warnings.push('Password is weak');
    } else if (score < 80) {
      warnings.push('Password is moderate');
    } else {
      warnings.push('Password is strong');
    }

    return {
      isValid: feedback.length === 0,
      score,
      feedback,
      warnings
    };
  }

  private isCommonPassword(password: string): boolean {
    return this.commonPasswords.has(password.toLowerCase());
  }

  private checkUserInfoInPassword(password: string, userInfo: Partial<UserProfile>): string[] {
    const violations: string[] = [];
    const lowerPassword = password.toLowerCase();

    if (userInfo.username && lowerPassword.includes(userInfo.username.toLowerCase())) {
      violations.push('Contains username');
    }

    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split('@')[0];
      if (lowerPassword.includes(emailParts)) {
        violations.push('Contains email address');
      }
    }

    if (userInfo.first_name && lowerPassword.includes(userInfo.first_name.toLowerCase())) {
      violations.push('Contains first name');
    }

    if (userInfo.last_name && lowerPassword.includes(userInfo.last_name.toLowerCase())) {
      violations.push('Contains last name');
    }

    return violations;
  }

  private calculateComplexityScore(password: string): number {
    let score = 0;

    // Length bonus
    if (password.length >= 12) score += 5;
    if (password.length >= 16) score += 5;

    // Character variety
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const hasExtendedSpecial = /[~`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const varietyCount = [hasLower, hasUpper, hasNumbers, hasSpecial].filter(Boolean).length;
    score += varietyCount * 2;

    if (hasExtendedSpecial) score += 3;

    // Pattern detection (reduce score for patterns)
    if (this.hasRepeatingChars(password)) score -= 5;
    if (this.hasSequentialChars(password)) score -= 5;
    if (this.hasKeyboardPatterns(password)) score -= 5;

    return Math.max(0, score);
  }

  private hasRepeatingChars(password: string): boolean {
    return /(.)\1{2,}/.test(password);
  }

  private hasSequentialChars(password: string): boolean {
    const sequences = ['abc', '123', 'qwe', 'asd', 'zxc'];
    const lowerPassword = password.toLowerCase();
    
    return sequences.some(seq => {
      for (let i = 0; i <= lowerPassword.length - 3; i++) {
        const substr = lowerPassword.substr(i, 3);
        if (substr === seq || substr === seq.split('').reverse().join('')) {
          return true;
        }
      }
      return false;
    });
  }

  private hasKeyboardPatterns(password: string): boolean {
    const patterns = ['qwerty', 'asdf', 'zxcv', '1234', 'abcd'];
    const lowerPassword = password.toLowerCase();
    
    return patterns.some(pattern => lowerPassword.includes(pattern));
  }

  private getCommonPasswords(): string[] {
    // Top 100 most common passwords (simplified list)
    return [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password1', '12345678', '111111', '1234567', 'sunshine',
      'qwerty123', 'iloveyou', 'princess', 'admin', 'welcome',
      '666666', 'abc123', 'football', '123123', 'monkey',
      '654321', '!@#$%^&*', 'charlie', 'aa123456', 'donald',
      'password123', 'qwerty1', 'dragon', '123qwe', 'solo',
      'passw0rd', 'starwars', 'hello', 'freedom', 'whatever',
      'qazwsx', 'trustno1', 'jordan23', 'harley', 'robert',
      'matthew', 'jordan', 'asshole', 'daniel'
    ];
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

export class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private config: SecurityConfig['rateLimit'];

  constructor(config: SecurityConfig['rateLimit']) {
    this.config = config;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  checkLoginAttempt(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    blockUntil?: number;
  } {
    const now = Date.now();
    const key = `login:${identifier}`;
    const entry = this.attempts.get(key);

    if (!entry) {
      // First attempt
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.config.loginAttempts.windowMs,
        blocked: false
      });

      return {
        allowed: true,
        remaining: this.config.loginAttempts.maxAttempts - 1,
        resetTime: now + this.config.loginAttempts.windowMs
      };
    }

    // Check if currently blocked
    if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blockUntil: entry.blockUntil
      };
    }

    // Check if window has expired
    if (now > entry.resetTime) {
      // Reset window
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.config.loginAttempts.windowMs,
        blocked: false
      });

      return {
        allowed: true,
        remaining: this.config.loginAttempts.maxAttempts - 1,
        resetTime: now + this.config.loginAttempts.windowMs
      };
    }

    // Increment attempt count
    entry.count++;

    if (entry.count > this.config.loginAttempts.maxAttempts) {
      // Block the identifier
      entry.blocked = true;
      entry.blockUntil = now + this.config.loginAttempts.blockDurationMs;

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blockUntil: entry.blockUntil
      };
    }

    return {
      allowed: true,
      remaining: this.config.loginAttempts.maxAttempts - entry.count,
      resetTime: entry.resetTime
    };
  }

  checkApiRequest(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const key = `api:${identifier}`;
    const entry = this.attempts.get(key);

    if (!entry) {
      // First request
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.config.apiRequests.windowMs,
        blocked: false
      });

      return {
        allowed: true,
        remaining: this.config.apiRequests.maxRequests - 1,
        resetTime: now + this.config.apiRequests.windowMs
      };
    }

    // Check if window has expired
    if (now > entry.resetTime) {
      // Reset window
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.config.apiRequests.windowMs,
        blocked: false
      });

      return {
        allowed: true,
        remaining: this.config.apiRequests.maxRequests - 1,
        resetTime: now + this.config.apiRequests.windowMs
      };
    }

    // Increment request count
    entry.count++;

    const allowed = entry.count <= this.config.apiRequests.maxRequests;

    return {
      allowed,
      remaining: Math.max(0, this.config.apiRequests.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  resetAttempts(identifier: string, type: 'login' | 'api' = 'login'): void {
    const key = `${type}:${identifier}`;
    this.attempts.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    
    const keysToDelete: string[] = [];
    this.attempts.forEach((entry, key) => {
      if (now > entry.resetTime && (!entry.blockUntil || now > entry.blockUntil)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.attempts.delete(key));
  }
}

// ============================================================================
// CSRF Protection
// ============================================================================

export class CSRFProtection {
  private tokens: Map<string, { token: string; expires: number }> = new Map();
  private readonly tokenExpiry = 60 * 60 * 1000; // 1 hour

  generateToken(sessionId: string): string {
    const token = randomBytes(32).toString('hex');
    const expires = Date.now() + this.tokenExpiry;
    
    this.tokens.set(sessionId, { token, expires });
    
    // Clean up expired tokens
    this.cleanup();
    
    return token;
  }

  validateToken(sessionId: string, token: string): boolean {
    const entry = this.tokens.get(sessionId);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.tokens.delete(sessionId);
      return false;
    }

    // Use timing-safe comparison
    const expectedBuffer = Buffer.from(entry.token, 'hex');
    const actualBuffer = Buffer.from(token, 'hex');
    
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  removeToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }

  private cleanup(): void {
    const now = Date.now();
    
    const keysToDelete: string[] = [];
    this.tokens.forEach((entry, sessionId) => {
      if (now > entry.expires) {
        keysToDelete.push(sessionId);
      }
    });
    
    keysToDelete.forEach(sessionId => this.tokens.delete(sessionId));
  }
}

// ============================================================================
// Security Headers
// ============================================================================

export class SecurityHeaders {
  private config: SecurityConfig['security'];

  constructor(config: SecurityConfig['security']) {
    this.config = config;
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.enableXSSProtection) {
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    if (this.config.enableContentTypeNoSniff) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    if (this.config.enableFrameOptions) {
      headers['X-Frame-Options'] = 'DENY';
    }

    if (this.config.enableHSTS) {
      headers['Strict-Transport-Security'] = `max-age=${this.config.hstsMaxAge}; includeSubDomains; preload`;
    }

    // Content Security Policy
    headers['Content-Security-Policy'] = this.generateCSP();

    // Referrer Policy
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // Permissions Policy
    headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';

    return headers;
  }

  private generateCSP(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-inline and unsafe-eval should be avoided in production
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "child-src 'none'",
      "worker-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "manifest-src 'self'"
    ];

    return directives.join('; ');
  }
}

// ============================================================================
// Main Security Service
// ============================================================================

export class SecurityService {
  private config: SecurityConfig;
  private passwordValidator: PasswordValidator;
  private rateLimiter: RateLimiter;
  private csrfProtection: CSRFProtection;
  private securityHeaders: SecurityHeaders;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
    this.passwordValidator = new PasswordValidator(config.password);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.csrfProtection = new CSRFProtection();
    this.securityHeaders = new SecurityHeaders(config.security);
  }

  // Password validation
  validatePassword(password: string, userInfo?: Partial<UserProfile>): PasswordValidationResult {
    return this.passwordValidator.validate(password, userInfo);
  }

  // Rate limiting
  checkLoginAttempt(identifier: string) {
    return this.rateLimiter.checkLoginAttempt(identifier);
  }

  checkApiRequest(identifier: string) {
    return this.rateLimiter.checkApiRequest(identifier);
  }

  resetRateLimit(identifier: string, type: 'login' | 'api' = 'login') {
    this.rateLimiter.resetAttempts(identifier, type);
  }

  // CSRF protection
  generateCSRFToken(sessionId: string): string {
    return this.csrfProtection.generateToken(sessionId);
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    return this.csrfProtection.validateToken(sessionId, token);
  }

  removeCSRFToken(sessionId: string): void {
    this.csrfProtection.removeToken(sessionId);
  }

  // Security headers
  getSecurityHeaders(): Record<string, string> {
    return this.securityHeaders.getHeaders();
  }

  // Utility methods
  hashSensitiveData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  sanitizeInput(input: string): string {
    // Basic input sanitization
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim();
  }

  // Configuration
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize components with new config
    if (newConfig.password) {
      this.passwordValidator = new PasswordValidator(this.config.password);
    }
    
    if (newConfig.rateLimit) {
      this.rateLimiter = new RateLimiter(this.config.rateLimit);
    }
    
    if (newConfig.security) {
      this.securityHeaders = new SecurityHeaders(this.config.security);
    }
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const securityService = new SecurityService();