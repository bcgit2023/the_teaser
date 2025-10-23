import { NextResponse } from 'next/server';
import { getAuthInstance } from '@/lib/auth-instance';

export async function GET(req: Request) {
  try {
    // Get the AuthIntegration instance
    const authService = await getAuthInstance();

    // Get token from cookies
    const cookieHeader = req.headers.get('cookie');
    const authToken = cookieHeader
      ?.split(';')
      ?.find(c => c.trim().startsWith('auth-token='))
      ?.split('=')[1];

    if (!authToken) {
      return NextResponse.json(
        { valid: false, error: 'No authentication token found' },
        { status: 401 }
      );
    }

    // Validate session using AuthIntegration service
    const sessionResult = await authService.validateSession(authToken);

    if (!sessionResult.valid) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Return user information if session is valid
    return NextResponse.json({
      valid: true,
      user: sessionResult.user,
      session: sessionResult.session
    });

  } catch (error) {
    console.error('Session validation error:', error);
    
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Get the AuthIntegration instance
    const authService = await getAuthInstance();

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No token provided' },
        { status: 400 }
      );
    }

    // Validate session using AuthIntegration service
    const sessionResult = await authService.validateSession(token);

    if (!sessionResult.valid) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Return user information if session is valid
    return NextResponse.json({
      valid: true,
      user: sessionResult.user,
      session: sessionResult.session
    });

  } catch (error) {
    console.error('Session validation error:', error);
    
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}