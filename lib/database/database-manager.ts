/**
 * Database Manager
 * 
 * Central database connection manager that switches between SQLite and Supabase
 * based on the DATABASE_TYPE environment variable.
 */

import { AbstractDatabaseAdapter } from './abstract-adapter';
import { SupabaseAdapter } from './supabase-adapter';
import { SQLiteAdapter } from './sqlite-adapter';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private adapter: AbstractDatabaseAdapter | null = null;
  private databaseType: string;

  private constructor() {
    this.databaseType = process.env.DATABASE_TYPE || 'sqlite';
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
    console.log(`Initializing database adapter: ${this.databaseType}`);

    switch (this.databaseType.toLowerCase()) {
      case 'supabase':
        this.adapter = new SupabaseAdapter({
          url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
        });
        break;
      
      case 'sqlite':
      default:
        this.adapter = new SQLiteAdapter('./db/user.db');
        break;
    }

    await this.adapter.connect();
    console.log(`Database adapter initialized: ${this.databaseType}`);
  }

  public async switchDatabase(newType: 'sqlite' | 'supabase'): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
    }
    
    this.databaseType = newType;
    this.adapter = null;
    
    await this.initializeAdapter();
    console.log(`Switched to database: ${newType}`);
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