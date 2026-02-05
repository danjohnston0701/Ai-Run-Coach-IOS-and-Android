import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// ALWAYS use EXTERNAL_DATABASE_URL (Neon database)
// DO NOT use DATABASE_URL as it points to wrong database
const connectionString = process.env.EXTERNAL_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "EXTERNAL_DATABASE_URL must be set. This should point to the Neon PostgreSQL database.",
  );
}

console.log("🔌 Connecting to database:", connectionString.substring(0, 30) + "...");

export const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Neon
});
export const db = drizzle(pool, { schema });
