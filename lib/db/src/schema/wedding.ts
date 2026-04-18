import { pgTable, serial, text, integer, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weddingProfiles = pgTable("wedding_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  partner1Name: text("partner1_name").notNull(),
  partner2Name: text("partner2_name").notNull(),
  weddingDate: text("wedding_date").notNull(),
  ceremonyTime: text("ceremony_time").notNull(),
  receptionTime: text("reception_time").notNull(),
  venue: text("venue").notNull(),
  location: text("location").notNull(),
  guestCount: integer("guest_count").notNull(),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  weddingVibe: text("wedding_vibe").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWeddingProfileSchema = createInsertSchema(weddingProfiles).omit({ id: true, updatedAt: true });
export type InsertWeddingProfile = z.infer<typeof insertWeddingProfileSchema>;
export type WeddingProfile = typeof weddingProfiles.$inferSelect;

export const timelines = pgTable("timelines", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  events: jsonb("events").notNull().$type<Array<{
    time: string;
    title: string;
    description: string;
    category: string;
  }>>(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type Timeline = typeof timelines.$inferSelect;

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;

export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull(),
  category: text("category").notNull(),
  vendor: text("vendor").notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  isPaid: boolean("is_paid").notNull().default(false),
  notes: text("notes"),
});

export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({ id: true });
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;

export const checklistItems = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  month: text("month").notNull(),
  task: text("task").notNull(),
  description: text("description").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

export type ChecklistItem = typeof checklistItems.$inferSelect;
