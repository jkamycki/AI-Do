import { Request, Response, Router } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  budgetItems,
  budgets,
  checklistItems,
  db,
  documents,
  guestPhotoUploads,
  guests,
  hotelBlocks,
  invitationCustomizations,
  seatingCharts,
  timelines,
  vendorContracts,
  vendorPayments,
  vendors,
  workspaceActivity,
  workspaceCollaborators,
  weddingParty,
  weddingWebsites,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../lib/workspaceAccess";

const router = Router();

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function vendorStatus(total: number, paid: number, signed: boolean): "Paid" | "Pending" | "Due Soon" | "Completed" | "Signed" | "Ongoing" {
  if (total > 0 && paid >= total) return "Completed";
  if (signed) return "Signed";
  return "Pending";
}

function rsvpStatus(value: string | null | undefined): "Confirmed" | "Pending" | "Declined" {
  if (value === "attending" || value === "maybe") return "Confirmed";
  if (value === "declined") return "Declined";
  return "Pending";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function firstName(name?: string | null) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length <= 1 ? parts[0] ?? "" : parts.slice(0, -1).join(" ");
}

function titleCaseStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "accepted" || normalized === "active") return "Accepted";
  if (normalized === "sent") return "Sent";
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "approved") return "Approved";
  if (normalized === "hidden") return "Hidden";
  if (normalized === "signed") return "Signed";
  if (normalized === "draft") return "Draft";
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Pending";
}

function documentStatus(tags: string[] | null | undefined, fallback: "Needs Review" | "Approved" | "Signed" | "Shared") {
  const statusTag = tags?.find((tag) => tag.startsWith("mobile-status:"));
  if (!statusTag) return fallback;
  const status = titleCaseStatus(statusTag.replace("mobile-status:", ""));
  if (status === "Approved" || status === "Signed" || status === "Shared") return status;
  return "Needs Review";
}

function contractStatus(analysis: Record<string, unknown>): "Draft" | "Needs Review" | "Negotiating" | "Signed" {
  const status = titleCaseStatus(typeof analysis._mobileStatus === "string" ? analysis._mobileStatus : undefined);
  if (status === "Draft" || status === "Negotiating" || status === "Signed") return status;
  return "Needs Review";
}

function collaboratorRole(role: string): "Planner" | "Partner" | "Family" | "Vendor" {
  if (role === "partner") return "Partner";
  if (role === "vendor") return "Vendor";
  if (role === "family") return "Family";
  return "Planner";
}

function guestPhotoSettings(customText: Record<string, string> | null | undefined) {
  const text = customText ?? {};
  const maxUploads = Number(text._guestPhotoMaxUploads);
  const displayMode = text._guestPhotoDisplayMode === "website" || text._guestPhotoDisplayMode === "both" || text._guestPhotoDisplayMode === "portal"
    ? text._guestPhotoDisplayMode
    : text._guestPhotoGalleryEnabled === "true"
      ? "both"
      : "portal";
  return {
    enabled: text._guestPhotoDropEnabled !== "false",
    displayMode,
    maxUploads: Number.isFinite(maxUploads) && maxUploads > 0 ? Math.floor(maxUploads) : 10,
    title: text._guestPhotoTitle || "Guest Photo Drop",
    instructions: text._guestPhotoInstructions || "Share your favorite wedding day moments here. Add a caption if you'd like.",
    selectedQrTarget: "website",
  };
}

