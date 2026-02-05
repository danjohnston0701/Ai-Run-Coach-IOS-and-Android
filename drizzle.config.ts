import { defineConfig } from "drizzle-kit";

if (!process.env.EXTERNAL_DATABASE_URL) {
  throw new Error("EXTERNAL_DATABASE_URL must be set. This should point to Neon PostgreSQL.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.EXTERNAL_DATABASE_URL,
  },
});
