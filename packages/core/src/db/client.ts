import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before accessing the database.");
  }

  // Next dev/build có thể tạo nhiều worker độc lập. Giữ pool nhỏ và đóng
  // connection rỗi giúp PostgreSQL local không bị cạn connection qua nhiều lần HMR/build.
  const client = postgres(connectionString, { prepare: false, max: 1, idle_timeout: 5, max_lifetime: 60 });
  return drizzle({ client, schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

// Lazy creation keeps pages that do not use persistence buildable before a
// local PostgreSQL instance has been configured.
export function getDb() {
  database ??= createDatabase();
  return database;
}