async function buildMobilePlanningPayload(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return {};

  const [
    vendorRows,
    budgetRows,
    guestRows,
    checklistRows,
    partyRows,
    hotelRows,
    documentRows,
    contractRows,
    timelineRows,
    collaboratorRows,
    activityRows,
    invitationRows,
    guestPhotoRows,
    chartRows,
    websiteRows,
  ] = await Promise.all([
    db.select().from(vendors).where(eq(vendors.profileId, profile.id)).orderBy(vendors.createdAt),
    db.select().from(budgets).where(eq(budgets.profileId, profile.id)).orderBy(desc(budgets.id)).limit(1),
    db.select().from(guests).where(eq(guests.profileId, profile.id)).orderBy(guests.createdAt),
    db.select().from(checklistItems).where(eq(checklistItems.profileId, profile.id)).orderBy(checklistItems.id),
    db.select().from(weddingParty).where(eq(weddingParty.profileId, profile.id)).orderBy(weddingParty.sortOrder),
    db.select().from(hotelBlocks).where(eq(hotelBlocks.profileId, profile.id)).orderBy(hotelBlocks.createdAt),
    db.select().from(documents).where(eq(documents.profileId, profile.id)).orderBy(desc(documents.updatedAt)),
    db.select().from(vendorContracts).where(eq(vendorContracts.profileId, profile.id)).orderBy(desc(vendorContracts.createdAt)),
    db.select().from(timelines).where(eq(timelines.profileId, profile.id)).orderBy(desc(timelines.id)).limit(1),
    db.select().from(workspaceCollaborators).where(eq(workspaceCollaborators.profileId, profile.id)).orderBy(desc(workspaceCollaborators.invitedAt)),
    db.select().from(workspaceActivity).where(eq(workspaceActivity.profileId, profile.id)).orderBy(desc(workspaceActivity.createdAt)).limit(40),
    db.select().from(invitationCustomizations).where(eq(invitationCustomizations.profileId, profile.id)).limit(1),
    db.select().from(guestPhotoUploads).where(eq(guestPhotoUploads.profileId, profile.id)).orderBy(desc(guestPhotoUploads.uploadedAt)).limit(48),
    db.select().from(seatingCharts).where(eq(seatingCharts.profileId, profile.id)).orderBy(desc(seatingCharts.createdAt)).limit(1),
    db.select().from(weddingWebsites).where(eq(weddingWebsites.profileId, profile.id)).limit(1),
  ]);

  const vendorIds = vendorRows.map((vendor) => vendor.id);
  const paymentRows = vendorIds.length
    ? await db.select().from(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds))
    : [];
  const paymentsByVendor = new Map<number, typeof paymentRows>();
  for (const payment of paymentRows) {
    const list = paymentsByVendor.get(payment.vendorId) ?? [];
    list.push(payment);
    paymentsByVendor.set(payment.vendorId, list);
  }

  const [budget] = budgetRows;
  const lineItems = budget
    ? await db.select().from(budgetItems).where(eq(budgetItems.budgetId, budget.id))
    : [];
  const vendorsById = new Map(vendorRows.map((vendor) => [vendor.id, vendor]));

  const mobileVendors = vendorRows.map((vendor) => {
    const payments = paymentsByVendor.get(vendor.id) ?? [];
    const paidMilestones = payments.filter((payment) => payment.isPaid);
    const total = money(vendor.totalCost);
    const paid = Math.min(total, money(vendor.depositAmount) + paidMilestones.reduce((sum, payment) => sum + money(payment.amount), 0));
    const nextPayment = payments
      .filter((payment) => !payment.isPaid)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
    return {
      id: String(vendor.id),
      name: vendor.name,
      category: vendor.category,
      committed: total,
      paid,
      remaining: Math.max(0, total - paid),
      nextPaymentDate: nextPayment?.dueDate ?? vendor.nextPaymentDue ?? undefined,
      status: vendorStatus(total, paid, vendor.contractSigned),
      contactName: vendor.primaryContact ?? undefined,
      phone: vendor.phone ?? undefined,
      email: vendor.email ?? undefined,
      payments: payments.map((payment) => ({
        id: String(payment.id),
        date: payment.dueDate,
        amount: money(payment.amount),
        isPaid: payment.isPaid,
        note: payment.label,
      })),
    };
  });

  const mobileBudget = lineItems.length
    ? lineItems.map((item) => ({
        id: String(item.id),
        category: item.category,
        title: item.vendor,
        total: money(item.actualCost) || money(item.estimatedCost),
        paid: money(item.amountPaid),
        nextPayment: item.nextPaymentDue
          ? { date: item.nextPaymentDue, amount: Math.max(0, (money(item.actualCost) || money(item.estimatedCost)) - money(item.amountPaid)) }
          : undefined,
        payments: [],
      }))
    : mobileVendors.map((vendor) => ({
        id: `vendor-${vendor.id}`,
        category: vendor.category,
        title: vendor.name,
        total: vendor.committed,
        paid: vendor.paid,
        nextPayment: vendor.nextPaymentDate ? { date: vendor.nextPaymentDate, amount: vendor.remaining } : undefined,
        payments: vendor.payments,
      }));

  const latestChart = chartRows[0];
  const chartTables = Array.isArray(latestChart?.tables) ? latestChart.tables : [];
  const mobileSeating = chartTables.length
    ? chartTables.map((table, index) => {
        const record = table as Record<string, unknown>;
        const assignedGuests = Array.isArray(record.guests) ? record.guests.length : 0;
        const tableName = String(record.tableName ?? record.name ?? `Table ${index + 1}`);
        return {
          id: String(record.id ?? `table-${index + 1}`),
          name: tableName,
          capacity: Number(record.capacity ?? latestChart?.seatsPerTable ?? 8),
          assigned: assignedGuests,
          notes: String(record.theme ?? ""),
        };
      })
    : [];

  const website = websiteRows[0];
  const invitation = invitationRows[0];
  const heroImages = Array.isArray(website?.heroImages) ? website.heroImages : [];
  const sortedHeroImages = [...heroImages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const coverPhotoUrl = website?.heroImage || sortedHeroImages[0]?.url || undefined;
  const coupleName = [firstName(profile.partner1Name), firstName(profile.partner2Name)].filter(Boolean).join(" & ");
  const latestTimeline = timelineRows[0];
  const timelineEvents = Array.isArray(latestTimeline?.events) ? latestTimeline.events : [];
  const confirmedGuests = guestRows.filter((guest) => rsvpStatus(guest.rsvpStatus) === "Confirmed").length;
  const declinedGuests = guestRows.filter((guest) => rsvpStatus(guest.rsvpStatus) === "Declined").length;
  const saveTheDateSent = guestRows.filter((guest) => guest.saveTheDateStatus === "sent").length;
  const invitationSent = guestRows.filter((guest) => guest.invitationStatus === "sent").length;

  return {
    profile: {
      coverPhotoUrl,
      coupleName,
      partnerOne: firstName(profile.partner1Name),
      partnerTwo: firstName(profile.partner2Name),
      weddingDate: profile.weddingDate,
      venue: profile.venue,
      venueStatus: profile.venueStatus === "booked" ? "Booked" : profile.venueStatus === "deciding" ? "Looking" : "Non-traditional",
      location: profile.location,
      totalBudget: money(profile.totalBudget),
      guestTarget: profile.guestCount,
      photoInitials: `${profile.partner1Name?.[0] ?? ""}&${profile.partner2Name?.[0] ?? ""}`,
      notificationsEnabled: profile.taskEmailRemindersEnabled,
      priorities: {
        mustHave: profile.planningPriorities?.mustHaves ?? [],
        niceToHave: profile.planningPriorities?.niceToHaves ?? [],
        mustAvoid: profile.planningPriorities?.mustAvoids ?? [],
      },
    },
    vendors: mobileVendors,
    budget: mobileBudget,
    guests: guestRows.map((guest) => ({
      email: guest.email || "",
      id: String(guest.id),
      invitationStatus: guest.invitationStatus || "pending",
      name: guest.name,
      rsvpReminderStatus: guest.rsvpReminderStatus || "not_sent",
      rsvp: rsvpStatus(guest.rsvpStatus),
      saveTheDateStatus: guest.saveTheDateStatus || "not_sent",
      mealPreference: guest.mealChoice || "Guest",
      plusOne: guest.plusOne,
      plusOneName: guest.plusOneName || "",
      plusOneStatus: guest.plusOneStatus || (guest.plusOne ? "name_tbd" : "none"),
      table: guest.tableAssignment || "No table",
      role: guest.guestGroup || "Guest",
      invitationStyle: "cream",
    })),
    tasks: checklistRows.map((item) => ({
      id: String(item.id),
      title: item.task,
      dueDate: item.dueDate || profile.weddingDate,
      category: "Checklist",
      completed: item.isCompleted,
      detail: item.description,
    })),
    documents: documentRows.map((document) => {
      const linkedVendor = document.linkedVendorId ? vendorsById.get(document.linkedVendorId) : undefined;
      return {
        id: String(document.id),
        title: document.originalFileName || document.fileName,
        type: /contract/i.test(document.folder) ? "Contract" : /receipt/i.test(document.folder) ? "Receipt" : "Other",
        linkedTo: linkedVendor?.name ?? document.folder,
        status: documentStatus(document.tags, document.summary ? "Needs Review" : "Shared"),
        updatedAt: document.updatedAt?.toISOString?.() ?? String(document.updatedAt),
        summary: document.summary || `${document.fileType} document uploaded to ${document.folder}.`,
      };
    }),
    contracts: contractRows.map((contract) => {
      const vendor = contract.vendorId ? vendorsById.get(contract.vendorId) : undefined;
      const analysis = asObject(contract.analysis);
      const clauses = [
        ...textList(analysis.missingClauses),
        ...textList(analysis.redFlags),
        ...textList(analysis.keyTerms).slice(0, 3),
      ].slice(0, 5);
      return {
        id: String(contract.id),
        vendorName: vendor?.name ?? String(analysis.vendorName ?? "Vendor"),
        title: contract.fileName,
        value: money(vendor?.totalCost),
        status: contractStatus(analysis),
        nextAction: clauses[0] ? `Review ${clauses[0]}` : "Review contract details",
        riskLevel: clauses.length >= 3 ? "High" : clauses.length ? "Medium" : "Low",
        clauses,
      };
    }),
    weddingParty: partyRows.map((member) => ({
      id: String(member.id),
      name: member.name,
      role: member.role,
      side: member.side === "groom" ? "Groom" : member.side === "shared" ? "Shared" : "Bride",
      phone: member.phone || "",
      attireStatus: member.outfitDetails ? "In Progress" : "Not Started",
      tasks: member.notes ? [member.notes] : [],
    })),
    hotels: hotelRows.map((hotel) => ({
      id: String(hotel.id),
      name: hotel.hotelName,
      address: [hotel.address, hotel.city, hotel.state, hotel.zip].filter(Boolean).join(", "),
      roomsBooked: hotel.roomsBooked,
      roomsTotal: hotel.roomsReserved ?? hotel.roomsBooked,
      rate: money(hotel.pricePerNight),
      deadline: hotel.cutoffDate || "",
      shuttle: false,
      contact: hotel.email || hotel.phone || "",
    })),
    seating: mobileSeating,
    dayOf: timelineEvents.map((event, index) => {
      const record = event as Record<string, unknown>;
      return {
        id: String(record.id ?? `timeline-${index + 1}`),
        time: String(record.time ?? ""),
        title: String(record.title ?? `Timeline item ${index + 1}`),
        owner: String(record.category ?? "Planner"),
        location: String(record.location ?? record.description ?? ""),
        completed: Boolean(record.completed) || String(record.status ?? "").toLowerCase() === "complete",
      };
    }),
    dayOfChecklist: checklistRows
      .filter((item) => /day|ceremony|music|speech|setup|vendor|packing/i.test([item.category, item.task, item.description].filter(Boolean).join(" ")))
      .map((item) => ({
        id: String(item.id),
        category: /music/i.test(item.task) ? "Music" : /speech|toast/i.test(item.task) ? "Speeches" : /setup|place|decor/i.test(item.task) ? "Setup" : /vendor/i.test(item.task) ? "Vendor Contacts" : /pack|ring|kit/i.test(item.task) ? "Packing" : "Ceremony",
        title: item.task,
        note: item.description,
        completed: item.isCompleted,
      })),
    websiteSections: [
      { id: "story", title: "Our Story", status: website ? "Ready" : "Draft", description: "Website content syncs from the desktop editor." },
      { id: "schedule", title: "Schedule", status: website?.published ? "Published" : "Ready", description: "Event schedule and location details." },
      { id: "travel", title: "Travel & Hotels", status: hotelRows.length ? "Ready" : "Draft", description: "Hotel blocks and travel notes." },
      { id: "registry", title: "Registry", status: "Draft", description: "Registry links and guest gifting notes." },
    ],
    invitations: [
      {
        id: "save-date",
        type: "Save the Date",
        status: saveTheDateSent ? "Sent" : profile.saveTheDatePhotoUrl || invitation?.saveTheDatePhotoUrl ? "Draft" : "Draft",
        sent: saveTheDateSent,
        opened: saveTheDateSent,
        responses: confirmedGuests + declinedGuests,
      },
      {
        id: "rsvp",
        type: "RSVP",
        status: invitationSent ? "Sent" : invitation?.rsvpByDate ? "Scheduled" : "Draft",
        sent: invitationSent,
        opened: confirmedGuests + declinedGuests,
        responses: confirmedGuests + declinedGuests,
      },
      {
        id: "digital",
        type: "Digital Invitation",
        status: profile.digitalInvitationPhotoUrl || invitation?.digitalInvitationPhotoUrl ? "Draft" : "Draft",
        sent: invitationSent,
        opened: confirmedGuests + declinedGuests,
        responses: confirmedGuests + declinedGuests,
      },
    ],
    workspaceInvites: collaboratorRows.map((collaborator) => ({
      id: String(collaborator.id),
      email: collaborator.inviteeEmail,
      role: collaboratorRole(collaborator.role),
      status: titleCaseStatus(collaborator.status),
    })),
    activityLog: activityRows.map((activity) => ({
      id: String(activity.id),
      action: activity.action,
      detail: activity.resourceType ? `${activity.resourceType}${activity.userName ? ` by ${activity.userName}` : ""}` : activity.userName || "Workspace update",
      createdAt: activity.createdAt.toISOString(),
      tone: /delete|remove/i.test(activity.action) ? "delete" : /create|add|invite/i.test(activity.action) ? "create" : "update",
    })),
    guestPhotoDrop: guestPhotoSettings(website?.customText),
    guestPhotoUploads: guestPhotoRows.map((upload) => ({
      id: String(upload.id),
      guestEmail: upload.guestEmail ?? undefined,
      guestName: upload.guestName,
      originalName: upload.originalName ?? undefined,
      caption: upload.note ?? "",
      status: titleCaseStatus(upload.status),
      uploadedAt: upload.uploadedAt.toISOString(),
      photoCount: 1,
      imageUrl: upload.imageUrl,
    })),
    settings: {
      emailRemindersEnabled: profile.taskEmailRemindersEnabled,
      deadlineReminderDays: profile.taskReminderDaysBefore,
      pushNotificationsEnabled: profile.taskEmailRemindersEnabled,
      rsvpEmailForwardingEnabled: profile.rsvpEmailNotificationsEnabled,
      rsvpResponseEmails: profile.rsvpNotificationEmails ?? [],
      ariaMemory: profile.ariaMemory ?? "",
    },
  };
}

