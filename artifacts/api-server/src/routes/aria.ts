import { Router } from "express";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import {
  db, vendors, vendorPayments, checklistItems, weddingProfiles, timelines,
  guests, weddingParty, hotelBlocks, manualExpenses, budgets, budgetItems, budgetPaymentLogs,
  vendorContracts,
} from "@workspace/db";
import { eq, desc, and, asc, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { aiLimiter, incrementDailyAria } from "../middlewares/rateLimiter";
import { resolveProfile, resolveScopeUserId, resolveWorkspaceRole, hasMinRole, logActivity } from "../lib/workspaceAccess";
import { getAuth } from "@clerk/express";
import type { Request } from "express";

const router = Router();

const SYSTEM_PROMPT = `You are Aria, an expert AI wedding planning assistant built into A.IDO.
You are warm, confident, and act like a trusted, experienced friend who has helped hundreds of couples plan their weddings.

You can BOTH chat AND take real actions inside the user's A.IDO portal. You can do anything the user can do from the UI:

VENDORS — add_vendor, update_vendor, delete_vendor, list_vendors, add_vendor_payment, update_vendor_payment, mark_vendor_payment_paid, delete_vendor_payment
CHECKLIST — add_checklist_item, update_checklist_item, toggle_checklist_item, delete_checklist_item, list_checklist
TIMELINE — add_timeline_event, update_timeline_event, delete_timeline_event, list_timeline
GUESTS — add_guest, update_guest, delete_guest, list_guests
WEDDING PARTY — add_party_member, update_party_member, delete_party_member, list_party
HOTELS — add_hotel, update_hotel, delete_hotel, list_hotels
BUDGET — add_budget_item, update_budget_item, delete_budget_item, log_budget_payment, list_budget
EXPENSES — add_expense, update_expense, delete_expense, list_expenses
PROFILE — update_profile, get_profile
CONTRACTS — list_contracts, get_contract

## How to use tools
- When the user provides ANY information that maps to a portal action (e.g. "add my florist Sarah Bloom, sarahbloom@email.com, $4000"), CALL THE TOOL IMMEDIATELY. Do not ask for clarification on optional fields — only the required ones.
- For vendors: required = name + category. Pick a sensible category from: Photography, Videography, Catering, Florist, DJ/Band, Venue, Officiant, Hair & Makeup, Transportation, Cake/Desserts, Stationery, Rentals, Planner, Other. Use Other if unsure. If the user provides a depositAmount, a Deposit payment milestone is created automatically — do NOT add a separate add_vendor_payment call for the same deposit. Pass depositPaid: true if the user says they've already paid the deposit.
- For vendor payment milestones: required = vendorName (or vendorId), label, amount, dueDate (YYYY-MM-DD). The vendor must already exist — if it doesn't, add the vendor FIRST, then add the milestone. Convert relative dates ("next Friday", "May 1") into ISO YYYY-MM-DD using the current year, or next year if the date has already passed. If the user gives multiple milestones, call this tool once per milestone.
- For checklist items: required = task + month (use a label like "12 months out", "6 months out", "1 month out", "Week of", "Day of").
- For timeline events: required = time (e.g. "3:00 PM"), title, description, category (preparation|ceremony|cocktail|reception|dancing|other).
- For profile updates: only update the specific fields the user mentions; leave others untouched.
- For guests: required = name. RSVP status is one of: pending, attending, declined, maybe.
- For wedding party: required = name + role + side (bride|groom|both). Roles include Maid of Honor, Best Man, Bridesmaid, Groomsman, Flower Girl, Ring Bearer, Officiant, etc.
- For hotels: required = hotelName.
- For budget items: required = category + vendor + estimatedCost. Categories include Venue, Catering, Photography, Florist, Music, Attire, Beauty, Stationery, Rings, Transportation, Decor, Cake, Other.
- For expenses: required = name + category + cost. These are one-off purchases not tied to a vendor (e.g. ring polish, marriage license fee).
- For UPDATE / DELETE / TOGGLE / MARK-PAID actions: prefer passing the record id when known. If you don't know the id, pass a name/title/match field — the tool will look it up case-insensitively. If multiple records match, the tool will return an error asking you to be more specific. When in doubt, call the corresponding list_* tool first to get ids.
- For destructive operations (delete_*), double-check that the user actually meant to delete before calling. If unclear, ask one short clarifying question.
- For contract questions: first call list_contracts to see what's uploaded, then call get_contract with the relevant id to read the full analysis and extracted text before answering. Never guess contract details — always read the contract data first.
- After successfully running a tool, briefly confirm what you did in plain language ("Added Sarah Bloom to your florists ✓"). Don't dump JSON.
- If a tool fails, explain the error simply and suggest a fix.
- You CAN run multiple tools in one turn (e.g. add a vendor AND add a related checklist item).

## Tone & style
- Warm, encouraging, specific. Markdown renders in chat (bullets, bold, headers).
- Keep replies under 250 words unless a detailed breakdown is needed.
- Celebrate wins, acknowledge stress.

## When NOT to take action
- If the user is just asking advice ("what's a good DJ price?"), answer the question — don't add anything.
- If you are unsure whether the user wants you to add something vs just discuss it, ask one short clarifying question.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "add_vendor",
      description: "Add a vendor to the user's vendor list. Use whenever the user gives you a vendor name + category (or enough info to infer one).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Business or contact name" },
          category: { type: "string", description: "Category (Photography, Catering, Florist, DJ/Band, Venue, etc.)" },
          email: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          notes: { type: "string" },
          totalCost: { type: "number", description: "Estimated or quoted cost in dollars" },
          depositAmount: { type: "number", description: "Deposit amount already agreed or paid. A Deposit payment milestone will be auto-created." },
          depositPaid: { type: "boolean", description: "Set true if the deposit has already been paid. Defaults to false." },
        },
        required: ["name", "category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_vendor_payment",
      description: "Add a payment milestone to an existing vendor (e.g. deposit, second installment, final balance). Provide either vendorId (preferred if known) or vendorName (case-insensitive match against the user's vendor list).",
      parameters: {
        type: "object",
        properties: {
          vendorId: { type: "number", description: "ID of the vendor — preferred when known" },
          vendorName: { type: "string", description: "Name of the vendor (used if vendorId is not provided). Case-insensitive partial match." },
          label: { type: "string", description: "Short label, e.g. 'Deposit', 'Second payment', 'Final balance'" },
          amount: { type: "number", description: "Payment amount in dollars" },
          dueDate: { type: "string", description: "Due date in ISO YYYY-MM-DD format" },
          isPaid: { type: "boolean", description: "True if already paid; defaults to false" },
        },
        required: ["label", "amount", "dueDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_vendor",
      description: "Update fields on an existing vendor. Provide either vendorId or vendorName plus the fields to change.",
      parameters: {
        type: "object",
        properties: {
          vendorId: { type: "number" },
          vendorName: { type: "string" },
          name: { type: "string" }, category: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
          website: { type: "string" }, portalLink: { type: "string" }, notes: { type: "string" },
          totalCost: { type: "number" }, depositAmount: { type: "number" }, contractSigned: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_vendor",
      description: "Delete a vendor and all their payment milestones. Provide vendorId or vendorName.",
      parameters: {
        type: "object",
        properties: { vendorId: { type: "number" }, vendorName: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_vendor_payment",
      description: "Update an existing vendor payment milestone. Pass paymentId (preferred) or vendorName + matchLabel.",
      parameters: {
        type: "object",
        properties: {
          paymentId: { type: "number" },
          vendorName: { type: "string" }, matchLabel: { type: "string", description: "Existing milestone label to match" },
          label: { type: "string" }, amount: { type: "number" }, dueDate: { type: "string" }, isPaid: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mark_vendor_payment_paid",
      description: "Mark a vendor payment milestone as paid. Pass paymentId or vendorName + matchLabel. Pass isPaid=false to undo.",
      parameters: {
        type: "object",
        properties: {
          paymentId: { type: "number" }, vendorName: { type: "string" }, matchLabel: { type: "string" },
          isPaid: { type: "boolean", description: "Defaults to true" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_vendor_payment",
      description: "Delete a vendor payment milestone. Pass paymentId or vendorName + matchLabel.",
      parameters: {
        type: "object",
        properties: { paymentId: { type: "number" }, vendorName: { type: "string" }, matchLabel: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_checklist_item",
      description: "Add a task to the user's wedding checklist.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "Short task title" },
          description: { type: "string" },
          month: { type: "string", description: "Bucket label e.g. '12 months out', '6 months out', '1 month out', 'Week of', 'Day of'" },
        },
        required: ["task", "month"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_checklist_item",
      description: "Update a checklist task's title, description, or month bucket. Pass itemId or matchTask.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "number" }, matchTask: { type: "string" },
          task: { type: "string" }, description: { type: "string" }, month: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "toggle_checklist_item",
      description: "Mark a checklist item complete or incomplete. Pass itemId or matchTask, plus isCompleted (defaults true).",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "number" }, matchTask: { type: "string" }, isCompleted: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_checklist_item",
      description: "Delete a checklist item. Pass itemId or matchTask.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "number" }, matchTask: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_checklist",
      description: "List all checklist items grouped by month bucket.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_timeline_event",
      description: "Add a single event to the existing day-of timeline. If no timeline exists yet, this will create one.",
      parameters: {
        type: "object",
        properties: {
          time: { type: "string", description: "Time string e.g. '3:00 PM'" },
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: ["preparation", "ceremony", "cocktail", "reception", "dancing", "other"] },
        },
        required: ["time", "title", "description", "category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_timeline_event",
      description: "Update an existing day-of timeline event. Match by matchTitle (case-insensitive substring) or matchTime.",
      parameters: {
        type: "object",
        properties: {
          matchTitle: { type: "string" }, matchTime: { type: "string" },
          time: { type: "string" }, title: { type: "string" }, description: { type: "string" },
          category: { type: "string", enum: ["preparation", "ceremony", "cocktail", "reception", "dancing", "other"] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_timeline_event",
      description: "Delete a timeline event by matching title (case-insensitive substring) or exact time.",
      parameters: {
        type: "object",
        properties: { matchTitle: { type: "string" }, matchTime: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_timeline",
      description: "List all day-of timeline events in order.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_guest",
      description: "Add a guest to the wedding guest list.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
          rsvpStatus: { type: "string", enum: ["pending", "attending", "declined", "maybe"] },
          mealChoice: { type: "string" }, dietaryNotes: { type: "string" },
          guestGroup: { type: "string", description: "e.g. Family, Friends, Work, Plus One" },
          plusOne: { type: "boolean" }, plusOneName: { type: "string" },
          tableAssignment: { type: "string" }, notes: { type: "string" },
          address: { type: "string" }, guestCity: { type: "string" }, guestState: { type: "string" }, guestZip: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_guest",
      description: "Update fields on a guest. Pass guestId or matchName.",
      parameters: {
        type: "object",
        properties: {
          guestId: { type: "number" }, matchName: { type: "string" },
          name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
          rsvpStatus: { type: "string", enum: ["pending", "attending", "declined", "maybe"] },
          mealChoice: { type: "string" }, dietaryNotes: { type: "string" },
          guestGroup: { type: "string" }, plusOne: { type: "boolean" }, plusOneName: { type: "string" },
          tableAssignment: { type: "string" }, notes: { type: "string" },
          address: { type: "string" }, guestCity: { type: "string" }, guestState: { type: "string" }, guestZip: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_guest",
      description: "Remove a guest. Pass guestId or matchName.",
      parameters: {
        type: "object",
        properties: { guestId: { type: "number" }, matchName: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_guests",
      description: "List all guests with id, name, RSVP, meal, plus-one info.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_party_member",
      description: "Add a wedding party member (bridesmaid, groomsman, etc.).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" }, role: { type: "string" },
          side: { type: "string", enum: ["bride", "groom", "both"] },
          phone: { type: "string" }, email: { type: "string" },
          outfitDetails: { type: "string" }, shoeSize: { type: "string" }, outfitStore: { type: "string" },
          fittingDate: { type: "string", description: "YYYY-MM-DD" }, notes: { type: "string" },
        },
        required: ["name", "role", "side"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_party_member",
      description: "Update a wedding party member. Pass memberId or matchName.",
      parameters: {
        type: "object",
        properties: {
          memberId: { type: "number" }, matchName: { type: "string" },
          name: { type: "string" }, role: { type: "string" }, side: { type: "string" },
          phone: { type: "string" }, email: { type: "string" },
          outfitDetails: { type: "string" }, shoeSize: { type: "string" }, outfitStore: { type: "string" },
          fittingDate: { type: "string" }, notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_party_member",
      description: "Remove a wedding party member. Pass memberId or matchName.",
      parameters: {
        type: "object",
        properties: { memberId: { type: "number" }, matchName: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_party",
      description: "List wedding party members.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_hotel",
      description: "Add a hotel block for out-of-town guests.",
      parameters: {
        type: "object",
        properties: {
          hotelName: { type: "string" }, address: { type: "string" }, city: { type: "string" },
          state: { type: "string" }, zip: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
          bookingLink: { type: "string" }, discountCode: { type: "string" }, groupName: { type: "string" },
          cutoffDate: { type: "string", description: "YYYY-MM-DD" },
          roomsReserved: { type: "number" }, pricePerNight: { type: "number" },
          distanceFromVenue: { type: "string" }, notes: { type: "string" },
        },
        required: ["hotelName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_hotel",
      description: "Update a hotel block. Pass hotelId or matchName.",
      parameters: {
        type: "object",
        properties: {
          hotelId: { type: "number" }, matchName: { type: "string" },
          hotelName: { type: "string" }, address: { type: "string" }, city: { type: "string" },
          state: { type: "string" }, zip: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
          bookingLink: { type: "string" }, discountCode: { type: "string" }, groupName: { type: "string" },
          cutoffDate: { type: "string" }, roomsReserved: { type: "number" }, roomsBooked: { type: "number" },
          pricePerNight: { type: "number" }, distanceFromVenue: { type: "string" }, notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_hotel",
      description: "Delete a hotel block. Pass hotelId or matchName.",
      parameters: {
        type: "object",
        properties: { hotelId: { type: "number" }, matchName: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_hotels",
      description: "List all hotel blocks.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_budget_item",
      description: "Add a budget line item (estimated cost for a category, optionally tied to a vendor name).",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" }, vendor: { type: "string" },
          estimatedCost: { type: "number" }, actualCost: { type: "number" },
          notes: { type: "string" },
        },
        required: ["category", "vendor", "estimatedCost"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_budget_item",
      description: "Update a budget item. Pass itemId or matchVendor (matches vendor name).",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "number" }, matchVendor: { type: "string" },
          category: { type: "string" }, vendor: { type: "string" },
          estimatedCost: { type: "number" }, actualCost: { type: "number" },
          notes: { type: "string" }, isPaid: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_budget_item",
      description: "Delete a budget item. Pass itemId or matchVendor.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "number" }, matchVendor: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_budget_payment",
      description: "Record a payment against a budget item (adds to amountPaid). Pass itemId or matchVendor.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "number" }, matchVendor: { type: "string" },
          amount: { type: "number" }, note: { type: "string" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_budget",
      description: "List all budget items with category, vendor, estimated/actual/paid amounts.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_expense",
      description: "Add a one-off expense (not tied to a vendor) — e.g. marriage license, gifts, supplies.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" }, category: { type: "string" },
          cost: { type: "number" }, amountPaid: { type: "number" }, notes: { type: "string" },
        },
        required: ["name", "category", "cost"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_expense",
      description: "Update an expense. Pass expenseId or matchName.",
      parameters: {
        type: "object",
        properties: {
          expenseId: { type: "number" }, matchName: { type: "string" },
          name: { type: "string" }, category: { type: "string" },
          cost: { type: "number" }, amountPaid: { type: "number" }, notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_expense",
      description: "Delete an expense. Pass expenseId or matchName.",
      parameters: {
        type: "object",
        properties: { expenseId: { type: "number" }, matchName: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_expenses",
      description: "List all manual expenses.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_profile",
      description: "Update one or more fields on the user's wedding profile. Only include fields the user explicitly wants to change.",
      parameters: {
        type: "object",
        properties: {
          partner1Name: { type: "string" },
          partner2Name: { type: "string" },
          weddingDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          ceremonyTime: { type: "string" },
          receptionTime: { type: "string" },
          venue: { type: "string" },
          location: { type: "string" },
          guestCount: { type: "number" },
          totalBudget: { type: "number" },
          weddingVibe: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_vendors",
      description: "List all vendors currently in the user's vendor list. Use to avoid duplicates or to reference existing vendors.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_profile",
      description: "Get the current wedding profile details (date, venue, budget, etc.) for context.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_contracts",
      description: "List all contracts the user has uploaded to the Contract Analyzer. Returns id, fileName, vendor type, risk level, and summary for each. Use this first when the user asks any question about their contracts.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contract",
      description: "Get the full details of a specific contract — including the complete AI analysis (red flags, key terms, cancellation policy, payment terms, liability notes, negotiation tips) and the extracted contract text. Use this to answer specific questions about a contract.",
      parameters: {
        type: "object",
        properties: {
          contractId: { type: "number", description: "The id of the contract to retrieve (from list_contracts)" },
        },
        required: ["contractId"],
      },
    },
  },
];

const ALLOWED_VENDOR_CATEGORIES = [
  "Photography", "Videography", "Catering", "Florist", "DJ/Band", "Venue",
  "Officiant", "Hair & Makeup", "Transportation", "Cake/Desserts",
  "Stationery", "Rentals", "Planner", "Other",
];

function normalizeCategory(c: string): string {
  const found = ALLOWED_VENDOR_CATEGORIES.find(a => a.toLowerCase() === c.toLowerCase());
  return found ?? c;
}

type ActionResult = { ok: true; data: unknown } | { ok: false; error: string };
type ActionRecord = { name: string; args: Record<string, unknown>; result: ActionResult };

type FoundVendor = { ok: true; id: number; name: string } | { ok: false; error: string };
type FoundVendorPayment = { ok: true; id: number; vendorId: number; label: string } | { ok: false; error: string };
type FoundChecklistItem = { ok: true; id: number; task: string } | { ok: false; error: string };
type FoundGuest = { ok: true; id: number; name: string } | { ok: false; error: string };
type FoundPartyMember = { ok: true; id: number; name: string } | { ok: false; error: string };
type FoundHotel = { ok: true; id: number; hotelName: string } | { ok: false; error: string };
type FoundBudgetItem = { ok: true; id: number; vendor: string; amountPaid: number; estimatedCost: number; actualCost: number } | { ok: false; error: string };
type FoundExpense = { ok: true; id: number; name: string } | { ok: false; error: string };

async function findVendor(userId: string, idArg: unknown, nameArg: unknown): Promise<FoundVendor> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [v] = await db.select({ id: vendors.id, name: vendors.name }).from(vendors)
        .where(and(eq(vendors.id, idNum), eq(vendors.userId, userId))).limit(1);
      if (v) return { ok: true, id: v.id, name: v.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: vendors.id, name: vendors.name }).from(vendors)
      .where(and(eq(vendors.userId, userId), ilike(vendors.name, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No vendor found matching "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.name.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, name: exact.name };
      return { ok: false, error: `Multiple vendors match "${search}": ${matches.map(m => m.name).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, name: matches[0].name };
  }
  return { ok: false, error: "Either vendorId or vendorName is required." };
}

