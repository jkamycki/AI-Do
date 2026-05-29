import { Router } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  budgetItems,
  budgets,
  checklistItems,
  db,
  guests,
  hotelBlocks,
  seatingCharts,
  vendorPayments,
  vendors,
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

router.get("/mobile/planning", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }

    const profile = await resolveProfile(req);
    if (!profile) {
      res.json({});
      return;
    }

    const [
      vendorRows,
      budgetRows,
      guestRows,
      checklistRows,
      partyRows,
      hotelRows,
      chartRows,
      websiteRows,
    ] = await Promise.all([
      db.select().from(vendors).where(eq(vendors.profileId, profile.id)).orderBy(vendors.createdAt),
      db.select().from(budgets).where(eq(budgets.profileId, profile.id)).orderBy(desc(budgets.id)).limit(1),
      db.select().from(guests).where(eq(guests.profileId, profile.id)).orderBy(guests.createdAt),
      db.select().from(checklistItems).where(eq(checklistItems.profileId, profile.id)).orderBy(checklistItems.id),
      db.select().from(weddingParty).where(eq(weddingParty.profileId, profile.id)).orderBy(weddingParty.sortOrder),
      db.select().from(hotelBlocks).where(eq(hotelBlocks.profileId, profile.id)).orderBy(hotelBlocks.createdAt),
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
    res.json({
      profile: {
        coupleName: `${profile.partner1Name} & ${profile.partner2Name}`,
        partnerOne: profile.partner1Name,
        partnerTwo: profile.partner2Name,
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
        id: String(guest.id),
        name: guest.name,
        rsvp: rsvpStatus(guest.rsvpStatus),
        mealPreference: guest.mealChoice || "Guest",
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
        address: [hotel.address, hotel.city, hotel.state].filter(Boolean).join(", "),
        roomsBooked: hotel.roomsBooked,
        roomsTotal: hotel.roomsReserved ?? hotel.roomsBooked,
        rate: money(hotel.pricePerNight),
        deadline: hotel.cutoffDate || "",
        shuttle: false,
        contact: hotel.email || hotel.phone || "",
      })),
      seating: mobileSeating,
      websiteSections: [
        { id: "story", title: "Our Story", status: website ? "Ready" : "Draft", description: "Website content syncs from the desktop editor." },
        { id: "schedule", title: "Schedule", status: website?.published ? "Published" : "Ready", description: "Event schedule and location details." },
        { id: "travel", title: "Travel & Hotels", status: hotelRows.length ? "Ready" : "Draft", description: "Hotel blocks and travel notes." },
        { id: "registry", title: "Registry", status: "Draft", description: "Registry links and guest gifting notes." },
      ],
      settings: {
        emailRemindersEnabled: profile.taskEmailRemindersEnabled,
        deadlineReminderDays: profile.taskReminderDaysBefore,
        rsvpEmailForwardingEnabled: profile.rsvpEmailNotificationsEnabled,
        rsvpResponseEmails: profile.rsvpNotificationEmails ?? [],
        ariaMemory: profile.ariaMemory ?? "",
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to build mobile planning payload");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/mobile/profile", requireAuth, async (req, res) => {
  const profile = await resolveProfile(req);
  res.json(profile ?? {});
});

export default router;
