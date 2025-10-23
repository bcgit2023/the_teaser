import { NextRequest, NextResponse } from 'next/server';
import { getDbAdapter } from '@/lib/database/database-manager';
import jwt from 'jsonwebtoken';

// Verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return { error: 'No authentication token', status: 401 };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key') as any;
    if (decoded.role !== 'admin') {
      return { error: 'Admin access required', status: 403 };
    }

    return { success: true, userId: decoded.userId };
  } catch (error) {
    return { error: 'Invalid authentication token', status: 401 };
  }
}

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const dbAdapter = await getDbAdapter();
    
    // Use pagination for better performance
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const users = await dbAdapter.getUsersWithPagination(page, limit);

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { username, password, role, email, full_name } = body;

    // Validate required fields
    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['student', 'admin', 'parent'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be student, admin, or parent' },
        { status: 400 }
      );
    }

    const dbAdapter = await getDbAdapter();

    // Check if username already exists
    const existingUser = await dbAdapter.getUserByUsername(username);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmailUser = await dbAdapter.getUserByEmail(email);
      if (existingEmailUser) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }

    // Create new user using Supabase Auth
    const userEmail = email || `${username}@futurelearner.com`;
    const supabaseAdapter = dbAdapter as any; // Cast to access Supabase-specific methods
    const { user: authUser, error: authError } = await supabaseAdapter.signUpWithSupabase(
      userEmail,
      password,
      {
        username,
        role: role as 'student' | 'admin' | 'parent',
        full_name: full_name || undefined,
        email: userEmail
      }
    );

    if (authError) {
      return NextResponse.json(
        { error: `Failed to create user: ${authError.message}` },
        { status: 400 }
      );
    }

    const newUser = authUser.profile;

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        email: newUser.email,
        full_name: newUser.full_name,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// PUT - Update user (admin only)
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { id, username, role, email, full_name, password } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const dbAdapter = await getDbAdapter();

    // Check if user exists
    const existingUser = await dbAdapter.getUserById(id);

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate role if provided
    if (role && !['student', 'admin', 'parent'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be student, admin, or parent' },
        { status: 400 }
      );
    }

    // Check if new username already exists (excluding current user)
    if (username && username !== existingUser.username) {
      const usernameExists = await dbAdapter.getUserByUsername(username);
      if (usernameExists && usernameExists.id !== id) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
    }

    // Check if new email already exists (excluding current user)
    if (email && email !== existingUser.email) {
      const emailExists = await dbAdapter.getUserByEmail(email);
      if (emailExists && emailExists.id !== id) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (role !== undefined) updateData.role = role;
    if (email !== undefined) updateData.email = email;
    if (full_name !== undefined) updateData.full_name = full_name;

    // Handle password update separately if provided
    if (password && password.trim()) {
      await dbAdapter.updatePassword(id, password);
    }

    // Update user data
    const updatedUser = await dbAdapter.updateUser(id, updateData);

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        created_at: updatedUser.created_at
      }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const dbAdapter = await getDbAdapter();

    // Check if user exists
    const existingUser = await dbAdapter.getUserById(userId);

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user (this will cascade delete related records)
    await dbAdapter.deleteUser(userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}