/**
 * Database Migration Manager
 * 
 * Handles database schema migrations and data transformations
 * for both SQLite and future Supabase migrations.
 */

import { Database } from 'sqlite';
import { DatabaseManager } from './abstract-adapter';
import { UserRole, UserProfile, ParentProfile } from '@/types/auth';
import bcrypt from 'bcrypt';

// ============================================================================
// Migration Types
// ============================================================================

export interface Migration {
  id: string;
  name: string;
  version: number;
  description: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
  dependencies?: string[];
}

export interface MigrationRecord {
  id: string;
  name: string;
  version: number;
  applied_at: string;
  checksum: string;
}

export interface MigrationResult {
  success: boolean;
  migration: Migration;
  error?: string;
  duration: number;
}

export interface MigrationPlan {
  migrations: Migration[];
  totalCount: number;
  estimatedDuration: number;
}

// ============================================================================
// Migration Definitions
// ============================================================================

export const MIGRATIONS: Migration[] = [
  {
    id: 'create_enhanced_schema',
    name: 'Create Enhanced User Schema',
    version: 1,
    description: 'Create enhanced user tables with proper relationships and security features',
    up: async (db: Database) => {
      // Note: The SQLiteAdapter already creates these tables in createTables()
      // This migration ensures they exist and adds any missing indexes
      
      // Create indexes for better performance
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_enhanced_username ON users_enhanced(username);
        CREATE INDEX IF NOT EXISTS idx_users_enhanced_email ON users_enhanced(email);
        CREATE INDEX IF NOT EXISTS idx_users_enhanced_role ON users_enhanced(role);
        CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token);
        CREATE INDEX IF NOT EXISTS idx_parent_child_parent_id ON parent_child_relationships(parent_id);
        CREATE INDEX IF NOT EXISTS idx_parent_child_child_id ON parent_child_relationships(child_id);
        CREATE INDEX IF NOT EXISTS idx_face_recognition_user_id ON face_recognition_data(user_id);
      `);
    },
    down: async (db: Database) => {
      // Drop indexes
      await db.exec(`
        DROP INDEX IF EXISTS idx_users_enhanced_username;
        DROP INDEX IF EXISTS idx_users_enhanced_email;
        DROP INDEX IF EXISTS idx_users_enhanced_role;
        DROP INDEX IF EXISTS idx_login_sessions_user_id;
        DROP INDEX IF EXISTS idx_login_sessions_token;
        DROP INDEX IF EXISTS idx_parent_child_parent_id;
        DROP INDEX IF EXISTS idx_parent_child_child_id;
        DROP INDEX IF EXISTS idx_face_recognition_user_id;
      `);
    }
  },

  {
    id: 'migrate_existing_users',
    name: 'Migrate Existing Users',
    version: 2,
    description: 'Migrate data from existing users and parents tables to enhanced schema',
    dependencies: ['create_enhanced_schema'],
    up: async (db: Database) => {
      // Check if old users table exists before migrating
      const oldUsersTable = await db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `);

      if (oldUsersTable) {
        // Migrate users from the original users table
        await db.exec(`
          INSERT OR IGNORE INTO users_enhanced (
            id, username, password_hash, role, email, created_at, updated_at
          )
          SELECT 
            CASE 
              WHEN LENGTH(id) > 0 THEN id 
              ELSE lower(hex(randomblob(16)))
            END as id,
            username, 
            password, 
            role,
            COALESCE(email, username || '@example.com') as email,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          FROM users
          WHERE username NOT IN (SELECT COALESCE(username, '') FROM users_enhanced)
        `);
      }

      // Check if parents table exists before migrating
      const parentsTable = await db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='parents'
      `);

      if (parentsTable) {
        // Migrate parents from the parents table
        await db.exec(`
          INSERT OR IGNORE INTO users_enhanced (
            id, username, email, password_hash, role, full_name, created_at, updated_at
          )
          SELECT 
            CASE 
              WHEN LENGTH(id) > 0 THEN id 
              ELSE lower(hex(randomblob(16)))
            END as id,
            username,
            email,
            password,
            'parent' as role,
            full_name,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          FROM parents
          WHERE username NOT IN (SELECT COALESCE(username, '') FROM users_enhanced)
        `);
      }

      // Check if parent_student_relationship table exists before migrating relationships
      const relationshipTable = await db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='parent_student_relationship'
      `);

      if (relationshipTable && parentsTable && oldUsersTable) {
        // Migrate parent-student relationships
        await db.exec(`
          INSERT OR IGNORE INTO parent_child_relationships (
            id, parent_id, child_id, relationship_type, is_primary, created_at, updated_at
          )
          SELECT 
            lower(hex(randomblob(16))) as id,
            p_enhanced.id as parent_id,
            s_enhanced.id as child_id,
            'parent' as relationship_type,
            1 as is_primary,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          FROM parent_student_relationship psr
          JOIN parents p ON psr.parent_id = p.id
          JOIN users s ON psr.student_id = s.id
          JOIN users_enhanced p_enhanced ON p.username = p_enhanced.username
          JOIN users_enhanced s_enhanced ON s.username = s_enhanced.username
          WHERE p_enhanced.role = 'parent' AND s_enhanced.role = 'student'
        `);
      }
    },
    down: async (db: Database) => {
      await db.exec(`DELETE FROM parent_child_relationships`);
      await db.exec(`DELETE FROM users_enhanced WHERE role = 'parent'`);
      await db.exec(`DELETE FROM users_enhanced WHERE username IN (SELECT username FROM users)`);
    }
  },

  {
    id: 'create_migration_tracking',
    name: 'Create Migration Tracking',
    version: 3,
    description: 'Create table to track applied migrations',
    up: async (db: Database) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_id VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          version INTEGER NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
    down: async (db: Database) => {
      await db.exec(`DROP TABLE IF EXISTS schema_migrations`);
    }
  },

  {
    id: 'create_security_tables',
    name: 'Create Security Tables',
    version: 4,
    description: 'Create security-related tables for audit logs, password resets, and account security',
    dependencies: ['create_enhanced_schema'],
    up: async (db: Database) => {
      // Password reset tokens table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          used_at TEXT,
          ip_address TEXT,
          user_agent TEXT,
          FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
        )
      `);

      // Failed login attempts table
       await db.exec(`
         CREATE TABLE IF NOT EXISTS failed_login_attempts (
           id TEXT PRIMARY KEY,
           identifier TEXT NOT NULL,
           ip_address TEXT NOT NULL,
           user_agent TEXT,
           attempt_time TEXT NOT NULL DEFAULT (datetime('now')),
           failure_reason TEXT NOT NULL,
           blocked_until TEXT
         )
       `);

       // Account lockouts table
       await db.exec(`
         CREATE TABLE IF NOT EXISTS account_lockouts (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL,
           locked_at TEXT NOT NULL DEFAULT (datetime('now')),
           locked_until TEXT,
           reason TEXT NOT NULL,
           locked_by TEXT,
           unlock_token TEXT UNIQUE,
           is_active INTEGER NOT NULL DEFAULT 1,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now')),
           FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
         )
       `);

      // Audit logs table for security events
       await db.exec(`
         CREATE TABLE IF NOT EXISTS security_audit_logs (
           id TEXT PRIMARY KEY,
           user_id TEXT,
           event_type TEXT NOT NULL,
           event_category TEXT NOT NULL,
           description TEXT NOT NULL,
           ip_address TEXT,
           user_agent TEXT,
           session_id TEXT,
           resource_accessed TEXT,
           old_values TEXT,
           new_values TEXT,
           risk_level TEXT NOT NULL DEFAULT 'low',
           success INTEGER NOT NULL DEFAULT 1,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           metadata TEXT,
           FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE SET NULL
         )
       `);

       // Email verification tokens table
       await db.exec(`
         CREATE TABLE IF NOT EXISTS email_verification_tokens (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL,
           email TEXT NOT NULL,
           token TEXT UNIQUE NOT NULL,
           expires_at TEXT NOT NULL,
           verified INTEGER NOT NULL DEFAULT 0,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           verified_at TEXT,
           ip_address TEXT,
           user_agent TEXT,
           FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
         )
       `);

       // Two-factor authentication table
       await db.exec(`
         CREATE TABLE IF NOT EXISTS two_factor_auth (
           id TEXT PRIMARY KEY,
           user_id TEXT UNIQUE NOT NULL,
           secret TEXT NOT NULL,
           backup_codes TEXT,
           is_enabled INTEGER NOT NULL DEFAULT 0,
           last_used_at TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now')),
           FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
         )
       `);

       // Create indexes for performance
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
        
        CREATE INDEX IF NOT EXISTS idx_failed_attempts_identifier ON failed_login_attempts(identifier);
        CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON failed_login_attempts(ip_address);
        CREATE INDEX IF NOT EXISTS idx_failed_attempts_time ON failed_login_attempts(attempt_time);
        
        CREATE INDEX IF NOT EXISTS idx_lockouts_user_id ON account_lockouts(user_id);
        CREATE INDEX IF NOT EXISTS idx_lockouts_active ON account_lockouts(is_active);
        CREATE INDEX IF NOT EXISTS idx_lockouts_until ON account_lockouts(locked_until);
        
        CREATE INDEX IF NOT EXISTS idx_audit_user_id ON security_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_audit_category ON security_audit_logs(event_category);
        CREATE INDEX IF NOT EXISTS idx_audit_created_at ON security_audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_risk_level ON security_audit_logs(risk_level);
        
        CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_tokens(expires_at);
        
        CREATE INDEX IF NOT EXISTS idx_2fa_user_id ON two_factor_auth(user_id);
        CREATE INDEX IF NOT EXISTS idx_2fa_enabled ON two_factor_auth(is_enabled);
      `);
    },
    down: async (db: Database) => {
      await db.exec(`
        DROP TABLE IF EXISTS two_factor_auth;
        DROP TABLE IF EXISTS email_verification_tokens;
        DROP TABLE IF EXISTS security_audit_logs;
        DROP TABLE IF EXISTS account_lockouts;
        DROP TABLE IF EXISTS failed_login_attempts;
        DROP TABLE IF EXISTS password_reset_tokens;
      `);
    }
  }
];

