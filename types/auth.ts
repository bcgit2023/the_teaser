/**
 * Authentication and User Management Types
 * 
 * This file contains all TypeScript types and interfaces for the authentication system.
 * Designed to be compatible with both SQLite and Supabase implementations.
 */

// ============================================================================
// Core User Types
// ============================================================================

export type UserRole = 'admin' | 'student' | 'parent' | 'teacher';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type LoginMethod = 'password' | 'face_recognition' | 'sso' | 'jwt';

// ============================================================================
// Session and Authentication Data
// ============================================================================

export interface SessionData {
  userId: string;
  username?: string;
  role: UserRole;
  email: string;
  sessionId?: string;
  iat?: number; // JWT issued at
  exp?: number; // JWT expires at
  iss?: string; // JWT issuer
  aud?: string; // JWT audience
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    user: SessionData;
    session?: any;
    permissions?: string[];
    isAuthenticated: boolean;
  };
}

// ============================================================================
// Database Entity Interfaces (Supabase-compatible)
// ============================================================================

export interface BaseUser {
  id: string; // UUID for Supabase compatibility
  email: string;
  username?: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  last_login?: string; // ISO timestamp
  login_attempts: number;
  password_reset_token?: string;
  password_reset_expires?: string;
  email_verified: boolean;
  phone?: string;
  avatar_url?: string;
}

export interface UserProfile extends BaseUser {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string;
  grade_level?: string; // For students
  subject_specialization?: string[]; // For teachers
  bio?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  accessibility: AccessibilitySettings;
  privacy: PrivacySettings;
}

export interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  quiz_reminders: boolean;
  progress_updates: boolean;
  system_announcements: boolean;
}

export interface AccessibilitySettings {
  high_contrast: boolean;
  large_text: boolean;
  screen_reader: boolean;
  keyboard_navigation: boolean;
}

export interface PrivacySettings {
  profile_visibility: 'public' | 'private' | 'friends_only';
  show_progress: boolean;
  allow_messages: boolean;
}

// ============================================================================
// Authentication-specific Types
// ============================================================================

export interface AuthCredentials {
  email?: string;
  username?: string;
  password: string;
  role?: UserRole;
  remember_me?: boolean;
}

export interface FaceRecognitionData {
  id: string;
  user_id: string;
  face_encoding: string; // Base64 encoded face data
  confidence_threshold: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface LoginSession {
  id: string;
  user_id: string;
  token: string;
  refresh_token?: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
  login_method: LoginMethod;
}

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  max_age_days: number;
  prevent_reuse_count: number;
}

// ============================================================================
// Relationship Types
// ============================================================================

export interface ParentChildRelationship {
  id: string;
  parent_id: string;
  child_id: string;
  relationship_type: 'parent' | 'guardian' | 'caregiver';
  is_primary: boolean;
  permissions: ParentPermissions;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ParentPermissions {
  view_progress: boolean;
  receive_notifications: boolean;
  manage_account: boolean;
  view_quiz_results: boolean;
  contact_teachers: boolean;
}

export interface TeacherStudentAssignment {
  id: string;
  teacher_id: string;
  student_id: string;
  subject: string;
  class_name?: string;
  academic_year: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Security-related Types
// ============================================================================

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
  used_at?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface FailedLoginAttempt {
  id: string;
  identifier: string; // email or username
  ip_address: string;
  user_agent?: string;
  attempt_time: string;
  failure_reason: 'invalid_credentials' | 'account_locked' | 'account_suspended' | 'too_many_attempts';
  blocked_until?: string;
}

export interface AccountLockout {
  id: string;
  user_id: string;
  locked_at: string;
  locked_until?: string;
  reason: 'failed_attempts' | 'admin_action' | 'security_breach' | 'suspicious_activity';
  locked_by?: string; // admin user id if manually locked
  unlock_token?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Security event types for audit logging
export type SecurityEventType = 
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'email_verification'
  | 'account_locked'
  | 'account_unlocked'
  | 'profile_update'
  | 'permission_change'
  | 'admin_action'
  | 'suspicious_activity'
  | 'data_export'
  | 'account_creation'
  | 'account_deletion'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'session_expired';

export interface SecurityAuditLog {
  id: string;
  user_id?: string;
  event_type: SecurityEventType;
  event_category: 'authentication' | 'authorization' | 'data_access' | 'admin_action' | 'security_event';
  description: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  resource_accessed?: string;
  old_values?: string; // JSON string
  new_values?: string; // JSON string
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  created_at: string;
  metadata?: string; // JSON string for additional context
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
  verified_at?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface TwoFactorAuth {
  id: string;
  user_id: string;
  secret: string;
  backup_codes: string[]; // Array of backup codes
  is_enabled: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}



export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SecuritySettings {
  max_login_attempts: number;
  lockout_duration_minutes: number;
  password_reset_token_expiry_hours: number;
  email_verification_token_expiry_hours: number;
  session_timeout_minutes: number;
  require_2fa_for_admin: boolean;
  require_email_verification: boolean;
  audit_log_retention_days: number;
  suspicious_activity_threshold: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  refresh_token?: string;
  expires_in?: number;
  message?: string;
  error?: string;
}

export interface LoginResponse extends AuthResponse {
  redirect_url?: string;
  requires_2fa?: boolean;
  requires_password_change?: boolean;
}

export interface RegisterResponse extends AuthResponse {
  requires_verification?: boolean;
  verification_method?: 'email' | 'phone';
}

// ============================================================================
// Database Abstraction Types
// ============================================================================

export interface DatabaseAdapter {
  // User operations
  createUser(userData: Partial<UserProfile>): Promise<UserProfile>;
  getUserById(id: string): Promise<UserProfile | null>;
  getUserByEmail(email: string): Promise<UserProfile | null>;
  getUserByUsername(username: string): Promise<UserProfile | null>;
  updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile>;
  deleteUser(id: string): Promise<boolean>;
  
