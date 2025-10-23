import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    
    console.log('All cookies:', allCookies)
    
    // Check for specific cookies
    const authToken = cookieStore.get('auth-token')
    const supabaseToken = cookieStore.get('sb-gffbcefjrnizipnflqjw-auth-token.0')
    
    console.log('Auth token:', authToken)
    console.log('Supabase token:', supabaseToken)
    
    return NextResponse.json({
      allCookies: allCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value.substring(0, 50) + '...',
        hasValue: !!cookie.value
      })),
      authToken: authToken ? {
        name: authToken.name,
        hasValue: !!authToken.value,
        valuePreview: authToken.value.substring(0, 50) + '...'
      } : null,
      supabaseToken: supabaseToken ? {
        name: supabaseToken.name,
        hasValue: !!supabaseToken.value,
        valuePreview: supabaseToken.value.substring(0, 50) + '...'
      } : null
    })
  } catch (error) {
    console.error('Cookie debug error:', error)
    return NextResponse.json({ error: 'Failed to debug cookies' }, { status: 500 })
  }
}