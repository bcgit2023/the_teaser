import { NextRequest, NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/database/database-manager'
import { JWTManager } from '@/lib/middleware/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get database adapter
    const dbManager = DatabaseManager.getInstance()
    await dbManager.initializeIfNeeded()
    const adapter = dbManager.getAdapter()

    // Get all users (excluding admins) and their quiz progress
    const usersResult = await adapter.getUsersWithPagination(0, 1000)
    const users = usersResult.users.filter(user => user.role !== 'admin')

    // For now, return mock data since quiz functionality isn't fully implemented
    const studentProgress = users.map((user, index) => ({
      id: user.id,
      username: user.username,
      full_name: user.full_name || user.username,
      email: user.email,
      total_quizzes: Math.floor(Math.random() * 10), // Mock data
      average_score: Math.floor(Math.random() * 100), // Mock data
      last_activity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last week
      progress_percentage: Math.floor(Math.random() * 100) // Mock data
    }))

    // Format the data for the frontend
    const formattedProgress = studentProgress.map(student => ({
      id: student.id,
      name: student.full_name || student.username,
      email: student.email,
      progress: student.progress_percentage || 0,
      totalQuizzes: student.total_quizzes || 0,
      averageScore: Math.round(student.average_score || 0),
      lastActivity: student.last_activity || null,
      status: student.total_quizzes > 0 ? 'active' : 'inactive'
    }))

    return NextResponse.json(formattedProgress)
  } catch (error) {
    console.error('Error fetching student progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch student progress' },
      { status: 500 }
    )
  }
}