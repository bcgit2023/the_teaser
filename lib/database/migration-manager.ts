/**
 * Database Migration Manager
 * 
 * DISABLED FOR VERCEL DEPLOYMENT COMPATIBILITY
 * 
 * This file contains SQLite-specific migration logic that causes native module
 * compilation errors on Vercel. Since we've migrated to Supabase-only deployment,
 * this migration manager is no longer needed for the main application.
 * 
 * The entire file is commented out to prevent build issues while preserving
 * the code for future reference or local development needs.
 * 
 * To re-enable this file, uncomment the code below and ensure SQLite dependencies
 * are available in your deployment environment.
 */

// This file is completely commented out for Vercel deployment compatibility
// Uncomment the code below if you need to use SQLite migrations in local development

/*
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
  // All migration definitions are commented out for Vercel compatibility
  // Original migrations would be defined here
];

// ============================================================================
// Migration Manager Class
// ============================================================================

export class MigrationManager {
  // All class implementation is commented out for Vercel compatibility
  // Original implementation would be here
}

// ============================================================================
// Data Migration Utilities
// ============================================================================

export class DataMigrationUtils {
  // All utility methods are commented out for Vercel compatibility
  // Original utilities would be here
}

// Note: MigrationManager should be instantiated after DatabaseManager is initialized
// Example: const migrationManager = new MigrationManager();
*/

// Export empty objects to prevent import errors if this file is imported elsewhere
export const MIGRATIONS: any[] = [];
export class MigrationManager {
  constructor() {
    console.warn('MigrationManager is disabled for Vercel deployment compatibility');
  }
}
export class DataMigrationUtils {
  static migrateUserData() {
    console.warn('DataMigrationUtils is disabled for Vercel deployment compatibility');
    return Promise.resolve({ migrated: 0, errors: ['Migration utilities disabled for Vercel compatibility'] });
  }
}