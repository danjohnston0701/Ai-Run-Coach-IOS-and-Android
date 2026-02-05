const fs = require('fs');
const pg = require('pg');
const path = require('path');

async function runMigration() {
  const { Pool } = pg;
  const connectionString = process.env.EXTERNAL_DATABASE_URL;

  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migrations', 'add_analytics_simple.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Running migration on Neon database...');
    const client = await pool.connect();
    
    try {
      await client.query(sql);
      console.log('✅ Migration completed successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