  // Authentication operations
  verifyPassword(userId: string, password: string): Promise<boolean>;
  updatePassword(userId: string, newPassword: string): Promise<boolean>;
  createSession(sessionData: Omit<LoginSession, 'id'>): Promise<LoginSession>;
  getSession(token: string): Promise<LoginSession | null>;
  invalidateSession(token: string): Promise<boolean>;
  
  // Relationship operations
  createParentChildLink(linkData: Omit<ParentChildRelationship, 'id'>): Promise<ParentChildRelationship>;
  getParentChildren(parentId: string): Promise<UserProfile[]>;
  getChildParents(childId: string): Promise<UserProfile[]>;
  
  // Face recognition operations
  saveFaceData(faceData: Omit<FaceRecognitionData, 'id'>): Promise<FaceRecognitionData>;
  getFaceData(userId: string): Promise<FaceRecognitionData | null>;
  
  // Utility operations
  healthCheck(): Promise<boolean>;
  migrate(): Promise<boolean>;
}

// ============================================================================
// Service Layer Types
// ============================================================================

export interface AuthService {
  login(credentials: AuthCredentials): Promise<LoginResponse>;
  loginWithFace(userId: string, faceData: string): Promise<LoginResponse>;
  register(userData: Partial<UserProfile>, password: string): Promise<RegisterResponse>;
  logout(token: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
  verifyToken(token: string): Promise<UserProfile | null>;
  resetPassword(email: string): Promise<boolean>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean>;
}

export interface UserService {
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile>;
  uploadAvatar(userId: string, file: File): Promise<string>;
  deleteAccount(userId: string): Promise<boolean>;
  searchUsers(query: string, role?: UserRole): Promise<UserProfile[]>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AuthConfig {
  jwt_secret: string;
  jwt_expires_in: string;
  refresh_token_expires_in: string;
  password_policy: PasswordPolicy;
  session_timeout: number;
  max_login_attempts: number;
  lockout_duration: number;
  face_recognition_enabled: boolean;
  face_confidence_threshold: number;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'supabase';
  connection_string?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_service_key?: string;
  sqlite_path?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// ============================================================================
// Service Request/Response Types
// ============================================================================

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  remember_me?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterData {
  email: string;
  username?: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  phone?: string;
  grade_level?: string;
  subject_specialization?: string[];
  preferences?: Partial<UserPreferences>;
}

export interface UserRegistration {
  email: string;
  username?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  phone?: string;
  gradeLevel?: string;
  subjectSpecialization?: string[];
  preferences?: Partial<UserPreferences>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  session?: LoginSession;
  token?: string;
  refreshToken?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface SessionValidationResult {
  isValid: boolean;
  user?: UserProfile;
  session?: LoginSession;
  error?: {
    code: string;
    message: string;
  };
}

export interface PasswordResetRequest {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordChangeRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// RBAC Types
// ============================================================================

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: string; // JSON string for complex conditions
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  level: number; // For role hierarchy
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  granted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_id: string;
  granted: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AccessContext {
  resource?: string;
  action?: string;
  conditions?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export interface AccessResult {
  granted: boolean;
  reason?: string;
  conditions_met?: boolean;
  expires_at?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type CreateUserInput = Omit<UserProfile, 'id' | 'created_at' | 'updated_at' | 'last_login'>;
export type UpdateUserInput = Partial<Omit<UserProfile, 'id' | 'created_at'>>;
export type UserWithoutSensitiveData = Omit<UserProfile, 'password_reset_token' | 'password_reset_expires'>;

// ============================================================================
// Migration Types
// ============================================================================

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export interface MigrationStatus {
  current_version: string;
  available_migrations: MigrationStep[];
  pending_migrations: MigrationStep[];
  completed_migrations: string[];
}