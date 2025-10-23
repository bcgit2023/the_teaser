/**
 * Database Manager
 * 
 * Supabase-only database connection manager for production deployment.
 * SQLite support has been removed to avoid native module compilation issues on Vercel.
 */

import { AbstractDatabaseAdapter } from './abstract-adapter';
import { SupabaseAdapter } from './supabase-adapter';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private adapter: AbstractDatabaseAdapter | null = null;
  private databaseType: string;

  private constructor() {
    this.databaseType = process.env.DATABASE_TYPE || 'supabase';
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getAdapter(): AbstractDatabaseAdapter {
    if (!this.adapter) {
      throw new Error('Database adapter not initialized. Call initializeAdapter() first.');
    }
    return this.adapter;
  }

  public async initializeIfNeeded(): Promise<void> {
    if (!this.adapter) {
      await this.initializeAdapter();
    }
  }

  public async initializeAdapter(): Promise<void> {
    console.log(`Initializing Supabase database adapter`);

    this.adapter = new SupabaseAdapter({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    await this.adapter.connect();
    console.log(`Supabase database adapter initialized`);
  }

  public async reinitialize(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
    }
    
    this.adapter = null;
    await this.initializeAdapter();
  }

  public getDatabaseType(): string {
    return this.databaseType;
  }

  public async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
  }
}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance();

// Export convenience function for getting the adapter
export async function getDbAdapter(): Promise<AbstractDatabaseAdapter> {
  await dbManager.initializeIfNeeded();
  return dbManager.getAdapter();
}