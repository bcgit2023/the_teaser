/**
 * Supabase Database Adapter
 * 
 * Implementation of the database adapter for Supabase.
 * This adapter provides the same interface as SQLite but uses Supabase
 * for backend operations, making migration seamless.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AbstractDatabaseAdapter } from './abstract-adapter';
import {
  UserProfile,
  LoginSession,
  ParentChildRelationship,
  FaceRecognitionData,
  DatabaseError
} from '@/types/auth';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export class SupabaseAdapter extends AbstractDatabaseAdapter {
  private client: SupabaseClient | null = null;
  private serviceClient: SupabaseClient | null = null;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    super(config.url);
    this.config = config;
  }

  // Getter for backward compatibility with methods using this.supabase
  get supabase(): SupabaseClient {
    if (!this.client) {
      throw new DatabaseError('Database not connected', 'NO_CONNECTION');
    }
    return this.client;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    try {
      // Create client for regular operations
      this.client = createClient(this.config.url, this.config.anonKey) as any;

      // Create service client for admin operations (if service role key provided)
      if (this.config.serviceRoleKey) {
        this.serviceClient = createClient(this.config.url, this.config.serviceRoleKey) as any;
      }

      this.isConnected = true;
    } catch (error) {
      this.handleError(error, 'connect to Supabase');
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      // Supabase client doesn't need explicit disconnection
      this.client = null;
      this.serviceClient = null;
      this.isConnected = false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      // Simple query to check connection
      const { error } = await this.client
        .from('users_enhanced')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }

  async migrate(): Promise<boolean> {
    try {
      // Supabase migrations are handled via SQL files
      // This would typically be done through Supabase CLI or dashboard
      console.log('Supabase migrations should be handled via SQL migration files');
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.serviceClient) {
      throw new DatabaseError('Service role client required for raw SQL queries', 'NO_SERVICE_CLIENT');
    }

    try {
      // For Supabase, we'd use the RPC function or direct SQL via service role
      // This is a simplified implementation - in practice, you'd want to use
      // Supabase's RPC functions or the REST API
      const { data, error } = await this.serviceClient.rpc('execute_sql', {
        query: sql,
        params: params || []
      });

      if (error) throw error;
      return data;
    } catch (error) {
      // Fallback: log the query for manual execution
      console.warn('Raw SQL query not supported in this Supabase setup:', sql);
      console.warn('Parameters:', params);
      return null;
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async createUser(userData: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

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
        profile_visibility: 'private' as const,
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
      const { data, error } = await this.client
        .from('users_enhanced')
        .insert([user])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'create user');
    }
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('users_enhanced')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data || null;
    } catch (error) {
      this.handleError(error, 'get user by ID');
    }
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('users_enhanced')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      this.handleError(error, 'get user by email');
    }
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    console.log('🔍 getUserByUsername called with username:', username);

    try {
      const { data, error } = await this.client
        .from('users_enhanced')
        .select('*')
        .eq('username', username)
        .single();

      console.log('🔍 getUserByUsername - data:', data, 'error:', error);

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.log('🔍 getUserByUsername - caught error:', error);
      this.handleError(error, 'get user by username');
    }
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    console.log('🔍 updateUser called with ID:', id, 'Type:', typeof id);
    console.log('🔍 updateUser updates:', JSON.stringify(updates, null, 2));

    const sanitized = this.sanitizeUserData(updates);
    sanitized.updated_at = this.getCurrentTimestamp();

    console.log('🔍 Sanitized updates:', JSON.stringify(sanitized, null, 2));

    try {
      // Use service client for admin operations if available, otherwise use regular client
      const clientToUse = this.serviceClient || this.client;
      console.log('🔍 Using client type:', this.serviceClient ? 'service' : 'anon');

      const { data, error } = await clientToUse
        .from('users_enhanced')
        .update(sanitized)
        .eq('id', id)
        .select()
        .single();

      console.log('🔍 Supabase update result - data:', data, 'error:', error);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ updateUser error:', error);
      this.handleError(error, 'update user');
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('users_enhanced')
        .delete()
        .eq('id', id);

      return !error;
    } catch (error) {
      this.handleError(error, 'delete user');
    }
  }

  // ============================================================================
  // Authentication Operations
  // ============================================================================

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    console.log('🔍 verifyPassword called with userId:', userId, 'Type:', typeof userId);

    try {
      // Get the user's password hash from users_enhanced table
      const { data: userData, error } = await this.client
        .from('users_enhanced')
        .select('password_hash')
        .eq('id', userId)
        .single();

      console.log('🔍 verifyPassword - userData:', userData, 'error:', error);

      if (error || !userData) {
        console.error('Error fetching user password hash:', error);
        return false;
      }

      // Use bcrypt to compare the password with the hash
      const bcrypt = require('bcrypt');
      const result = await bcrypt.compare(password, userData.password_hash);
      console.log('🔍 verifyPassword - bcrypt result:', result);
      return result;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    // Similar to verifyPassword, this would typically be handled by Supabase Auth
    // or implemented as a secure stored procedure
    
    if (!this.serviceClient) {
      throw new DatabaseError('Service role client required for password update', 'NO_SERVICE_CLIENT');
    }

    try {
      const { data, error } = await this.serviceClient.rpc('update_user_password', {
        user_id: userId,
        new_password: newPassword
      });

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'update password');
    }
  }

  async createSession(sessionData: Omit<LoginSession, 'id'>): Promise<LoginSession> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const session: LoginSession = {
      id: this.generateId(),
      ...sessionData
    };

    try {
      const { data, error } = await this.client
        .from('login_sessions')
        .insert([session])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'create session');
    }
  }

  async getSession(token: string): Promise<LoginSession | null> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('login_sessions')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      this.handleError(error, 'get session');
    }
  }

  async invalidateSession(token: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('login_sessions')
        .update({ is_active: false })
        .eq('token', token);

      return !error;
    } catch (error) {
      this.handleError(error, 'invalidate session');
    }
  }

  async getSessionByToken(sessionToken: string): Promise<LoginSession | null> {
    return this.getSession(sessionToken);
  }

  async updateSessionActivity(sessionToken: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('login_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('token', sessionToken);

      return !error;
    } catch (error) {
      this.handleError(error, 'update session activity');
    }
  }

  async invalidateSessionByRefreshToken(refreshToken: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('login_sessions')
        .update({ is_active: false })
        .eq('refresh_token', refreshToken);

      return !error;
    } catch (error) {
      this.handleError(error, 'invalidate session by refresh token');
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('login_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      this.handleError(error, 'invalidate all user sessions');
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('login_sessions')
        .delete()
        .or(`expires_at.lte.${new Date().toISOString()},is_active.eq.false`)
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      this.handleError(error, 'cleanup expired sessions');
    }
  }

  // ============================================================================
  // Relationship Operations
  // ============================================================================

  async createParentChildLink(linkData: Omit<ParentChildRelationship, 'id'>): Promise<ParentChildRelationship> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const link: ParentChildRelationship = {
      id: this.generateId(),
      ...linkData,
      created_at: linkData.created_at || this.getCurrentTimestamp(),
      updated_at: linkData.updated_at || this.getCurrentTimestamp()
    };

    try {
      const { data, error } = await this.client
        .from('parent_child_relationships')
        .insert([link])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'create parent-child link');
    }
  }

  async getParentChildren(parentId: string): Promise<UserProfile[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('parent_child_relationships')
        .select(`
          child:users_enhanced!child_id(*)
        `)
        .eq('parent_id', parentId)
        .eq('is_active', true);

      if (error) throw error;
      return data?.map(item => this.mapDatabaseUserToProfile(item.child)).filter(Boolean) || [];
    } catch (error) {
      this.handleError(error, 'get parent children');
    }
  }

  async getChildParents(childId: string): Promise<UserProfile[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('parent_child_relationships')
        .select(`
          parent:users_enhanced!parent_id(*)
        `)
        .eq('child_id', childId)
        .eq('is_active', true);

      if (error) throw error;
      return data?.map(item => this.mapDatabaseUserToProfile(item.parent)).filter(Boolean) || [];
    } catch (error) {
      this.handleError(error, 'get child parents');
    }
  }

  async updateParentChildLink(id: string, updates: Partial<ParentChildRelationship>): Promise<ParentChildRelationship> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const sanitized = { ...updates };
    sanitized.updated_at = this.getCurrentTimestamp();

    try {
      const { data, error } = await this.client
        .from('parent_child_relationships')
        .update(sanitized)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'update parent-child link');
    }
  }

  async deleteParentChildLink(id: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('parent_child_relationships')
        .delete()
        .eq('id', id);

      return !error;
    } catch (error) {
      this.handleError(error, 'delete parent-child link');
    }
  }

  // ============================================================================
  // Quiz Operations
  // ============================================================================

  async createQuizResult(quizData: {
    user_id: string;
    score: number;
    correct_answers: number;
    total_questions: number;
  }): Promise<any> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const id = this.generateId();
    const now = this.getCurrentTimestamp();
    
    const quizResult = {
      id,
      user_id: quizData.user_id,
      score: quizData.score,
      correct_answers: quizData.correct_answers,
      total_questions: quizData.total_questions,
      completed_at: now
    };

    try {
      const { data, error } = await this.client
        .from('quiz_results')
        .insert([quizResult])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'create quiz result');
    }
  }

  async getQuizResultsByUserId(userId: string): Promise<any[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      console.log('[SUPABASE-ADAPTER] Querying quiz_results for userId:', userId);
      
      // Use service client for admin operations to bypass RLS
      const client = this.serviceClient || this.client;
      console.log('[SUPABASE-ADAPTER] Using client type:', this.serviceClient ? 'service' : 'anon');
      
      const { data, error } = await client
        .from('quiz_results')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      console.log('[SUPABASE-ADAPTER] Supabase query result - error:', error);
      console.log('[SUPABASE-ADAPTER] Supabase query result - data length:', data?.length || 0);
      console.log('[SUPABASE-ADAPTER] Supabase query result - data:', JSON.stringify(data, null, 2));

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting quiz results by user ID:', error);
      return [];
    }
  }

  async getQuizResultById(id: string): Promise<any | null> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('quiz_results')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      this.handleError(error, 'get quiz result by ID');
    }
  }

  async createQuizAnswer(answerData: {
    quiz_result_id: string;
    question_text: string;
    selected_answer: string;
    correct_answer: string;
    is_correct: boolean;
  }): Promise<any> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const id = this.generateId();
    
    const quizAnswer = {
      id,
      quiz_result_id: answerData.quiz_result_id,
      question_text: answerData.question_text,
      selected_answer: answerData.selected_answer,
      correct_answer: answerData.correct_answer,
      is_correct: answerData.is_correct
    };

    try {
      const { data, error } = await this.client
        .from('quiz_answers')
        .insert([quizAnswer])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'create quiz answer');
    }
  }

  async getQuizAnswersByResultId(quizResultId: string): Promise<any[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      // Use service client for admin operations to bypass RLS
      const client = this.serviceClient || this.client;
      
      const { data, error } = await client
        .from('quiz_answers')
        .select('*')
        .eq('quiz_result_id', quizResultId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting quiz answers by result ID:', error);
      return [];
    }
  }

  async createIncorrectAnswer(incorrectData: {
    user_id: string;
    question_id?: string;
    question_text: string;
    selected_answer: string;
    correct_answer: string;
  }): Promise<any> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const id = this.generateId();
    const now = this.getCurrentTimestamp();
    
    const incorrectAnswer = {
      id,
      user_id: incorrectData.user_id,
      question_id: incorrectData.question_id,
      question_text: incorrectData.question_text,
      selected_answer: incorrectData.selected_answer,
      correct_answer: incorrectData.correct_answer,
      created_at: now
    };

    try {
      const { data, error } = await this.client
        .from('incorrect_answers')
        .insert([incorrectAnswer])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'create incorrect answer');
    }
  }

  async getIncorrectAnswersByUserId(userId: string): Promise<any[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('incorrect_answers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.handleError(error, 'get incorrect answers by user ID');
    }
  }

  async deleteIncorrectAnswer(id: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('incorrect_answers')
        .delete()
        .eq('id', id);

      return !error;
    } catch (error) {
      this.handleError(error, 'delete incorrect answer');
    }
  }

  // ============================================================================
  // Analytics and Reporting
  // ============================================================================

  async getUserQuizStats(userId: string): Promise<{
    totalQuizzes: number;
    averageScore: number;
    bestScore: number;
    totalCorrectAnswers: number;
    totalQuestions: number;
  }> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('quiz_results')
        .select('score, correct_answers, total_questions')
        .eq('user_id', userId);

      if (error) throw error;

      const results = data || [];
      const totalQuizzes = results.length;
      
      if (totalQuizzes === 0) {
        return {
          totalQuizzes: 0,
          averageScore: 0,
          bestScore: 0,
          totalCorrectAnswers: 0,
          totalQuestions: 0
        };
      }

      const totalScore = results.reduce((sum, result) => sum + (result.score || 0), 0);
      const averageScore = totalScore / totalQuizzes;
      const bestScore = Math.max(...results.map(result => result.score || 0));
      const totalCorrectAnswers = results.reduce((sum, result) => sum + (result.correct_answers || 0), 0);
      const totalQuestions = results.reduce((sum, result) => sum + (result.total_questions || 0), 0);

      return {
        totalQuizzes,
        averageScore: Math.round(averageScore * 100) / 100,
        bestScore,
        totalCorrectAnswers,
        totalQuestions
      };
    } catch (error) {
      this.handleError(error, 'get user quiz stats');
    }
  }

  async getRecentQuizResults(limit: number = 10): Promise<any[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('quiz_results')
        .select(`
          *,
          users_enhanced:user_id (
            username,
            full_name
          )
        `)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.handleError(error, 'get recent quiz results');
    }
  }

  async getAdminStats(): Promise<{
    totalQuizAttempts: number;
    averageScore: number;
    usersWithQuizzes: number;
    recentActivity: number;
  }> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      // Get total quiz attempts
      const { count: totalQuizAttempts } = await this.client
        .from('quiz_results')
        .select('*', { count: 'exact', head: true });

      // Get average score
      const { data: scoreData } = await this.client
        .from('quiz_results')
        .select('score');
      
      let averageScore = 0;
      if (scoreData && scoreData.length > 0) {
        const totalScore = scoreData.reduce((sum, item) => sum + (item.score || 0), 0);
        averageScore = Math.round((totalScore / scoreData.length) * 100) / 100;
      }

      // Get users with quizzes
      const { data: distinctUsers } = await this.client
        .from('quiz_results')
        .select('user_id');
      const uniqueUsers = new Set(distinctUsers?.map(item => item.user_id) || []);
      const usersWithQuizzes = uniqueUsers.size;

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentActivity } = await this.client
        .from('quiz_results')
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', sevenDaysAgo.toISOString());

      return {
        totalQuizAttempts: totalQuizAttempts || 0,
        averageScore,
        usersWithQuizzes,
        recentActivity: recentActivity || 0
      };
    } catch (error) {
      this.handleError(error, 'get admin stats');
    }
  }

  // ============================================================================
  // Face Recognition Operations
  // ============================================================================

  async saveFaceData(faceData: Omit<FaceRecognitionData, 'id'>): Promise<FaceRecognitionData> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    const data: FaceRecognitionData = {
      id: this.generateId(),
      ...faceData,
      created_at: faceData.created_at || this.getCurrentTimestamp(),
      updated_at: faceData.updated_at || this.getCurrentTimestamp()
    };

    try {
      const { data: result, error } = await this.client
        .from('face_recognition_data')
        .upsert([data], { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      this.handleError(error, 'save face data');
    }
  }

  async getFaceData(userId: string): Promise<FaceRecognitionData | null> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('face_recognition_data')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      this.handleError(error, 'get face data');
    }
  }

  async updateFaceData(userId: string, faceData: string): Promise<FaceRecognitionData> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('face_recognition_data')
        .update({
          face_encoding: faceData,
          updated_at: this.getCurrentTimestamp()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.handleError(error, 'update face data');
    }
  }

  async deleteFaceData(userId: string): Promise<boolean> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { error } = await this.client
        .from('face_recognition_data')
        .delete()
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      this.handleError(error, 'delete face data');
    }
  }

  // ============================================================================
  // Query Helpers
  // ============================================================================

  async getUsersByRole(role: string): Promise<UserProfile[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      const { data, error } = await this.client
        .from('users_enhanced')
        .select('*')
        .eq('role', role)
        .eq('account_status', 'active');

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.handleError(error, 'get users by role');
    }
  }

  async searchUsers(query: string, role?: string): Promise<UserProfile[]> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      let queryBuilder = this.client
        .from('users_enhanced')
        .select('*')
        .eq('account_status', 'active')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(50);

      if (role) {
        queryBuilder = queryBuilder.eq('role', role);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.handleError(error, 'search users');
    }
  }

  async getUsersWithPagination(offset: number, limit: number, role?: string): Promise<{
    users: UserProfile[];
    total: number;
    hasMore: boolean;
  }> {
    if (!this.client) throw new DatabaseError('Database not connected', 'NO_CONNECTION');

    try {
      let queryBuilder = this.client
        .from('users_enhanced')
        .select('*', { count: 'exact' })
        .eq('account_status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (role) {
        queryBuilder = queryBuilder.eq('role', role);
      }

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      const total = count || 0;
      const users = data || [];
      const hasMore = offset + limit < total;

      return { users, total, hasMore };
    } catch (error) {
      this.handleError(error, 'get users with pagination');
    }
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  async beginTransaction(): Promise<any> {
    // Supabase doesn't support explicit transactions in the same way as SQLite
    // Transactions are handled automatically for single operations
    // For complex transactions, you'd typically use Supabase Edge Functions
    return this.client;
  }

  async commitTransaction(_transaction: any): Promise<void> {
    // No-op for Supabase as transactions are auto-committed
  }

  async rollbackTransaction(_transaction: any): Promise<void> {
    // No-op for Supabase as rollback is handled automatically on errors
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map database user record to UserProfile interface
   */
  private mapDatabaseUserToProfile(data: any): UserProfile {
    return {
      id: data.id,
      email: data.email,
      username: data.username,
      role: data.role,
      account_status: data.account_status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      login_attempts: data.login_attempts || 0,
      email_verified: data.email_verified || false,
      phone: data.phone,
      avatar_url: data.avatar_url,
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: data.full_name,
      date_of_birth: data.date_of_birth,
      grade_level: data.grade_level,
      subject_specialization: data.subject_specialization,
      bio: data.bio,
      preferences: data.preferences || {}
    };
  }

  // ============================================================================
  // Quiz Operations
  // ============================================================================

  async getRandomQuestions(count: number): Promise<any[]> {
    if (!this.serviceClient) {
      throw new DatabaseError('Service role client required for questions', 'NO_SERVICE_CLIENT');
    }

    try {
      const { data, error } = await this.serviceClient
        .from('questions')
        .select('id, question_text, correct_word, option_1, option_2, option_3, option_4, correct_option')
        .limit(count * 2); // Get more than needed for randomization

      if (error) throw error;

      // Shuffle and select the requested count
      const shuffled = (data || []).sort(() => 0.5 - Math.random());
      const selectedQuestions = shuffled.slice(0, count);

      // Transform to match expected format
      return selectedQuestions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        options: [q.option_1, q.option_2, q.option_3, q.option_4],
        correct_answer: q.correct_word
      }));
    } catch (error) {
      this.handleError(error, 'get random questions');
    }
  }

  // ============================================================================
  // Custom Authentication (for users_enhanced table)
  // ============================================================================

  /**
   * Authenticate user with email/password using users_enhanced table
   */
  async authenticateWithCustomAuth(email: string, password: string): Promise<{ user: any; error: any }> {
    try {
      console.log('Authenticating user with email:', email);
      
      // Get user by email from users_enhanced table
      const { data: userData, error: userError } = await this.client!
        .from('users_enhanced')
        .select('*')
        .eq('email', email)
        .eq('account_status', 'active')
        .single();

      console.log('User query result:', { userData: userData ? 'found' : 'not found', error: userError });

      if (userError || !userData) {
        console.log('User not found or error:', userError);
        return { user: null, error: { message: 'Invalid login credentials' } };
      }

      // Verify password using bcrypt
      const bcrypt = require('bcrypt');
      console.log('Comparing password with hash...');
      const isValidPassword = await bcrypt.compare(password, userData.password_hash);
      console.log('Password validation result:', isValidPassword);

      if (!isValidPassword) {
        console.log('Password validation failed');
        return { user: null, error: { message: 'Invalid login credentials' } };
      }

      // Update last login
      await this.client!
        .from('users_enhanced')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

      // Map to UserProfile format
      const userProfile = this.mapDatabaseUserToProfile(userData);

      return { 
        user: { profile: userProfile }, 
        error: null 
      };
    } catch (error) {
      console.error('Error in authenticateWithCustomAuth:', error);
      return { user: null, error: { message: 'Authentication failed' } };
    }
  }

  // ============================================================================
  // Supabase Auth Integration
  // ============================================================================

  /**
   * Sign up a new user with Supabase Auth
   */
  async signUpWithSupabase(email: string, password: string, userData: Partial<UserProfile>): Promise<{ user: any; error: any }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: userData.username,
            role: userData.role || 'student',
            full_name: userData.full_name,
            date_of_birth: userData.date_of_birth,
            grade_level: userData.grade_level
          }
        }
      });

      if (error) {
        console.error('Supabase sign up error:', error);
        return { user: null, error };
      }

      // Create user profile in our users_enhanced table
      if (data.user) {
        const userProfile: Partial<UserProfile> = {
          id: data.user.id,
          email: data.user.email!,
          username: userData.username!,
          role: userData.role || 'student',
          account_status: 'active',
          full_name: userData.full_name,
          date_of_birth: userData.date_of_birth,
          grade_level: userData.grade_level,
          email_verified: data.user.email_confirmed_at ? true : false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          login_attempts: 0,
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
              profile_visibility: 'private' as const,
              show_progress: true,
              allow_messages: true
            }
          }
        };

        const createdUser = await this.createUser(userProfile);
        return { user: { ...data.user, profile: createdUser }, error: null };
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error in signUpWithSupabase:', error);
      return { user: null, error };
    }
  }

  /**
   * Sign in a user with Supabase Auth
   */
  async signInWithSupabase(email: string, password: string): Promise<{ user: any; session: any; error: any }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Supabase sign in error:', error);
        return { user: null, session: null, error };
      }

      // Get user profile from our database
      let userProfile = null;
      if (data.user) {
        userProfile = await this.getUserBySupabaseId(data.user.id);
        
        // If no profile exists, create one (for existing Supabase users)
        if (!userProfile) {
          const newProfile: Partial<UserProfile> = {
            id: data.user.id,
            email: data.user.email!,
            username: data.user.email!.split('@')[0], // Use email prefix as username
            role: 'student', // Default role
            account_status: 'active',
            email_verified: data.user.email_confirmed_at ? true : false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            login_attempts: 0,
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
                profile_visibility: 'private' as const,
                show_progress: true,
                allow_messages: true
              }
            }
          };
          userProfile = await this.createUser(newProfile);
        }
      }

      return { 
        user: { ...data.user, profile: userProfile }, 
        session: data.session, 
        error: null 
      };
    } catch (error) {
      console.error('Error in signInWithSupabase:', error);
      return { user: null, session: null, error };
    }
  }

  /**
   * Sign out user from Supabase Auth
   */
  async signOutFromSupabase(): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      return { error };
    } catch (error) {
      console.error('Error in signOutFromSupabase:', error);
      return { error };
    }
  }

  /**
   * Get current Supabase user
   */
  async getCurrentSupabaseUser(): Promise<{ user: any; error: any }> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error) {
        return { user: null, error };
      }

      // Get user profile from our database
      let userProfile = null;
      if (user) {
        userProfile = await this.getUserBySupabaseId(user.id);
      }

      return { 
        user: user ? { ...user, profile: userProfile } : null, 
        error: null 
      };
    } catch (error) {
      console.error('Error getting current Supabase user:', error);
      return { user: null, error };
    }
  }

  /**
   * Refresh Supabase session
   */
  async refreshSupabaseSession(): Promise<{ session: any; error: any }> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      return { session: data.session, error };
    } catch (error) {
      console.error('Error refreshing Supabase session:', error);
      return { session: null, error };
    }
  }

  /**
   * Get user by Supabase ID
   */
  async getUserBySupabaseId(supabaseUserId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('users_enhanced')
        .select('*')
        .eq('supabase_user_id', supabaseUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error getting user by Supabase ID:', error);
        return null;
      }

      return this.mapDatabaseUserToProfile(data);
    } catch (error) {
      console.error('Error getting user by Supabase ID:', error);
      return null;
    }
  }

  /**
   * Update user's email verification status
   */
  async updateEmailVerificationStatus(userId: number, verified: boolean): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users_enhanced')
        .update({ 
          email_verified: verified,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating email verification status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating email verification status:', error);
      return false;
    }
  }

  /**
   * Send password reset email through Supabase
   */
  async sendPasswordResetEmail(email: string): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
      });
      
      return { error };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { error };
    }
  }

  /**
   * Update password through Supabase Auth
   */
  async updatePasswordWithSupabase(newPassword: string): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      });
      
      return { error };
    } catch (error) {
      console.error('Error updating password with Supabase:', error);
      return { error };
    }
  }
}