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
  // Production chỉ có một tiến trình Backend: pool 1 kết nối bắt mọi request (kể cả các truy vấn Promise.all
  // trong cùng request) xếp hàng sau nhau, một truy vấn chậm chặn cả CMS lẫn website.
  // connect_timeout: database không kết nối được thì báo lỗi sau 10 giây (health trả 503) thay vì treo request.
  const max = Number(process.env.DATABASE_POOL_MAX) || (process.env.NODE_ENV === "production" ? 10 : 2);
  const client = postgres(connectionString, { prepare: false, max, idle_timeout: 5, max_lifetime: 60, connect_timeout: 10 });
  return drizzle({ client, schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

// Lazy creation keeps pages that do not use persistence buildable before a
// local PostgreSQL instance has been configured.
export function getDb() {
  database ??= createDatabase();
  return database;
}
