const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUsers() {
  try {
    console.log('🔧 Creating test users...');

    // Hash passwords
    const adminPasswordHash = await bcrypt.hash('admin', 12);
    const userPasswordHash = await bcrypt.hash('user', 12);

    // Create admin user
    const adminUser = {
      email: 'admin@example.com',
      username: 'admin',
      role: 'admin',
      account_status: 'active',
      password_hash: adminPasswordHash,
      email_verified: true,
      first_name: 'Admin',
      last_name: 'User',
      full_name: 'Admin User'
    };

    // Create regular user
    const regularUser = {
      email: 'user@example.com',
      username: 'user',
      role: 'student',
      account_status: 'active',
      password_hash: userPasswordHash,
      email_verified: true,
      first_name: 'Test',
      last_name: 'User',
      full_name: 'Test User'
    };

    // Check if users already exist
    const { data: existingAdmin } = await supabase
      .from('users_enhanced')
      .select('id, username, email')
      .eq('username', 'admin')
      .single();

    const { data: existingUser } = await supabase
      .from('users_enhanced')
      .select('id, username, email')
      .eq('username', 'user')
      .single();

    // Insert admin user if doesn't exist
    if (!existingAdmin) {
      const { data: adminResult, error: adminError } = await supabase
        .from('users_enhanced')
        .insert([adminUser])
        .select();

      if (adminError) {
        console.error('❌ Error creating admin user:', adminError);
      } else {
        console.log('✅ Admin user created:', adminResult[0]);
      }
    } else {
      console.log('ℹ️ Admin user already exists:', existingAdmin);
      
      // Update password hash if needed
      const { error: updateError } = await supabase
        .from('users_enhanced')
        .update({ password_hash: adminPasswordHash })
        .eq('username', 'admin');
        
      if (updateError) {
        console.error('❌ Error updating admin password:', updateError);
      } else {
        console.log('✅ Admin password updated');
      }
    }

    // Insert regular user if doesn't exist
    if (!existingUser) {
      const { data: userResult, error: userError } = await supabase
        .from('users_enhanced')
        .insert([regularUser])
        .select();

      if (userError) {
        console.error('❌ Error creating regular user:', userError);
      } else {
        console.log('✅ Regular user created:', userResult[0]);
      }
    } else {
      console.log('ℹ️ Regular user already exists:', existingUser);
      
      // Update password hash if needed
      const { error: updateError } = await supabase
        .from('users_enhanced')
        .update({ password_hash: userPasswordHash })
        .eq('username', 'user');
        
      if (updateError) {
        console.error('❌ Error updating user password:', updateError);
      } else {
        console.log('✅ User password updated');
      }
    }

    // Verify users exist
    const { data: allUsers, error: fetchError } = await supabase
      .from('users_enhanced')
      .select('id, username, email, role, account_status')
      .in('username', ['admin', 'user']);

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
    } else {
      console.log('📋 Current test users:');
      allUsers.forEach(user => {
        console.log(`  - ${user.username} (${user.email}) - ${user.role} - ${user.account_status}`);
      });
    }

    console.log('✅ Test users setup complete!');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  }
}

createTestUsers();