// ============================================================================
// Migration Manager
// ============================================================================

export class MigrationManager {
  private migrations: Migration[];

  private get db(): Database {
    return DatabaseManager.getInstance().getAdapter().getConnection();
  }

  constructor(migrations: Migration[] = MIGRATIONS) {
    this.migrations = migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    // First check if the schema_migrations table exists
    const tableExists = await this.db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`
    );
    
    // If table doesn't exist, return empty array
    if (!tableExists) {
      return [];
    }
    
    // Table exists, query it
    const rows = await this.db.all(
      `SELECT migration_id as id, name, version, applied_at, checksum 
       FROM schema_migrations 
       ORDER BY version ASC`
    );
    
    return rows as MigrationRecord[];
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map(m => m.id));
    
    return this.migrations.filter(m => !appliedIds.has(m.id));
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(): Promise<MigrationPlan> {
    const pending = await this.getPendingMigrations();
    const applied = await this.getAppliedMigrations();
    
    // Resolve dependencies considering already applied migrations
    const orderedMigrations = this.resolveDependencies(pending, applied);
    
    return {
      migrations: orderedMigrations,
      totalCount: orderedMigrations.length,
      estimatedDuration: orderedMigrations.length * 1000 // Rough estimate: 1 second per migration
    };
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    await this.initialize();
    
    const plan = await this.createMigrationPlan();
    const results: MigrationResult[] = [];

    for (const migration of plan.migrations) {
      const result = await this.runMigration(migration);
      results.push(result);
      
      if (!result.success) {
        console.error(`Migration ${migration.id} failed:`, result.error);
        break;
      }
    }

    return results;
  }

  /**
   * Run a specific migration
   */
  async runMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      // Check dependencies
      if (migration.dependencies) {
        const applied = await this.getAppliedMigrations();
        const appliedIds = new Set(applied.map(m => m.id));
        
        for (const dep of migration.dependencies) {
          if (!appliedIds.has(dep)) {
            throw new Error(`Dependency ${dep} not satisfied for migration ${migration.id}`);
          }
        }
      }

      // Run the migration
      await migration.up(this.db);
      
      // Record the migration
      await this.recordMigration(migration);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        migration,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        migration,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  /**
   * Rollback a migration
   */
  async rollback(migrationId: string): Promise<MigrationResult> {
    const migration = this.migrations.find(m => m.id === migrationId);
    
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    const startTime = Date.now();
    
    try {
      // Run the rollback
      await migration.down(this.db);
      
      // Remove migration record
      await this.removeMigrationRecord(migrationId);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        migration,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        migration,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      applied,
      pending,
      total: this.migrations.length
    };
  }

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check if all required tables exist
      const requiredTables = [
        'users_enhanced',
        'login_sessions',
        'parent_child_relationships',
        'face_recognition_data',
        'password_history',
        'login_attempts',
        'schema_migrations'
      ];

      for (const table of requiredTables) {
        const exists = await this.tableExists(table);
        if (!exists) {
          issues.push(`Missing table: ${table}`);
        }
      }

      // Check for required indexes
      const requiredIndexes = [
        'idx_users_enhanced_username',
        'idx_users_enhanced_email',
        'idx_login_sessions_user_id',
        'idx_login_sessions_token'
      ];

      for (const index of requiredIndexes) {
        const exists = await this.indexExists(index);
        if (!exists) {
          issues.push(`Missing index: ${index}`);
        }
      }

    } catch (error) {
      issues.push(`Schema validation error: ${error}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async recordMigration(migration: Migration): Promise<void> {
    const checksum = this.calculateChecksum(migration);
    
    await this.db.run(
      `INSERT INTO schema_migrations (migration_id, name, version, checksum) 
       VALUES (?, ?, ?, ?)`,
      [migration.id, migration.name, migration.version, checksum]
    );
  }

  private async removeMigrationRecord(migrationId: string): Promise<void> {
    await this.db.run(
      `DELETE FROM schema_migrations WHERE migration_id = ?`,
      [migrationId]
    );
  }

  private calculateChecksum(migration: Migration): string {
    const crypto = require('crypto');
    const content = migration.up.toString() + migration.down.toString();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private resolveDependencies(migrations: Migration[], appliedMigrations: MigrationRecord[] = []): Migration[] {
    const resolved: Migration[] = [];
    const remaining = [...migrations];
    
    // Include already applied migrations in the resolved set
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    
    while (remaining.length > 0) {
      const resolvedIds = new Set([...resolved.map(m => m.id), ...appliedIds]);
      const initialRemainingCount = remaining.length;
      
      for (let i = remaining.length - 1; i >= 0; i--) {
        const migration = remaining[i];
        
        if (!migration.dependencies || 
            migration.dependencies.every(dep => resolvedIds.has(dep))) {
          resolved.push(migration);
          remaining.splice(i, 1);
        }
      }
      
      // Prevent infinite loop - if no migrations were resolved in this pass
      if (remaining.length === initialRemainingCount && remaining.length > 0) {
        // Check if any remaining migrations have unresolvable dependencies
        const allMigrationIds = new Set([...resolved.map(m => m.id), ...remaining.map(m => m.id), ...appliedIds]);
        const unresolvedDeps = remaining.flatMap(m => 
          (m.dependencies || []).filter(dep => !allMigrationIds.has(dep))
        );
        
        if (unresolvedDeps.length > 0) {
          throw new Error(`Unresolved dependencies: ${unresolvedDeps.join(', ')}`);
        } else {
          throw new Error('Circular dependency detected in migrations');
        }
      }
    }
    
    return resolved;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const row = await this.db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return !!row;
  }

  private async indexExists(indexName: string): Promise<boolean> {
    const row = await this.db.get(
      `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
      [indexName]
    );
    return !!row;
  }
}

// ============================================================================
// Data Migration Utilities
// ============================================================================

export class DataMigrationUtils {
  /**
   * Migrate user data from old schema to new schema
   */
  static async migrateUserData(
    oldDb: Database,
    newDb: Database
  ): Promise<{ migrated: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    try {
      // Get users from old database
      const users = await this.getOldUsers(oldDb);
      
      for (const user of users) {
        try {
          await this.insertEnhancedUser(newDb, user);
          migrated++;
        } catch (error) {
          errors.push(`Failed to migrate user ${user.username}: ${error}`);
        }
      }

      // Get parents from old database
      const parents = await this.getOldParents(oldDb);
      
      for (const parent of parents) {
        try {
          await this.insertEnhancedParent(newDb, parent);
          migrated++;
        } catch (error) {
          errors.push(`Failed to migrate parent ${parent.username}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Migration failed: ${error}`);
    }

    return { migrated, errors };
  }

  private static async getOldUsers(db: Database): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM users`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  private static async getOldParents(db: Database): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM parents`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  private static async insertEnhancedUser(db: Database, user: any): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO users_enhanced 
         (username, password_hash, role, profile_picture, created_at) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [user.username, user.password, user.role, user.profile_picture],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private static async insertEnhancedParent(db: Database, parent: any): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO users_enhanced 
         (username, email, password_hash, role, first_name, created_at) 
         VALUES (?, ?, ?, 'parent', ?, CURRENT_TIMESTAMP)`,
        [parent.username, parent.email, parent.password, parent.full_name],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

// ============================================================================
// Export
// ============================================================================

// Note: MigrationManager should be instantiated after DatabaseManager is initialized
// Example: const migrationManager = new MigrationManager();