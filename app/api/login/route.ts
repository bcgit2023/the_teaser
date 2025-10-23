import { NextRequest, NextResponse } from 'next/server';
import { getAuthInstance } from '@/lib/auth-instance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Input validation
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (!username && !email) {
      return NextResponse.json(
        { error: 'Username or email is required' },
        { status: 400 }
      );
    }

    // Get client information for security logging
    const ip_address = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const user_agent = request.headers.get('user-agent') || 'unknown';

    // Use Supabase authentication
    console.log('🔐 Attempting Supabase authentication...');
    const authService = await getAuthInstance();
    console.log('✅ Auth service instance obtained');
    
    const loginResult = await authService.login({
      username,
      email,
      password,
      ip_address,
      user_agent
    });
    
    console.log('🔍 Auth result:', loginResult);

    if (loginResult.success) {
      // Create response with user data
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: {
          id: loginResult.user?.id,
          username: loginResult.user?.username,
          email: loginResult.user?.email,
          role: loginResult.user?.role,
          full_name: loginResult.user?.full_name
        },
        userRole: loginResult.user?.role
      });

      // Set authentication cookies
      if (loginResult.token) {
        response.cookies.set('auth-token', loginResult.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 // 24 hours
        });
      }

      if (loginResult.refreshToken) {
        response.cookies.set('refresh-token', loginResult.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 // 7 days
        });
      }

      return response;
    }

    // Handle specific error types from auth
    if (loginResult.error === 'Account locked') {
      return NextResponse.json(
        { error: 'Account is temporarily locked due to multiple failed login attempts' },
        { status: 423 }
      );
    }
    
    if (loginResult.error === 'Rate limit exceeded') {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Default error response
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
