import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gffbcefjrnizipnflqjw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZmJjZWZqcm5pemlwbmZscWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU3MzE2NDQsImV4cCI6MjA0MTMwNzY0NH0.iZ2KPOZGzn6-S1Xqk-OFL-EG1e1y9-GMK-gSRzfOMz0'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: NextRequest) {
  try {
    console.log('=== TEST AUTH ENDPOINT ===')
    
    const cookieStore = cookies()
    const localToken = cookieStore.get('auth-token')?.value
    const supabaseToken = cookieStore.get('sb-gffbcefjrnizipnflqjw-auth-token.0')?.value
    
    // Check for additional cookie parts
    const supabaseToken1 = cookieStore.get('sb-gffbcefjrnizipnflqjw-auth-token.1')?.value
    const supabaseToken2 = cookieStore.get('sb-gffbcefjrnizipnflqjw-auth-token.2')?.value

    console.log('Local token present:', !!localToken)
    console.log('Supabase token present:', !!supabaseToken)
    console.log('Supabase token.1 present:', !!supabaseToken1)
    console.log('Supabase token.2 present:', !!supabaseToken2)
    
    // Combine all Supabase token parts
    let fullSupabaseToken = supabaseToken || ''
    if (supabaseToken1) {
      fullSupabaseToken += supabaseToken1
    }
    if (supabaseToken2) {
      fullSupabaseToken += supabaseToken2
    }
    
    if (fullSupabaseToken) {
      console.log('Combined Supabase token length:', fullSupabaseToken.length)
      console.log('Combined Supabase token first 100 chars:', fullSupabaseToken.substring(0, 100))
      
      // Try to parse the token
      try {
        console.log('Attempting to parse Supabase token...')
        let tokenData
        
        try {
          tokenData = JSON.parse(fullSupabaseToken)
          console.log('Direct JSON parse successful')
        } catch (parseError) {
          console.log('Direct JSON parse failed, trying base64...')
          // Check if token has base64- prefix and remove it
          let base64Token = fullSupabaseToken
          if (fullSupabaseToken.startsWith('base64-')) {
            base64Token = fullSupabaseToken.substring(7) // Remove 'base64-' prefix
            console.log('Removed base64- prefix')
          }
          
          console.log('Base64 token length after prefix removal:', base64Token.length)
          console.log('Base64 token first 50 chars:', base64Token.substring(0, 50))
          
          // Try URL decoding first in case it's URL encoded
          try {
            const urlDecoded = decodeURIComponent(base64Token)
            console.log('URL decoded length:', urlDecoded.length)
            if (urlDecoded !== base64Token) {
              base64Token = urlDecoded
              console.log('URL decoding changed the token')
            }
          } catch (urlError) {
            console.log('URL decoding failed, continuing with original token')
          }
          
          // Clean up the base64 string - remove any invalid characters
          let cleanBase64 = base64Token.replace(/[^A-Za-z0-9+/=]/g, '')
          console.log('Cleaned base64 length:', cleanBase64.length)
          
          // Add padding if necessary (base64 strings must be multiple of 4)
          while (cleanBase64.length % 4 !== 0) {
            cleanBase64 += '='
          }
          console.log('Padded base64 length:', cleanBase64.length)
          
          try {
            // Use Buffer instead of atob for better compatibility
            const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8')
            console.log('Base64 decode successful, decoded length:', decoded.length)
            tokenData = JSON.parse(decoded)
            console.log('JSON parse after base64 decode successful')
          } catch (decodeError) {
            console.log('Base64 decode error:', (decodeError as Error).message)
            throw decodeError
          }
        }
        
        console.log('Token data keys:', Object.keys(tokenData))
        
        if (tokenData.access_token) {
          console.log('Access token found, testing with Supabase...')
          const { data: { user }, error } = await supabase.auth.getUser(tokenData.access_token)
          
          if (user && !error) {
            console.log('Supabase user authenticated:', user.email)
            return NextResponse.json({
              success: true,
              user: {
                id: user.id,
                email: user.email
              },
              tokenParsed: true
            })
          } else {
            console.log('Supabase user verification failed:', error)
            return NextResponse.json({
              success: false,
              error: 'User verification failed',
              supabaseError: error
            })
          }
        } else {
          console.log('No access token found in parsed data')
          return NextResponse.json({
            success: false,
            error: 'No access token in parsed data',
            tokenKeys: Object.keys(tokenData)
          })
        }
      } catch (tokenError) {
        console.log('Token parsing failed:', (tokenError as Error).message)
        return NextResponse.json({
          success: false,
          error: 'Token parsing failed',
          tokenError: (tokenError as Error).message
        })
      }
    } else {
      console.log('No Supabase token found')
      return NextResponse.json({
        success: false,
        error: 'No Supabase token found'
      })
    }
  } catch (error) {
    console.error('Test auth error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }, { status: 500 })
  }
}