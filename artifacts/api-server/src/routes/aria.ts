import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, vendors, checklistItems, weddingProfiles, timelines } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveProfile, resolveScopeUserId, resolveWorkspaceRole, hasMinRole, logActivity } from "../lib/workspaceAccess";
import type { Request } from "express";

const router = Router();

const SYSTEM_PROMPT = `You are Aria, an expert AI wedding planning assistant built into A.IDO.
You are warm, confident, and act like a trusted, experienced friend who has helped hundreds of couples plan their weddings.

You can BOTH chat AND take real actions inside the user's A.IDO portal:
- Add vendors to the vendor list
- Add tasks to the checklist
- Add events to the day-of timeline
- Update wedding profile details (date, venue, budget, guest count, etc.)
- List existing vendors / checklist items / timeline / profile when needed

## How to use tools
- When the user provides ANY information that maps to a portal action (e.g. "add my florist Sarah Bloom, sarahbloom@email.com, $4000"), CALL THE TOOL IMMEDIATELY. Do not ask for clarification on optional fields — only the required ones.
- For vendors: required = name + category. Pick a sensible category from: Photography, Videography, Catering, Florist, DJ/Band, Venue, Officiant, Hair & Makeup, Transportation, Cake/Desserts, Stationery, Rentals, Planner, Other. Use Other if unsure.
- For checklist items: required = task + month (use a label like "12 months out", "6 months out", "1 month out", "Week of", "Day of").
- For timeline events: required = time (e.g. "3:00 PM"), title, description, category (preparation|ceremony|cocktail|reception|dancing|other).
- For profile updates: only update the specific fields the user mentions; leave others untouched.
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
          depositAmount: { type: "number" },
        },
        required: ["name", "category"],
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

async function executeTool(name: string, args: Record<string, unknown>, req: Request): Promise<ActionResult> {
  try {
    if (name === "add_vendor") {
      const userId = await resolveScopeUserId(req);
      const vendorName = String(args.name ?? "").trim();
      const category = normalizeCategory(String(args.category ?? "Other").trim());
      if (!vendorName) return { ok: false, error: "Vendor name is required" };
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
        depositAmount: String(Number(args.depositAmount ?? 0)),
        contractSigned: false,
        nextPaymentDue: null,
        files: [],
      }).returning();
      return { ok: true, data: { id: created.id, name: created.name, category: created.category } };
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
      const rows = await db.select({ id: vendors.id, name: vendors.name, category: vendors.category }).from(vendors).where(eq(vendors.userId, userId));
      return { ok: true, data: { vendors: rows } };
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

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

router.post("/aria/chat", requireAuth, async (req, res) => {
  try {
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
        model: "gpt-4.1-mini",
        max_completion_tokens: 1000,
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
      res.write(`data: ${JSON.stringify({ type: "error", error: "Something went wrong. Please try again." })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
