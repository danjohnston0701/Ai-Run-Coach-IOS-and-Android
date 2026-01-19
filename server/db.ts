import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use external Neon database (EXTERNAL_DATABASE_URL) as primary
// Falls back to Replit's DATABASE_URL if external is not set
const connectionString = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "EXTERNAL_DATABASE_URL or DATABASE_URL must be set. Did you forget to configure the database?",
  );
}

export const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Neon
});
export const db = drizzle(pool, { schema });