async function findVendorPayment(userId: string, paymentIdArg: unknown, vendorNameArg: unknown, matchLabelArg: unknown): Promise<FoundVendorPayment> {
  if (paymentIdArg !== undefined && paymentIdArg !== null) {
    const idNum = Number(paymentIdArg);
    if (Number.isFinite(idNum)) {
      const [p] = await db.select({ id: vendorPayments.id, vendorId: vendorPayments.vendorId, label: vendorPayments.label, ownerId: vendors.userId })
        .from(vendorPayments).innerJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
        .where(and(eq(vendorPayments.id, idNum), eq(vendors.userId, userId))).limit(1);
      if (p) return { ok: true, id: p.id, vendorId: p.vendorId, label: p.label };
    }
    return { ok: false, error: "Payment not found or not yours." };
  }
  const v = await findVendor(userId, undefined, vendorNameArg);
  if (!v.ok) return v;
  if (!matchLabelArg) return { ok: false, error: "matchLabel is required when looking up by vendorName." };
  const search = String(matchLabelArg).trim();
  const matches = await db.select({ id: vendorPayments.id, vendorId: vendorPayments.vendorId, label: vendorPayments.label })
    .from(vendorPayments).where(and(eq(vendorPayments.vendorId, v.id), ilike(vendorPayments.label, `%${search}%`)));
  if (matches.length === 0) return { ok: false, error: `No payment matching "${search}" on vendor "${v.name}".` };
  if (matches.length > 1) {
    const exact = matches.find(m => m.label.toLowerCase() === search.toLowerCase());
    if (exact) return { ok: true, id: exact.id, vendorId: exact.vendorId, label: exact.label };
    return { ok: false, error: `Multiple payments match "${search}": ${matches.map(m => m.label).join(", ")}. Be more specific.` };
  }
  return { ok: true, id: matches[0].id, vendorId: matches[0].vendorId, label: matches[0].label };
}

