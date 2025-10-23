const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkUsers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔍 Checking users in the database...');
    
    const { data: users, error } = await supabase
      .from('users_enhanced')
      .select('id, email, username, role, account_status, password_hash, created_at, last_login')
      .order('created_at');

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log(`✅ Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.account_status}`);
      console.log(`   Password Hash: ${user.password_hash ? user.password_hash.substring(0, 20) + '...' : 'NULL'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Last Login: ${user.last_login || 'Never'}`);
    });

  } catch (error) {
    console.error('❌ Exception:', error);
  }
}

checkUsers()