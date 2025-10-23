const fs = require('fs');
const path = require('path');

/**
 * Migration Status Checker
 * Shows the current status of the SQLite to Supabase migration
 */

function checkMigrationStatus() {
  console.log('🔍 SUPABASE MIGRATION STATUS CHECK');
  console.log('=' .repeat(50));
  
  const status = {
    stage1_completed: false,
    supabase_connected: false,
    schema_created: false,
    scripts_ready: false,
    env_configured: false,
    ready_to_migrate: false
  };

  // Check 1: Environment Configuration
  console.log('\n📋 Environment Configuration:');
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      const hasSupabaseUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL=');
      const hasAnonKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=');
      const hasServiceKey = envContent.includes('SUPABASE_SERVICE_ROLE_KEY=');
      const hasDatabaseType = envContent.includes('DATABASE_TYPE=');
      
      console.log(`   ✅ .env file exists`);
      console.log(`   ${hasSupabaseUrl ? '✅' : '❌'} Supabase URL configured`);
      console.log(`   ${hasAnonKey ? '✅' : '❌'} Anon key configured`);
      console.log(`   ${hasServiceKey ? '✅' : '❌'} Service role key configured`);
      console.log(`   ${hasDatabaseType ? '✅' : '❌'} DATABASE_TYPE variable added`);
      
      status.env_configured = hasSupabaseUrl && hasAnonKey && hasServiceKey && hasDatabaseType;
    } else {
      console.log('   ❌ .env file not found');
    }
  } catch (error) {
    console.log(`   ❌ Error reading .env: ${error.message}`);
  }

  // Check 2: Migration Scripts
  console.log('\n📁 Migration Scripts:');
  const scripts = [
    'test-supabase-connection.js',
    'create-supabase-schema.sql',
    'export-sqlite-data.js',
    'import-to-supabase.js',
    'migrate-sqlite-to-supabase.js'
  ];
  
  let scriptsReady = 0;
  scripts.forEach(script => {
    const scriptPath = path.join(__dirname, script);
    const exists = fs.existsSync(scriptPath);
    console.log(`   ${exists ? '✅' : '❌'} ${script}`);
    if (exists) scriptsReady++;
  });
  
  status.scripts_ready = scriptsReady === scripts.length;

  // Check 3: Supabase Schema Status
  console.log('\n🗄️  Supabase Schema:');
  const schemaFile = path.join(__dirname, 'create-supabase-schema.sql');
  if (fs.existsSync(schemaFile)) {
    console.log('   ✅ Schema creation script exists');
    console.log('   ℹ️  Run migration to create tables in Supabase');
    status.schema_created = true;
  } else {
    console.log('   ❌ Schema creation script missing');
  }

  // Check 4: SQLite Databases
  console.log('\n💾 SQLite Databases:');
  const sqliteDbs = ['user.db', 'parents.db', 'quiz.db'];
  let dbsFound = 0;
  
  sqliteDbs.forEach(db => {
    const dbPath = path.join(process.cwd(), db);
    const exists = fs.existsSync(dbPath);
    console.log(`   ${exists ? '✅' : '⚠️ '} ${db} ${exists ? 'found' : 'not found'}`);
    if (exists) dbsFound++;
  });
  
  if (dbsFound === 0) {
    console.log('   ℹ️  No SQLite databases found - migration will create empty Supabase schema');
  }

  // Check 5: Previous Migration Data
  console.log('\n📊 Previous Migration Data:');
  const migrationDataDir = path.join(process.cwd(), 'migration-data');
  if (fs.existsSync(migrationDataDir)) {
    const files = fs.readdirSync(migrationDataDir);
    console.log(`   ✅ Migration data directory exists (${files.length} files)`);
    
    if (files.includes('migration-summary.json')) {
      try {
        const summary = JSON.parse(fs.readFileSync(
          path.join(migrationDataDir, 'migration-summary.json'), 'utf8'
        ));
        console.log(`   📋 Last migration: ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   📅 Date: ${new Date(summary.endTime).toLocaleString()}`);
        console.log(`   📊 Records: ${summary.totalRecordsImported} imported`);
      } catch (error) {
        console.log('   ⚠️  Could not read migration summary');
      }
    }
  } else {
    console.log('   ℹ️  No previous migration data found');
  }

  // Overall Status
  status.stage1_completed = status.env_configured && status.scripts_ready && status.schema_created;
  status.ready_to_migrate = status.stage1_completed;

  console.log('\n🎯 OVERALL STATUS:');
  console.log('=' .repeat(50));
  console.log(`Stage 1 (Setup): ${status.stage1_completed ? '✅ COMPLETED' : '❌ INCOMPLETE'}`);
  console.log(`Ready to Migrate: ${status.ready_to_migrate ? '✅ YES' : '❌ NO'}`);

  if (status.ready_to_migrate) {
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run the complete migration:');
    console.log('   node scripts/migrate-sqlite-to-supabase.js');
    console.log('');
    console.log('2. After successful migration:');
    console.log('   - Update DATABASE_TYPE=supabase in .env');
    console.log('   - Test application functionality');
    console.log('   - Deploy updated application');
  } else {
    console.log('\n🔧 REQUIRED ACTIONS:');
    if (!status.env_configured) {
      console.log('- Configure Supabase credentials in .env file');
    }
    if (!status.scripts_ready) {
      console.log('- Ensure all migration scripts are present');
    }
    if (!status.schema_created) {
      console.log('- Create Supabase schema creation script');
    }
  }

  console.log('\n📚 DOCUMENTATION:');
  console.log('- Migration Guide: scripts/README.md');
  console.log('- Master Registry: .trae/documents/Master_Registry_Schema_Management.md');
  
  console.log('=' .repeat(50));
  
  return status;
}

// Run the status check if this script is executed directly
if (require.main === module) {
  checkMigrationStatus();
}

module.exports = { checkMigrationStatus };