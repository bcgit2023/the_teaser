const { exportSQLiteData } = require('./export-sqlite-data');
const { importToSupabase } = require('./import-to-supabase');
const fs = require('fs');
const path = require('path');

/**
 * Complete SQLite to Supabase Migration Script
 * Based on Master Registry Schema Management Document
 */

async function migrateSQLiteToSupabase() {
  console.log('🚀 Starting Complete SQLite to Supabase Migration...');
  console.log('=' .repeat(60));
  
  const migrationStart = Date.now();
  const migrationSummary = {
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
    phases: [],
    success: false,
    totalRecordsExported: 0,
    totalRecordsImported: 0,
    errors: []
  };

  try {
    // Phase 1: Export SQLite Data
    console.log('\n📤 PHASE 1: Exporting SQLite Data');
    console.log('-'.repeat(40));
    
    const exportResult = await exportSQLiteData();
    migrationSummary.phases.push({
      name: 'Export SQLite Data',
      success: true,
      recordCount: exportResult.totalRecords,
      duration: null
    });
    migrationSummary.totalRecordsExported = exportResult.totalRecords;
    
    if (exportResult.totalRecords === 0) {
      console.log('⚠️  No data found to migrate. Migration completed with no data transfer.');
      migrationSummary.success = true;
      return migrationSummary;
    }

    // Phase 2: Import to Supabase
    console.log('\n📥 PHASE 2: Importing to Supabase');
    console.log('-'.repeat(40));
    
    const importResult = await importToSupabase();
    migrationSummary.phases.push({
      name: 'Import to Supabase',
      success: importResult.errors.length === 0,
      recordCount: importResult.totalImported,
      errors: importResult.errors
    });
    migrationSummary.totalRecordsImported = importResult.totalImported;
    migrationSummary.errors = importResult.errors;

    // Phase 3: Validation
    console.log('\n✅ PHASE 3: Validation');
    console.log('-'.repeat(40));
    
    const validationResult = await validateMigration(exportResult, importResult);
    migrationSummary.phases.push({
      name: 'Validation',
      success: validationResult.success,
      details: validationResult
    });

    // Calculate final results
    const migrationEnd = Date.now();
    migrationSummary.endTime = new Date().toISOString();
    migrationSummary.duration = `${((migrationEnd - migrationStart) / 1000).toFixed(2)}s`;
    migrationSummary.success = migrationSummary.errors.length === 0 && validationResult.success;

    // Save migration summary
    const summaryFile = './migration-data/migration-summary.json';
    fs.writeFileSync(summaryFile, JSON.stringify(migrationSummary, null, 2));

    // Print final summary
    printMigrationSummary(migrationSummary);
    
    return migrationSummary;

  } catch (error) {
    migrationSummary.success = false;
    migrationSummary.errors.push(error.message);
    migrationSummary.endTime = new Date().toISOString();
    
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

async function validateMigration(exportResult, importResult) {
  console.log('🔍 Validating migration results...');
  
  const validation = {
    success: true,
    checks: [],
    warnings: []
  };

  // Check 1: Record count comparison
  const exportCount = exportResult.totalRecords;
  const importCount = importResult.totalImported;
  const errorCount = importResult.errors.length;
  
  validation.checks.push({
    name: 'Record Count Validation',
    exported: exportCount,
    imported: importCount,
    errors: errorCount,
    success: (importCount + errorCount) === exportCount
  });

  // Check 2: Table-by-table validation
  for (const db of exportResult.databases) {
    for (const table of db.tables) {
      if (table.recordCount > 0) {
        const importedTable = importResult.tables.find(t => 
          t.name.includes(table.name) || t.source.includes(table.name)
        );
        
        if (importedTable) {
          validation.checks.push({
            name: `Table ${table.name}`,
            exported: table.recordCount,
            imported: importedTable.imported,
            success: table.recordCount === importedTable.imported
          });
        } else {
          validation.warnings.push(`Table ${table.name} was exported but not found in import results`);
        }
      }
    }
  }

  // Check 3: Error analysis
  if (importResult.errors.length > 0) {
    validation.success = false;
    validation.checks.push({
      name: 'Error Analysis',
      errorCount: importResult.errors.length,
      success: false,
      errors: importResult.errors.slice(0, 5) // Show first 5 errors
    });
  }

  // Print validation results
  console.log('\n📊 Validation Results:');
  validation.checks.forEach((check, index) => {
    const status = check.success ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (check.exported !== undefined) {
      console.log(`     Exported: ${check.exported}, Imported: ${check.imported}`);
    }
  });

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }

  return validation;
}

function printMigrationSummary(summary) {
  console.log('\n' + '='.repeat(60));
  console.log('🎉 MIGRATION COMPLETED');
  console.log('='.repeat(60));
  
  console.log(`📊 Summary:`);
  console.log(`   Status: ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`   Duration: ${summary.duration}`);
  console.log(`   Records Exported: ${summary.totalRecordsExported}`);
  console.log(`   Records Imported: ${summary.totalRecordsImported}`);
  console.log(`   Errors: ${summary.errors.length}`);
  
  console.log(`\n📋 Phases:`);
  summary.phases.forEach((phase, index) => {
    const status = phase.success ? '✅' : '❌';
    console.log(`   ${index + 1}. ${status} ${phase.name}`);
    if (phase.recordCount !== undefined) {
      console.log(`      Records: ${phase.recordCount}`);
    }
  });

  if (summary.errors.length > 0) {
    console.log(`\n⚠️  Errors (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    if (summary.errors.length > 10) {
      console.log(`   ... and ${summary.errors.length - 10} more errors`);
    }
  }

  console.log(`\n📁 Files:`);
  console.log(`   Migration Data: ./migration-data/`);
  console.log(`   Summary: ./migration-data/migration-summary.json`);
  
  if (summary.success) {
    console.log('\n🎯 Next Steps:');
    console.log('   1. Update DATABASE_TYPE environment variable to "supabase"');
    console.log('   2. Test application functionality with Supabase');
    console.log('   3. Update database adapters to use Supabase');
    console.log('   4. Deploy updated application');
  } else {
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Review error messages above');
    console.log('   2. Check Supabase connection and permissions');
    console.log('   3. Verify SQLite database files exist and are readable');
    console.log('   4. Re-run migration after fixing issues');
  }
  
  console.log('='.repeat(60));
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateSQLiteToSupabase()
    .then((summary) => {
      process.exit(summary.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed with unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { migrateSQLiteToSupabase };