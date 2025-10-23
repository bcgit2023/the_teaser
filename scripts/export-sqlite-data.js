const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * Export SQLite Data to JSON Files
 * Based on Master Registry Schema Management Document
 */

async function exportSQLiteData() {
  console.log('🗂️ Starting SQLite Data Export...');
  
  // Create export directory
  const exportDir = './migration-data';
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const databases = [
    { file: './db/user.db', name: 'user', tables: ['users', 'quiz_results', 'quiz_answers'] },
    { file: './db/parents.db', name: 'parents', tables: ['parents'] },
    { file: './db/quiz.db', name: 'quiz', tables: ['incorrect_answers'] }
  ];

  const exportSummary = {
    timestamp: new Date().toISOString(),
    databases: [],
    totalRecords: 0
  };

  for (const dbConfig of databases) {
    console.log(`\n📊 Processing database: ${dbConfig.name}`);
    
    if (!fs.existsSync(dbConfig.file)) {
      console.log(`⚠️  Database file not found: ${dbConfig.file}`);
      continue;
    }

    const db = new sqlite3.Database(dbConfig.file);
    const dbSummary = {
      name: dbConfig.name,
      file: dbConfig.file,
      tables: [],
      recordCount: 0
    };

    try {
      for (const tableName of dbConfig.tables) {
        console.log(`  📋 Exporting table: ${tableName}`);
        
        try {
          const data = await exportTable(db, tableName);
          const outputFile = path.join(exportDir, `${dbConfig.name}_${tableName}.json`);
          
          fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
          
          console.log(`    ✅ Exported ${data.length} rows to ${outputFile}`);
          
          dbSummary.tables.push({
            name: tableName,
            recordCount: data.length,
            outputFile: outputFile
          });
          dbSummary.recordCount += data.length;
          exportSummary.totalRecords += data.length;
          
        } catch (tableError) {
          console.log(`    ⚠️  Table ${tableName} not found or empty`);
          dbSummary.tables.push({
            name: tableName,
            recordCount: 0,
            error: tableError.message
          });
        }
      }
    } finally {
      db.close();
    }

    exportSummary.databases.push(dbSummary);
  }

  // Save export summary
  const summaryFile = path.join(exportDir, 'export-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(exportSummary, null, 2));

  console.log('\n🎉 SQLite Data Export Completed!');
  console.log(`📊 Summary:`);
  console.log(`   Total Records: ${exportSummary.totalRecords}`);
  console.log(`   Export Directory: ${exportDir}`);
  console.log(`   Summary File: ${summaryFile}`);
  
  return exportSummary;
}

function exportTable(db, tableName) {
  return new Promise((resolve, reject) => {
    // First check if table exists
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        reject(new Error(`Table ${tableName} does not exist`));
        return;
      }

      // Export all data from the table
      db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows || []);
      });
    });
  });
}

// Run the export if this script is executed directly
if (require.main === module) {
  exportSQLiteData()
    .then((summary) => {
      console.log('\n✅ Export completed successfully!');
      console.log(`📊 Total records exported: ${summary.totalRecords}`);
      console.log(`📁 Data saved to: ./migration-data/`);
      console.log(`📋 Summary saved to: ./migration-data/export-summary.json`);
    })
    .catch((error) => {
      console.error('\n❌ Export failed:', error);
      process.exit(1);
    });
}

module.exports = { exportSQLiteData };