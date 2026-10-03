import { index, pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { userStatusEnum } from "./enums";
import { timestamps } from "./shared";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 80 }).notNull(),
    email: varchar("email", { length: 320 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    status: userStatusEnum("status").default("active").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
    index("users_status_index").on(table.status),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("roles_code_unique").on(table.code)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgent: varchar("user_agent", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_expires_at_index").on(table.userId, table.expiresAt),
    index("sessions_expires_at_index").on(table.expiresAt),
  ],
);
