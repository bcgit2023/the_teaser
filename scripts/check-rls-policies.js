import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSPolicies() {
  try {
    console.log('Checking table permissions...');
    
    // Check table permissions using raw SQL
    const { data: permissions, error: permError } = await supabase
      .rpc('exec_sql', { 
        sql: `SELECT grantee, table_name, privilege_type 
              FROM information_schema.role_table_grants 
              WHERE table_schema = 'public' 
              AND table_name = 'users_enhanced' 
              AND grantee IN ('anon', 'authenticated')
              ORDER BY table_name, grantee;`
      });
    
    if (permError) {
      console.error('Error checking permissions:', permError);
    } else {
      console.log('Table permissions:', permissions);
    }
    
    // Test query with anon key
    console.log('\nTesting query with anon key...');
    const anonSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: anonData, error: anonError } = await anonSupabase
      .from('users_enhanced')
      .select('id, email, role')
      .eq('email', 'test@example.com')
      .single();
    
    if (anonError) {
      console.error('Anon query error:', anonError);
    } else {
      console.log('Anon query result:', anonData);
    }
    
    // Test query with service role key (should work)
    console.log('\nTesting query with service role key...');
    const { data: serviceData, error: serviceError } = await supabase
      .from('users_enhanced')
      .select('id, email, role, password_hash')
      .eq('email', 'test@example.com')
      .single();
    
    if (serviceError) {
      console.error('Service role query error:', serviceError);
    } else {
      console.log('Service role query result:', {
        id: serviceData.id,
        email: serviceData.email,
        role: serviceData.role,
        hasPassword: !!serviceData.password_hash
      });
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

checkRLSPolicies();