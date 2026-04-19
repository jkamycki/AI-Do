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
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  isPaid: boolean("is_paid").notNull().default(false),
  notes: text("notes"),
  nextPaymentDue: text("next_payment_due"),
});

export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({ id: true });
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;

export const budgetPaymentLogs = pgTable("budget_payment_logs", {
  id: serial("id").primaryKey(),
  budgetItemId: integer("budget_item_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});
export type BudgetPaymentLog = typeof budgetPaymentLogs.$inferSelect;

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

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  name: text("name").notNull(),
  category: text("category").notNull(),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  portalLink: text("portal_link"),
  notes: text("notes"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  contractSigned: boolean("contract_signed").default(false).notNull(),
  files: jsonb("files").$type<Array<{ name: string; url: string; type: string }>>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export const vendorPayments = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: text("due_date").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({ id: true, createdAt: true });
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type VendorPayment = typeof vendorPayments.$inferSelect;

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;

export const workspaceCollaborators = pgTable("workspace_collaborators", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  inviterUserId: text("inviter_user_id").notNull(),
  inviteeEmail: text("invitee_email").notNull(),
  inviteeUserId: text("invitee_user_id"),
  role: text("role").notNull().default("planner"),
  status: text("status").notNull().default("pending"),
  inviteToken: text("invite_token").notNull().unique(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

export type WorkspaceCollaborator = typeof workspaceCollaborators.$inferSelect;

export const workspaceActivity = pgTable("workspace_activity", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WorkspaceActivity = typeof workspaceActivity.$inferSelect;

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContactMessage = typeof contactMessages.$inferSelect;

export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  rating: integer("rating"),
  category: text("category"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;

export const vendorContracts = pgTable("vendor_contracts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  profileId: integer("profile_id"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  extractedText: text("extracted_text"),
  analysis: jsonb("analysis").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VendorContract = typeof vendorContracts.$inferSelect;

export const seatingCharts = pgTable("seating_charts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  profileId: integer("profile_id"),
  name: text("name").notNull().default("My Seating Chart"),
  guests: jsonb("guests").$type<Record<string, unknown>[]>().notNull().default([]),
  tables: jsonb("tables").$type<Record<string, unknown>[]>(),
  tableCount: integer("table_count").notNull().default(8),
  seatsPerTable: integer("seats_per_table").notNull().default(8),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SeatingChart = typeof seatingCharts.$inferSelect;

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  rsvpStatus: text("rsvp_status").notNull().default("pending"),
  mealChoice: text("meal_choice"),
  guestGroup: text("guest_group"),
  plusOne: boolean("plus_one").notNull().default(false),
  plusOneName: text("plus_one_name"),
  tableAssignment: text("table_assignment"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGuestSchema = createInsertSchema(guests).omit({ id: true, createdAt: true });
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Guest = typeof guests.$inferSelect;

export const hotelBlocks = pgTable("hotel_blocks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  hotelName: text("hotel_name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  bookingLink: text("booking_link"),
  discountCode: text("discount_code"),
  groupName: text("group_name"),
  cutoffDate: text("cutoff_date"),
  roomsReserved: integer("rooms_reserved"),
  roomsBooked: integer("rooms_booked").notNull().default(0),
  pricePerNight: numeric("price_per_night", { precision: 12, scale: 2 }),
  distanceFromVenue: text("distance_from_venue"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type HotelBlock = typeof hotelBlocks.$inferSelect;

export const weddingParty = pgTable("wedding_party", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  side: text("side").notNull().default("bride"),
  phone: text("phone"),
  email: text("email"),
  outfitDetails: text("outfit_details"),
  shoeSize: text("shoe_size"),
  outfitStore: text("outfit_store"),
  fittingDate: text("fitting_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WeddingPartyMember = typeof weddingParty.$inferSelect;
