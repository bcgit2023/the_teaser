/**
 * Session Management API Route
 * 
 * Provides endpoints for session validation, refresh, and logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/middleware/auth-middleware';

// ============================================================================
// GET - Validate Session
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Extract session token from cookie or header
    const sessionToken = request.cookies.get('session-token')?.value ||
                        request.headers.get('authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return NextResponse.json(
        { valid: false, error: 'No session token provided' },
        { status: 401 }
      );
    }

    // Validate session
    const sessionData = await SessionManager.validateSession(sessionToken);
    
    if (!sessionData) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: sessionData.userId,
        username: sessionData.username,
        email: sessionData.email,
        role: sessionData.role
      },
      sessionId: sessionData.sessionId
    });

  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Session validation failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Refresh Session
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token required' },
        { status: 400 }
      );
    }

    // Refresh session
    const refreshResult = await SessionManager.refreshSession(refreshToken);
    
    if (!refreshResult) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Set new session cookie
    const response = NextResponse.json({
      success: true,
      tokens: {
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken
      }
    });

    // Set secure HTTP-only cookie
    response.cookies.set('session-token', refreshResult.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Session refresh failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Logout / Invalidate Session
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session-token')?.value ||
                        request.headers.get('authorization')?.replace('Bearer ', '');

    if (sessionToken) {
      // Invalidate session
      await SessionManager.invalidateSession(sessionToken);
    }

    // Clear session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Session invalidated successfully'
    });

    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Session logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Session logout failed' },
      { status: 500 }
    );
  }
}