/**
 * SQLite Database Adapter
 * 
 * Implementation of the database adapter for SQLite.
 * This adapter maintains compatibility with the existing SQLite setup
 * while providing a clean interface for future Supabase migration.
 */

import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { AbstractDatabaseAdapter } from './abstract-adapter';
import {
  UserProfile,
  LoginSession,
  ParentChildRelationship,
  FaceRecognitionData,
  DatabaseError,
  UserRole,
  AccountStatus
} from '@/types/auth';

export class SQLiteAdapter extends AbstractDatabaseAdapter {
  private db: Database | null = null;

  constructor(config: { path: string }) {
    super(config.path);
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    try {
      this.db = await open({
        filename: this.connectionString,
        driver: sqlite3.Database
      });
      await this.createTables();
      this.isConnected = true;
    } catch (error) {
      this.handleError(error, 'connect to database');
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isConnected = false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  getConnection(): Database {
    if (!this.db) {
      throw new DatabaseError('Database not connected', 'NO_CONNECTION');
    }
    return this.db;
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');
    
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return await this.db.all(sql, params);
      } else {
        return await this.db.run(sql, params);
      }
    } catch (error) {
      this.handleError(error, 'execute query');
    }
  }

  async migrate(): Promise<boolean> {
    try {
      await this.createTables();
      await this.migrateExistingData();
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }

  // ============================================================================
  // Schema Creation
  // ============================================================================

  private async createTables(): Promise<void> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    // Enhanced users table (Supabase-compatible)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users_enhanced (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
        account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending_verification')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login TEXT,
        login_attempts INTEGER NOT NULL DEFAULT 0,
        password_hash TEXT,
        password_reset_token TEXT,
        password_reset_expires TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        phone TEXT,
        avatar_url TEXT,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        date_of_birth TEXT,
        grade_level TEXT,
        subject_specialization TEXT, -- JSON array for teachers
        bio TEXT,
        preferences TEXT NOT NULL DEFAULT '{}' -- JSON object
      )
    `);

    // Login sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS login_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        refresh_token TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        ip_address TEXT,
        user_agent TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        login_method TEXT NOT NULL CHECK (login_method IN ('password', 'face_recognition', 'sso')),
        FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
      )
    `);

    // Parent-child relationships table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS parent_child_relationships (
        id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'guardian', 'caregiver')),
        is_primary INTEGER NOT NULL DEFAULT 0,
        permissions TEXT NOT NULL DEFAULT '{}', -- JSON object
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        is_active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (parent_id) REFERENCES users_enhanced(id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES users_enhanced(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
      )
    `);

    // Face recognition data table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS face_recognition_data (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        face_encoding TEXT NOT NULL,
        confidence_threshold REAL NOT NULL DEFAULT 0.6,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        is_active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
      )
    `);

    // Teacher-student assignments table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS teacher_student_assignments (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        class_name TEXT,
        academic_year TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (teacher_id) REFERENCES users_enhanced(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users_enhanced(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users_enhanced(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users_enhanced(role);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON login_sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON login_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_parent ON parent_child_relationships(parent_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_child ON parent_child_relationships(child_id);
    `);
  }

  // ============================================================================
  // Data Migration from Existing Tables
  // ============================================================================

  private async migrateExistingData(): Promise<void> {
    if (!this.db) return;

    try {
      // Check if old users table exists
      const oldUsersTable = await this.db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `);

      if (oldUsersTable) {
        // Migrate existing users
        const oldUsers = await this.db.all('SELECT * FROM users');
        
        for (const oldUser of oldUsers) {
          const newUser: Partial<UserProfile> = {
            id: this.generateId(),
            email: oldUser.username + '@example.com', // Generate email from username
            username: oldUser.username,
            role: oldUser.role as UserRole,
            account_status: 'active' as AccountStatus,
            password_hash: oldUser.password,
            email_verified: false,
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

          await this.db.run(`
            INSERT OR IGNORE INTO users_enhanced (
              id, email, username, role, account_status, password_hash, 
              email_verified, preferences, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newUser.id,
            newUser.email,
            newUser.username,
            newUser.role,
            newUser.account_status,
            newUser.password_hash,
            newUser.email_verified ? 1 : 0,
            JSON.stringify(newUser.preferences),
            this.getCurrentTimestamp(),
            this.getCurrentTimestamp()
          ]);
        }
      }

      // Check if parents table exists (from parent_db)
      const parentsTable = await this.db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='parents'
      `);

      if (parentsTable) {
        // Note: This would need to be run against the parents.db file
        // For now, we'll create a placeholder parent user
        const parentId = this.generateId();
        await this.db.run(`
          INSERT OR IGNORE INTO users_enhanced (
            id, email, username, role, account_status, full_name,
            email_verified, preferences, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          parentId,
          'parent1@example.com',
          'parent1',
          'parent',
          'active',
          'Parent One',
          0,
          JSON.stringify({
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
          }),
          this.getCurrentTimestamp(),
          this.getCurrentTimestamp()
        ]);
      }

    } catch (error) {
      console.error('Error migrating existing data:', error);
      // Don't throw error - migration should be non-blocking
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async createUser(userData: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    this.validateRequired(userData, ['email', 'role']);

    const id = this.generateId();
    const now = this.getCurrentTimestamp();
    
    const defaultPreferences = {
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
    };

    const user: UserProfile = {
      id,
      email: userData.email!,
      username: userData.username,
      role: userData.role!,
      account_status: userData.account_status || 'active',
      created_at: now,
      updated_at: now,
      login_attempts: 0,
      email_verified: userData.email_verified || false,
      phone: userData.phone,
      avatar_url: userData.avatar_url,
      first_name: userData.first_name,
      last_name: userData.last_name,
      full_name: userData.full_name,
      date_of_birth: userData.date_of_birth,
      grade_level: userData.grade_level,
      subject_specialization: userData.subject_specialization,
      bio: userData.bio,
      preferences: userData.preferences || defaultPreferences
    };

    try {
      await this.db.run(`
        INSERT INTO users_enhanced (
          id, email, username, role, account_status, created_at, updated_at,
          login_attempts, email_verified, phone, avatar_url, first_name,
          last_name, full_name, date_of_birth, grade_level, subject_specialization,
          bio, preferences
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id, user.email, user.username, user.role, user.account_status,
        user.created_at, user.updated_at, user.login_attempts,
        user.email_verified ? 1 : 0, user.phone, user.avatar_url,
        user.first_name, user.last_name, user.full_name, user.date_of_birth,
        user.grade_level, JSON.stringify(user.subject_specialization),
        user.bio, JSON.stringify(user.preferences)
      ]);

      return user;
    } catch (error) {
      this.handleError(error, 'create user');
    }
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const row = await this.db.get(`
        SELECT * FROM users_enhanced WHERE id = ?
      `, [id]);

      return row ? this.mapRowToUser(row) : null;
    } catch (error) {
      this.handleError(error, 'get user by ID');
    }
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const row = await this.db.get(`
        SELECT * FROM users_enhanced WHERE email = ?
      `, [email]);

      return row ? this.mapRowToUser(row) : null;
    } catch (error) {
      this.handleError(error, 'get user by email');
    }
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const row = await this.db.get(`
        SELECT * FROM users_enhanced WHERE username = ?
      `, [username]);

      return row ? this.mapRowToUser(row) : null;
    } catch (error) {
      this.handleError(error, 'get user by username');
    }
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const sanitized = this.sanitizeUserData(updates);
    const now = this.getCurrentTimestamp();
    
    const setClause = Object.keys(sanitized)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => `${key} = ?`)
      .concat(['updated_at = ?'])
      .join(', ');

    const values = Object.keys(sanitized)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => {
        const value = (sanitized as any)[key];
        if (key === 'preferences' || key === 'subject_specialization') {
          return JSON.stringify(value);
        }
        if (key === 'email_verified') {
          return value ? 1 : 0;
        }
        return value;
      })
      .concat([now, id]);

    try {
      await this.db.run(`
        UPDATE users_enhanced SET ${setClause} WHERE id = ?
      `, values);

      const updatedUser = await this.getUserById(id);
      if (!updatedUser) {
        throw new DatabaseError('User not found after update', 'USER_NOT_FOUND');
      }
      return updatedUser;
    } catch (error) {
      this.handleError(error, 'update user');
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        DELETE FROM users_enhanced WHERE id = ?
      `, [id]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'delete user');
    }
  }

  // ============================================================================
  // Authentication Operations
  // ============================================================================

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const row = await this.db.get(`
        SELECT password_hash FROM users_enhanced WHERE id = ?
      `, [userId]);

      if (!row || !row.password_hash) return false;
      return await bcrypt.compare(password, row.password_hash);
    } catch (error) {
      this.handleError(error, 'verify password');
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const result = await this.db.run(`
        UPDATE users_enhanced 
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
      `, [hashedPassword, this.getCurrentTimestamp(), userId]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'update password');
    }
  }

  async createSession(sessionData: Omit<LoginSession, 'id'>): Promise<LoginSession> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const session: LoginSession = {
      id: this.generateId(),
      ...sessionData
    };

    try {
      await this.db.run(`
        INSERT INTO login_sessions (
          id, user_id, token, refresh_token, expires_at, created_at,
          ip_address, user_agent, is_active, login_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        session.id, session.user_id, session.token, session.refresh_token,
        session.expires_at, session.created_at, session.ip_address,
        session.user_agent, session.is_active ? 1 : 0, session.login_method
      ]);

      return session;
    } catch (error) {
      this.handleError(error, 'create session');
    }
  }

  async getSession(token: string): Promise<LoginSession | null> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const row = await this.db.get(`
        SELECT * FROM login_sessions 
        WHERE token = ? AND is_active = 1 AND expires_at > datetime('now')
      `, [token]);

      return row ? this.mapRowToSession(row) : null;
    } catch (error) {
      this.handleError(error, 'get session');
    }
  }

  async invalidateSession(token: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        UPDATE login_sessions SET is_active = 0 WHERE token = ?
      `, [token]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'invalidate session');
    }
  }

  async getSessionByToken(sessionToken: string): Promise<LoginSession | null> {
    return this.getSession(sessionToken);
  }

  async updateSessionActivity(sessionToken: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        UPDATE login_sessions SET last_activity = datetime('now') WHERE token = ?
      `, [sessionToken]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'update session activity');
    }
  }

  async invalidateSessionByRefreshToken(refreshToken: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        UPDATE login_sessions SET is_active = 0 WHERE refresh_token = ?
      `, [refreshToken]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'invalidate session by refresh token');
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        UPDATE login_sessions SET is_active = 0 WHERE user_id = ?
      `, [userId]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'invalidate all user sessions');
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        DELETE FROM login_sessions 
        WHERE expires_at <= datetime('now') OR is_active = 0
      `);

      return result.changes || 0;
    } catch (error) {
      this.handleError(error, 'cleanup expired sessions');
    }
  }

  // ============================================================================
  // Relationship Operations
  // ============================================================================

  async createParentChildLink(linkData: Omit<ParentChildRelationship, 'id'>): Promise<ParentChildRelationship> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const link: ParentChildRelationship = {
      id: this.generateId(),
      ...linkData,
      created_at: linkData.created_at || this.getCurrentTimestamp(),
      updated_at: linkData.updated_at || this.getCurrentTimestamp()
    };

    try {
      await this.db.run(`
        INSERT INTO parent_child_relationships (
          id, parent_id, child_id, relationship_type, is_primary,
          permissions, created_at, updated_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        link.id, link.parent_id, link.child_id, link.relationship_type,
        link.is_primary ? 1 : 0, JSON.stringify(link.permissions),
        link.created_at, link.updated_at, link.is_active ? 1 : 0
      ]);

      return link;
    } catch (error) {
      this.handleError(error, 'create parent-child link');
    }
  }

  async getParentChildren(parentId: string): Promise<UserProfile[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const rows = await this.db.all(`
        SELECT u.* FROM users_enhanced u
        INNER JOIN parent_child_relationships pcr ON u.id = pcr.child_id
        WHERE pcr.parent_id = ? AND pcr.is_active = 1
      `, [parentId]);

      return rows.map(row => this.mapRowToUser(row));
    } catch (error) {
      this.handleError(error, 'get parent children');
    }
  }

  async getChildParents(childId: string): Promise<UserProfile[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const rows = await this.db.all(`
        SELECT u.* FROM users_enhanced u
        INNER JOIN parent_child_relationships pcr ON u.id = pcr.parent_id
        WHERE pcr.child_id = ? AND pcr.is_active = 1
      `, [childId]);

      return rows.map(row => this.mapRowToUser(row));
    } catch (error) {
      this.handleError(error, 'get child parents');
    }
  }

  async updateParentChildLink(id: string, updates: Partial<ParentChildRelationship>): Promise<ParentChildRelationship> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const now = this.getCurrentTimestamp();
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => `${key} = ?`)
      .concat(['updated_at = ?'])
      .join(', ');

    const values = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => {
        const value = (updates as any)[key];
        if (key === 'permissions') {
          return JSON.stringify(value);
        }
        if (key === 'is_primary' || key === 'is_active') {
          return value ? 1 : 0;
        }
        return value;
      })
      .concat([now, id]);

    try {
      await this.db.run(`
        UPDATE parent_child_relationships SET ${setClause} WHERE id = ?
      `, values);

      const row = await this.db.get(`
        SELECT * FROM parent_child_relationships WHERE id = ?
      `, [id]);

      if (!row) {
        throw new DatabaseError('Relationship not found after update', 'RELATIONSHIP_NOT_FOUND');
      }

      return this.mapRowToRelationship(row);
    } catch (error) {
      this.handleError(error, 'update parent-child link');
    }
  }

  async deleteParentChildLink(id: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        DELETE FROM parent_child_relationships WHERE id = ?
      `, [id]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'delete parent-child link');
    }
  }

  // ============================================================================
  // Face Recognition Operations
  // ============================================================================

  async saveFaceData(faceData: Omit<FaceRecognitionData, 'id'>): Promise<FaceRecognitionData> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const data: FaceRecognitionData = {
      id: this.generateId(),
      ...faceData,
      created_at: faceData.created_at || this.getCurrentTimestamp(),
      updated_at: faceData.updated_at || this.getCurrentTimestamp()
    };

    try {
      await this.db.run(`
        INSERT OR REPLACE INTO face_recognition_data (
          id, user_id, face_encoding, confidence_threshold,
          created_at, updated_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        data.id, data.user_id, data.face_encoding, data.confidence_threshold,
        data.created_at, data.updated_at, data.is_active ? 1 : 0
      ]);

      return data;
    } catch (error) {
      this.handleError(error, 'save face data');
    }
  }

  async getFaceData(userId: string): Promise<FaceRecognitionData | null> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const row = await this.db.get(`
        SELECT * FROM face_recognition_data 
        WHERE user_id = ? AND is_active = 1
      `, [userId]);

      return row ? this.mapRowToFaceData(row) : null;
    } catch (error) {
      this.handleError(error, 'get face data');
    }
  }

  async updateFaceData(userId: string, faceData: string): Promise<FaceRecognitionData> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const now = this.getCurrentTimestamp();

    try {
      await this.db.run(`
        UPDATE face_recognition_data 
        SET face_encoding = ?, updated_at = ?
        WHERE user_id = ?
      `, [faceData, now, userId]);

      const updated = await this.getFaceData(userId);
      if (!updated) {
        throw new DatabaseError('Face data not found after update', 'FACE_DATA_NOT_FOUND');
      }
      return updated;
    } catch (error) {
      this.handleError(error, 'update face data');
    }
  }

  async deleteFaceData(userId: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const result = await this.db.run(`
        DELETE FROM face_recognition_data WHERE user_id = ?
      `, [userId]);

      return (result.changes || 0) > 0;
    } catch (error) {
      this.handleError(error, 'delete face data');
    }
  }

  // ============================================================================
  // Query Helpers
  // ============================================================================

  async getUsersByRole(role: string): Promise<UserProfile[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const rows = await this.db.all(`
        SELECT * FROM users_enhanced WHERE role = ? AND account_status = 'active'
      `, [role]);

      return rows.map(row => this.mapRowToUser(row));
    } catch (error) {
      this.handleError(error, 'get users by role');
    }
  }

  async searchUsers(query: string, role?: string): Promise<UserProfile[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      let sql = `
        SELECT * FROM users_enhanced 
        WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?)
        AND account_status = 'active'
      `;
      const params = [`%${query}%`, `%${query}%`, `%${query}%`];

      if (role) {
        sql += ' AND role = ?';
        params.push(role);
      }

      sql += ' ORDER BY username LIMIT 50';

      const rows = await this.db.all(sql, params);
      return rows.map(row => this.mapRowToUser(row));
    } catch (error) {
      this.handleError(error, 'search users');
    }
  }

  async getUsersWithPagination(offset: number, limit: number, role?: string): Promise<{
    users: UserProfile[];
    total: number;
    hasMore: boolean;
  }> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      let countSql = 'SELECT COUNT(*) as total FROM users_enhanced WHERE account_status = ?';
      let dataSql = 'SELECT * FROM users_enhanced WHERE account_status = ?';
      const params = ['active'];

      if (role) {
        countSql += ' AND role = ?';
        dataSql += ' AND role = ?';
        params.push(role);
      }

      dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

      const [countResult, rows] = await Promise.all([
        this.db.get(countSql, params),
        this.db.all(dataSql, [...params, limit, offset])
      ]);

      const total = countResult?.total || 0;
      const users = rows.map(row => this.mapRowToUser(row));
      const hasMore = offset + limit < total;

      return { users, total, hasMore };
    } catch (error) {
      this.handleError(error, 'get users with pagination');
    }
  }

  // ============================================================================
  // Quiz Operations
  // ============================================================================

  async getRandomQuestions(count: number): Promise<any[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      // Get random questions from the questions table
      const rows = await this.db.all(`
        SELECT id, question_text, correct_word, option_1, option_2, option_3, option_4, correct_option
        FROM questions 
        WHERE option_1 IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
      `, [count]);

      // Transform to match expected format
      return rows.map(q => ({
        id: q.id,
        question_text: q.question_text,
        options: [q.option_1, q.option_2, q.option_3, q.option_4],
        correct_answer: q.correct_word
      }));
    } catch (error) {
      this.handleError(error, 'get random questions');
    }
  }

  async createQuizResult(resultData: any): Promise<any> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const id = this.generateId();
    const now = this.getCurrentTimestamp();
    
    try {
      await this.db.run(`
        INSERT INTO quiz_results (id, user_id, score, correct_answers, total_questions, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, resultData.user_id, resultData.score, resultData.correct_answers, resultData.total_questions, now]);

      return { id, ...resultData, completed_at: now };
    } catch (error) {
      this.handleError(error, 'create quiz result');
    }
  }

  async getQuizResultsByUserId(userId: string, limit?: number): Promise<any[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      let sql = 'SELECT * FROM quiz_results WHERE user_id = ? ORDER BY completed_at DESC';
      const params = [userId];
      
      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const rows = await this.db.all(sql, params);
      return rows;
    } catch (error) {
      this.handleError(error, 'get quiz results by user ID');
    }
  }

  async createQuizAnswer(answerData: any): Promise<any> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const id = this.generateId();
    
    try {
      await this.db.run(`
        INSERT INTO quiz_answers (id, quiz_result_id, question_text, selected_answer, correct_answer, is_correct)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, answerData.quiz_result_id, answerData.question_text, answerData.selected_answer, answerData.correct_answer, answerData.is_correct]);

      return { id, ...answerData };
    } catch (error) {
      this.handleError(error, 'create quiz answer');
    }
  }

  async getQuizAnswersByResultId(quizResultId: string): Promise<any[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const rows = await this.db.all(`
        SELECT * FROM quiz_answers WHERE quiz_result_id = ?
      `, [quizResultId]);

      return rows;
    } catch (error) {
      this.handleError(error, 'get quiz answers by result ID');
    }
  }

  async createIncorrectAnswer(answerData: any): Promise<any> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const id = this.generateId();
    const now = this.getCurrentTimestamp();
    
    try {
      await this.db.run(`
        INSERT INTO incorrect_answers (id, user_id, question_id, question_text, selected_answer, correct_answer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, answerData.user_id, answerData.question_id, answerData.question_text, answerData.selected_answer, answerData.correct_answer, now]);

      return { id, ...answerData, created_at: now };
    } catch (error) {
      this.handleError(error, 'create incorrect answer');
    }
  }

  async getIncorrectAnswersByUserId(userId: string, limit?: number): Promise<any[]> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      let sql = 'SELECT * FROM incorrect_answers WHERE user_id = ? ORDER BY created_at DESC';
      const params = [userId];
      
      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const rows = await this.db.all(sql, params);
      return rows;
    } catch (error) {
      this.handleError(error, 'get incorrect answers by user ID');
    }
  }

  async getAdminStats(): Promise<{
    totalQuizAttempts: number;
    averageScore: number;
    usersWithQuizzes: number;
    recentActivity: number;
  }> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      // Get total quiz attempts
      const totalQuizAttemptsResult = await this.db.get(`
        SELECT COUNT(*) as count FROM quiz_results
      `);
      const totalQuizAttempts = totalQuizAttemptsResult?.count || 0;

      // Get average score
      const averageScoreResult = await this.db.get(`
        SELECT AVG(score) as avg_score FROM quiz_results
      `);
      const averageScore = Math.round((averageScoreResult?.avg_score || 0) * 100) / 100;

      // Get users with quizzes
      const usersWithQuizzesResult = await this.db.get(`
        SELECT COUNT(DISTINCT user_id) as count FROM quiz_results
      `);
      const usersWithQuizzes = usersWithQuizzesResult?.count || 0;

      // Get recent activity (last 7 days)
      const recentActivityResult = await this.db.get(`
        SELECT COUNT(*) as count 
        FROM quiz_results 
        WHERE completed_at >= datetime('now', '-7 days')
      `);
      const recentActivity = recentActivityResult?.count || 0;

      return {
        totalQuizAttempts,
        averageScore,
        usersWithQuizzes,
        recentActivity
      };
    } catch (error) {
      this.handleError(error, 'get admin stats');
    }
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  async beginTransaction(): Promise<any> {
    if (!this.db) throw new DatabaseError('Database not connected', 'NO_CONNECTION');
    await this.db.exec('BEGIN TRANSACTION');
    return this.db;
  }

  async commitTransaction(transaction: any): Promise<void> {
    await transaction.exec('COMMIT');
  }

  async rollbackTransaction(transaction: any): Promise<void> {
    await transaction.exec('ROLLBACK');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapRowToUser(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role as UserRole,
      account_status: row.account_status as AccountStatus,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login: row.last_login,
      login_attempts: row.login_attempts,
      password_reset_token: row.password_reset_token,
      password_reset_expires: row.password_reset_expires,
      email_verified: Boolean(row.email_verified),
      phone: row.phone,
      avatar_url: row.avatar_url,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: row.full_name,
      date_of_birth: row.date_of_birth,
      grade_level: row.grade_level,
      subject_specialization: row.subject_specialization ? JSON.parse(row.subject_specialization) : undefined,
      bio: row.bio,
      preferences: row.preferences ? JSON.parse(row.preferences) : {}
    };
  }

  private mapRowToSession(row: any): LoginSession {
    return {
      id: row.id,
      user_id: row.user_id,
      token: row.token,
      refresh_token: row.refresh_token,
      expires_at: row.expires_at,
      created_at: row.created_at,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      is_active: Boolean(row.is_active),
      login_method: row.login_method
    };
  }

  private mapRowToRelationship(row: any): ParentChildRelationship {
    return {
      id: row.id,
      parent_id: row.parent_id,
      child_id: row.child_id,
      relationship_type: row.relationship_type,
      is_primary: Boolean(row.is_primary),
      permissions: row.permissions ? JSON.parse(row.permissions) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_active: Boolean(row.is_active)
    };
  }

  private mapRowToFaceData(row: any): FaceRecognitionData {
    return {
      id: row.id,
      user_id: row.user_id,
      face_encoding: row.face_encoding,
      confidence_threshold: row.confidence_threshold,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_active: Boolean(row.is_active)
    };
  }
}