import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const fallbackConnectionString =
  "postgresql://aido_missing_database_url@127.0.0.1:1/aido_missing_database_url";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? fallbackConnectionString,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
