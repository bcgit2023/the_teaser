# SQLite to Supabase Migration Scripts

This directory contains scripts for migrating data from SQLite databases to Supabase PostgreSQL.

## 📁 Files Overview

### Migration Scripts
- **`migrate-sqlite-to-supabase.js`** - Complete migration orchestrator (recommended)
- **`export-sqlite-data.js`** - Export data from SQLite databases to JSON
- **`import-to-supabase.js`** - Import JSON data to Supabase
- **`create-supabase-schema.sql`** - PostgreSQL schema creation script
- **`test-supabase-connection.js`** - Test Supabase connectivity

### Configuration
- **`README.md`** - This documentation file

## 🚀 Quick Start

### Prerequisites
1. Ensure Supabase credentials are configured in `.env`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   DATABASE_TYPE=sqlite  # Will change to 'supabase' after migration
   ```

2. Install dependencies:
   ```bash
   npm install dotenv @supabase/supabase-js sqlite3
   ```

### Complete Migration (Recommended)
Run the complete migration process:
```bash
node scripts/migrate-sqlite-to-supabase.js
```

This will:
1. Export all data from SQLite databases
2. Import data to Supabase
3. Validate the migration
4. Generate comprehensive reports

### Individual Steps (Advanced)

#### 1. Test Connection
```bash
node scripts/test-supabase-connection.js
```

#### 2. Export SQLite Data
```bash
node scripts/export-sqlite-data.js
```

#### 3. Import to Supabase
```bash
node scripts/import-to-supabase.js
```

## 📊 Migration Process

### Phase 1: Export SQLite Data
- Scans for SQLite databases: `user.db`, `parents.db`, `quiz.db`
- Exports all tables to JSON files
- Creates export summary with record counts

### Phase 2: Import to Supabase
- Transforms data for PostgreSQL compatibility
- Handles UUID generation for primary keys
- Maintains referential integrity
- Imports in dependency order:
  1. `users_enhanced`
  2. `quiz_results`
  3. `quiz_answers`
  4. `parent_child_relationships`
  5. `incorrect_answers`

### Phase 3: Validation
- Compares record counts between export and import
- Validates table-by-table migration
- Reports any errors or discrepancies

## 📁 Output Structure

After migration, you'll find:
```
migration-data/
├── user.db/
│   ├── users.json
│   └── user_profiles.json
├── parents.db/
│   └── parent_child_relationships.json
├── quiz.db/
│   ├── quiz_results.json
│   ├── quiz_answers.json
│   └── incorrect_answers.json
├── export-summary.json
├── import-summary.json
└── migration-summary.json
```

## 🔧 Configuration

### Database Type Control
The `DATABASE_TYPE` environment variable controls which database the application uses:
- `sqlite` - Use SQLite databases (default)
- `supabase` - Use Supabase PostgreSQL

### Migration Settings
Key settings in the migration scripts:
- **Batch Size**: 100 records per batch for imports
- **UUID Generation**: Automatic for PostgreSQL primary keys
- **Error Handling**: Continues on individual record errors
- **Validation**: Comprehensive post-migration checks

## 📋 Schema Mapping

| SQLite Database | SQLite Table | Supabase Table |
|----------------|--------------|----------------|
| user.db | users | users_enhanced |
| user.db | user_profiles | users_enhanced |
| quiz.db | quiz_results | quiz_results |
| quiz.db | quiz_answers | quiz_answers |
| quiz.db | incorrect_answers | incorrect_answers |
| parents.db | parent_child_relationships | parent_child_relationships |

## 🛡️ Security & Permissions

### Row Level Security (RLS)
All Supabase tables have RLS enabled with policies for:
- **Public access**: Read-only for anonymous users
- **Authenticated access**: Full CRUD for authenticated users
- **User isolation**: Users can only access their own data

### Permissions
Required permissions are automatically granted:
- `anon` role: SELECT permissions
- `authenticated` role: ALL privileges

## 🔍 Troubleshooting

### Common Issues

#### 1. Connection Errors
```
Error: Invalid Supabase URL or key
```
**Solution**: Verify `.env` credentials and test connection

#### 2. Permission Denied
```
Error: permission denied for table users_enhanced
```
**Solution**: Check RLS policies and role permissions

#### 3. Foreign Key Violations
```
Error: insert or update on table violates foreign key constraint
```
**Solution**: Ensure parent records exist before child records

#### 4. UUID Format Errors
```
Error: invalid input syntax for type uuid
```
**Solution**: Check UUID generation in import script

### Debug Mode
Add debug logging by setting:
```javascript
const DEBUG = true; // In migration scripts
```

## 📈 Performance

### Expected Migration Times
- **Small dataset** (< 1,000 records): 30-60 seconds
- **Medium dataset** (1,000-10,000 records): 2-5 minutes
- **Large dataset** (> 10,000 records): 5-15 minutes

### Optimization Tips
1. Run migration during low-traffic periods
2. Ensure stable internet connection
3. Monitor Supabase dashboard for performance
4. Use batch processing for large datasets

## 🎯 Post-Migration Steps

1. **Update Environment Variable**:
   ```env
   DATABASE_TYPE=supabase
   ```

2. **Test Application**:
   - Verify all features work with Supabase
   - Check user authentication
   - Validate data integrity

3. **Update Database Adapters**:
   - Modify database connection logic
   - Update query syntax for PostgreSQL
   - Test all CRUD operations

4. **Deploy**:
   - Deploy updated application
   - Monitor for any issues
   - Keep SQLite backup until confirmed stable

## 📞 Support

For issues or questions:
1. Check the migration summary files for detailed error information
2. Review Supabase dashboard for database status
3. Verify environment configuration
4. Test individual migration steps

## 🔄 Rollback Plan

If migration fails or issues arise:
1. Set `DATABASE_TYPE=sqlite` in `.env`
2. Restart application (will use original SQLite databases)
3. Review migration logs and fix issues
4. Re-run migration when ready

The original SQLite databases remain untouched during migration, providing a safe rollback option.