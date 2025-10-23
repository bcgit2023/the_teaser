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

import { DatabaseManager } from '@/lib/database/database-manager';
import { UserProfile, UserRole } from '@/types/auth';

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
      // TODO: Implement with Supabase
      console.warn('initializeTables: Supabase implementation needed');
      console.log('RBAC tables initialization skipped - Supabase migration needed');
    } catch (error) {
      console.error('Error initializing RBAC tables:', error);
      throw error;
    }
  }

  // ============================================================================
  // Permission Management
  // ============================================================================

  async createPermission(permissionData: Omit<Permission, 'id' | 'created_at' | 'updated_at'>): Promise<Permission> {
    // TODO: Implement with Supabase
    console.warn('createPermission: Supabase implementation needed');
    
    const permission: Permission = {
      id: this.generateId(),
      ...permissionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.clearPermissionCache();
    return permission;
  }

  async getPermissions(): Promise<Permission[]> {
    if (this.isPermissionCacheValid()) {
      return this.permissionCache.get('all') || [];
    }

    // TODO: Implement with Supabase
    console.warn('getPermissions: Supabase implementation needed');
    
    const permissions: Permission[] = [];

    this.permissionCache.set('all', permissions);
    this.lastCacheUpdate = Date.now();

    return permissions;
  }

  async getPermissionsByRole(_role: UserRole): Promise<Permission[]> {
    const cacheKey = `role_${_role}`;
    
    if (this.isPermissionCacheValid() && this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey) || [];
    }

    // TODO: Implement with Supabase
    console.warn('getPermissionsByRole: Supabase implementation needed');
    
    const permissions: Permission[] = [];

    this.permissionCache.set(cacheKey, permissions);
    return permissions;
  }

  async getPermissionsByUser(_userId: string): Promise<Permission[]> {
    // TODO: Implement with Supabase
    console.warn('getPermissionsByUser: Supabase implementation needed');
    
    // For now, return empty array until Supabase implementation
    const permissions: Permission[] = [];
    return permissions;
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  async assignRolePermission(_role: UserRole, _permissionId: string, _grantedBy: string): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('assignRolePermission: Supabase implementation needed');

    this.clearPermissionCache();
  }

  async revokeRolePermission(_role: UserRole, _permissionId: string): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('revokeRolePermission: Supabase implementation needed');

    this.clearPermissionCache();
  }

  async assignUserPermission(
    _userId: string, 
    _permissionId: string, 
    _grantedBy: string, 
    _expiresAt?: string
  ): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('assignUserPermission: Supabase implementation needed');
  }

  async revokeUserPermission(_userId: string, _permissionId: string): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('revokeUserPermission: Supabase implementation needed');
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

  async getUsersWithPermission(_resource: string, _action: string): Promise<UserProfile[]> {
    // TODO: Implement with Supabase
    console.warn('getUsersWithPermission: Supabase implementation needed');
    
    return [];
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

  private async logAccessEvent(eventData: {
    user_id: string;
    resource: string;
    action: string;
    granted: boolean;
    reason: string;
    context?: AccessContext;
  }): Promise<void> {
    // TODO: Implement with Supabase
    console.warn('logAccessEvent: Supabase implementation needed');
    
    // Log to console for now
    console.log(`Access ${eventData.granted ? 'granted' : 'denied'} for ${eventData.resource}:${eventData.action} - ${eventData.reason}`);
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