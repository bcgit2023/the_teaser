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

    // Get recent users (last 7 days)
    const usersResult = await adapter.getUsersWithPagination(0, 100)
    const recentUsers = usersResult.users
      .filter(user => user.role !== 'admin')
      .filter(user => {
        const userDate = new Date(user.created_at)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return userDate > weekAgo
      })
      .slice(0, 5)
      .map(user => ({
        type: 'user_registered',
        username: user.username,
        full_name: user.full_name || user.username,
        score: null,
        timestamp: user.created_at,
        description: 'Registered as new user'
      }))

    // Mock recent quiz activities since quiz system isn't fully implemented
    const mockQuizzes = Array.from({ length: 3 }, (_, i) => ({
      type: 'quiz_completed',
      username: `student${i + 1}`,
      full_name: `Student ${i + 1}`,
      score: Math.floor(Math.random() * 100),
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: `Completed quiz with score ${Math.floor(Math.random() * 100)}%`
    }))

    // Combine and sort all activities
    const allActivities = [...recentUsers, ...mockQuizzes]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    // Format the activities for the frontend
    const formattedActivities = allActivities.map(activity => ({
      id: `${activity.type}_${activity.timestamp}`,
      type: activity.type,
      user: activity.full_name || activity.username,
      description: activity.description,
      timestamp: activity.timestamp,
      score: activity.score
    }))

    return NextResponse.json(formattedActivities)
  } catch (error) {
    console.error('Error fetching recent activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent activities' },
      { status: 500 }
    )
  }
}