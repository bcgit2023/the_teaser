import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gffbcefjrnizipnflqjw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZmJjZWZqcm5pemlwbmZscWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU3MzE2NDQsImV4cCI6MjA0MTMwNzY0NH0.iZ2KPOZGzn6-S1Xqk-OFL-EG1e1y9-GMK-gSRzfOMz0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)