async function sendMobilePlanningSection(req: Request, res: Response, section?: string) {
  const callerRole = await resolveCallerRole(req);
  if (!hasMinRole(callerRole, "planner")) {
    res.status(403).json({ error: "Insufficient permissions." });
    return;
  }

  const payload = await buildMobilePlanningPayload(req);
  res.json(section ? (payload as Record<string, unknown>)[section] ?? [] : payload);
}

router.get("/mobile/planning", requireAuth, async (req, res) => {
  try {
    await sendMobilePlanningSection(req, res);
  } catch (err) {
    req.log.error(err, "Failed to build mobile planning payload");
    res.status(500).json({ error: "Internal server error" });
  }
});

const mobileSections = {
  profile: "profile",
  vendors: "vendors",
  budget: "budget",
  guests: "guests",
  tasks: "tasks",
  documents: "documents",
  contracts: "contracts",
  "wedding-party": "weddingParty",
  hotels: "hotels",
  seating: "seating",
  "day-of": "dayOf",
  "day-of-checklist": "dayOfChecklist",
  "website-sections": "websiteSections",
  invitations: "invitations",
  "workspace-invites": "workspaceInvites",
  "activity-log": "activityLog",
  "guest-photo-drop": "guestPhotoDrop",
  "guest-photo-uploads": "guestPhotoUploads",
} as const;

for (const [path, section] of Object.entries(mobileSections)) {
  router.get(`/mobile/${path}`, requireAuth, async (req, res) => {
    try {
      await sendMobilePlanningSection(req, res, section);
    } catch (err) {
      req.log.error({ err, section }, "Failed to build mobile planning section");
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

export default router;
