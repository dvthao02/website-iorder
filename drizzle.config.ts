import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/core/src/db/schema/index.ts",
  out: "./drizzle",
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
});
