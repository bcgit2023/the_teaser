/**
 * Abstract Database Adapter
 * 
 * This abstract class defines the interface for database operations.
 * Implementations for SQLite and Supabase will extend this class.
 */

import {
  DatabaseAdapter,
  UserProfile,
  LoginSession,
  ParentChildRelationship,
  FaceRecognitionData,
  DatabaseError
} from '@/types/auth';

export abstract class AbstractDatabaseAdapter implements DatabaseAdapter {
  protected connectionString: string;
  protected isConnected: boolean = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
  abstract migrate(): Promise<boolean>;

  // ============================================================================
  // User Operations
  // ============================================================================

  abstract createUser(userData: Partial<UserProfile>): Promise<UserProfile>;
  abstract getUserById(id: string): Promise<UserProfile | null>;
  abstract getUserByEmail(email: string): Promise<UserProfile | null>;
  abstract getUserByUsername(username: string): Promise<UserProfile | null>;
  abstract updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile>;
  abstract deleteUser(id: string): Promise<boolean>;

  // ============================================================================
  // Authentication Operations
  // ============================================================================

  abstract verifyPassword(userId: string, password: string): Promise<boolean>;
  abstract updatePassword(userId: string, newPassword: string): Promise<boolean>;
  abstract createSession(sessionData: Omit<LoginSession, 'id'>): Promise<LoginSession>;
  abstract getSession(token: string): Promise<LoginSession | null>;
  abstract getSessionByToken(sessionToken: string): Promise<LoginSession | null>;
  abstract updateSessionActivity(sessionToken: string): Promise<boolean>;
  abstract invalidateSession(token: string): Promise<boolean>;
  abstract invalidateSessionByRefreshToken(refreshToken: string): Promise<boolean>;
  abstract invalidateAllUserSessions(userId: string): Promise<boolean>;
  abstract cleanupExpiredSessions(): Promise<number>;

  // ============================================================================
  // Relationship Operations
  // ============================================================================

  abstract createParentChildLink(linkData: Omit<ParentChildRelationship, 'id'>): Promise<ParentChildRelationship>;
  abstract getParentChildren(parentId: string): Promise<UserProfile[]>;
  abstract getChildParents(childId: string): Promise<UserProfile[]>;
  abstract updateParentChildLink(id: string, updates: Partial<ParentChildRelationship>): Promise<ParentChildRelationship>;
  abstract deleteParentChildLink(id: string): Promise<boolean>;

  // ============================================================================
  // Face Recognition Operations
  // ============================================================================

  abstract saveFaceData(faceData: Omit<FaceRecognitionData, 'id'>): Promise<FaceRecognitionData>;
  abstract getFaceData(userId: string): Promise<FaceRecognitionData | null>;
  abstract updateFaceData(userId: string, faceData: string): Promise<FaceRecognitionData>;
  abstract deleteFaceData(userId: string): Promise<boolean>;

  // ============================================================================
  // Query Helpers
  // ============================================================================

  abstract query(sql: string, params?: any[]): Promise<any>;
  abstract getUsersByRole(role: string): Promise<UserProfile[]>;
  abstract searchUsers(query: string, role?: string): Promise<UserProfile[]>;
  abstract getUsersWithPagination(offset: number, limit: number, role?: string): Promise<{
    users: UserProfile[];
    total: number;
    hasMore: boolean;
  }>;

  // ============================================================================
  // Quiz Operations
  // ============================================================================

  abstract getRandomQuestions(count: number): Promise<any[]>;
  abstract createQuizResult(resultData: any): Promise<any>;
  abstract getQuizResultsByUserId(userId: string, limit?: number): Promise<any[]>;
  abstract createQuizAnswer(answerData: any): Promise<any>;
  abstract getQuizAnswersByResultId(quizResultId: string): Promise<any[]>;
  abstract createIncorrectAnswer(answerData: any): Promise<any>;
  abstract getIncorrectAnswersByUserId(userId: string, limit?: number): Promise<any[]>;

  // ============================================================================
  // Admin Statistics
  // ============================================================================

  abstract getAdminStats(): Promise<{
    totalQuizAttempts: number;
    averageScore: number;
    usersWithQuizzes: number;
    recentActivity: number;
  }>;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  protected generateId(): string {
    // Generate UUID v4 compatible ID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  protected handleError(error: any, operation: string): never {
    console.error(`Database error in ${operation}:`, error);
    throw new DatabaseError(
      `Failed to ${operation}`,
      'DATABASE_OPERATION_FAILED',
      error
    );
  }

  protected validateRequired(data: any, fields: string[]): void {
    for (const field of fields) {
      if (!data[field]) {
        throw new DatabaseError(
          `Missing required field: ${field}`,
          'VALIDATION_ERROR'
        );
      }
    }
  }

  protected sanitizeUserData(userData: Partial<UserProfile>): Partial<UserProfile> {
    // Remove sensitive fields that shouldn't be updated directly
    const { password_reset_token, password_reset_expires, ...sanitized } = userData;
    return sanitized;
  }

  // ============================================================================
  // Transaction Support (to be implemented by concrete classes)
  // ============================================================================

  abstract beginTransaction(): Promise<any>;
  abstract commitTransaction(transaction: any): Promise<void>;
  abstract rollbackTransaction(transaction: any): Promise<void>;

  protected async withTransaction<T>(
    operation: (transaction: any) => Promise<T>
  ): Promise<T> {
    const transaction = await this.beginTransaction();
    try {
      const result = await operation(transaction);
      await this.commitTransaction(transaction);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transaction);
      throw error;
    }
  }
}

// ============================================================================
// Database Factory
// ============================================================================

export interface DatabaseAdapterFactory {
  createAdapter(type: 'sqlite' | 'supabase', config: any): AbstractDatabaseAdapter;
}

export class DatabaseFactory implements DatabaseAdapterFactory {
  createAdapter(type: 'sqlite' | 'supabase', config: any): AbstractDatabaseAdapter {
    switch (type) {
      case 'sqlite':
        // Will be implemented in sqlite-adapter.ts
        const { SQLiteAdapter } = require('./sqlite-adapter');
        return new SQLiteAdapter(config);
      
      case 'supabase':
        // Will be implemented in supabase-adapter.ts
        const { SupabaseAdapter } = require('./supabase-adapter');
        return new SupabaseAdapter(config);
      
      default:
        throw new DatabaseError(
          `Unsupported database type: ${type}`,
          'UNSUPPORTED_DATABASE_TYPE'
        );
    }
  }
}

// ============================================================================
// Singleton Database Manager
// ============================================================================

export class DatabaseManager {
  private static instance: DatabaseManager;
  private adapter: AbstractDatabaseAdapter | null = null;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(type: 'sqlite' | 'supabase', config: any): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
    }

    const factory = new DatabaseFactory();
    this.adapter = factory.createAdapter(type, config);
    await this.adapter.connect();
  }

  getAdapter(): AbstractDatabaseAdapter {
    if (!this.adapter) {
      throw new DatabaseError(
        'Database not initialized. Call initialize() first.',
        'DATABASE_NOT_INITIALIZED'
      );
    }
    return this.adapter;
  }

  async shutdown(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
  }
}