async function syncVendorNextPaymentDue(vendorId: number): Promise<void> {
  const unpaid = await db.select({ dueDate: vendorPayments.dueDate }).from(vendorPayments)
    .where(and(eq(vendorPayments.vendorId, vendorId), eq(vendorPayments.isPaid, false)))
    .orderBy(asc(vendorPayments.dueDate));
  await db.update(vendors).set({ nextPaymentDue: unpaid.length > 0 ? unpaid[0].dueDate : null }).where(eq(vendors.id, vendorId));
}

async function findChecklistItem(profileId: number, idArg: unknown, taskArg: unknown): Promise<FoundChecklistItem> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: checklistItems.id, task: checklistItems.task }).from(checklistItems)
        .where(and(eq(checklistItems.id, idNum), eq(checklistItems.profileId, profileId))).limit(1);
      if (r) return { ok: true, id: r.id, task: r.task };
    }
  }
  if (taskArg) {
    const search = String(taskArg).trim();
    const matches = await db.select({ id: checklistItems.id, task: checklistItems.task }).from(checklistItems)
      .where(and(eq(checklistItems.profileId, profileId), ilike(checklistItems.task, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No checklist item matching "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.task.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, task: exact.task };
      return { ok: false, error: `Multiple items match "${search}": ${matches.map(m => m.task).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, task: matches[0].task };
  }
  return { ok: false, error: "Either itemId or matchTask is required." };
}

async function findGuest(profileId: number, idArg: unknown, nameArg: unknown): Promise<FoundGuest> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: guests.id, name: guests.name }).from(guests)
        .where(and(eq(guests.id, idNum), eq(guests.profileId, profileId))).limit(1);
      if (r) return { ok: true, id: r.id, name: r.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: guests.id, name: guests.name }).from(guests)
      .where(and(eq(guests.profileId, profileId), ilike(guests.name, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No guest matching "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.name.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, name: exact.name };
      return { ok: false, error: `Multiple guests match "${search}": ${matches.map(m => m.name).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, name: matches[0].name };
  }
  return { ok: false, error: "Either guestId or matchName is required." };
}

async function findPartyMember(userId: string, idArg: unknown, nameArg: unknown): Promise<FoundPartyMember> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: weddingParty.id, name: weddingParty.name }).from(weddingParty)
        .where(and(eq(weddingParty.id, idNum), eq(weddingParty.userId, userId))).limit(1);
      if (r) return { ok: true, id: r.id, name: r.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: weddingParty.id, name: weddingParty.name }).from(weddingParty)
      .where(and(eq(weddingParty.userId, userId), ilike(weddingParty.name, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No wedding party member matching "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.name.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, name: exact.name };
      return { ok: false, error: `Multiple members match "${search}": ${matches.map(m => m.name).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, name: matches[0].name };
  }
  return { ok: false, error: "Either memberId or matchName is required." };
}

async function findHotel(userId: string, idArg: unknown, nameArg: unknown): Promise<FoundHotel> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: hotelBlocks.id, hotelName: hotelBlocks.hotelName }).from(hotelBlocks)
        .where(and(eq(hotelBlocks.id, idNum), eq(hotelBlocks.userId, userId))).limit(1);
      if (r) return { ok: true, id: r.id, hotelName: r.hotelName };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: hotelBlocks.id, hotelName: hotelBlocks.hotelName }).from(hotelBlocks)
      .where(and(eq(hotelBlocks.userId, userId), ilike(hotelBlocks.hotelName, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No hotel matching "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.hotelName.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, hotelName: exact.hotelName };
      return { ok: false, error: `Multiple hotels match "${search}": ${matches.map(m => m.hotelName).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, hotelName: matches[0].hotelName };
  }
  return { ok: false, error: "Either hotelId or matchName is required." };
}

async function ensureBudget(profileId: number, profileTotalBudget: string | number) {
  const [existing] = await db.select().from(budgets).where(eq(budgets.profileId, profileId)).limit(1);
  if (existing) return existing;
  await db.insert(budgets)
    .values({ profileId, totalBudget: String(profileTotalBudget ?? 0) })
    .onConflictDoNothing({ target: budgets.profileId });
  const [row] = await db.select().from(budgets).where(eq(budgets.profileId, profileId)).limit(1);
  return row;
}

async function findBudgetItem(budgetId: number, idArg: unknown, vendorArg: unknown): Promise<FoundBudgetItem> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select().from(budgetItems)
        .where(and(eq(budgetItems.id, idNum), eq(budgetItems.budgetId, budgetId))).limit(1);
      if (r) return { ok: true, id: r.id, vendor: r.vendor, amountPaid: Number(r.amountPaid), estimatedCost: Number(r.estimatedCost), actualCost: Number(r.actualCost) };
    }
  }
  if (vendorArg) {
    const search = String(vendorArg).trim();
    const matches = await db.select().from(budgetItems)
      .where(and(eq(budgetItems.budgetId, budgetId), ilike(budgetItems.vendor, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No budget item matching vendor "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.vendor.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, vendor: exact.vendor, amountPaid: Number(exact.amountPaid), estimatedCost: Number(exact.estimatedCost), actualCost: Number(exact.actualCost) };
      return { ok: false, error: `Multiple items match "${search}": ${matches.map(m => m.vendor).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, vendor: matches[0].vendor, amountPaid: Number(matches[0].amountPaid), estimatedCost: Number(matches[0].estimatedCost), actualCost: Number(matches[0].actualCost) };
  }
  return { ok: false, error: "Either itemId or matchVendor is required." };
}

async function findExpense(userId: string, idArg: unknown, nameArg: unknown): Promise<FoundExpense> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: manualExpenses.id, name: manualExpenses.name }).from(manualExpenses)
        .where(and(eq(manualExpenses.id, idNum), eq(manualExpenses.userId, userId))).limit(1);
      if (r) return { ok: true, id: r.id, name: r.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: manualExpenses.id, name: manualExpenses.name }).from(manualExpenses)
      .where(and(eq(manualExpenses.userId, userId), ilike(manualExpenses.name, `%${search}%`)));
    if (matches.length === 0) return { ok: false, error: `No expense matching "${search}".` };
    if (matches.length > 1) {
      const exact = matches.find(m => m.name.toLowerCase() === search.toLowerCase());
      if (exact) return { ok: true, id: exact.id, name: exact.name };
      return { ok: false, error: `Multiple expenses match "${search}": ${matches.map(m => m.name).join(", ")}. Be more specific.` };
    }
    return { ok: true, id: matches[0].id, name: matches[0].name };
  }
  return { ok: false, error: "Either expenseId or matchName is required." };
}

async function executeTool(name: string, args: Record<string, unknown>, req: Request): Promise<ActionResult> {
  try {
    if (name === "add_vendor") {
      const userId = await resolveScopeUserId(req);
      const vendorName = String(args.name ?? "").trim();
      const category = normalizeCategory(String(args.category ?? "Other").trim());
      if (!vendorName) return { ok: false, error: "Vendor name is required" };
      const depositAmt = Number(args.depositAmount ?? 0);
      const todayISO = new Date().toISOString().slice(0, 10);
      const [created] = await db.insert(vendors).values({
        userId,
        name: vendorName,
        category,
        email: args.email ? String(args.email) : null,
        phone: args.phone ? String(args.phone) : null,
        website: args.website ? String(args.website) : null,
        portalLink: null,
        notes: args.notes ? String(args.notes) : null,
        totalCost: String(Number(args.totalCost ?? 0)),
        depositAmount: String(depositAmt),
        contractSigned: false,
        nextPaymentDue: null,
        files: [],
      }).returning();

      // Auto-create a Deposit payment milestone when a deposit amount is provided
      if (depositAmt > 0) {
        const depositPaid = args.depositPaid === true;
        await db.insert(vendorPayments).values({
          vendorId: created.id,
          label: "Deposit",
          amount: String(depositAmt),
          dueDate: todayISO,
          isPaid: depositPaid,
          paidAt: depositPaid ? new Date() : null,
        });
        if (!depositPaid) {
          await db.update(vendors).set({ nextPaymentDue: todayISO }).where(eq(vendors.id, created.id));
        }
      }

      return { ok: true, data: { id: created.id, name: created.name, category: created.category, depositMilestoneCreated: depositAmt > 0 } };
    }

    if (name === "add_vendor_payment") {
      const userId = await resolveScopeUserId(req);
      const label = String(args.label ?? "").trim();
      const amountNum = Number(args.amount);
      const dueDate = String(args.dueDate ?? "").trim();
      if (!label) return { ok: false, error: "Payment label is required (e.g. 'Deposit')" };
      if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false, error: "Amount must be a positive number" };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, error: "dueDate must be ISO YYYY-MM-DD" };

      let vendorId: number | null = null;
      if (args.vendorId !== undefined && args.vendorId !== null) {
        const idNum = Number(args.vendorId);
        if (Number.isFinite(idNum)) {
          const [v] = await db.select({ id: vendors.id }).from(vendors)
            .where(and(eq(vendors.id, idNum), eq(vendors.userId, userId))).limit(1);
          if (v) vendorId = v.id;
        }
      }
      if (vendorId === null && args.vendorName) {
        const search = String(args.vendorName).trim();
        const matches = await db.select({ id: vendors.id, name: vendors.name }).from(vendors)
          .where(and(eq(vendors.userId, userId), ilike(vendors.name, `%${search}%`)));
        if (matches.length === 0) {
          return { ok: false, error: `No vendor found matching "${search}". Add the vendor first using add_vendor.` };
        }
        if (matches.length > 1) {
          const exact = matches.find(m => m.name.toLowerCase() === search.toLowerCase());
          if (exact) vendorId = exact.id;
          else return { ok: false, error: `Multiple vendors match "${search}": ${matches.map(m => m.name).join(", ")}. Be more specific.` };
        } else {
          vendorId = matches[0].id;
        }
      }
      if (vendorId === null) {
        return { ok: false, error: "Either vendorId or vendorName is required to attach a payment milestone." };
      }

      const isPaid = Boolean(args.isPaid);
      const [payment] = await db.insert(vendorPayments).values({
        vendorId,
        label,
        amount: String(amountNum),
        dueDate,
        isPaid,
        paidAt: isPaid ? new Date() : null,
      }).returning();

      // Sync vendor.nextPaymentDue to the earliest unpaid milestone
      const unpaid = await db
        .select({ dueDate: vendorPayments.dueDate })
        .from(vendorPayments)
        .where(and(eq(vendorPayments.vendorId, vendorId), eq(vendorPayments.isPaid, false)))
        .orderBy(asc(vendorPayments.dueDate));
      const nextDate = unpaid.length > 0 ? unpaid[0].dueDate : null;
      await db.update(vendors).set({ nextPaymentDue: nextDate }).where(eq(vendors.id, vendorId));

      return { ok: true, data: { id: payment.id, vendorId, label: payment.label, amount: Number(payment.amount), dueDate: payment.dueDate, isPaid: payment.isPaid } };
    }

    if (name === "add_checklist_item") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Please complete your wedding profile before adding checklist items." };
      const task = String(args.task ?? "").trim();
      const month = String(args.month ?? "").trim();
      if (!task || !month) return { ok: false, error: "task and month are required" };
      const [item] = await db.insert(checklistItems).values({
        profileId: profile.id,
        task,
        month,
        description: args.description ? String(args.description) : "",
      }).returning();
      return { ok: true, data: { id: item.id, task: item.task, month: item.month } };
    }

    if (name === "add_timeline_event") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Please complete your wedding profile before adding timeline events." };
      const event = {
        time: String(args.time ?? ""),
        title: String(args.title ?? ""),
        description: String(args.description ?? ""),
        category: String(args.category ?? "other"),
      };
      const [latest] = await db.select().from(timelines).where(eq(timelines.profileId, profile.id)).orderBy(desc(timelines.id)).limit(1);
      if (latest) {
        const events = Array.isArray(latest.events) ? [...latest.events, event] : [event];
        await db.update(timelines).set({ events }).where(eq(timelines.id, latest.id));
        return { ok: true, data: { added: event, totalEvents: events.length } };
      } else {
        await db.insert(timelines).values({ profileId: profile.id, events: [event] });
        return { ok: true, data: { added: event, totalEvents: 1 } };
      }
    }

    // ===== VENDORS update/delete =====
    if (name === "update_vendor") {
      const userId = await resolveScopeUserId(req);
      const vendor = await findVendor(userId, args.vendorId, args.vendorName);
      if (!vendor.ok) return vendor;
      const updates: Partial<typeof vendors.$inferInsert> = {};
      if (args.name !== undefined) updates.name = String(args.name);
      if (args.category !== undefined) updates.category = normalizeCategory(String(args.category));
      if (args.email !== undefined) updates.email = args.email ? String(args.email) : null;
      if (args.phone !== undefined) updates.phone = args.phone ? String(args.phone) : null;
      if (args.website !== undefined) updates.website = args.website ? String(args.website) : null;
      if (args.portalLink !== undefined) updates.portalLink = args.portalLink ? String(args.portalLink) : null;
      if (args.notes !== undefined) updates.notes = args.notes ? String(args.notes) : null;
      if (args.totalCost !== undefined) updates.totalCost = String(Number(args.totalCost));
      if (args.depositAmount !== undefined) updates.depositAmount = String(Number(args.depositAmount));
      if (args.contractSigned !== undefined) updates.contractSigned = Boolean(args.contractSigned);
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      updates.updatedAt = new Date();
      const [updated] = await db.update(vendors).set(updates)
        .where(and(eq(vendors.id, vendor.id), eq(vendors.userId, userId))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name, updated: Object.keys(updates).filter(k=>k!=="updatedAt") } };
    }

    if (name === "delete_vendor") {
      const userId = await resolveScopeUserId(req);
      const vendor = await findVendor(userId, args.vendorId, args.vendorName);
      if (!vendor.ok) return vendor;
      await db.delete(vendorPayments).where(eq(vendorPayments.vendorId, vendor.id));
      await db.delete(vendors).where(and(eq(vendors.id, vendor.id), eq(vendors.userId, userId)));
      return { ok: true, data: { deleted: vendor.name } };
    }

    // ===== VENDOR PAYMENTS update/mark/delete =====
    if (name === "update_vendor_payment" || name === "mark_vendor_payment_paid" || name === "delete_vendor_payment") {
      const userId = await resolveScopeUserId(req);
      const payment = await findVendorPayment(userId, args.paymentId, args.vendorName, args.matchLabel);
      if (!payment.ok) return payment;
      if (name === "delete_vendor_payment") {
        await db.delete(vendorPayments).where(eq(vendorPayments.id, payment.id));
        await syncVendorNextPaymentDue(payment.vendorId);
        return { ok: true, data: { deleted: payment.label } };
      }
      const updates: Partial<typeof vendorPayments.$inferInsert> = {};
      if (name === "mark_vendor_payment_paid") {
        const isPaid = args.isPaid === undefined ? true : Boolean(args.isPaid);
        updates.isPaid = isPaid;
        updates.paidAt = isPaid ? new Date() : null;
      } else {
        if (args.label !== undefined) updates.label = String(args.label);
        if (args.amount !== undefined) updates.amount = String(Number(args.amount));
        if (args.dueDate !== undefined) {
          const d = String(args.dueDate);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, error: "dueDate must be ISO YYYY-MM-DD" };
          updates.dueDate = d;
        }
        if (args.isPaid !== undefined) {
          updates.isPaid = Boolean(args.isPaid);
          updates.paidAt = updates.isPaid ? new Date() : null;
        }
      }
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(vendorPayments).set(updates).where(eq(vendorPayments.id, payment.id)).returning();
      await syncVendorNextPaymentDue(payment.vendorId);
      return { ok: true, data: { id: updated.id, label: updated.label, isPaid: updated.isPaid, amount: Number(updated.amount), dueDate: updated.dueDate } };
    }

    // ===== CHECKLIST =====
    if (name === "update_checklist_item" || name === "toggle_checklist_item" || name === "delete_checklist_item") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const item = await findChecklistItem(profile.id, args.itemId, args.matchTask);
      if (!item.ok) return item;
      if (name === "delete_checklist_item") {
        await db.delete(checklistItems).where(and(eq(checklistItems.id, item.id), eq(checklistItems.profileId, profile.id)));
        return { ok: true, data: { deleted: item.task } };
      }
      const updates: Partial<typeof checklistItems.$inferInsert> = {};
      if (name === "toggle_checklist_item") {
        const isCompleted = args.isCompleted === undefined ? true : Boolean(args.isCompleted);
        updates.isCompleted = isCompleted;
        updates.completedAt = isCompleted ? new Date() : null;
      } else {
        if (args.task !== undefined) updates.task = String(args.task);
        if (args.description !== undefined) updates.description = String(args.description);
        if (args.month !== undefined) updates.month = String(args.month);
      }
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(checklistItems).set(updates)
        .where(and(eq(checklistItems.id, item.id), eq(checklistItems.profileId, profile.id))).returning();
      return { ok: true, data: { id: updated.id, task: updated.task, isCompleted: updated.isCompleted } };
    }

    if (name === "list_checklist") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const items = await db.select({ id: checklistItems.id, task: checklistItems.task, month: checklistItems.month, isCompleted: checklistItems.isCompleted })
        .from(checklistItems).where(eq(checklistItems.profileId, profile.id));
      return { ok: true, data: { items } };
    }

    // ===== TIMELINE update/delete/list =====
    if (name === "update_timeline_event" || name === "delete_timeline_event") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const [latest] = await db.select().from(timelines).where(eq(timelines.profileId, profile.id)).orderBy(desc(timelines.id)).limit(1);
      if (!latest || !Array.isArray(latest.events) || latest.events.length === 0) {
        return { ok: false, error: "No timeline events found." };
      }
      const events = [...latest.events];
      const matchTitle = args.matchTitle ? String(args.matchTitle).toLowerCase() : null;
      const matchTime = args.matchTime ? String(args.matchTime).toLowerCase() : null;
      const indices = events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) =>
          (matchTitle && e.title.toLowerCase().includes(matchTitle)) ||
          (matchTime && e.time.toLowerCase() === matchTime),
        );
      if (indices.length === 0) return { ok: false, error: "No matching event found." };
      if (indices.length > 1) return { ok: false, error: `Multiple events match: ${indices.map(x => `"${x.e.title}" @ ${x.e.time}`).join(", ")}. Be more specific.` };
      const idx = indices[0].i;
      if (name === "delete_timeline_event") {
        const removed = events[idx];
        events.splice(idx, 1);
        await db.update(timelines).set({ events }).where(eq(timelines.id, latest.id));
        return { ok: true, data: { deleted: removed, totalEvents: events.length } };
      }
      const updated = { ...events[idx] };
      if (args.time !== undefined) updated.time = String(args.time);
      if (args.title !== undefined) updated.title = String(args.title);
      if (args.description !== undefined) updated.description = String(args.description);
      if (args.category !== undefined) updated.category = String(args.category);
      events[idx] = updated;
      await db.update(timelines).set({ events }).where(eq(timelines.id, latest.id));
      return { ok: true, data: { updated, totalEvents: events.length } };
    }

    if (name === "list_timeline") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const [latest] = await db.select().from(timelines).where(eq(timelines.profileId, profile.id)).orderBy(desc(timelines.id)).limit(1);
      return { ok: true, data: { events: latest?.events ?? [] } };
    }

    // ===== GUESTS =====
    if (name === "add_guest") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const guestName = String(args.name ?? "").trim();
      if (!guestName) return { ok: false, error: "Guest name is required" };
      const [created] = await db.insert(guests).values({
        profileId: profile.id,
        name: guestName,
        email: args.email ? String(args.email) : null,
        phone: args.phone ? String(args.phone) : null,
        rsvpStatus: args.rsvpStatus ? String(args.rsvpStatus) : "pending",
        mealChoice: args.mealChoice ? String(args.mealChoice) : null,
        dietaryNotes: args.dietaryNotes ? String(args.dietaryNotes) : null,
        guestGroup: args.guestGroup ? String(args.guestGroup) : null,
        plusOne: Boolean(args.plusOne),
        plusOneName: args.plusOneName ? String(args.plusOneName) : null,
        tableAssignment: args.tableAssignment ? String(args.tableAssignment) : null,
        notes: args.notes ? String(args.notes) : null,
        address: args.address ? String(args.address) : null,
        guestCity: args.guestCity ? String(args.guestCity) : null,
        guestState: args.guestState ? String(args.guestState) : null,
        guestZip: args.guestZip ? String(args.guestZip) : null,
      }).returning();
      return { ok: true, data: { id: created.id, name: created.name } };
    }

    if (name === "update_guest" || name === "delete_guest") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const guest = await findGuest(profile.id, args.guestId, args.matchName);
      if (!guest.ok) return guest;
      if (name === "delete_guest") {
        await db.delete(guests).where(and(eq(guests.id, guest.id), eq(guests.profileId, profile.id)));
        return { ok: true, data: { deleted: guest.name } };
      }
      const updates: Partial<typeof guests.$inferInsert> = {};
      const stringFields = ["name","email","phone","rsvpStatus","mealChoice","dietaryNotes","guestGroup","plusOneName","tableAssignment","notes","address","guestCity","guestState","guestZip"] as const;
      for (const f of stringFields) {
        if (args[f] !== undefined) (updates as Record<string, unknown>)[f] = args[f] === null || args[f] === "" ? null : String(args[f]);
      }
      if (args.plusOne !== undefined) updates.plusOne = Boolean(args.plusOne);
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(guests).set(updates)
        .where(and(eq(guests.id, guest.id), eq(guests.profileId, profile.id))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name, rsvpStatus: updated.rsvpStatus } };
    }

    if (name === "list_guests") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const rows = await db.select({ id: guests.id, name: guests.name, rsvpStatus: guests.rsvpStatus, mealChoice: guests.mealChoice, plusOne: guests.plusOne, plusOneName: guests.plusOneName, tableAssignment: guests.tableAssignment })
        .from(guests).where(eq(guests.profileId, profile.id));
      return { ok: true, data: { guests: rows } };
    }

    // ===== WEDDING PARTY =====
    if (name === "add_party_member") {
      const userId = await resolveScopeUserId(req);
      const memberName = String(args.name ?? "").trim();
      const role = String(args.role ?? "").trim();
      const side = String(args.side ?? "").trim();
      if (!memberName || !role || !side) return { ok: false, error: "name, role, and side are required" };
      const [created] = await db.insert(weddingParty).values({
        userId, name: memberName, role, side,
        phone: args.phone ? String(args.phone) : null,
        email: args.email ? String(args.email) : null,
        outfitDetails: args.outfitDetails ? String(args.outfitDetails) : null,
        shoeSize: args.shoeSize ? String(args.shoeSize) : null,
        outfitStore: args.outfitStore ? String(args.outfitStore) : null,
        fittingDate: args.fittingDate ? String(args.fittingDate) : null,
        notes: args.notes ? String(args.notes) : null,
      }).returning();
      return { ok: true, data: { id: created.id, name: created.name, role: created.role } };
    }

    if (name === "update_party_member" || name === "delete_party_member") {
      const userId = await resolveScopeUserId(req);
      const member = await findPartyMember(userId, args.memberId, args.matchName);
      if (!member.ok) return member;
      if (name === "delete_party_member") {
        await db.delete(weddingParty).where(and(eq(weddingParty.id, member.id), eq(weddingParty.userId, userId)));
        return { ok: true, data: { deleted: member.name } };
      }
      const updates: Partial<typeof weddingParty.$inferInsert> = {};
      const fields = ["name","role","side","phone","email","outfitDetails","shoeSize","outfitStore","fittingDate","notes"] as const;
      for (const f of fields) {
        if (args[f] !== undefined) (updates as Record<string, unknown>)[f] = args[f] === null || args[f] === "" ? null : String(args[f]);
      }
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(weddingParty).set(updates)
        .where(and(eq(weddingParty.id, member.id), eq(weddingParty.userId, userId))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name } };
    }

    if (name === "list_party") {
      const userId = await resolveScopeUserId(req);
      const rows = await db.select({ id: weddingParty.id, name: weddingParty.name, role: weddingParty.role, side: weddingParty.side })
        .from(weddingParty).where(eq(weddingParty.userId, userId));
      return { ok: true, data: { members: rows } };
    }

    // ===== HOTELS =====
    if (name === "add_hotel") {
      const userId = await resolveScopeUserId(req);
      const hotelName = String(args.hotelName ?? "").trim();
      if (!hotelName) return { ok: false, error: "hotelName is required" };
      const [created] = await db.insert(hotelBlocks).values({
        userId, hotelName,
        address: args.address ? String(args.address) : null,
        city: args.city ? String(args.city) : null,
        state: args.state ? String(args.state) : null,
        zip: args.zip ? String(args.zip) : null,
        phone: args.phone ? String(args.phone) : null,
        email: args.email ? String(args.email) : null,
        bookingLink: args.bookingLink ? String(args.bookingLink) : null,
        discountCode: args.discountCode ? String(args.discountCode) : null,
        groupName: args.groupName ? String(args.groupName) : null,
        cutoffDate: args.cutoffDate ? String(args.cutoffDate) : null,
        roomsReserved: args.roomsReserved !== undefined ? Number(args.roomsReserved) : null,
        pricePerNight: args.pricePerNight !== undefined ? String(Number(args.pricePerNight)) : null,
        distanceFromVenue: args.distanceFromVenue ? String(args.distanceFromVenue) : null,
        notes: args.notes ? String(args.notes) : null,
      }).returning();
      return { ok: true, data: { id: created.id, hotelName: created.hotelName } };
    }

    if (name === "update_hotel" || name === "delete_hotel") {
      const userId = await resolveScopeUserId(req);
      const hotel = await findHotel(userId, args.hotelId, args.matchName);
      if (!hotel.ok) return hotel;
      if (name === "delete_hotel") {
        await db.delete(hotelBlocks).where(and(eq(hotelBlocks.id, hotel.id), eq(hotelBlocks.userId, userId)));
        return { ok: true, data: { deleted: hotel.hotelName } };
      }
      const updates: Partial<typeof hotelBlocks.$inferInsert> = {};
      const stringFields = ["hotelName","address","city","state","zip","phone","email","bookingLink","discountCode","groupName","cutoffDate","distanceFromVenue","notes"] as const;
      for (const f of stringFields) {
        if (args[f] !== undefined) (updates as Record<string, unknown>)[f] = args[f] === null || args[f] === "" ? null : String(args[f]);
      }
      if (args.roomsReserved !== undefined) updates.roomsReserved = Number(args.roomsReserved);
      if (args.roomsBooked !== undefined) updates.roomsBooked = Number(args.roomsBooked);
      if (args.pricePerNight !== undefined) updates.pricePerNight = String(Number(args.pricePerNight));
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(hotelBlocks).set(updates)
        .where(and(eq(hotelBlocks.id, hotel.id), eq(hotelBlocks.userId, userId))).returning();
      return { ok: true, data: { id: updated.id, hotelName: updated.hotelName } };
    }

    if (name === "list_hotels") {
      const userId = await resolveScopeUserId(req);
      const rows = await db.select({ id: hotelBlocks.id, hotelName: hotelBlocks.hotelName, city: hotelBlocks.city, pricePerNight: hotelBlocks.pricePerNight, roomsReserved: hotelBlocks.roomsReserved, roomsBooked: hotelBlocks.roomsBooked })
        .from(hotelBlocks).where(eq(hotelBlocks.userId, userId));
      return { ok: true, data: { hotels: rows } };
    }

    // ===== BUDGET ITEMS =====
    if (name === "add_budget_item") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const budget = await ensureBudget(profile.id, profile.totalBudget);
      const category = String(args.category ?? "").trim();
      const vendor = String(args.vendor ?? "").trim();
      const estimatedCost = Number(args.estimatedCost);
      if (!category || !vendor) return { ok: false, error: "category and vendor are required" };
      if (!Number.isFinite(estimatedCost)) return { ok: false, error: "estimatedCost must be a number" };
      const [created] = await db.insert(budgetItems).values({
        budgetId: budget.id,
        category, vendor,
        estimatedCost: String(estimatedCost),
        actualCost: args.actualCost !== undefined ? String(Number(args.actualCost)) : "0",
        amountPaid: "0",
        isPaid: false,
        notes: args.notes ? String(args.notes) : null,
        nextPaymentDue: null,
      }).returning();
      return { ok: true, data: { id: created.id, category: created.category, vendor: created.vendor } };
    }

    if (name === "update_budget_item" || name === "delete_budget_item" || name === "log_budget_payment") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const budget = await ensureBudget(profile.id, profile.totalBudget);
      const item = await findBudgetItem(budget.id, args.itemId, args.matchVendor);
      if (!item.ok) return item;
      if (name === "delete_budget_item") {
        await db.delete(budgetPaymentLogs).where(eq(budgetPaymentLogs.budgetItemId, item.id));
        await db.delete(budgetItems).where(and(eq(budgetItems.id, item.id), eq(budgetItems.budgetId, budget.id)));
        return { ok: true, data: { deleted: item.vendor } };
      }
      if (name === "log_budget_payment") {
        const amt = Number(args.amount);
        if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "amount must be a positive number" };
        await db.insert(budgetPaymentLogs).values({
          budgetItemId: item.id,
          amount: String(amt),
          note: args.note ? String(args.note) : null,
        });
        const newPaid = Number(item.amountPaid) + amt;
        const isPaid = item.actualCost > 0 ? newPaid >= item.actualCost : newPaid >= item.estimatedCost;
        await db.update(budgetItems)
          .set({ amountPaid: String(newPaid), isPaid })
          .where(eq(budgetItems.id, item.id));
        return { ok: true, data: { itemId: item.id, vendor: item.vendor, paid: amt, totalPaid: newPaid, isPaid } };
      }
      const updates: Partial<typeof budgetItems.$inferInsert> = {};
      if (args.category !== undefined) updates.category = String(args.category);
      if (args.vendor !== undefined) updates.vendor = String(args.vendor);
      if (args.estimatedCost !== undefined) updates.estimatedCost = String(Number(args.estimatedCost));
      if (args.actualCost !== undefined) updates.actualCost = String(Number(args.actualCost));
      if (args.notes !== undefined) updates.notes = args.notes ? String(args.notes) : null;
      if (args.isPaid !== undefined) updates.isPaid = Boolean(args.isPaid);
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(budgetItems).set(updates)
        .where(and(eq(budgetItems.id, item.id), eq(budgetItems.budgetId, budget.id))).returning();
      return { ok: true, data: { id: updated.id, vendor: updated.vendor } };
    }

    if (name === "list_budget") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const [budget] = await db.select().from(budgets).where(eq(budgets.profileId, profile.id)).limit(1);
      if (!budget) return { ok: true, data: { items: [] } };
      const rows = await db.select({ id: budgetItems.id, category: budgetItems.category, vendor: budgetItems.vendor, estimatedCost: budgetItems.estimatedCost, actualCost: budgetItems.actualCost, amountPaid: budgetItems.amountPaid, isPaid: budgetItems.isPaid })
        .from(budgetItems).where(eq(budgetItems.budgetId, budget.id));
      const items = rows.map(r => ({ ...r, estimatedCost: Number(r.estimatedCost), actualCost: Number(r.actualCost), amountPaid: Number(r.amountPaid) }));
      return { ok: true, data: { items } };
    }

    // ===== EXPENSES =====
    if (name === "add_expense") {
      const userId = await resolveScopeUserId(req);
      const expName = String(args.name ?? "").trim();
      const category = String(args.category ?? "").trim() || "Other";
      const cost = Number(args.cost);
      if (!expName) return { ok: false, error: "name is required" };
      if (!Number.isFinite(cost)) return { ok: false, error: "cost must be a number" };
      const [created] = await db.insert(manualExpenses).values({
        userId, name: expName, category,
        cost: String(cost),
        amountPaid: args.amountPaid !== undefined ? String(Number(args.amountPaid)) : "0",
        notes: args.notes ? String(args.notes) : null,
      }).returning();
      return { ok: true, data: { id: created.id, name: created.name } };
    }

    if (name === "update_expense" || name === "delete_expense") {
      const userId = await resolveScopeUserId(req);
      const exp = await findExpense(userId, args.expenseId, args.matchName);
      if (!exp.ok) return exp;
      if (name === "delete_expense") {
        await db.delete(manualExpenses).where(and(eq(manualExpenses.id, exp.id), eq(manualExpenses.userId, userId)));
        return { ok: true, data: { deleted: exp.name } };
      }
      const updates: Partial<typeof manualExpenses.$inferInsert> = {};
      if (args.name !== undefined) updates.name = String(args.name);
      if (args.category !== undefined) updates.category = String(args.category);
      if (args.cost !== undefined) updates.cost = String(Number(args.cost));
      if (args.amountPaid !== undefined) updates.amountPaid = String(Number(args.amountPaid));
      if (args.notes !== undefined) updates.notes = args.notes ? String(args.notes) : null;
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      updates.updatedAt = new Date();
      const [updated] = await db.update(manualExpenses).set(updates)
        .where(and(eq(manualExpenses.id, exp.id), eq(manualExpenses.userId, userId))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name } };
    }

    if (name === "list_expenses") {
      const userId = await resolveScopeUserId(req);
      const rows = await db.select({ id: manualExpenses.id, name: manualExpenses.name, category: manualExpenses.category, cost: manualExpenses.cost, amountPaid: manualExpenses.amountPaid })
        .from(manualExpenses).where(eq(manualExpenses.userId, userId));
      return { ok: true, data: { expenses: rows.map(r => ({ ...r, cost: Number(r.cost), amountPaid: Number(r.amountPaid) })) } };
    }

    if (name === "update_profile") {
      const existing = await resolveProfile(req);
      if (!existing) return { ok: false, error: "No wedding profile yet. Please create one first in Settings." };
      const role = await resolveWorkspaceRole(req.userId!, existing.id);
      if (!hasMinRole(role, "partner")) {
        return { ok: false, error: "Only owners and partners can edit core wedding details." };
      }
      const updates: Record<string, unknown> = {};
      const allowed = ["partner1Name", "partner2Name", "weddingDate", "ceremonyTime", "receptionTime", "venue", "location", "guestCount", "weddingVibe"];
      for (const key of allowed) {
        if (args[key] !== undefined && args[key] !== null) updates[key] = args[key];
      }
      if (args.totalBudget !== undefined && args.totalBudget !== null) {
        updates.totalBudget = String(args.totalBudget);
      }
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      updates.updatedAt = new Date();
      const [updated] = await db.update(weddingProfiles).set(updates).where(eq(weddingProfiles.id, existing.id)).returning();
      logActivity(existing.id, req.userId!, `Aria updated wedding profile (${Object.keys(updates).filter(k=>k!=="updatedAt").join(", ")})`, "profile", { fields: Object.keys(updates) });
      return { ok: true, data: { updated: Object.keys(updates).filter(k => k !== "updatedAt") } };
    }

    if (name === "list_vendors") {
      const userId = await resolveScopeUserId(req);
      const rows = await db
        .select({
          id: vendors.id,
          name: vendors.name,
          category: vendors.category,
          email: vendors.email,
          phone: vendors.phone,
          notes: vendors.notes,
          totalCost: vendors.totalCost,
          depositAmount: vendors.depositAmount,
          contractSigned: vendors.contractSigned,
          nextPaymentDue: vendors.nextPaymentDue,
        })
        .from(vendors)
        .where(eq(vendors.userId, userId));

      const vendorIds = rows.map(v => v.id);
      const paymentsByVendor: Record<number, Array<{ id: number; label: string; amount: string; dueDate: string; isPaid: boolean }>> = {};
      if (vendorIds.length > 0) {
        const payments = await db
          .select({
            id: vendorPayments.id,
            vendorId: vendorPayments.vendorId,
            label: vendorPayments.label,
            amount: vendorPayments.amount,
            dueDate: vendorPayments.dueDate,
            isPaid: vendorPayments.isPaid,
          })
          .from(vendorPayments)
          .where(inArray(vendorPayments.vendorId, vendorIds))
          .orderBy(asc(vendorPayments.dueDate));
        for (const p of payments) {
          if (!paymentsByVendor[p.vendorId]) paymentsByVendor[p.vendorId] = [];
          paymentsByVendor[p.vendorId].push({ id: p.id, label: p.label, amount: p.amount, dueDate: p.dueDate, isPaid: p.isPaid });
        }
      }

      const result = rows.map(v => ({
        ...v,
        payments: paymentsByVendor[v.id] ?? [],
      }));
      return { ok: true, data: { vendors: result } };
    }

    if (name === "get_profile") {
      const p = await resolveProfile(req);
      if (!p) return { ok: false, error: "No profile found" };
      return { ok: true, data: {
        partner1Name: p.partner1Name, partner2Name: p.partner2Name,
        weddingDate: p.weddingDate, venue: p.venue, location: p.location,
        guestCount: p.guestCount, totalBudget: p.totalBudget, weddingVibe: p.weddingVibe,
        ceremonyTime: p.ceremonyTime, receptionTime: p.receptionTime,
      } };
    }

    if (name === "list_contracts") {
      const userId = await resolveScopeUserId(req);
      const rows = await db
        .select({
          id: vendorContracts.id,
          fileName: vendorContracts.fileName,
          fileSize: vendorContracts.fileSize,
          analysis: vendorContracts.analysis,
          createdAt: vendorContracts.createdAt,
        })
        .from(vendorContracts)
        .where(eq(vendorContracts.userId, userId))
        .orderBy(desc(vendorContracts.createdAt))
        .limit(50);
      const summary = rows.map(r => {
        const a = (r.analysis ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          fileName: r.fileName,
          vendorType: a["vendorType"] ?? "Unknown",
          overallRiskLevel: a["overallRiskLevel"] ?? "unknown",
          summary: a["summary"] ?? null,
          uploadedAt: r.createdAt.toISOString(),
        };
      });
      return { ok: true, data: summary };
    }

    if (name === "get_contract") {
      const userId = await resolveScopeUserId(req);
      const contractId = Number(args["contractId"]);
      if (!Number.isFinite(contractId)) return { ok: false, error: "contractId must be a number." };
      const [row] = await db
        .select({
          id: vendorContracts.id,
          fileName: vendorContracts.fileName,
          extractedText: vendorContracts.extractedText,
          analysis: vendorContracts.analysis,
          createdAt: vendorContracts.createdAt,
          userId: vendorContracts.userId,
        })
        .from(vendorContracts)
        .where(eq(vendorContracts.id, contractId))
        .limit(1);
      if (!row || row.userId !== userId) return { ok: false, error: "Contract not found." };
      return { ok: true, data: {
        id: row.id,
        fileName: row.fileName,
        uploadedAt: row.createdAt.toISOString(),
        analysis: row.analysis,
        extractedText: row.extractedText ?? "",
      } };
    }

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

const AI_CONFIGURED_FOR_PROD =
  !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);

/**
 * GET /aria/test — admin-only connectivity check for the OpenAI API.
 * Returns { ok, model, baseUrl, error? } without hitting the DB.
 */
router.get("/aria/test", requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  if (!AI_CONFIGURED_FOR_PROD) {
    return res.json({ ok: false, error: "AI_INTEGRATIONS_OPENAI_API_KEY is not set." });
  }

  try {
    const result = await openai.chat.completions.create({
      model: getModel(),
      max_tokens: 5,
      messages: [{ role: "user", content: "Say OK" }],
    });
    const reply = result.choices[0]?.message?.content ?? "";
    return res.json({ ok: true, model: getModel(), reply });
  } catch (err) {
    const e = err as { status?: number; message?: string; error?: { message?: string } };
    return res.json({
      ok: false,
      model: getModel(),
      status: e?.status,
      error: e?.error?.message || e?.message || String(err),
    });
  }
});

router.post("/aria/chat", requireAuth, aiLimiter, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!AI_CONFIGURED_FOR_PROD) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: "error", error: "Aria requires an OpenAI API key. Please add AI_INTEGRATIONS_OPENAI_API_KEY to your production server environment." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const dailyCheck = incrementDailyAria(userId);
    if (!dailyCheck.allowed) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: "text", content: "You've reached your daily limit for Aria messages. Limits reset at midnight UTC. You can still browse and edit everything manually in the meantime." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const { messages, preferredLanguage } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      preferredLanguage?: string;
    };
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${preferredLanguage}, regardless of what language the user writes in.`
      : "";

    const recent = messages.slice(-20);
    const convo: Array<Record<string, unknown>> = [
      { role: "system", content: SYSTEM_PROMPT + langInstruction },
      ...recent,
    ];
    const performedActions: ActionRecord[] = [];

    let toolLoops = 0;
    const MAX_TOOL_LOOPS = 4;

    while (toolLoops < MAX_TOOL_LOOPS) {
      const completion = await openai.chat.completions.create({
        model: getModel(),
        max_tokens: 1000,
        messages: convo as Parameters<typeof openai.chat.completions.create>[0]["messages"],
        tools: TOOLS,
        tool_choice: "auto",
      });

      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const finalContent = msg.content ?? "";
        send({ type: "content", content: finalContent });
        send({ type: "done", actions: performedActions.map(a => ({ name: a.name, ok: a.result.ok, error: a.result.ok ? undefined : a.result.error })) });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      convo.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}
        send({ type: "action_start", name: tc.function.name, args: parsedArgs });
        const result = await executeTool(tc.function.name, parsedArgs, req);
        performedActions.push({ name: tc.function.name, args: parsedArgs, result });
        send({ type: "action_result", name: tc.function.name, ok: result.ok, error: result.ok ? undefined : result.error });
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      toolLoops++;
    }

    // Safety net if max loops hit
    send({ type: "content", content: "I ran into an issue completing all of those steps. Please check what got added and let me know what to try again." });
    send({ type: "done", actions: performedActions.map(a => ({ name: a.name, ok: a.result.ok, error: a.result.ok ? undefined : a.result.error })) });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error(err, "Aria chat error");
    try {
      const apiErr = err as { status?: number; message?: string; error?: { message?: string; code?: string } };
      const status = apiErr?.status;
      const detail = apiErr?.error?.message || apiErr?.message || "";

      const errCode = apiErr?.error?.code ?? "";
      let userMsg = "Something went wrong. Please try again.";
      if (status === 401) {
        userMsg = "OpenAI API key is invalid or expired. Please check the key set on your server.";
      } else if (status === 429) {
        if (errCode === "insufficient_quota" || detail.toLowerCase().includes("quota") || detail.toLowerCase().includes("exceeded your current quota")) {
          userMsg = "Your OpenAI account has run out of credits. Please visit platform.openai.com/settings/billing to add credits, then try again.";
        } else {
          userMsg = "OpenAI is busy right now. Please wait 30 seconds and try again.";
        }
      } else if (status === 404 || detail.toLowerCase().includes("model")) {
        userMsg = `AI model not available on your plan. (${detail || "no detail"})`;
      } else if (detail) {
        userMsg = `Aria error: ${detail}`;
      }

      res.write(`data: ${JSON.stringify({ type: "error", error: userMsg })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
