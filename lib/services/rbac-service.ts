/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Provides comprehensive role and permission management for the FutureLearner platform.
 * Designed to be compatible with both SQLite and Supabase backends.
 * 
 * Features:
 * - Hierarchical role system
 * - Fine-grained permissions
 * - Resource-based access control
 * - Dynamic permission checking
 * - Audit logging for access control events
 */

import { DatabaseManager } from '@/lib/database/abstract-adapter';
import { UserProfile, UserRole, SecurityAuditLog } from '@/types/auth';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  role: UserRole;
  permission_id: string;
  granted_at: string;
  granted_by: string;
}

export interface UserPermission {
  user_id: string;
  permission_id: string;
  granted_at: string;
  granted_by: string;
  expires_at?: string;
}

export interface AccessContext {
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  resource?: string;
  action?: string;
}

export interface AccessResult {
  granted: boolean;
  reason: string;
  permissions: string[];
  role: UserRole;
  expires_at?: string;
}

export class RBACService {
  private dbManager: DatabaseManager;
  private permissionCache: Map<string, Permission[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  // ============================================================================
  // Database Initialization
  // ============================================================================

  async initializeTables(): Promise<void> {
    try {
      const adapter = this.dbManager.getAdapter();
      
      // Create permissions table
      await adapter.query(`
        CREATE TABLE IF NOT EXISTS permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          resource TEXT NOT NULL,
          action TEXT NOT NULL,
          conditions TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create role_permissions table
      await adapter.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          permission_id INTEGER NOT NULL,
          granted BOOLEAN DEFAULT true,
          conditions TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
          UNIQUE(role, permission_id)
        )
      `);

      // Create user_permissions table
      await adapter.query(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          permission_id INTEGER NOT NULL,
          granted BOOLEAN DEFAULT true,
          conditions TEXT,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
          UNIQUE(user_id, permission_id)
        )
      `);

      // Create access_logs table for audit trail
      await adapter.query(`
        CREATE TABLE IF NOT EXISTS access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          resource TEXT NOT NULL,
          action TEXT NOT NULL,
          granted BOOLEAN NOT NULL,
          reason TEXT,
          ip_address TEXT,
          user_agent TEXT,
          context TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Create indexes for performance
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)`);
      await adapter.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at)`);

      console.log('✅ RBAC tables initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RBAC tables:', error);
      throw error;
    }
  }

  // ============================================================================
  // Permission Management
  // ============================================================================

  async createPermission(permissionData: Omit<Permission, 'id' | 'created_at' | 'updated_at'>): Promise<Permission> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    const permission: Permission = {
      id: this.generateId(),
      ...permissionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.run(`
      INSERT INTO permissions (id, name, description, resource, action, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      permission.id,
      permission.name,
      permission.description,
      permission.resource,
      permission.action,
      permission.created_at,
      permission.updated_at
    ]);

    this.clearPermissionCache();
    return permission;
  }

  async getPermissions(): Promise<Permission[]> {
    if (this.isPermissionCacheValid()) {
      return this.permissionCache.get('all') || [];
    }

    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    const permissions = await db.all(`
      SELECT * FROM permissions ORDER BY resource, action
    `) as Permission[];

    this.permissionCache.set('all', permissions);
    this.lastCacheUpdate = Date.now();

    return permissions;
  }

  async getPermissionsByRole(role: UserRole): Promise<Permission[]> {
    const cacheKey = `role_${role}`;
    
    if (this.isPermissionCacheValid() && this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey) || [];
    }

    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    const permissions = await db.all(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ?
      ORDER BY p.resource, p.action
    `, [role]) as Permission[];

    this.permissionCache.set(cacheKey, permissions);
    return permissions;
  }

  async getPermissionsByUser(userId: string): Promise<Permission[]> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    // Get user's role-based permissions
    const user = await adapter.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const rolePermissions = await this.getPermissionsByRole(user.role);

    // Get user-specific permissions
    const userPermissions = await db.all(`
      SELECT p.* FROM permissions p
      JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ? AND (up.expires_at IS NULL OR up.expires_at > datetime('now'))
      ORDER BY p.resource, p.action
    `, [userId]) as Permission[];

    // Combine and deduplicate permissions
    const allPermissions = [...rolePermissions, ...userPermissions];
    const uniquePermissions = allPermissions.filter((permission, index, self) =>
      index === self.findIndex(p => p.id === permission.id)
    );

    return uniquePermissions;
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  async assignRolePermission(role: UserRole, permissionId: string, grantedBy: string): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    await db.run(`
      INSERT OR REPLACE INTO role_permissions (role, permission_id, granted_at, granted_by)
      VALUES (?, ?, ?, ?)
    `, [role, permissionId, new Date().toISOString(), grantedBy]);

    this.clearPermissionCache();
  }

  async revokeRolePermission(role: UserRole, permissionId: string): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    await db.run(`
      DELETE FROM role_permissions WHERE role = ? AND permission_id = ?
    `, [role, permissionId]);

    this.clearPermissionCache();
  }

  async assignUserPermission(
    userId: string, 
    permissionId: string, 
    grantedBy: string, 
    expiresAt?: string
  ): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    await db.run(`
      INSERT OR REPLACE INTO user_permissions (user_id, permission_id, granted_at, granted_by, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, permissionId, new Date().toISOString(), grantedBy, expiresAt]);
  }

  async revokeUserPermission(userId: string, permissionId: string): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    await db.run(`
      DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?
    `, [userId, permissionId]);
  }

  // ============================================================================
  // Access Control
  // ============================================================================

  async checkAccess(
    userId: string, 
    resource: string, 
    action: string, 
    context?: AccessContext
  ): Promise<AccessResult> {
    try {
      const user = await this.dbManager.getAdapter().getUserById(userId);
      if (!user) {
        await this.logAccessEvent({
          user_id: userId,
          resource,
          action,
          granted: false,
          reason: 'User not found',
          context
        });

        return {
          granted: false,
          reason: 'User not found',
          permissions: [],
          role: 'student' // Default role
        };
      }

      // Check if user account is active
      if (user.account_status !== 'active') {
        await this.logAccessEvent({
          user_id: userId,
          resource,
          action,
          granted: false,
          reason: `Account status: ${user.account_status}`,
          context
        });

        return {
          granted: false,
          reason: `Account is ${user.account_status}`,
          permissions: [],
          role: user.role
        };
      }

      // Get user permissions
      const userPermissions = await this.getPermissionsByUser(userId);
      const permissionNames = userPermissions.map(p => p.name);

      // Check for specific permission
      const hasPermission = userPermissions.some(p => 
        p.resource === resource && p.action === action
      );

      // Check for wildcard permissions
      const hasWildcardResource = userPermissions.some(p => 
        p.resource === '*' && p.action === action
      );

      const hasWildcardAction = userPermissions.some(p => 
        p.resource === resource && p.action === '*'
      );

      const hasFullWildcard = userPermissions.some(p => 
        p.resource === '*' && p.action === '*'
      );

      const granted = hasPermission || hasWildcardResource || hasWildcardAction || hasFullWildcard;

      await this.logAccessEvent({
        user_id: userId,
        resource,
        action,
        granted,
        reason: granted ? 'Permission granted' : 'Permission denied',
        context
      });

      return {
        granted,
        reason: granted ? 'Access granted' : 'Insufficient permissions',
        permissions: permissionNames,
        role: user.role
      };

    } catch (error) {
      console.error('Access check error:', error);
      
      await this.logAccessEvent({
        user_id: userId,
        resource,
        action,
        granted: false,
        reason: `Error: ${error}`,
        context
      });

      return {
        granted: false,
        reason: 'Access check failed',
        permissions: [],
        role: 'student'
      };
    }
  }

  async checkMultipleAccess(
    userId: string, 
    checks: Array<{ resource: string; action: string }>,
    context?: AccessContext
  ): Promise<{ [key: string]: AccessResult }> {
    const results: { [key: string]: AccessResult } = {};

    for (const check of checks) {
      const key = `${check.resource}:${check.action}`;
      results[key] = await this.checkAccess(userId, check.resource, check.action, context);
    }

    return results;
  }

  // ============================================================================
  // Role Hierarchy and Inheritance
  // ============================================================================

  getRoleHierarchy(): { [key in UserRole]: UserRole[] } {
    return {
      'admin': ['teacher', 'parent', 'student'],
      'teacher': ['student'],
      'parent': ['student'],
      'student': []
    };
  }

  canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    const hierarchy = this.getRoleHierarchy();
    return hierarchy[managerRole]?.includes(targetRole) || false;
  }

  async getUsersWithPermission(resource: string, action: string): Promise<UserProfile[]> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    // Get users with role-based permissions
    const usersWithRolePermissions = await db.all(`
      SELECT DISTINCT u.* FROM users_enhanced u
      JOIN role_permissions rp ON u.role = rp.role
      JOIN permissions p ON rp.permission_id = p.id
      WHERE p.resource = ? AND p.action = ?
    `, [resource, action]) as UserProfile[];

    // Get users with direct permissions
    const usersWithDirectPermissions = await db.all(`
      SELECT DISTINCT u.* FROM users_enhanced u
      JOIN user_permissions up ON u.id = up.user_id
      JOIN permissions p ON up.permission_id = p.id
      WHERE p.resource = ? AND p.action = ?
      AND (up.expires_at IS NULL OR up.expires_at > datetime('now'))
    `, [resource, action]) as UserProfile[];

    // Combine and deduplicate
    const allUsers = [...usersWithRolePermissions, ...usersWithDirectPermissions];
    const uniqueUsers = allUsers.filter((user, index, self) =>
      index === self.findIndex(u => u.id === user.id)
    );

    return uniqueUsers;
  }

  // ============================================================================
  // Middleware and Decorators
  // ============================================================================

  createAccessMiddleware(resource: string, action: string) {
    return async (req: any, res: any, next: any) => {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const context: AccessContext = {
        user_id: userId,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        session_id: req.session?.id,
        resource,
        action
      };

      const accessResult = await this.checkAccess(userId, resource, action, context);

      if (!accessResult.granted) {
        return res.status(403).json({ 
          error: 'Access denied',
          reason: accessResult.reason 
        });
      }

      req.accessResult = accessResult;
      next();
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async initializeDefaultPermissions(): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    // Check if permissions table exists and has data
    try {
      const count = await db.get(`SELECT COUNT(*) as count FROM permissions`);
      if (count?.count > 0) {
        return; // Permissions already initialized
      }
    } catch (error) {
      // Table might not exist yet, create it
      await this.createPermissionTables();
    }

    // Default permissions for the FutureLearner platform
    const defaultPermissions = [
      // User management
      { name: 'view_users', description: 'View user profiles', resource: 'users', action: 'read' },
      { name: 'create_users', description: 'Create new users', resource: 'users', action: 'create' },
      { name: 'update_users', description: 'Update user profiles', resource: 'users', action: 'update' },
      { name: 'delete_users', description: 'Delete users', resource: 'users', action: 'delete' },
      
      // Quiz management
      { name: 'view_quizzes', description: 'View quizzes', resource: 'quizzes', action: 'read' },
      { name: 'create_quizzes', description: 'Create quizzes', resource: 'quizzes', action: 'create' },
      { name: 'update_quizzes', description: 'Update quizzes', resource: 'quizzes', action: 'update' },
      { name: 'delete_quizzes', description: 'Delete quizzes', resource: 'quizzes', action: 'delete' },
      { name: 'take_quizzes', description: 'Take quizzes', resource: 'quizzes', action: 'take' },
      
      // Progress tracking
      { name: 'view_progress', description: 'View learning progress', resource: 'progress', action: 'read' },
      { name: 'update_progress', description: 'Update progress', resource: 'progress', action: 'update' },
      
      // Reports and analytics
      { name: 'view_reports', description: 'View reports', resource: 'reports', action: 'read' },
      { name: 'create_reports', description: 'Create reports', resource: 'reports', action: 'create' },
      
      // System administration
      { name: 'manage_system', description: 'System administration', resource: 'system', action: '*' },
      { name: 'view_audit_logs', description: 'View audit logs', resource: 'audit', action: 'read' },
      
      // Parent-specific permissions
      { name: 'view_child_progress', description: 'View child progress', resource: 'child_progress', action: 'read' },
      { name: 'manage_children', description: 'Manage children accounts', resource: 'children', action: '*' }
    ];

    // Create permissions
    for (const permission of defaultPermissions) {
      await this.createPermission(permission);
    }

    // Assign default role permissions
    await this.assignDefaultRolePermissions();
  }

  private async createPermissionTables(): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    // Create permissions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create role_permissions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        granted_by TEXT NOT NULL,
        PRIMARY KEY (role, permission_id),
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `);

    // Create user_permissions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        granted_by TEXT NOT NULL,
        expires_at TEXT,
        PRIMARY KEY (user_id, permission_id),
        FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await db.run(`CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at)`);
  }

  private async assignDefaultRolePermissions(): Promise<void> {
    const permissions = await this.getPermissions();
    const systemUserId = 'system';

    // Admin - all permissions
    for (const permission of permissions) {
      await this.assignRolePermission('admin', permission.id, systemUserId);
    }

    // Teacher - quiz and progress management
    const teacherPermissions = permissions.filter(p => 
      ['quizzes', 'progress', 'reports'].includes(p.resource) ||
      (p.resource === 'users' && p.action === 'read')
    );
    for (const permission of teacherPermissions) {
      await this.assignRolePermission('teacher', permission.id, systemUserId);
    }

    // Parent - child management and progress viewing
    const parentPermissions = permissions.filter(p => 
      ['child_progress', 'children'].includes(p.resource) ||
      (p.resource === 'progress' && p.action === 'read')
    );
    for (const permission of parentPermissions) {
      await this.assignRolePermission('parent', permission.id, systemUserId);
    }

    // Student - basic quiz taking and progress viewing
    const studentPermissions = permissions.filter(p => 
      (p.resource === 'quizzes' && ['read', 'take'].includes(p.action)) ||
      (p.resource === 'progress' && p.action === 'read')
    );
    for (const permission of studentPermissions) {
      await this.assignRolePermission('student', permission.id, systemUserId);
    }
  }

  private async logAccessEvent(eventData: {
    user_id: string;
    resource: string;
    action: string;
    granted: boolean;
    reason: string;
    context?: AccessContext;
  }): Promise<void> {
    const adapter = this.dbManager.getAdapter();
    const db = adapter.getConnection();

    const logData = {
      id: this.generateId(),
      user_id: eventData.user_id,
      event_type: 'access_control' as const,
      event_category: 'authorization' as const,
      description: `Access ${eventData.granted ? 'granted' : 'denied'} for ${eventData.resource}:${eventData.action} - ${eventData.reason}`,
      ip_address: eventData.context?.ip_address || null,
      user_agent: eventData.context?.user_agent || null,
      session_id: eventData.context?.session_id || null,
      resource_accessed: `${eventData.resource}:${eventData.action}`,
      risk_level: eventData.granted ? 'low' : 'medium' as const,
      success: eventData.granted ? 1 : 0,
      created_at: new Date().toISOString(),
      metadata: JSON.stringify({
        resource: eventData.resource,
        action: eventData.action,
        granted: eventData.granted,
        reason: eventData.reason
      })
    };

    await db.run(`
      INSERT INTO security_audit_logs (
        id, user_id, event_type, event_category, description, ip_address, 
        user_agent, session_id, resource_accessed, risk_level, success, 
        created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      logData.risk_level,
      logData.success,
      logData.created_at,
      logData.metadata
    ]);
  }

  private isPermissionCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  private clearPermissionCache(): void {
    this.permissionCache.clear();
    this.lastCacheUpdate = 0;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// Create and export a default instance
const dbManager = DatabaseManager.getInstance();
export const rbacService = new RBACService(dbManager);