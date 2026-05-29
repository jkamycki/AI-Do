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
import { FROM_EMAIL, sendEmail } from "../lib/resend";

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
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
        email: guest.email || "",
        id: String(guest.id),
        invitationStatus: guest.invitationStatus || "pending",
        name: guest.name,
        rsvpReminderStatus: guest.rsvpReminderStatus || "not_sent",
        rsvp: rsvpStatus(guest.rsvpStatus),
        saveTheDateStatus: guest.saveTheDateStatus || "not_sent",
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

router.post("/mobile/invitation-studio/test", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }

    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(400).json({ error: "No wedding profile found." });
      return;
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Enter a valid test email address." });
      return;
    }

    const type = req.body?.type === "saveTheDate" ? "saveTheDate" : "rsvp";
    const coupleNames = typeof req.body?.coupleNames === "string" && req.body.coupleNames.trim()
      ? req.body.coupleNames.trim().slice(0, 160)
      : [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The couple";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 800) : "";
    const rsvpBy = typeof req.body?.rsvpBy === "string" ? req.body.rsvpBy.trim().slice(0, 40) : "";
    const accent = typeof req.body?.accent === "string" && /^#[0-9a-f]{6}$/i.test(req.body.accent) ? req.body.accent : "#8D294D";
    const textColor = typeof req.body?.textColor === "string" && /^#[0-9a-f]{6}$/i.test(req.body.textColor) ? req.body.textColor : "#3B1C2B";
    const weddingDate = profile.weddingDate
      ? new Date(`${profile.weddingDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "Wedding date coming soon";
    const title = type === "saveTheDate" ? "Save the Date" : "You're invited";
    const action = type === "saveTheDate" ? "Formal invitation to follow." : (rsvpBy ? `Please RSVP by ${rsvpBy}.` : "Please RSVP when you receive your invitation.");
    const safeMessage = escapeHtml(message || (type === "saveTheDate"
      ? `Please save ${weddingDate} for ${coupleNames}'s wedding.`
      : `We are so excited to celebrate with you at ${coupleNames}'s wedding.`));

    const html = `
      <div style="margin:0;padding:28px;background:#fff7f2;font-family:Arial,Helvetica,sans-serif;color:${textColor};">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ead8cf;border-radius:22px;overflow:hidden;">
          <div style="padding:34px 28px;text-align:center;">
            <p style="margin:0 0 10px;text-transform:uppercase;letter-spacing:0.22em;font-size:12px;color:${accent};font-weight:700;">A.I DO Test</p>
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.05;color:${accent};">${escapeHtml(title)}</h1>
            <p style="margin:18px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;color:${textColor};">${escapeHtml(coupleNames)}</p>
            <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:${textColor};">${escapeHtml(weddingDate)}${profile.venue ? ` · ${escapeHtml(profile.venue)}` : ""}</p>
            <p style="margin:24px 0 0;font-size:15px;line-height:1.8;color:${textColor};">${safeMessage}</p>
            <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:${textColor};">${escapeHtml(action)}</p>
          </div>
        </div>
      </div>`;

    const result = await sendEmail({
      to: email,
      replyTo: FROM_EMAIL,
      fromName: `${coupleNames} via A.IDO`,
      subject: `${type === "saveTheDate" ? "Save the Date" : "RSVP Invitation"} test - ${coupleNames}`,
      text: `A.I DO test\n\n${title}\n${coupleNames}\n${weddingDate}${profile.venue ? ` at ${profile.venue}` : ""}\n\n${message}\n\n${action}`,
      html,
    });

    if (!result.ok) {
      res.status(502).json({ error: result.error || "Could not send test email." });
      return;
    }

    res.json({ emailSent: true, email, id: result.id ?? null });
  } catch (err) {
    req.log.error(err, "Failed to send mobile invitation studio test");
    res.status(500).json({ error: "Could not send test email." });
  }
});

export default router;
