/**
 * Authentication Configuration
 * 
 * Centralized configuration for all authentication services.
 * This configuration is designed to be easily adaptable for Supabase migration.
 */

import { AuthIntegrationConfig } from '@/lib/services/auth-integration';

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const authConfig: AuthIntegrationConfig = {
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    jwtExpiresIn: '24h',
    refreshTokenExpiresIn: '7d',
    passwordSaltRounds: 12
  },
  security: {
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90, // days
      preventReuse: 5 // number of previous passwords to check
    },
    session: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      secure: isProduction, // HTTPS only in production
      httpOnly: true,
      sameSite: 'strict',
      rolling: true // Extend session on activity
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      skipSuccessfulRequests: false
    },
    cors: {
      origin: isDevelopment 
        ? ['http://localhost:3000', 'http://localhost:5173'] 
        : process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourapp.com'],
      credentials: true
    },
    requireEmailVerification: false, // Set to true if email verification is required
    lockout: {
      maxFailedAttempts: 5,
      lockoutDuration: 30 * 60 * 1000 // 30 minutes
    }
  },
  rbac: {
    enableRoleHierarchy: true,
    defaultRole: 'student' // Default role for new users
  },
  features: {
    enableEmailVerification: true,
    enablePasswordHistory: true,
    enableAccountLockout: true,
    enableAuditLogging: true
  }
};

// Database configuration for different environments
export const databaseConfig = {
  development: {
    type: 'sqlite' as const,
    database: 'test_enhanced.db',
    synchronize: true,
    logging: isDevelopment
  },
  production: {
    type: 'sqlite' as const,
    database: process.env.DATABASE_PATH || 'production.db',
    synchronize: false,
    logging: false
  },
  // Future Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    schema: 'public'
  }
};

// JWT configuration
export const jwtConfig = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-access-token-secret',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-token-secret',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'futurelearner',
  audience: 'futurelearner-users'
};

// Email configuration (for verification emails)
export const emailConfig = {
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  from: {
    name: 'FutureLearner',
    email: process.env.FROM_EMAIL || 'noreply@futurelearner.com'
  },
  templates: {
    verification: {
      subject: 'Verify your email address',
      template: 'email-verification'
    },
    passwordReset: {
      subject: 'Reset your password',
      template: 'password-reset'
    },
    welcomeEmail: {
      subject: 'Welcome to FutureLearner!',
      template: 'welcome'
    }
  }
};

// Security headers configuration
export const securityHeaders = {
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
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

// Default permissions for different roles
export const defaultPermissions = {
  admin: [
    'users:read',
    'users:write',
    'users:delete',
    'courses:read',
    'courses:write',
    'courses:delete',
    'quizzes:read',
    'quizzes:write',
    'quizzes:delete',
    'analytics:read',
    'system:admin'
  ],
  teacher: [
    'users:read',
    'courses:read',
    'courses:write',
    'quizzes:read',
    'quizzes:write',
    'analytics:read',
    'students:manage'
  ],
  parent: [
    'children:read',
    'children:progress',
    'courses:read',
    'quizzes:read'
  ],
  student: [
    'courses:read',
    'quizzes:take',
    'profile:read',
    'profile:write'
  ]
};

// Account lockout configuration
export const lockoutConfig = {
  maxFailedAttempts: 5,
  lockoutDuration: 30 * 60 * 1000, // 30 minutes
  resetOnSuccess: true,
  progressiveLockout: true, // Increase lockout time with repeated failures
  ipBasedLockout: true
};

// Two-factor authentication configuration
export const twoFactorConfig = {
  enabled: false, // Can be enabled per user
  issuer: 'FutureLearner',
  window: 1, // Allow 1 step before/after current time
  qrCodeOptions: {
    width: 200,
    height: 200,
    margin: 2
  }
};

// Audit logging configuration
export const auditConfig = {
  enabled: true,
  retentionDays: 90,
  logLevels: ['info', 'warn', 'error'],
  sensitiveFields: ['password', 'token', 'secret'],
  events: {
    authentication: ['login', 'logout', 'register', 'password_change'],
    authorization: ['access_granted', 'access_denied', 'role_change'],
    security: ['account_locked', 'suspicious_activity', 'failed_login'],
    data: ['user_created', 'user_updated', 'user_deleted']
  }
};

// Migration configuration for Supabase
export const migrationConfig = {
  supabase: {
    // Table mappings for migration
    tableMappings: {
      users_enhanced: 'users',
      user_sessions: 'user_sessions',
      password_reset_tokens: 'password_reset_tokens',
      failed_login_attempts: 'failed_login_attempts',
      account_lockouts: 'account_lockouts',
      security_audit_logs: 'security_audit_logs',
      email_verification_tokens: 'email_verification_tokens',
      two_factor_auth: 'two_factor_auth',
      permissions: 'permissions',
      role_permissions: 'role_permissions',
      user_permissions: 'user_permissions'
    },
    // RLS policies to create
    rlsPolicies: {
      users: [
        {
          name: 'Users can view own profile',
          operation: 'SELECT',
          using: 'auth.uid() = id::uuid'
        },
        {
          name: 'Users can update own profile',
          operation: 'UPDATE',
          using: 'auth.uid() = id::uuid'
        }
      ],
      user_sessions: [
        {
          name: 'Users can view own sessions',
          operation: 'SELECT',
          using: 'auth.uid() = user_id::uuid'
        }
      ]
    },
    // Functions to create
    functions: [
      'handle_new_user',
      'handle_user_login',
      'cleanup_expired_sessions',
      'audit_user_changes'
    ]
  }
};

// Environment validation
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required environment variables
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  // Optional but recommended for production
  const recommended = [
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'FROM_EMAIL'
  ];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  if (isProduction) {
    for (const envVar of recommended) {
      if (!process.env[envVar]) {
        console.warn(`Missing recommended environment variable for production: ${envVar}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Get configuration for current environment
export function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  return {
    auth: authConfig,
    database: databaseConfig[env as keyof typeof databaseConfig] || databaseConfig.development,
    jwt: jwtConfig,
    email: emailConfig,
    security: securityHeaders,
    permissions: defaultPermissions,
    lockout: lockoutConfig,
    twoFactor: twoFactorConfig,
    audit: auditConfig,
    migration: migrationConfig
  };
}