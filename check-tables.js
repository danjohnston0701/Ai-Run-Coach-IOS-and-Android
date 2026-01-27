const pg = require('pg');

async function checkTables() {
  const { Pool } = pg;
  const connectionString = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    try {
      // Check which analytics tables exist
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public' 
        AND table_name IN (
          'segments', 'segment_efforts', 'segment_stars',
          'daily_fitness', 'training_plans', 'weekly_plans',
          'planned_workouts', 'plan_adaptations',
          'feed_activities', 'reactions', 'activity_comments',
          'clubs', 'challenges', 'achievements', 'user_achievements'
        )
        ORDER BY table_name
      `);
      
      console.log('📊 Existing analytics tables:');
      if (result.rows.length === 0) {
        console.log('  (none)');
      } else {
        result.rows.forEach(row => console.log(`  - ${row.table_name}`));
      }
      
      // If segments exists, show its structure
      if (result.rows.some(r => r.table_name === 'segments')) {
        const columns = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'segments'
          ORDER BY ordinal_position
        `);
        console.log('\n📋 Segments table columns:');
        columns.rows.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
