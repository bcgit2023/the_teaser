/**
 * Database Connection Module
 * 
 * Supabase-only implementation for production deployment.
 * SQLite support has been removed to avoid native module compilation issues on Vercel.
 */

import { getDbAdapter as getAdapterFromManager } from './database/database-manager'
import { AbstractDatabaseAdapter } from './database/abstract-adapter'

let _adapter: AbstractDatabaseAdapter | null = null;

// Legacy function for backward compatibility - now uses Supabase adapter
async function getDb(): Promise<any> {
  const adapter = await getDbAdapter();
  return adapter;
}

// New adapter-based functions
async function getDbAdapter(): Promise<AbstractDatabaseAdapter> {
  // Always get a fresh adapter from the manager to ensure proper initialization
  return await getAdapterFromManager();
}

// Initialize the database - Supabase only
const initDb = async () => {
  console.log('Initializing Supabase database connection...');
  // For Supabase, we use the adapter pattern
  _adapter = await getAdapterFromManager();
  return _adapter;
};

// Export both legacy and new interfaces
let dbPromise: Promise<AbstractDatabaseAdapter> | null = null;

export const db = () => {
  if (!dbPromise) {
    dbPromise = initDb();
  }
  return dbPromise;
};

export { getDb, getDbAdapter };

// Export database type for conditional logic
export const getDatabaseType = () => process.env.DATABASE_TYPE || 'supabase';

// Export helper function to check if using Supabase
export const isUsingSupabase = () => getDatabaseType() === 'supabase';