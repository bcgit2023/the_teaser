const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixTestUsers() {
  console.log('🔧 Fixing test user accounts...\n');
  
  try {
    // 1. Update admin user password to "admin"
    console.log('1. Updating admin user password...');
    const adminPasswordHash = await bcrypt.hash('admin', 10);
    
    const { data: adminUpdate, error: adminError } = await supabase
      .from('users_enhanced')
      .update({ 
        password_hash: adminPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('username', 'admin')
      .select();
    
    if (adminError) {
      console.error('❌ Error updating admin password:', adminError);
    } else {
      console.log('✅ Admin password updated to "admin"');
    }
    
    // 2. Check if user with username "user" exists
    console.log('\n2. Checking for user with username "user"...');
    const { data: existingUser, error: checkError } = await supabase
      .from('users_enhanced')
      .select('*')
      .eq('username', 'user')
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking for user:', checkError);
      return;
    }
    
    if (existingUser) {
      console.log('✅ User with username "user" already exists, updating password...');
      const userPasswordHash = await bcrypt.hash('user', 10);
      
      const { data: userUpdate, error: userUpdateError } = await supabase
        .from('users_enhanced')
        .update({ 
          password_hash: userPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('username', 'user')
        .select();
      
      if (userUpdateError) {
        console.error('❌ Error updating user password:', userUpdateError);
      } else {
        console.log('✅ User password updated to "user"');
      }
    } else {
      console.log('⚠️  User with username "user" does not exist, creating...');
      
      // 3. Create new user with username "user", password "user"
      const userPasswordHash = await bcrypt.hash('user', 10);
      
      const { data: newUser, error: createError } = await supabase
        .from('users_enhanced')
        .insert({
          username: 'user',
          email: 'user@example.com',
          password_hash: userPasswordHash,
          role: 'student',
          account_status: 'active',
          email_verified: true,
          full_name: 'Test User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (createError) {
        console.error('❌ Error creating user:', createError);
      } else {
        console.log('✅ New user created with username "user", password "user"');
      }
    }
    
    // 4. Verify the changes
    console.log('\n🔍 Verifying changes...');
    
    const { data: allUsers, error: verifyError } = await supabase
      .from('users_enhanced')
      .select('username, email, role, account_status')
      .in('username', ['admin', 'user']);
    
    if (verifyError) {
      console.error('❌ Error verifying users:', verifyError);
    } else {
      console.log('📊 Current test users:');
      allUsers.forEach(user => {
        console.log(`   - ${user.username} (${user.email}) - Role: ${user.role}, Status: ${user.account_status}`);
      });
    }
    
    // 5. Test the passwords
    console.log('\n🔐 Testing passwords...');
    
    // Test admin password
    const { data: adminUser, error: adminFetchError } = await supabase
      .from('users_enhanced')
      .select('password_hash')
      .eq('username', 'admin')
      .single();
    
    if (!adminFetchError && adminUser) {
      const adminPasswordValid = await bcrypt.compare('admin', adminUser.password_hash);
      console.log(`   Admin password "admin": ${adminPasswordValid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
    // Test user password
    const { data: testUser, error: userFetchError } = await supabase
      .from('users_enhanced')
      .select('password_hash')
      .eq('username', 'user')
      .single();
    
    if (!userFetchError && testUser) {
      const userPasswordValid = await bcrypt.compare('user', testUser.password_hash);
      console.log(`   User password "user": ${userPasswordValid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
    console.log('\n🎉 Test user accounts are now ready!');
    console.log('   - Login with: admin/admin (admin role)');
    console.log('   - Login with: user/user (student role)');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixTestUsers()