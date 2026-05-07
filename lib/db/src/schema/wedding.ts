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
  venueCity: text("venue_city"),
  venueState: text("venue_state"),
  venueZip: text("venue_zip"),
  venueCountry: text("venue_country"),
  ceremonyAtVenue: boolean("ceremony_at_venue").notNull().default(true),
  ceremonyVenueName: text("ceremony_venue_name"),
  ceremonyAddress: text("ceremony_address"),
  ceremonyCity: text("ceremony_city"),
  ceremonyState: text("ceremony_state"),
  ceremonyZip: text("ceremony_zip"),
  guestCount: integer("guest_count").notNull(),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  weddingVibe: text("wedding_vibe").notNull(),
  preferredLanguage: text("preferred_language").default("English"),
  guestCollectionToken: text("guest_collection_token"),
  vendorBccEmail: text("vendor_bcc_email"),
  invitationPhotoUrl: text("invitation_photo_url"),
  invitationMessage: text("invitation_message"),
  saveTheDatePhotoUrl: text("save_the_date_photo_url"),
  saveTheDateMessage: text("save_the_date_message"),
  digitalInvitationPhotoUrl: text("digital_invitation_photo_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  profileId: integer("profile_id").notNull().unique(),
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
  profileId: integer("profile_id"),
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
  nextPaymentDue: text("next_payment_due"),
  files: jsonb("files").$type<Array<{ name: string; url: string; type: string }>>().default([]).notNull(),
  primaryContact: text("primary_contact"),
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

export const manualExpenses = pgTable("manual_expenses", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id"),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  receiptName: text("receipt_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ManualExpense = typeof manualExpenses.$inferSelect;

export const vendorConversations = pgTable("vendor_conversations", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  userId: text("user_id").notNull(),
  inboundToken: text("inbound_token").notNull().unique(),
  subject: text("subject").notNull().default("Wedding planning"),
  lastMessagePreview: text("last_message_preview").default(""),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  unreadCount: integer("unread_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VendorConversation = typeof vendorConversations.$inferSelect;

export const vendorMessages = pgTable("vendor_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderType: text("sender_type").notNull(),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  subject: text("subject"),
  body: text("body").notNull(),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; type: string; size?: number }>>().default([]).notNull(),
  inboundMessageId: text("inbound_message_id"),
  deliveryStatus: text("delivery_status").notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VendorMessage = typeof vendorMessages.$inferSelect;

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
  invitationStatus: text("invitation_status").notNull().default("pending"),
  rsvpStatus: text("rsvp_status").notNull().default("pending"),
  mealChoice: text("meal_choice"),
  dietaryNotes: text("dietary_notes"),
  guestGroup: text("guest_group"),
  plusOne: boolean("plus_one").notNull().default(false),
  plusOneName: text("plus_one_name"),
  plusOneMealChoice: text("plus_one_meal_choice"),
  tableAssignment: text("table_assignment"),
  notes: text("notes"),
  phone: text("phone"),
  address: text("address"),
  aptUnit: text("apt_unit"),
  guestCity: text("guest_city"),
  guestState: text("guest_state"),
  guestZip: text("guest_zip"),
  guestCountry: text("guest_country"),
  rsvpToken: text("rsvp_token"),
  rsvpSentAt: timestamp("rsvp_sent_at"),
  saveTheDateStatus: text("save_the_date_status").notNull().default("not_sent"),
  source: text("source").notNull().default("manual"),
  acknowledgedAt: timestamp("acknowledged_at"),
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
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
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
  photoUrl: text("photo_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WeddingPartyMember = typeof weddingParty.$inferSelect;

export const deletedAccountEmails = pgTable("deleted_account_emails", {
  email: text("email").primaryKey(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  deletedUserId: text("deleted_user_id"),
});

export type DeletedAccountEmail = typeof deletedAccountEmails.$inferSelect;

export const deletedUserArchive = pgTable("deleted_user_archive", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  archivedData: jsonb("archived_data").$type<Record<string, unknown>>().notNull(),
  restoredAt: timestamp("restored_at"),
  restoredBy: text("restored_by"),
  restoredToUserId: text("restored_to_user_id"),
});

export type DeletedUserArchive = typeof deletedUserArchive.$inferSelect;

export const moodBoards = pgTable("mood_boards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  images: jsonb("images").notNull().$type<Array<{
    objectPath: string;
    order: number;
    name?: string;
    analysis?: {
      styleKeywords: string[];
      dominantColors: string[];
      decorThemes: string[];
      floralStyle?: string;
      venueVibe?: string;
    };
  }>>().default([]),
  colorPalette: jsonb("color_palette").notNull().$type<Array<{
    hex: string;
    name: string;
  }>>().default([]),
  styleTags: jsonb("style_tags").notNull().$type<string[]>().default([]),
  aiSummary: text("ai_summary"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MoodBoard = typeof moodBoards.$inferSelect;

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  category: text("category").notNull(), // "bug", "feature", "general", "praise", "support"
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // "open", "in_progress", "resolved", "closed"
  priority: text("priority").notNull().default("medium"), // "low", "medium", "high", "urgent"
  userId: text("user_id"), // optional, if user was signed in
  profileId: integer("profile_id"), // optional, if related to a specific wedding
  followUpNotes: text("follow_up_notes"),
  followUpEmail: text("follow_up_email"),
  followUpSentAt: timestamp("follow_up_sent_at"),
  followUpSentBy: text("follow_up_sent_by"), // admin user ID who sent follow-up
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;

export const invitationCustomizations = pgTable("invitation_customizations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique(),

  // Color System
  primaryColor: text("primary_color").notNull().default("#D4A017"),
  colorPalette: jsonb("color_palette").notNull().$type<{
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
  }>().default({
    primary: "#D4A017",
    secondary: "#F5C842",
    accent: "#D4A017",
    neutral: "#E8E0D0",
  }),
  customColors: jsonb("custom_colors").$type<{
    primary?: string;
    secondary?: string;
    accent?: string;
    neutral?: string;
  } | null>(),
  selectedPalette: text("selected_palette"), // 'romantic', 'modern', 'luxury', 'minimalist', 'seasonal'
  backgroundColor: text("background_color"),

  // Photo URLs
  saveTheDatePhotoUrl: text("save_the_date_photo_url"),
  digitalInvitationPhotoUrl: text("digital_invitation_photo_url"),

  // Photo positions (x/y as percent 0–100, default center 50/50)
  saveTheDatePhotoPosition: jsonb("save_the_date_photo_position").$type<{ x: number; y: number } | null>(),
  digitalInvitationPhotoPosition: jsonb("digital_invitation_photo_position").$type<{ x: number; y: number } | null>(),

  // Design Options — per-design font / layout / background
  selectedFont: text("selected_font").notNull().default("Playfair Display"),
  saveTheDateFont: text("save_the_date_font").default("Playfair Display"),
  digitalInvitationFont: text("digital_invitation_font").default("Playfair Display"),
  selectedLayout: text("selected_layout").notNull().default("classic"),
  saveTheDateLayout: text("save_the_date_layout").default("classic"),
  digitalInvitationLayout: text("digital_invitation_layout").default("classic"),
  backgroundImageUrl: text("background_image_url"),
  saveTheDateBackground: text("save_the_date_background"),
  digitalInvitationBackground: text("digital_invitation_background"),

  // Per-element overrides keyed like "std:heading", "dig:couple".
  // Each value: { x?, y?, font?, color?, fontSize? }
  textOverrides: jsonb("text_overrides")
    .notNull()
    .$type<
      Record<
        string,
        {
          x?: number;
          y?: number;
          font?: string;
          color?: string;
          fontSize?: number;
        }
      >
    >()
    .default({}),

  // Sending mode: true = use the AI-generated email template, false = use user's custom design
  useGeneratedInvitation: boolean("use_generated_invitation").notNull().default(true),

  // Metadata
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvitationCustomizationSchema = createInsertSchema(invitationCustomizations).omit({ id: true, updatedAt: true, createdAt: true });
export type InsertInvitationCustomization = z.infer<typeof insertInvitationCustomizationSchema>;
export type InvitationCustomization = typeof invitationCustomizations.$inferSelect;

export type WebsiteSectionsEnabled = {
  welcome: boolean;
  story: boolean;
  schedule: boolean;
  travel: boolean;
  registry: boolean;
  faq: boolean;
  gallery: boolean;
  weddingParty: boolean;
  rsvp?: boolean;
};

export type WebsiteCustomText = Record<string, string>;

export type WebsiteGalleryImage = {
  url: string;
  caption?: string;
  order: number;
};

export const weddingWebsites = pgTable("wedding_websites", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  theme: text("theme").notNull().default("classic"),
  layoutStyle: text("layout_style").notNull().default("standard"),
  font: text("font").notNull().default("Playfair Display"),
  accentColor: text("accent_color").notNull().default("#D4A017"),
  colorPalette: jsonb("color_palette").notNull().$type<{
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    background: string;
    text: string;
  }>().default({
    primary: "#D4A017",
    secondary: "#F5C842",
    accent: "#D4A017",
    neutral: "#E8E0D0",
    background: "#FFFFFF",
    text: "#222222",
  }),
  sectionsEnabled: jsonb("sections_enabled").notNull().$type<WebsiteSectionsEnabled>().default({
    welcome: true,
    story: true,
    schedule: true,
    travel: true,
    registry: true,
    faq: true,
    gallery: true,
    weddingParty: true,
  }),
  // User-overridden text per section. Keys: "welcome", "story", "faq", etc.
  // Empty value means "use auto-generated text from couple's profile".
  customText: jsonb("custom_text").notNull().$type<WebsiteCustomText>().default({}),
  galleryImages: jsonb("gallery_images").notNull().$type<WebsiteGalleryImage[]>().default([]),
  heroImage: text("hero_image"),
  password: text("password"),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWeddingWebsiteSchema = createInsertSchema(weddingWebsites).omit({ id: true, lastUpdated: true, createdAt: true });
export type InsertWeddingWebsite = z.infer<typeof insertWeddingWebsiteSchema>;
export type WeddingWebsite = typeof weddingWebsites.$inferSelect;

export const websiteRsvps = pgTable("website_rsvps", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  attending: text("attending").notNull().default("yes"),
  plusOneCount: integer("plus_one_count").notNull().default(0),
  dietaryRestrictions: text("dietary_restrictions"),
  message: text("message"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export type WebsiteRsvp = typeof websiteRsvps.$inferSelect;

