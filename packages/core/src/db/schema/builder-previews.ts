import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./identity";

// Bản xem trước tạm thời; không thay đổi bản nháp, revision hoặc trạng thái xuất bản.
export const builderPreviews = pgTable("builder_previews", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 20 }).notNull(),
  documentId: uuid("document_id"),
  sequence: integer("sequence").notNull(),
  payload: jsonb("payload").$type<unknown>().notNull(),
  parentOrigin: varchar("parent_origin", { length: 500 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [index("builder_previews_expiry_index").on(table.expiresAt), index("builder_previews_owner_index").on(table.ownerId)]);
