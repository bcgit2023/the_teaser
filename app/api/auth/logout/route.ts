import { NextResponse } from 'next/server';
import { getAuthInstance } from '@/lib/auth-instance';

export async function POST(req: Request) {
  try {
    // Get the AuthIntegration instance
    const authService = await getAuthInstance();

    // Get token from cookies
    const cookieHeader = req.headers.get('cookie');
    const authToken = cookieHeader
      ?.split(';')
      ?.find(c => c.trim().startsWith('auth-token='))
      ?.split('=')[1];

    if (authToken) {
      // Logout using AuthIntegration service
      await authService.logout(authToken);
    }

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear authentication cookies
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    response.cookies.set('refresh-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Logout failed' },
      { status: 500 }
    );
  }
}