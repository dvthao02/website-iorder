import { bigint, index, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./identity";
import { timestamps } from "./shared";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: varchar("alt_text", { length: 500 }),
    caption: text("caption"),
    ...timestamps(),
  },
  (table) => [index("media_assets_mime_type_index").on(table.mimeType), index("media_assets_created_at_index").on(table.createdAt)],
);
