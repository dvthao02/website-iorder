import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "review", "scheduled", "published", "archived"]);
export const postTypeEnum = pgEnum("post_type", ["news", "promotion", "case_study", "announcement", "guide"]);
export const offeringTypeEnum = pgEnum("offering_type", ["software", "solution", "service", "industry"]);
export const partnerKindEnum = pgEnum("partner_kind", ["partner", "customer"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "closed"]);
