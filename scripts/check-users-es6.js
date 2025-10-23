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

async function checkUsers() {
  try {
    console.log('Checking users in users_enhanced table...');
    
    const { data, error } = await supabase
      .from('users_enhanced')
      .select('id, email, username, role, account_status, created_at');
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log('Found users:', data);
    console.log('Total users:', data?.length || 0);
    
    // Check specifically for test@example.com
    const testUser = data?.find(user => user.email === 'test@example.com');
    if (testUser) {
      console.log('Test user found:', testUser);
    } else {
      console.log('Test user NOT found');
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

checkUsers();