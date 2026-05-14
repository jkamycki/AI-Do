import { Router } from "express";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import {
  db, vendors, vendorPayments, checklistItems, weddingProfiles, timelines,
  guests, weddingParty, hotelBlocks, manualExpenses, budgets, budgetItems, budgetPaymentLogs,
  vendorContracts, seatingCharts, workspaceCollaborators,
} from "@workspace/db";
import { eq, desc, and, asc, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { isAllowedOrigin } from "../lib/allowedOrigins";
import { aiLimiter, incrementDailyAria } from "../middlewares/rateLimiter";
import { resolveProfile, resolveScopeUserId, resolveWorkspaceRole, hasMinRole, logActivity } from "../lib/workspaceAccess";
import { getAuth } from "@clerk/express";
import type { Request } from "express";

const router = Router();

// Detect short conversational messages where Aria doesn't need any tools
// (greetings, thanks, small talk, etc). When this returns true we strip
// the ~3,700-token TOOLS schema from the Groq request, dropping per-call
// usage from ~5,000 tokens to ~500. That keeps chitchat well under the
// Groq free-tier 6,000 TPM budget so a friendly "how are you" never
// hits a rate limit and shows the user "Aria is unavailable".
//
// Conservative heuristic — only triggers when EVERY signal lines up:
//   - short message (< 80 chars)
//   - matches a clearly conversational pattern at the start
//   - contains no wedding-planning action keywords
// Anything else falls through to the normal tools-enabled path so we
// never accidentally drop tools for a real planning request.
const ACTION_KEYWORDS = /\b(add|create|delete|remove|update|edit|change|set|save|book|schedule|invite|cancel|pay|paid|owe|cost|spend|budget|guest|vendor|venue|timeline|checklist|todo|task|event|payment|contract|hotel|party|reception|ceremony|honeymoon|email|message|reminder|date|when|where|how much|how many)\b/i;
const CANCEL_INTENT = /^\s*(?:cancel(?:\s+(?:that|it|this|the\s+(?:guest|vendor|add|save|request)|add(?:ing)?\b.*|save\b.*|guest\b.*|vendor\b.*))?|never\s?mind|nevermind|stop(?:\s+(?:that|it|this|adding|saving|the\s+(?:guest|vendor)))?|forget\s+it|don'?t\s+(?:do|save|add|create|update|delete)\s+(?:that|it|this|the\s+(?:guest|vendor))|abort)\b[\s.!?]*$/i;
const CONVERSATIONAL_PATTERNS: RegExp[] = [
  /^(hi|hey|hello|yo|sup|hola|aloha|howdy)\b/i,
  /^how (are|r) (you|u|ya|things)/i,
  /^how'?s it going/i,
  /^how have you been/i,
  /^what'?s up\b/i,
  /^good (morning|afternoon|evening|night)\b/i,
  /^(thank you|thanks|thx|ty)\b/i,
  /^(bye|goodbye|see ya|ttyl|night)\b/i,
  /^(lol|haha|nice|cool|ok|okay|got it|sounds good|awesome|love it|perfect)\b/i,
  /^(who|what) are you\b/i,
  /^tell me about yourself/i,
  /^are you (real|human|ai|a bot)/i,
];
function isConversationalMessage(text: string): boolean {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  if (ACTION_KEYWORDS.test(trimmed)) return false;
  return CONVERSATIONAL_PATTERNS.some((re) => re.test(trimmed));
}

// Detect "advice" questions where the user wants general planning wisdom
// rather than a database action — e.g. "what should I prioritize at 6
// months", "what questions should I ask a photographer". For these we
// skip the entire tools schema (~3,700 tokens) so Aria answers from her
// system-prompt knowledge alone, well within Groq's 6,000 TPM budget.
//
// We exclude messages that reference the user's own data ("my budget",
// "how much is left") — those genuinely need a database lookup.
const INFO_QUESTION_PATTERNS: RegExp[] = [
  /^what (questions|should i (ask|prioritize|focus|do|consider|expect|know|look (out )?for)|tips|advice|are some|are the|do you recommend|does .{0,40}\s(typically|usually) (cost|include)|happens (during|if)|color|theme|flower|food|music)/i,
  /^how (do i|should i|can i) (find|choose|pick|select|hire|interview|negotiate|decide|approach|handle|plan|prep|prepare|word|write|ask)/i,
  /^how (long|far in advance) (should|does|do)/i,
  /^when should i (book|hire|start|order|send|begin|reserve|sign|announce|share|post)/i,
  /^(any|got any|do you have any) (tips|advice|ideas|suggestions|recommendations|thoughts)/i,
  /^(give me|share) (some |a few |any )?(tips|advice|ideas|suggestions|recommendations|thoughts)/i,
  /^tell me (about (the |a |an )?(typical|usual|normal|average|wedding|ceremony|reception|tradition)|how to|why)/i,
  /^explain\b/i,
  /^what'?s? (a |an |the )?(typical|good|normal|common|average|standard|best)/i,
  /^why (do|does|should|is|are)/i,
  /\bbefore (booking|signing|hiring|choosing|selecting|paying|meeting)/i,
  /^should i\b/i,
];
// Override: messages that refer to the user's stored data — we DO need
// to call list_* tools for these even though they look like questions.
const DATA_LOOKUP_KEYWORDS = /\bmy (budget|guests?|vendors?|checklist|timeline|party|hotels?|contracts?|profile|spending|expenses?|payments?|tasks?|seating|wedding party|day-?of)\b|\bi (have|added|booked|paid)\b|\bwe (have|added|booked|paid)\b|\bhow much (is|are|do i have) (left|remaining|spent|in)/i;

function isInfoQuestion(text: string): boolean {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 240) return false;
  if (DATA_LOOKUP_KEYWORDS.test(trimmed)) return false;
  return INFO_QUESTION_PATTERNS.some((re) => re.test(trimmed));
}

// Group every tool by its data domain so we can send only the relevant
// subset on each request. Picking the right subset cuts the per-request
// tools schema from ~3,700 tokens (all 35 tools) to ~300-700 tokens
// (typically 4-9 tools) — the single biggest lever for keeping Aria
// inside Groq's 6,000 TPM free-tier budget.
const TOOL_GROUPS: Record<string, string[]> = {
  vendor: ["add_vendor","update_vendor","delete_vendor","list_vendors","add_vendor_payment","update_vendor_payment","mark_vendor_payment_paid","delete_vendor_payment"],
  checklist: ["generate_checklist","add_checklist_item","update_checklist_item","toggle_checklist_item","delete_checklist_item","list_checklist"],
  timeline: ["generate_timeline","add_timeline_event","update_timeline_event","delete_timeline_event","list_timeline"],
  guest: ["add_guest","update_guest","delete_guest","list_guests"],
  party: ["add_party_member","update_party_member","delete_party_member","list_party"],
  hotel: ["add_hotel","update_hotel","delete_hotel","list_hotels"],
  budget: ["generate_budget","add_budget_item","update_budget_item","delete_budget_item","log_budget_payment","list_budget","add_expense","update_expense","delete_expense","list_expenses"],
  profile: ["update_profile","get_profile"],
  contract: ["list_contracts","get_contract"],
  seating: ["generate_seating","list_seating_charts","delete_seating_chart"],
  collaborator: ["invite_collaborator","list_collaborators","remove_collaborator"],
};
const GROUP_KEYWORDS: Record<string, RegExp> = {
  vendor: /\b(vendors?|photographers?|videographers?|florists?|caterer|catering|djs?|bands?|musician|officiant|hair|makeup|transport|limo|cake|baker|stationery|invitation|rental|planner|venue|deposit)\b/i,
  checklist: /\b(checklist|tasks?|todo|to-?do|prioritize|priorities|month(s)?\s*out|due|reminder)\b/i,
  timeline: /\b(timeline|day-?of|schedule|ceremony|reception|cocktail|run-?sheet|order of (events|service))\b/i,
  guest: /\b(guests?|rsvp|seating|seats?|tables?|plus[-\s]?one|dietary|meal|invite list|guest list)\b/i,
  party: /\b(bridesmaids?|groomsm[ae]n|maid of honor|best man|party members?|wedding party|attendants?)\b/i,
  hotel: /\b(hotels?|room block|accommodat|lodging)\b/i,
  budget: /\b(budget|expenses?|cost|price|payment|paid|spend|spent|money|dollars?|owe|left to spend|remaining|\$)/i,
  // Website/editor requests frequently map to profile-backed fields
  // (names, date, venue, location, vibe). Including website keywords here
  // lets Aria pick update_profile/get_profile immediately instead of falling
  // into a read-only core set and getting stuck in clarification loops.
  profile: /\b(profile|website|site|web\s?site|website editor|wedding website|home page|homepage|hero|partner|vibe|theme|wedding date|guest count|total budget|venue|location|ceremony time|reception time|rsvp)\b/i,
  contract: /\b(contracts?|agreements?)\b/i,
  seating: /\b(seating chart|seat(ing)?|table assign|arrange guests|generate seat|seating plan)\b/i,
  collaborator: /\b(collaborat|invite|partner access|planner access|vendor access|remove access|team member|workspace)\b/i,
};
function pickToolsForMessages(messages: Array<{ role: string; content: string }>) {
  // Scan recent text (both the user's latest message and Aria's prior
  // reply) so confirmation turns like "yes save it" still pick up the
  // domain from Aria's earlier "Reply yes to save vendor X" prompt.
  const fullText = messages.map(m => typeof m?.content === "string" ? m.content : "").join(" ");
  const matched = new Set<string>();
  for (const [group, regex] of Object.entries(GROUP_KEYWORDS)) {
    if (regex.test(fullText)) matched.add(group);
  }
  // Multi-domain questions (e.g. "summary of where I am") are detected
  // by 3+ matched groups OR an explicit overview/summary keyword —
  // those cases need get_summary + a few read tools, not all 35 tools.
  const wantsOverview = /\b(summary|overview|where (am|are) (i|we)|where i am|how (am|are) (i|we) doing|catch me up|status|progress)\b/i.test(fullText);
  if (matched.size === 0 && !wantsOverview) {
    // Truly ambiguous — fall back to a small "core" so we still don't
    // pay the full 3,700-token tax. Get_summary + read tools cover most
    // unknown questions without write capability.
    const coreNames = new Set(["get_summary","get_profile","list_vendors","list_budget","list_guests","list_checklist"]);
    return TOOLS.filter(t => coreNames.has(t.function.name));
  }
  const allowedNames = new Set<string>(["get_summary"]);
  if (wantsOverview) {
    // Overview wants every read tool so Aria can stitch a real status
    // report — but ONLY read tools. Returning early here also stops
    // matched domain groups from sneaking write tools back in (e.g. a
    // user asking "give me an overview, especially budget" shouldn't
    // unlock add_budget_item just because "budget" matched).
    for (const names of Object.values(TOOL_GROUPS)) {
      for (const n of names) {
        if (n.startsWith("list_") || n === "get_profile") allowedNames.add(n);
      }
    }
    return TOOLS.filter(t => allowedNames.has(t.function.name));
  }
  for (const group of matched) {
    for (const name of TOOL_GROUPS[group] || []) allowedNames.add(name);
  }
  return TOOLS.filter(t => allowedNames.has(t.function.name));
}

const SYSTEM_PROMPT = `You are Aria, the warm AI wedding planner inside A.IDO. Talk like a real planner — friendly, specific, never robotic. Default ≤100 words. Markdown renders.

SMALL TALK: For greetings, thanks, "how are you?", or chitchat → reply warmly in 1-2 sentences. Don't force a planning topic. Example: "Hi" → "Hi there! 💕 Ready to dive in, or just chat?"

#1 RULE — NEVER INVENT. If REQUIRED tool fields are missing, ASK first. Never substitute a category word for a business name. Never fill in placeholder names. Never assume defaults. Required fields are listed in each tool's schema (look at the "required" array) — read them.

#1a VENDOR RULE — add_vendor REQUIRES a real business name typed by the user in THIS conversation. "Photographer", "Florist", "DJ", "Caterer", "Vendor", "New Vendor" are CATEGORIES when they appear ALONE, not names. But DJ CAN be part of a real business name, like "DJ Nick", "DJ Jon", or "Nick's DJ Services" — save those exactly if the user typed the full name. NEVER invent, assume, or reuse any name — not from examples, not from memory, not from anywhere. If the user has not typed a specific business name in THIS message thread, ask the gathering question (see VENDOR GATHERING QUESTION below) and wait for their reply BEFORE calling add_vendor. Do NOT call add_vendor in the same turn you ask for details.

#2 RULE — OPTIONAL FIELDS NEVER BLOCK A SAVE. If the schema doesn't list a field in "required", it is optional. NEVER ask for it as a precondition. NEVER ask the user to "confirm" or "verify" an optional value they already gave (e.g. if they said "total cost 2500", USE 2500 — do not ask "could you confirm the total cost?"). The user can always edit the record later.

#3 RULE — NEVER LOOP. Once you have all REQUIRED fields, go to summary+confirm. Once the user says yes, SAVE. Do NOT add a re-clarification step in either direction. If you catch yourself writing "Just to confirm…" or "Could you verify…" twice in a row — STOP, you're looping.

#4 WEBSITE RESILIENCE RULE — If the user asks for website help:
- If it's a supported data action (names/date/time/venue/location/vibe/budget/guest count), use tools and complete it.
- If it's an editor-style visual/content action not exposed as a tool (e.g. section layout, fonts, animations, page toggles), do NOT stall or loop. Give direct click-by-click steps in the Website Editor and offer the next best workaround.
- Never claim you changed something if no tool exists for that change. Be explicit: what you can update now vs what the user should click.

GUEST RULE — adding a guest only requires the guest's name. If the user provides a person's name, that is enough to proceed to the one-line summary + Reply "yes" flow. Do NOT ask for the guest's name again. Do NOT ask whether the person is a guest or a plus-one unless the user explicitly says they are adding a plus-one for an existing guest. Default named people to regular guests. Do NOT ask for meal choice while adding a guest. Only save meal choice if the user voluntarily provides it or later asks to update it.

WRITE/UPDATE/DELETE FLOW — exactly ONE summary turn and exactly ONE save turn:

SUMMARY PHRASING RULE — CRITICAL: The summary turn MUST use future/present tense to make clear nothing has been saved yet. NEVER use past tense ("has been added", "was saved", "added successfully") in the summary turn — that implies the action already happened and breaks the confirmation loop.
  ✅ CORRECT: "Saving JC Photography (Photographer). Reply 'yes' to save."
  ✅ CORRECT: "Ready to add JC Photography (Photographer). Reply 'yes' to confirm."
  ❌ WRONG: "JC Photography has been added. Reply 'yes' to save." ← contradictory, DO NOT do this

CASE A — user provided all required fields up front (real business name + category):
  Turn 1 (you): one-line summary in present/future tense. End with: Reply "yes" to save.
  Turn 2 (user): yes / confirm / ok / save it / go ahead / do it.
  Turn 3 (you): IMMEDIATELY call add_vendor. Include ALL details the user mentioned (totalCost, depositAmount, depositPaid, contractSigned). No more text, no more questions.

CASE B — user is missing the vendor name (e.g. said "add a vendor" or "add a photographer" with no business name):
  Turn 1 (you): ask the VENDOR GATHERING QUESTION (below). Do not summarize yet. Do NOT call add_vendor. DO NOT pass the gathering question as the vendor name — that is NEVER a valid name.
  Turn 2 (user): answers with their details (e.g. "james dj", "Bloom & Co florist", "Sarah's Catering $5000").
  Turn 3 (you): IMMEDIATELY write the one-line summary in present/future tense + Reply "yes" to save. Do NOT call list_vendors or any other tool in this turn. Do NOT verify whether the vendor already exists.
  Turn 4 (user): yes.
  Turn 5 (you): IMMEDIATELY call add_vendor with ALL details the user has mentioned so far. No other tools.

VENDOR GATHERING QUESTION — use this exact style whenever the user wants to add a vendor but hasn't given a name:
  "What's the vendor's name and category (florist, photographer, caterer, DJ, etc.)? Feel free to also share the total cost, deposit amount, or any other details — only the name is needed to get started!"
  ⚠️ WARNING: Never use this question text as the vendor name argument. It is a message to the user, not a name to save.

Examples:
  • User: "Add vendor [Name], Florist, total cost 5000, signed contract" → You: "Saving [Name] (Florist), $5,000 total, contract signed. Reply 'yes' to save." → User: "yes" → You: [calls add_vendor with name, category, totalCost: 5000, contractSigned: true — no extra text].
  • User: "Add a vendor" → You: "What's the vendor's name and category (florist, photographer, caterer, DJ, etc.)? Feel free to also share the total cost, deposit amount, or any other details — only the name is needed to get started!" — STOP. Do NOT call add_vendor yet.
  • User: "Add a vendor for me" → same VENDOR GATHERING QUESTION — STOP. Do NOT call add_vendor yet.
  • User: "Add a photographer" → You: "What's the photographer's business name? Feel free to also share the total cost, deposit, or any other details — only the name is needed!" — STOP. Do NOT call add_vendor yet.

Exception: toggle_checklist_item needs no confirmation. DELETE: state exactly what will be deleted (incl. cascades).

UPDATE FLOW — NO CONFIRMATION NEEDED. When the user provides updates to existing data — including the *very common* case where they answered a follow-up question you just asked — call the appropriate update/add tool IMMEDIATELY in the same turn. Do NOT ask "Reply 'yes' to save" for updates. Do NOT call list_* tools first to "look up" the entity — pass the entity by name (most update tools accept a name field).

POST-ADD-VENDOR FLOW (explicit rules, the small model gets this wrong otherwise):
Key signal: "✅ Added **X**" in an assistant message means add_vendor for X was already executed and X is in the database. Do NOT call add_vendor for X again under any circumstances.

When you see "✅ Added **X**" and the user then provides contract / cost / payment info (e.g. "signed the contract, total 6000, paid 1000 deposit"):
  • IMMEDIATELY call update_vendor with { vendorName: "X", contractSigned?, totalCost?, depositAmount? } — skip any field the user didn't mention.
  • If the user mentioned a paid deposit or payment, ALSO call add_vendor_payment with { vendorName: "X", label: "Deposit", amount, dueDate: today, isPaid: true }.
  • Do NOT ask for confirmation. Do NOT call list_vendors. Do NOT call list_contracts. The user gave you everything — just save it.
  • If the user says "no", "not yet", "that's all", or similar → just acknowledge warmly and stop. Don't re-ask.

SAVE ALL DETAILS UPFRONT: When calling add_vendor, include every field the user already mentioned — totalCost, depositAmount, depositPaid, contractSigned — so nothing needs to be re-asked afterward.

AFTER A SUCCESSFUL WRITE: stop. The system auto-emits a confirmation + follow-up — don't add text.

QUERIES: overview→get_summary | vendors/payments→list_vendors | budget→list_budget+list_expenses | guests/RSVP→list_guests | party→list_party | day-of→list_timeline | checklist→list_checklist | hotels→list_hotels | date/venue/vibe→get_profile | contracts→list_contracts then get_contract(id) | seating charts→list_seating_charts | collaborators→list_collaborators. General advice ("typical day-of timeline?") → answer directly, no tool.

SHORTCUTS: RSVP→update_guest(matchName, rsvpStatus). Seating→update_guest(matchName, tableAssignment). Payment paid→mark_vendor_payment_paid(vendorName).

TOOL USE: Call tools silently and directly — never describe what you are about to call, never narrate "I'll call the list_checklist function", never output raw JSON function calls in your text. The tools work automatically; just use them.

OUTPUT: Plans → numbered steps + brief summary. Query results → warm ≤100-word summary, never raw JSON.`;

// Detect function-call JSON that some small Llama models emit as plain text
// instead of using the structured tool_calls API. Matches the two most common
// formats: {"name": "tool", "parameters": {...}} and {"name": "tool", "arguments": {...}}
function extractTextBasedToolCalls(
  text: string,
  allowedTools: Array<{ function: { name: string } }>,
): Array<{ id: string; name: string; args: string }> {
  const allowedNames = new Set(allowedTools.map(t => t.function.name));
  const results: Array<{ id: string; name: string; args: string }> = [];
  // Handles nested objects one level deep (e.g. {"category": {"id": 1}})
  const re = /\{[\s\r\n]*"name"\s*:\s*"([^"]+)"\s*,\s*"(?:parameters|arguments)"\s*:\s*(\{(?:[^{}]|\{[^{}]*\})*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const toolName = m[1];
    if (!allowedNames.has(toolName)) continue;
    const argsJson = m[2];
    try {
      JSON.parse(argsJson);
      results.push({ id: `txt-${Date.now()}-${results.length}`, name: toolName, args: argsJson });
    } catch { /* malformed JSON — skip */ }
  }
  return results;
}

// Tools that write data — after these succeed we skip the second AI round-trip
// and send an instant confirmation instead, saving ~1,000–2,000 tokens per call.

function safeParseToolArgs(raw: string): Record<string, unknown> {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  try { return JSON.parse(text) as Record<string, unknown>; } catch {}

  // Light repair path for common streaming/truncation glitches.
  const repaired = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\n/g, " ")
    .trim();
  try { return JSON.parse(repaired) as Record<string, unknown>; } catch {}

  // Last-resort envelope extraction when the model emits a JSON wrapper.
  const objMatch = repaired.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) as Record<string, unknown>; } catch {}
  }
  return {};
}


function coercePrimitive(value: unknown, targetType: string): unknown {
  if (targetType === "number") {
    if (typeof value === "number") return Number.isFinite(value) ? value : value;
    if (typeof value === "string") {
      const n = Number(value.replace(/[$,]/g, "").trim());
      return Number.isFinite(n) ? n : value;
    }
    return value;
  }
  if (targetType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (["true","yes","y","1","paid","done"].includes(v)) return true;
      if (["false","no","n","0","unpaid","not paid"].includes(v)) return false;
    }
    if (typeof value === "number") return value !== 0;
    return value;
  }
  if (targetType === "string") {
    return value === null || value === undefined ? value : String(value);
  }
  return value;
}

function normalizeToolArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const tool = TOOLS.find((t) => t.function.name === toolName);
  if (!tool) return args;
  const props = (tool.function.parameters?.properties ?? {}) as Record<string, { type?: string }>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    const t = props[k]?.type;
    out[k] = t ? coercePrimitive(v, t) : v;
  }
  return out;
}

function vendorDedupeKey(args: Record<string, unknown>): string {
  const normalizedName = String(args.name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const normalizedCategory = normalizeCategory(String(args.category ?? "Other"))
    .trim()
    .toLowerCase();
  return `${normalizedName}:${normalizedCategory}`;
}

const ACTION_TOOLS = new Set([
  "add_vendor", "update_vendor", "delete_vendor",
  "add_vendor_payment", "update_vendor_payment", "mark_vendor_payment_paid", "delete_vendor_payment",
  "generate_checklist", "add_checklist_item", "update_checklist_item", "toggle_checklist_item", "delete_checklist_item",
  "generate_timeline", "add_timeline_event", "update_timeline_event", "delete_timeline_event",
  "add_guest", "update_guest", "delete_guest",
  "add_party_member", "update_party_member", "delete_party_member",
  "add_hotel", "update_hotel", "delete_hotel",
  "add_expense", "update_expense", "delete_expense",
  "generate_budget", "add_budget_item", "update_budget_item", "delete_budget_item", "log_budget_payment",
  "update_profile",
  "generate_seating", "delete_seating_chart",
  "invite_collaborator", "remove_collaborator",
]);

// Build a friendly confirmation + proactive follow-up question from tool
// results. We do this in code (not via a second AI call) to keep writes fast
// and to guarantee the follow-up actually appears even on the fast-path.
function buildConfirmation(actions: ActionRecord[]): string {
  const lines: string[] = [];
  let followUp = "";
  for (const a of actions) {
    if (!a.result.ok) {
      lines.push(`⚠️ ${a.name.replace(/_/g, " ")}: ${a.result.error ?? "failed"}`);
      continue;
    }
    const d = (a.result as { ok: true; data?: Record<string, unknown> }).data ?? {};
    switch (a.name) {
      case "add_vendor": {
        const savedDetails: string[] = [];
        if (d.contractSigned) savedDetails.push("contract signed ✓");
        const detailSuffix = savedDetails.length ? ` — ${savedDetails.join(", ")}` : "";
        lines.push(`✅ Added **${d.name ?? "vendor"}** (${d.category ?? ""})${detailSuffix}`);
        if (!d.contractSigned) {
          followUp = `Have a contract or any payments for **${d.name ?? "them"}**? Just tell me the details — e.g. *"signed contract, total $6,000, paid $1,000 deposit"* — and I'll save them.`;
        } else {
          followUp = `Any payments or deposit milestones to track for **${d.name ?? "them"}**?`;
        }
        break;
      }
      case "update_vendor":
        lines.push(`✅ Updated **${d.name ?? "vendor"}**`);
        followUp = "";
        break;
      case "delete_vendor":
        lines.push(`✅ Removed **${d.name ?? "vendor"}**`);
        break;
      case "add_vendor_payment":
        lines.push(`✅ Payment milestone added`);
        followUp = `Want to add another milestone, or has this one already been paid?`;
        break;
      case "update_vendor_payment":
        lines.push(`✅ Payment milestone updated`);
        break;
      case "mark_vendor_payment_paid":
        lines.push(`✅ Payment marked as paid`);
        followUp = `Want me to log the next milestone or check what's still outstanding?`;
        break;
      case "delete_vendor_payment":
        lines.push(`✅ Payment milestone removed`);
        break;
      case "generate_checklist":
        lines.push(`Checklist created with **${d.count ?? 0} tasks**`);
        followUp = `I used your wedding profile and date to build it. Want me to add, remove, or reprioritize anything?`;
        break;
      case "add_checklist_item":
        lines.push(`✅ Checklist task added: **${d.task ?? ""}**`);
        followUp = `Want me to add more tasks for the same timeframe?`;
        break;
      case "update_checklist_item":
        lines.push(`✅ Checklist task updated`);
        break;
      case "toggle_checklist_item":
        lines.push(`✅ Task ${d.isCompleted ? "completed ✓" : "unmarked"}`);
        break;
      case "delete_checklist_item":
        lines.push(`✅ Checklist task removed`);
        break;
      case "generate_timeline":
        lines.push(`Timeline created with **${d.count ?? 0} events**`);
        followUp = `Want me to adjust the ceremony, reception, photo, or vendor timing?`;
        break;
      case "add_timeline_event":
        lines.push(`✅ Timeline event added: **${d.title ?? ""}**`);
        followUp = `Want to add another timeline moment around the same time?`;
        break;
      case "update_timeline_event":
        lines.push(`✅ Timeline event updated`);
        break;
      case "delete_timeline_event":
        lines.push(`✅ Timeline event removed`);
        break;
      case "add_guest":
        lines.push(`✅ Guest added: **${d.name ?? ""}**`);
        followUp = `Want me to mark their RSVP, add a plus-one, or assign them to a table?`;
        break;
      case "update_guest":
        lines.push(`✅ Guest updated`);
        break;
      case "delete_guest":
        lines.push(`✅ Guest removed`);
        break;
      case "add_party_member":
        lines.push(`✅ **${d.name ?? "Party member"}** added to wedding party`);
        followUp = `Want me to note their outfit details, fitting date, or shoe size?`;
        break;
      case "update_party_member":
        lines.push(`✅ Wedding party member updated`);
        break;
      case "delete_party_member":
        lines.push(`✅ Wedding party member removed`);
        break;
      case "add_hotel":
        lines.push(`✅ Hotel block added: **${d.hotelName ?? ""}**`);
        followUp = `Want to add a group rate, cutoff date, or booking link for this block?`;
        break;
      case "update_hotel":
        lines.push(`✅ Hotel block updated`);
        break;
      case "delete_hotel":
        lines.push(`✅ Hotel block removed`);
        break;
      case "add_expense":
        lines.push(`✅ Expense added: **${d.name ?? ""}**`);
        followUp = `Want to log a payment against this expense?`;
        break;
      case "update_expense":
        lines.push(`✅ Expense updated`);
        break;
      case "delete_expense":
        lines.push(`✅ Expense removed`);
        break;
      case "add_budget_item":
        lines.push(`✅ Budget item added`);
        followUp = `Want to log a payment you've already made on this?`;
        break;
      case "generate_budget":
        lines.push(`✅ Budget created with **${d.count ?? 0} categories**`);
        followUp = `Want me to adjust any category, track an overage, or log a payment?`;
        break;
      case "update_budget_item":
        lines.push(`✅ Budget item updated`);
        break;
      case "delete_budget_item":
        lines.push(`✅ Budget item removed`);
        break;
      case "log_budget_payment":
        lines.push(`✅ Payment logged`);
        followUp = `Want to log another payment or check what's left on the budget?`;
        break;
      case "update_profile":
        lines.push(`✅ Profile updated`);
        followUp = `Anything else about your wedding details I should update?`;
        break;
      case "generate_seating":
        lines.push(`✅ Seating chart generated${d.savedAs ? ` and saved as **${d.savedAs}**` : ""} — ${d.totalSeated ?? "?"} guests seated`);
        if ((d.warnings as string[] | undefined)?.length) followUp = `⚠️ Heads up: ${(d.warnings as string[]).join("; ")}`;
        else followUp = `Want me to save this chart, adjust table sizes, or reassign any guests?`;
        break;
      case "delete_seating_chart":
        lines.push(`✅ Seating chart removed`);
        break;
      case "invite_collaborator":
        lines.push(`✅ Invite sent to **${d.email ?? ""}** as ${d.role ?? ""}`);
        followUp = `They'll receive an email to accept. Want to invite anyone else?`;
        break;
      case "remove_collaborator":
        lines.push(`✅ Removed **${d.removed ?? "collaborator"}** from your workspace`);
        break;
      default:
        lines.push(`✅ Done`);
    }
  }
  if (followUp) lines.push("", followUp);
  return lines.join("\n");
}

const TOOLS = [
  { type:"function" as const, function:{ name:"add_vendor", description:"Add a new vendor to the user's wedding. ONLY call this AFTER: (1) the user has typed a specific business name in this conversation, AND (2) the user has confirmed with 'yes' or similar. NEVER invent a vendor name — not from examples, not from your training. NEVER call this tool in the same turn you ask for the vendor name. If the user just says 'add a vendor' or 'add a photographer' with no business name, ask for the name first and wait. Include all details the user mentioned (totalCost, depositAmount, contractSigned, etc.) so nothing needs to be re-asked.", parameters:{ type:"object", properties:{ name:{type:"string", description:"Exact business name the user typed. Never invent one."}, category:{type:"string", enum:["Venue","Caterer","Photographer","Videographer","Florist","DJ / Band","Officiant","Hair & Makeup","Transportation","Cake & Desserts","Invitations","Lighting & AV","Photo Booth","Wedding Planner","Other"], description:"Vendor category."}, email:{type:"string"}, phone:{type:"string"}, website:{type:"string"}, notes:{type:"string"}, totalCost:{type:"number"}, depositAmount:{type:"number"}, depositPaid:{type:"boolean"}, contractSigned:{type:"boolean", description:"Set true if user said the contract is signed."} }, required:["name","category"] } } },
  { type:"function" as const, function:{ name:"update_vendor", description:"Update vendor fields. Pass vendorId or vendorName.", parameters:{ type:"object", properties:{ vendorId:{type:"number"}, vendorName:{type:"string"}, name:{type:"string"}, category:{type:"string"}, email:{type:"string"}, phone:{type:"string"}, website:{type:"string"}, portalLink:{type:"string"}, notes:{type:"string"}, totalCost:{type:"number"}, depositAmount:{type:"number"}, contractSigned:{type:"boolean"} } } } },
  { type:"function" as const, function:{ name:"delete_vendor", description:"Delete vendor. Pass vendorId or vendorName.", parameters:{ type:"object", properties:{ vendorId:{type:"number"}, vendorName:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_vendors", description:"List all vendors.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"add_vendor_payment", description:"Add payment milestone to existing vendor. Required: label, amount, dueDate (YYYY-MM-DD).", parameters:{ type:"object", properties:{ vendorId:{type:"number"}, vendorName:{type:"string"}, label:{type:"string"}, amount:{type:"number"}, dueDate:{type:"string"}, isPaid:{type:"boolean"} }, required:["label","amount","dueDate"] } } },
  { type:"function" as const, function:{ name:"update_vendor_payment", description:"Update payment milestone. Pass paymentId or vendorName+matchLabel.", parameters:{ type:"object", properties:{ paymentId:{type:"number"}, vendorName:{type:"string"}, matchLabel:{type:"string"}, label:{type:"string"}, amount:{type:"number"}, dueDate:{type:"string"}, isPaid:{type:"boolean"} } } } },
  { type:"function" as const, function:{ name:"mark_vendor_payment_paid", description:"Mark payment paid. Pass paymentId or vendorName+matchLabel.", parameters:{ type:"object", properties:{ paymentId:{type:"number"}, vendorName:{type:"string"}, matchLabel:{type:"string"}, isPaid:{type:"boolean"} } } } },
  { type:"function" as const, function:{ name:"delete_vendor_payment", description:"Delete payment milestone. Pass paymentId or vendorName+matchLabel.", parameters:{ type:"object", properties:{ paymentId:{type:"number"}, vendorName:{type:"string"}, matchLabel:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"generate_checklist", description:"Generate or rebuild the user's full wedding checklist from their wedding profile, wedding date, wedding vibe, and guest count. Use when the user asks to create, generate, build, reset, or make a checklist, to-do list, planning tasks, or wedding task plan.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"add_checklist_item", description:"Add checklist task. Required: task, month.", parameters:{ type:"object", properties:{ task:{type:"string"}, description:{type:"string"}, month:{type:"string"} }, required:["task","month"] } } },
  { type:"function" as const, function:{ name:"update_checklist_item", description:"Update checklist item. Pass itemId or matchTask.", parameters:{ type:"object", properties:{ itemId:{type:"number"}, matchTask:{type:"string"}, task:{type:"string"}, description:{type:"string"}, month:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"toggle_checklist_item", description:"Toggle checklist item complete/incomplete. Pass itemId or matchTask.", parameters:{ type:"object", properties:{ itemId:{type:"number"}, matchTask:{type:"string"}, isCompleted:{type:"boolean"} } } } },
  { type:"function" as const, function:{ name:"delete_checklist_item", description:"Delete checklist item. Pass itemId or matchTask.", parameters:{ type:"object", properties:{ itemId:{type:"number"}, matchTask:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_checklist", description:"List all checklist items.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"generate_timeline", description:"Generate or rebuild the user's full wedding day timeline from their wedding profile ceremony time, reception time, venue, location, guest count, and optional dayVision. Use when the user asks to create, generate, build, make, or reset a timeline, day-of schedule, wedding schedule, or run sheet.", parameters:{ type:"object", properties:{ dayVision:{type:"string", description:"Optional details the user gave about how they want the day to flow."} } } } },
  { type:"function" as const, function:{ name:"add_timeline_event", description:"Add timeline event. Required: time, title, description, category.", parameters:{ type:"object", properties:{ time:{type:"string"}, title:{type:"string"}, description:{type:"string"}, category:{type:"string",enum:["preparation","ceremony","cocktail","reception","dancing","other"]} }, required:["time","title","description","category"] } } },
  { type:"function" as const, function:{ name:"update_timeline_event", description:"Update timeline event. Pass matchTitle or matchTime.", parameters:{ type:"object", properties:{ matchTitle:{type:"string"}, matchTime:{type:"string"}, time:{type:"string"}, title:{type:"string"}, description:{type:"string"}, category:{type:"string",enum:["preparation","ceremony","cocktail","reception","dancing","other"]} } } } },
  { type:"function" as const, function:{ name:"delete_timeline_event", description:"Delete timeline event. Pass matchTitle or matchTime.", parameters:{ type:"object", properties:{ matchTitle:{type:"string"}, matchTime:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_timeline", description:"List timeline events.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"add_guest", description:"Add a guest to the wedding guest list. ONLY call after the user has explicitly confirmed (replied 'yes' or similar to your confirmation message). 'name' MUST be a specific person's name provided by the user — never invent placeholder names like 'Guest 1'. If the user just says 'add a guest' without naming anyone, ASK for the name first. Do NOT ask for mealChoice while adding a guest; only include mealChoice if the user voluntarily provided it.", parameters:{ type:"object", properties:{ name:{type:"string", description:"Specific guest full name provided by the user."}, email:{type:"string"}, phone:{type:"string"}, rsvpStatus:{type:"string",enum:["pending","attending","declined","maybe"]}, mealChoice:{type:"string"}, dietaryNotes:{type:"string"}, guestGroup:{type:"string"}, plusOne:{type:"boolean"}, plusOneName:{type:"string"}, tableAssignment:{type:"string"}, notes:{type:"string"}, address:{type:"string"}, guestCity:{type:"string"}, guestState:{type:"string"}, guestZip:{type:"string"}, guestCountry:{type:"string"} }, required:["name"] } } },
  { type:"function" as const, function:{ name:"update_guest", description:"Update guest. Pass guestId or matchName.", parameters:{ type:"object", properties:{ guestId:{type:"number"}, matchName:{type:"string"}, name:{type:"string"}, email:{type:"string"}, phone:{type:"string"}, rsvpStatus:{type:"string",enum:["pending","attending","declined","maybe"]}, mealChoice:{type:"string"}, dietaryNotes:{type:"string"}, guestGroup:{type:"string"}, plusOne:{type:"boolean"}, plusOneName:{type:"string"}, tableAssignment:{type:"string"}, notes:{type:"string"}, address:{type:"string"}, guestCity:{type:"string"}, guestState:{type:"string"}, guestZip:{type:"string"}, guestCountry:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"delete_guest", description:"Delete guest. Pass guestId or matchName.", parameters:{ type:"object", properties:{ guestId:{type:"number"}, matchName:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_guests", description:"List all guests.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"add_party_member", description:"Add a wedding party member (bridesmaid, groomsman, etc.). ONLY call after the user has explicitly confirmed. All three required fields (name, role, side) MUST come from the user — never invent them. If any is missing, ASK first. Side must be bride/bridal party, groom side, or both.", parameters:{ type:"object", properties:{ name:{type:"string", description:"Specific person's name provided by the user."}, role:{type:"string", description:"Specific role like 'Maid of Honor', 'Best Man', 'Bridesmaid' — provided by the user."}, side:{type:"string",enum:["bride","groom","both"], description:"Use bride for bridal party/bride side, groom for groom side, or both only if user says both/shared."}, phone:{type:"string"}, email:{type:"string"}, outfitDetails:{type:"string"}, shoeSize:{type:"string"}, outfitStore:{type:"string"}, fittingDate:{type:"string"}, notes:{type:"string"} }, required:["name","role","side"] } } },
  { type:"function" as const, function:{ name:"update_party_member", description:"Update party member. Pass memberId or matchName.", parameters:{ type:"object", properties:{ memberId:{type:"number"}, matchName:{type:"string"}, name:{type:"string"}, role:{type:"string"}, side:{type:"string"}, phone:{type:"string"}, email:{type:"string"}, outfitDetails:{type:"string"}, shoeSize:{type:"string"}, outfitStore:{type:"string"}, fittingDate:{type:"string"}, notes:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"delete_party_member", description:"Delete party member. Pass memberId or matchName.", parameters:{ type:"object", properties:{ memberId:{type:"number"}, matchName:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_party", description:"List wedding party members.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"add_hotel", description:"Add hotel block. ONLY call after the user has explicitly confirmed. Required: hotelName. hotelName MUST be the real hotel name typed by the user in this conversation. If the user just says 'add hotel block' or 'add a hotel' without naming the hotel, ask which hotel first and wait. Optional fields like room count, rate, cutoff date, address, booking link, discount code, or notes must be included ONLY if the user explicitly typed those details.", parameters:{ type:"object", properties:{ hotelName:{type:"string", description:"Exact hotel name provided by the user. Never invent placeholder hotel names."}, address:{type:"string"}, city:{type:"string"}, state:{type:"string"}, zip:{type:"string"}, phone:{type:"string"}, email:{type:"string"}, bookingLink:{type:"string"}, discountCode:{type:"string"}, groupName:{type:"string"}, cutoffDate:{type:"string"}, roomsReserved:{type:"number"}, pricePerNight:{type:"number"}, distanceFromVenue:{type:"string"}, notes:{type:"string"} }, required:["hotelName"] } } },
  { type:"function" as const, function:{ name:"update_hotel", description:"Update hotel block. Pass hotelId or matchName. Booked room counts are synced from guests assigned in the Guest List, not edited here.", parameters:{ type:"object", properties:{ hotelId:{type:"number"}, matchName:{type:"string"}, hotelName:{type:"string"}, address:{type:"string"}, city:{type:"string"}, state:{type:"string"}, zip:{type:"string"}, phone:{type:"string"}, email:{type:"string"}, bookingLink:{type:"string"}, discountCode:{type:"string"}, groupName:{type:"string"}, cutoffDate:{type:"string"}, roomsReserved:{type:"number"}, pricePerNight:{type:"number"}, distanceFromVenue:{type:"string"}, notes:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"delete_hotel", description:"Delete hotel block. Pass hotelId or matchName.", parameters:{ type:"object", properties:{ hotelId:{type:"number"}, matchName:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_hotels", description:"List all hotel blocks.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"generate_budget", description:"Generate or rebuild a full wedding budget from the user's profile total budget, or from totalBudget if the user provides one. Use when the user asks to create, build, make, reset, or generate a full budget or budget breakdown.", parameters:{ type:"object", properties:{ totalBudget:{type:"number", description:"Optional total wedding budget amount provided by the user."} } } } },
  { type:"function" as const, function:{ name:"add_budget_item", description:"Add budget line item. Required: category, vendor, estimatedCost.", parameters:{ type:"object", properties:{ category:{type:"string"}, vendor:{type:"string"}, estimatedCost:{type:"number"}, actualCost:{type:"number"}, notes:{type:"string"} }, required:["category","vendor","estimatedCost"] } } },
  { type:"function" as const, function:{ name:"update_budget_item", description:"Update budget item. Pass itemId or matchVendor.", parameters:{ type:"object", properties:{ itemId:{type:"number"}, matchVendor:{type:"string"}, category:{type:"string"}, vendor:{type:"string"}, estimatedCost:{type:"number"}, actualCost:{type:"number"}, notes:{type:"string"}, isPaid:{type:"boolean"} } } } },
  { type:"function" as const, function:{ name:"delete_budget_item", description:"Delete budget item. Pass itemId or matchVendor.", parameters:{ type:"object", properties:{ itemId:{type:"number"}, matchVendor:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"log_budget_payment", description:"Log payment against budget item. Required: amount.", parameters:{ type:"object", properties:{ itemId:{type:"number"}, matchVendor:{type:"string"}, amount:{type:"number"}, note:{type:"string"} }, required:["amount"] } } },
  { type:"function" as const, function:{ name:"list_budget", description:"List all budget items.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"add_expense", description:"Add one-off expense. Required: name, category, cost.", parameters:{ type:"object", properties:{ name:{type:"string"}, category:{type:"string"}, cost:{type:"number"}, amountPaid:{type:"number"}, notes:{type:"string"} }, required:["name","category","cost"] } } },
  { type:"function" as const, function:{ name:"update_expense", description:"Update expense. Pass expenseId or matchName.", parameters:{ type:"object", properties:{ expenseId:{type:"number"}, matchName:{type:"string"}, name:{type:"string"}, category:{type:"string"}, cost:{type:"number"}, amountPaid:{type:"number"}, notes:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"delete_expense", description:"Delete expense. Pass expenseId or matchName.", parameters:{ type:"object", properties:{ expenseId:{type:"number"}, matchName:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"list_expenses", description:"List all expenses.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"update_profile", description:"Update wedding profile fields.", parameters:{ type:"object", properties:{ partner1Name:{type:"string"}, partner2Name:{type:"string"}, weddingDate:{type:"string"}, ceremonyTime:{type:"string"}, receptionTime:{type:"string"}, venue:{type:"string"}, location:{type:"string"}, guestCount:{type:"number"}, totalBudget:{type:"number"}, weddingVibe:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"get_profile", description:"Get wedding profile details.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"list_contracts", description:"List uploaded contracts.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"get_contract", description:"Get full contract analysis. Required: contractId.", parameters:{ type:"object", properties:{ contractId:{type:"number"} }, required:["contractId"] } } },
  { type:"function" as const, function:{ name:"get_summary", description:"Get a compact overview of the couple's wedding planning progress: profile, guest counts, vendor count, budget totals, checklist completion, upcoming payments.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"generate_seating", description:"Generate an AI seating chart using the current guest list. Required: tableCount (number of tables), seatsPerTable (seats per table). Optionally provide saveName to save the chart, and additionalNotes for special considerations.", parameters:{ type:"object", properties:{ tableCount:{type:"number",description:"Number of tables"}, seatsPerTable:{type:"number",description:"Maximum seats per table"}, additionalNotes:{type:"string",description:"Optional special instructions (e.g. keep family X away from family Y)"}, saveName:{type:"string",description:"If provided, saves the chart with this name"} }, required:["tableCount","seatsPerTable"] } } },
  { type:"function" as const, function:{ name:"list_seating_charts", description:"List all saved seating charts.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"delete_seating_chart", description:"Delete a saved seating chart. Pass chartId or matchName.", parameters:{ type:"object", properties:{ chartId:{type:"number"}, matchName:{type:"string"} } } } },
  { type:"function" as const, function:{ name:"invite_collaborator", description:"Invite someone to collaborate on the wedding planning. Required: email, role (partner / planner / vendor).", parameters:{ type:"object", properties:{ email:{type:"string",description:"Email address to invite"}, role:{type:"string",enum:["partner","planner","vendor"],description:"Collaborator role"} }, required:["email","role"] } } },
  { type:"function" as const, function:{ name:"list_collaborators", description:"List all current collaborators and pending invites.", parameters:{ type:"object", properties:{} } } },
  { type:"function" as const, function:{ name:"remove_collaborator", description:"Remove a collaborator or cancel a pending invite. Pass collaboratorId or matchEmail.", parameters:{ type:"object", properties:{ collaboratorId:{type:"number"}, matchEmail:{type:"string"} } } } },
];

const ALLOWED_VENDOR_CATEGORIES = [
  "Venue", "Caterer", "Photographer", "Videographer", "Florist",
  "DJ / Band", "Officiant", "Hair & Makeup", "Transportation",
  "Cake & Desserts", "Invitations", "Lighting & AV", "Photo Booth",
  "Wedding Planner", "Other",
];

const VENDOR_CATEGORY_SYNONYMS: Record<string, string> = {
  dj: "DJ / Band",
  band: "DJ / Band",
  "dj/band": "DJ / Band",
  "dj & band": "DJ / Band",
  makeup: "Hair & Makeup",
  hair: "Hair & Makeup",
  "hair and makeup": "Hair & Makeup",
  "cake": "Cake & Desserts",
  "dessert": "Cake & Desserts",
  desserts: "Cake & Desserts",
  planner: "Wedding Planner",
  "wedding coordinator": "Wedding Planner",
  "lighting": "Lighting & AV",
  av: "Lighting & AV",
  "photo booth": "Photo Booth",
};

function normalizeCategory(c: string): string {
  const canonical = c.trim();
  const found = ALLOWED_VENDOR_CATEGORIES.find(a => a.toLowerCase() === canonical.toLowerCase());
  if (found) return found;

  const simplified = canonical.toLowerCase().replace(/\s+/g, " ").replace(/[.]/g, "");
  const synonym = VENDOR_CATEGORY_SYNONYMS[simplified];
  return synonym ?? canonical;
}

const YES_CONFIRM_INTENT = /^(?:yes|yep|yeah|yup|ok|okay|confirm|confirmed|save(?: it)?|go ahead|do it|please do|sounds good|sure)[.! ]*$/i;

function parsePendingVendorConfirmation(text: string): { name: string; category: string } | null {
  // Matches assistant prompts like:
  // "Saving DJ Magic (DJ). Reply 'yes' to save."
  const m = text.match(/Saving\s+(.+?)\s+\(([^)]+)\)\.[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+save/i);
  if (!m) return null;
  const name = m[1]?.trim();
  const categoryRaw = m[2]?.trim();
  if (!name || !categoryRaw) return null;
  return { name, category: normalizeCategory(categoryRaw) };
}

function parsePendingGuestConfirmation(text: string): { name: string } | null {
  const patterns = [
    /Ready\s+to\s+add\s+(.+?)\s+to\s+(?:the\s+)?guest\s+list[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+(?:save|confirm)/i,
    /Saving\s+(.+?)\s+to\s+(?:the\s+)?guest\s+list[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+(?:save|confirm)/i,
    /Saving\s+(.+?)\s+(?:as\s+a\s+)?guest[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+save/i,
    /Ready\s+to\s+add\s+(.+?)\s+(?:as\s+a\s+)?guest[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+(?:save|confirm)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1]?.trim().replace(/[.!,;:]$/, "");
    if (name) return { name };
  }
  return null;
}

function parsePendingHotelConfirmation(text: string): { hotelName: string } | null {
  const patterns = [
    /Saving\s+(.+?)\s+(?:as\s+a\s+)?hotel\s+block[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+save/i,
    /Ready\s+to\s+add\s+(.+?)\s+(?:as\s+a\s+)?hotel\s+block[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+(?:save|confirm)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const hotelName = match?.[1]?.trim().replace(/[.!,;:]$/, "");
    if (hotelName) return { hotelName };
  }
  return null;
}

function parsePendingPartyConfirmation(text: string): { name: string; role: string; side: string } | null {
  const patterns = [
    /Saving\s+(.+?)\s+as\s+(.+?)\s+on\s+(?:the\s+)?(bride|bridal|groom|both)(?:'s)?\s+(?:side|party)[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+save/i,
    /Ready\s+to\s+add\s+(.+?)\s+as\s+(.+?)\s+on\s+(?:the\s+)?(bride|bridal|groom|both)(?:'s)?\s+(?:side|party)[\s\S]*Reply\s*['"]?yes['"]?\s+to\s+(?:save|confirm)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1]?.trim().replace(/[.!,;:]$/, "");
    const role = match?.[2]?.trim().replace(/[.!,;:]$/, "");
    const side = normalizePartySide(match?.[3] ?? "");
    if (name && role && side) return { name, role, side };
  }
  return null;
}

function extractGuestNameFromAssistant(text: string): string | null {
  const patterns = [
    /\b(?:add|adding)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3})\s+(?:to\s+)?(?:the\s+)?guest\s+list/i,
    /\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3})'s\s+details/i,
    /\bWhat'?s\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3})'s\s+name/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1]?.trim();
    if (name) return name;
  }
  return null;
}

function cleanGatheredName(text: string): string {
  if (CANCEL_INTENT.test(text)) return "";
  return text
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\b(email|phone|rsvp|notes?|note|category|cost|total|deposit)\b[\s:=-].*$/i, "")
    .split(/[,\n;]/)[0]
    .trim()
    .replace(/[.!,;:]$/, "");
}

function inferGatheredVendor(text: string): { name: string; category: string } | null {
  const raw = cleanGatheredName(text);
  if (!raw || raw.length > 80 || /\?/.test(raw)) return null;
  const lower = raw.toLowerCase();
  let category = "Other";
  for (const [word, mapped] of Object.entries(VENDOR_CATEGORY_SYNONYMS)) {
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) {
      category = mapped;
      break;
    }
  }
  const categoryWords = [
    "photographer", "videographer", "florist", "caterer", "catering", "officiant",
    "transportation", "transport", "limo", "cake", "baker", "bakery", "stationery",
    "invitations", "rental", "rentals", "planner", "venue", "lighting", "photo booth",
    "coordinator",
  ];
  const categoryPattern = new RegExp(`\\b(${categoryWords.join("|")})s?\\b`, "ig");
  const name = raw.replace(categoryPattern, "").replace(/\s{2,}/g, " ").trim() || raw;
  return { name, category };
}

function inferGatheredHotel(text: string): { hotelName: string } | null {
  const hotelName = cleanGatheredName(text);
  if (!hotelName || hotelName.length > 100 || /\?/.test(hotelName)) return null;
  return { hotelName };
}

function normalizePartySide(value: string): string {
  const lower = value.toLowerCase().trim();
  if (/\b(bride|bridal)\b/.test(lower)) return "bride";
  if (/\bgroom\b/.test(lower)) return "groom";
  if (/\b(both|shared|either)\b/.test(lower)) return "both";
  return "";
}

function inferGatheredPartyMember(text: string): { name?: string; role?: string; side?: string } {
  const raw = cleanGatheredName(text);
  const fullText = text.trim();
  const rolePatterns = [
    /\b(maid of honor|matron of honor|man of honor|best man|best woman|bridesmaid|bridesman|groomsman|groomswoman|flower girl|ring bearer|usher|junior bridesmaid|junior groomsman|officiant)\b/i,
  ];
  const role = rolePatterns.map(re => fullText.match(re)?.[1]).find(Boolean)?.trim();
  const side = normalizePartySide(fullText);
  let name = raw;
  if (name && role) name = name.replace(new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "").trim();
  name = name
    .replace(/\b(?:on|for|side|bride|bridal|groom|both|party|as|a|an|the)\b/ig, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { name: name || undefined, role: role || undefined, side: side || undefined };
}

function userActuallyMentionedName(candidate: string, userBlob: string, ignoredWords: Set<string>): boolean {
  const lowerCandidate = candidate.toLowerCase().trim();
  const normalizedUserBlob = userBlob.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const compactCandidate = lowerCandidate.replace(/[^a-z0-9]+/g, "");
  const nameTokens = lowerCandidate
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !ignoredWords.has(t));
  const anyTokenMatch = nameTokens.some((t) => userBlob.includes(t));
  const compactMatch = compactCandidate.length >= 3 && normalizedUserBlob.includes(compactCandidate);
  return nameTokens.length > 0 && (anyTokenMatch || compactMatch);
}

type ActionResult =
  | { ok: true; data: unknown }
  // doNotRetry tells the orchestrator to remove this tool from the next round so
  // the model can't keep guessing args after a hallucination-rejection (e.g.
  // "Lowdown Blow DJ" after the user only typed "add a vendor").
  | { ok: false; error: string; doNotRetry?: boolean };
type ActionRecord = { name: string; args: Record<string, unknown>; result: ActionResult };

function friendlyToolError(err: unknown, toolName: string): string {
  const detail = err instanceof Error ? err.message : String(err ?? "");
  const lower = detail.toLowerCase();
  const looksLikeDbError =
    lower.includes("failed query") ||
    lower.includes("insert into") ||
    lower.includes("update ") ||
    lower.includes("delete from") ||
    lower.includes("returning ") ||
    lower.includes("params:") ||
    lower.includes("violates") ||
    lower.includes("invalid input syntax");

  if (looksLikeDbError) {
    if (toolName.includes("guest")) {
      return "I couldn't save that guest because the database rejected one of the fields. Please check the name/details and try again.";
    }
    if (toolName.includes("vendor")) {
      return "I couldn't save that vendor because the database rejected one of the fields. Please check the name/category and try again.";
    }
    return "I couldn't save that change because the database rejected one of the fields. Please check the details and try again.";
  }

  return detail || "Unexpected error";
}

type FoundVendor = { ok: true; id: number; name: string } | { ok: false; error: string };
type FoundVendorPayment = { ok: true; id: number; vendorId: number; label: string } | { ok: false; error: string };
type FoundChecklistItem = { ok: true; id: number; task: string } | { ok: false; error: string };
type FoundGuest = { ok: true; id: number; name: string } | { ok: false; error: string };
type FoundPartyMember = { ok: true; id: number; name: string } | { ok: false; error: string };
type FoundHotel = { ok: true; id: number; hotelName: string } | { ok: false; error: string };
type FoundBudgetItem = { ok: true; id: number; vendor: string; amountPaid: number; estimatedCost: number; actualCost: number } | { ok: false; error: string };
type FoundExpense = { ok: true; id: number; name: string } | { ok: false; error: string };

async function findVendor(profileId: number, idArg: unknown, nameArg: unknown): Promise<FoundVendor> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [v] = await db.select({ id: vendors.id, name: vendors.name }).from(vendors)
        .where(and(eq(vendors.id, idNum), eq(vendors.profileId, profileId))).limit(1);
      if (v) return { ok: true, id: v.id, name: v.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: vendors.id, name: vendors.name }).from(vendors)
      .where(and(eq(vendors.profileId, profileId), ilike(vendors.name, `%${search}%`)));
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

async function findVendorPayment(profileId: number, paymentIdArg: unknown, vendorNameArg: unknown, matchLabelArg: unknown): Promise<FoundVendorPayment> {
  if (paymentIdArg !== undefined && paymentIdArg !== null) {
    const idNum = Number(paymentIdArg);
    if (Number.isFinite(idNum)) {
      const [p] = await db.select({ id: vendorPayments.id, vendorId: vendorPayments.vendorId, label: vendorPayments.label })
        .from(vendorPayments).innerJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
        .where(and(eq(vendorPayments.id, idNum), eq(vendors.profileId, profileId))).limit(1);
      if (p) return { ok: true, id: p.id, vendorId: p.vendorId, label: p.label };
    }
    return { ok: false, error: "Payment not found or not yours." };
  }
  const v = await findVendor(profileId, undefined, vendorNameArg);
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

async function findPartyMember(profileId: number, idArg: unknown, nameArg: unknown): Promise<FoundPartyMember> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: weddingParty.id, name: weddingParty.name }).from(weddingParty)
        .where(and(eq(weddingParty.id, idNum), eq(weddingParty.profileId, profileId))).limit(1);
      if (r) return { ok: true, id: r.id, name: r.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: weddingParty.id, name: weddingParty.name }).from(weddingParty)
      .where(and(eq(weddingParty.profileId, profileId), ilike(weddingParty.name, `%${search}%`)));
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

async function findHotel(profileId: number, idArg: unknown, nameArg: unknown): Promise<FoundHotel> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: hotelBlocks.id, hotelName: hotelBlocks.hotelName }).from(hotelBlocks)
        .where(and(eq(hotelBlocks.id, idNum), eq(hotelBlocks.profileId, profileId))).limit(1);
      if (r) return { ok: true, id: r.id, hotelName: r.hotelName };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: hotelBlocks.id, hotelName: hotelBlocks.hotelName }).from(hotelBlocks)
      .where(and(eq(hotelBlocks.profileId, profileId), ilike(hotelBlocks.hotelName, `%${search}%`)));
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

async function findExpense(profileId: number, idArg: unknown, nameArg: unknown): Promise<FoundExpense> {
  if (idArg !== undefined && idArg !== null) {
    const idNum = Number(idArg);
    if (Number.isFinite(idNum)) {
      const [r] = await db.select({ id: manualExpenses.id, name: manualExpenses.name }).from(manualExpenses)
        .where(and(eq(manualExpenses.id, idNum), eq(manualExpenses.profileId, profileId))).limit(1);
      if (r) return { ok: true, id: r.id, name: r.name };
    }
  }
  if (nameArg) {
    const search = String(nameArg).trim();
    const matches = await db.select({ id: manualExpenses.id, name: manualExpenses.name }).from(manualExpenses)
      .where(and(eq(manualExpenses.profileId, profileId), ilike(manualExpenses.name, `%${search}%`)));
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

type AriaTimelineBlock = {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  category: string;
  location: string;
  notes: string;
};

function ariaParseTimeToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes));
}

function ariaMinutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function ariaTimelineBlock(
  id: number,
  start: number,
  end: number,
  title: string,
  description: string,
  category: string,
  location: string,
  notes = "",
): AriaTimelineBlock {
  return {
    id: `block-${id}`,
    startTime: ariaMinutesToTime(start),
    endTime: ariaMinutesToTime(Math.max(start + 15, end)),
    title,
    description,
    category,
    location,
    notes,
  };
}

function buildAriaTimeline(profile: typeof weddingProfiles.$inferSelect): AriaTimelineBlock[] {
  const ceremony = ariaParseTimeToMinutes(profile.ceremonyTime, 16 * 60);
  const reception = ariaParseTimeToMinutes(profile.receptionTime, ceremony + 2 * 60);
  const venue = profile.venue || "Wedding venue";
  const ceremonyLocation = profile.ceremonyAtVenue === false
    ? profile.ceremonyVenueName || profile.ceremonyAddress || "Ceremony location"
    : venue;

  return [
    ariaTimelineBlock(1, ceremony - 8 * 60, ceremony - 6 * 60, "Hair, makeup, and getting ready", "Wedding party begins hair, makeup, wardrobe prep, and detail photos.", "preparation", venue),
    ariaTimelineBlock(2, ceremony - 6 * 60, ceremony - 5 * 60, "Vendor arrivals and setup", "Photo/video team, florist, music, catering, and venue team begin setup.", "vendors", venue),
    ariaTimelineBlock(3, ceremony - 5 * 60, ceremony - 4 * 60, "Couple portraits and first look", "Optional first look, couple portraits, and immediate family photos.", "photos", venue),
    ariaTimelineBlock(4, ceremony - 4 * 60, ceremony - 3 * 60, "Wedding party photos", "Capture wedding party portraits and any pre-ceremony group photos.", "photos", venue),
    ariaTimelineBlock(5, ceremony - 90, ceremony - 45, "Final ceremony prep", "Hideaway time, ceremony detail checks, music checks, and guest arrival prep.", "preparation", ceremonyLocation),
    ariaTimelineBlock(6, ceremony - 30, ceremony, "Guest arrival", "Guests arrive, find seats, and prelude music begins.", "ceremony", ceremonyLocation),
    ariaTimelineBlock(7, ceremony, ceremony + 45, "Ceremony", "Processional, vows, rings, pronouncement, and recessional.", "ceremony", ceremonyLocation),
    ariaTimelineBlock(8, ceremony + 45, reception, "Cocktail hour and family photos", "Guests enjoy cocktail hour while family and newlywed portraits are completed.", "cocktail", venue),
    ariaTimelineBlock(9, reception, reception + 30, "Reception entrance and welcome", "Grand entrance, welcome remarks, and transition into dinner service.", "reception", venue),
    ariaTimelineBlock(10, reception + 30, reception + 90, "Dinner service", "Dinner is served with space for table visits and guest greetings.", "reception", venue),
    ariaTimelineBlock(11, reception + 90, reception + 135, "Toasts and special dances", "Toasts, first dance, parent dances, and formal reception moments.", "reception", venue),
    ariaTimelineBlock(12, reception + 135, reception + 240, "Open dancing and celebration", "Dance floor opens, cake cutting happens as scheduled, and the party continues.", "dancing", venue),
    ariaTimelineBlock(13, reception + 240, reception + 270, "Final song and send-off", "Final song, private last dance or send-off, and guest departure.", "dancing", venue),
  ];
}

function monthsUntilWedding(weddingDate: string | null | undefined): number {
  const wedding = weddingDate ? new Date(weddingDate) : null;
  if (!wedding || Number.isNaN(wedding.getTime())) return 12;
  const monthMs = 1000 * 60 * 60 * 24 * 30;
  return Math.max(0, Math.ceil((wedding.getTime() - Date.now()) / monthMs));
}

function buildAriaChecklist(profile: typeof weddingProfiles.$inferSelect): Array<{ month: string; task: string; description: string }> {
  const months = monthsUntilWedding(profile.weddingDate);
  const vibe = profile.weddingVibe || "wedding";
  const guestCount = Number(profile.guestCount ?? 0);
  const items: Array<{ minMonth: number; month: string; task: string; description: string }> = [
    { minMonth: 10, month: "12+ Months Before", task: "Set your wedding budget", description: "Confirm priorities, contributors, and comfort range." },
    { minMonth: 10, month: "12+ Months Before", task: "Draft the guest list", description: `Start with the must-invite list${guestCount ? ` near ${guestCount} guests` : ""}.` },
    { minMonth: 10, month: "12+ Months Before", task: "Book the venue", description: "Secure the date, location, and contract terms." },
    { minMonth: 10, month: "12+ Months Before", task: "Hire priority vendors", description: "Book planner, photographer, catering, music, and floral leads." },
    { minMonth: 7, month: "9-12 Months Before", task: "Choose the wedding style", description: `Translate the ${vibe} vision into colors and design notes.` },
    { minMonth: 7, month: "9-12 Months Before", task: "Start wedding website details", description: "Add date, venue, travel, RSVP, and registry basics." },
    { minMonth: 7, month: "9-12 Months Before", task: "Plan hotel blocks", description: "Reserve rooms and collect booking links for guests." },
    { minMonth: 4, month: "6-9 Months Before", task: "Order attire", description: "Schedule fittings and confirm accessories." },
    { minMonth: 4, month: "6-9 Months Before", task: "Finalize catering direction", description: "Pick menu style, tasting date, and dietary process." },
    { minMonth: 4, month: "6-9 Months Before", task: "Send save the dates", description: "Send once venue, date, and guest list are stable." },
    { minMonth: 2, month: "3-6 Months Before", task: "Choose ceremony details", description: "Confirm readings, music, processional, and officiant notes." },
    { minMonth: 2, month: "3-6 Months Before", task: "Order invitations", description: "Proof names, addresses, RSVP date, and inserts." },
    { minMonth: 2, month: "3-6 Months Before", task: "Plan rentals and decor", description: "Confirm linens, tabletop, signage, lighting, and layout." },
    { minMonth: 1, month: "1-3 Months Before", task: "Send invitations", description: "Mail or email invites with RSVP deadline." },
    { minMonth: 1, month: "1-3 Months Before", task: "Create seating plan", description: "Group guests by relationships, needs, and RSVPs." },
    { minMonth: 1, month: "1-3 Months Before", task: "Confirm vendor balances", description: "Review due dates, contracts, and payment status." },
    { minMonth: 0, month: "1 Month Before", task: "Finalize RSVP count", description: "Follow up with pending guests and update catering." },
    { minMonth: 0, month: "1 Month Before", task: "Build final timeline", description: "Share ceremony, reception, photo, and vendor timing." },
    { minMonth: 0, month: "1 Week Before", task: "Confirm vendor arrivals", description: "Send final timeline, addresses, and contact list." },
    { minMonth: 0, month: "1 Week Before", task: "Pack wedding day essentials", description: "Prepare attire, rings, documents, tips, and emergency kit." },
    { minMonth: 0, month: "Day Before", task: "Rehearse ceremony", description: "Walk through lineup, cues, music, and timing." },
    { minMonth: 0, month: "Wedding Day", task: "Enjoy the celebration", description: "Let the timeline guide the day and be present." },
  ];

  return items
    .filter((item) => item.minMonth === 0 || months >= item.minMonth)
    .map(({ minMonth: _minMonth, ...item }) => item);
}

function buildAriaBudgetBreakdown(totalBudget: number): Array<{ category: string; vendor: string; estimatedCost: number; notes: string }> {
  const categories = [
    { category: "Venue", vendor: "Venue", pct: 0.22, notes: "Ceremony/reception space, rentals, and venue fees." },
    { category: "Catering & Bar", vendor: "Catering & Bar", pct: 0.28, notes: "Food, beverage, service staff, and gratuity buffer." },
    { category: "Photography", vendor: "Photography", pct: 0.10, notes: "Main photographer package and engagement/session coverage." },
    { category: "Videography", vendor: "Videography", pct: 0.06, notes: "Highlight film or ceremony/reception video coverage." },
    { category: "Florals & Decor", vendor: "Florals & Decor", pct: 0.08, notes: "Personal flowers, centerpieces, ceremony decor, and styling." },
    { category: "Music/DJ/Band", vendor: "Music/DJ/Band", pct: 0.06, notes: "Ceremony audio, cocktail music, and reception entertainment." },
    { category: "Attire & Beauty", vendor: "Attire & Beauty", pct: 0.07, notes: "Wedding attire, alterations, hair, makeup, and accessories." },
    { category: "Invitations & Stationery", vendor: "Invitations & Stationery", pct: 0.03, notes: "Save the dates, invitations, signage, and day-of paper." },
    { category: "Cake & Desserts", vendor: "Cake & Desserts", pct: 0.02, notes: "Cake, dessert display, tasting, and delivery." },
    { category: "Transportation", vendor: "Transportation", pct: 0.03, notes: "Couple, wedding party, or guest shuttle transportation." },
    { category: "Officiant", vendor: "Officiant", pct: 0.01, notes: "Ceremony officiant fee and related documentation." },
    { category: "Emergency Fund", vendor: "Emergency Fund", pct: 0.04, notes: "Buffer for taxes, tips, rush fees, or last-minute needs." },
  ];

  let allocated = 0;
  return categories.map((item, index) => {
    const estimatedCost = index === categories.length - 1
      ? Math.max(0, Math.round(totalBudget - allocated))
      : Math.max(0, Math.round(totalBudget * item.pct));
    allocated += estimatedCost;
    return {
      category: item.category,
      vendor: item.vendor,
      estimatedCost,
      notes: item.notes,
    };
  });
}

function timelineEventTime(event: Record<string, unknown>): string {
  return String(event.time ?? event.startTime ?? "").toLowerCase();
}

async function executeTool(name: string, args: Record<string, unknown>, req: Request, ctx?: { recentUserText?: string }): Promise<ActionResult> {
  // Lower-cased blob of the user's most recent messages so individual tools
  // can verify the user actually mentioned the things the model is trying
  // to record (defense against hallucinated args like contractSigned=true
  // when the user only asked to "add a vendor").
  const userBlob = (ctx?.recentUserText ?? "").toLowerCase();
  try {
    if (name === "add_vendor") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
      const vendorName = String(args.name ?? "").trim();
      const category = normalizeCategory(String(args.category ?? "Other").trim());
      if (!vendorName) return { ok: false, error: "Vendor name is required. Ask the user for the specific business name.", doNotRetry: true };

      // Reject category words and placeholders used as vendor names
      const VENDOR_CATEGORY_WORDS = new Set([
        "vendor", "photographer", "videographer", "florist", "caterer", "catering",
        "dj", "band", "musician", "officiant", "hair", "makeup", "transportation",
        "transport", "limo", "cake", "baker", "bakery", "stationery", "invitations",
        "rental", "rentals", "planner", "venue", "lighting", "photo booth",
        "wedding planner", "coordinator", "other", "misc", "miscellaneous",
      ]);
      const lowerName = vendorName.toLowerCase();
      if (VENDOR_CATEGORY_WORDS.has(lowerName)) {
        return { ok: false, error: `"${vendorName}" is a vendor category when it appears by itself, not a business name. Ask the user for the full business name. Names like "DJ Nick" or "Nick's DJ Services" are valid if the user typed them.`, doNotRetry: true };
      }

      // Refuse to save a vendor whose name doesn't appear anywhere in the
      // user's recent messages. This catches hallucinated business names
      // ("Lowdown Blow DJ", "Bloom & Co", etc.) that the small instruct
      // model occasionally fabricates when it should be asking instead.
      // We compare token-by-token so partial matches still pass — e.g.
      // user: "add Bloom & Co Florists" → tokens "bloom" and "co" appear,
      // hallucinations like "Lowdown Blow DJ" never do.
      if (userBlob && userBlob.length > 0) {
        if (!userActuallyMentionedName(vendorName, userBlob, VENDOR_CATEGORY_WORDS)) {
          return {
            ok: false,
            error: `"${vendorName}" doesn't appear in the user's messages — do not invent vendor names. Ask the user: "What's the vendor's business name?" and wait for their reply before calling add_vendor again.`,
            doNotRetry: true,
          };
        }
      }
      if (/^(vendor\s*\d*|new vendor|sample vendor|test vendor|unnamed|unknown vendor|n\/a|none|tbd|placeholder|my vendor|the vendor)$/i.test(lowerName)) {
        return { ok: false, error: `"${vendorName}" looks like a placeholder. Ask the user for the actual business name, then call add_vendor again.`, doNotRetry: true };
      }
      // Reject names that match the system prompt examples — the model sometimes
      // uses these as defaults when the user hasn't provided a real name.
      if (/^(bloom\s*&?\s*co|happy clicks studio|sarah lee photography)$/i.test(lowerName)) {
        return { ok: false, error: `"${vendorName}" is an example name, not a name the user provided. Ask the user: "What's the specific business name?" then call add_vendor with their real answer.`, doNotRetry: true };
      }
      // Reject names that are clearly questions or the gathering-question text.
      // A real business name never contains a question mark or exceeds 80 chars.
      if (vendorName.includes("?")) {
        return { ok: false, error: `"${vendorName}" is a question, not a business name. Ask the user for the vendor's name and wait for their reply before calling add_vendor.`, doNotRetry: true };
      }
      if (vendorName.length > 80) {
        return { ok: false, error: `Vendor name is too long to be a real business name. Ask the user: "What's the specific business name?" then call add_vendor with their real answer.`, doNotRetry: true };
      }
      if (/^(what'?s|what is|please|could you|can you|tell me|i need|i want|add a |add an )/i.test(vendorName)) {
        return { ok: false, error: `"${vendorName.slice(0, 40)}…" looks like a prompt or question, not a business name. Ask the user for the vendor's name and wait for their reply.` };
      }
      // Defense against hallucinated args: only honor money/contract fields
      // if the user actually mentioned them in their recent messages. The
      // small instruct model frequently fills these in unprompted (e.g.
      // contractSigned=true when the user only said "add a vendor"), which
      // produced misleading "contract signed ✓ deposit milestone created ✓"
      // confirmations for fictional details.
      const userMentionedMoney = /(\$|\bdollar|\bcost|\btotal|\bdeposit|\bdue|\bbudget)/i.test(userBlob);
      const userMentionedContract = /\b(contract|signed|sign(ed)? off|booked|locked in)\b/i.test(userBlob);
      const depositAmt = userMentionedMoney ? Number(args.depositAmount ?? 0) : 0;
      const totalCostAmt = userMentionedMoney ? Number(args.totalCost ?? 0) : 0;
      const contractSignedArg = userMentionedContract && args.contractSigned === true;

      const normalizedVendorName = lowerName.replace(/[^a-z0-9]+/g, "");
      const existingVendors = await db
        .select({ id: vendors.id, name: vendors.name })
        .from(vendors)
        .where(eq(vendors.profileId, profile.id));
      const duplicate = existingVendors.find((v) => v.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedVendorName);
      if (duplicate) {
        return {
          ok: false,
          error: `Vendor "${duplicate.name}" already exists. Do not add a duplicate entry — update the existing vendor instead.`,
          doNotRetry: true,
        };
      }

      const [created] = await db.insert(vendors).values({
        profileId: profile.id,
        userId: profile.userId,
        name: vendorName,
        category,
        email: args.email ? String(args.email) : null,
        phone: args.phone ? String(args.phone) : null,
        website: args.website ? String(args.website) : null,
        portalLink: null,
        notes: args.notes ? String(args.notes) : null,
        totalCost: String(Number.isFinite(totalCostAmt) ? totalCostAmt : 0),
        depositAmount: String(Number.isFinite(depositAmt) ? depositAmt : 0),
        contractSigned: contractSignedArg,
      }).returning();

      // NOTE: Deposit milestones are intentionally NOT auto-created here.
      // If the user wants a deposit payment scheduled, the model must call
      // add_vendor_payment explicitly so the action is visible in the
      // confirmation summary instead of appearing as a hidden side-effect.

      return { ok: true, data: { id: created.id, name: created.name, category: created.category, contractSigned: contractSignedArg, hasCost: totalCostAmt > 0 } };
    }

    if (name === "add_vendor_payment") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
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
            .where(and(eq(vendors.id, idNum), eq(vendors.profileId, profile.id))).limit(1);
          if (v) vendorId = v.id;
        }
      }
      if (vendorId === null && args.vendorName) {
        const search = String(args.vendorName).trim();
        const matches = await db.select({ id: vendors.id, name: vendors.name }).from(vendors)
          .where(and(eq(vendors.profileId, profile.id), ilike(vendors.name, `%${search}%`)));
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

    if (name === "generate_checklist") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Please complete your wedding profile before generating a checklist." };
      const tasks = buildAriaChecklist(profile);
      const rows = tasks.map((task) => ({
        profileId: profile.id,
        month: task.month,
        task: task.task,
        description: task.description,
      }));
      await db.transaction(async (tx) => {
        await tx.delete(checklistItems).where(eq(checklistItems.profileId, profile.id));
        if (rows.length > 0) await tx.insert(checklistItems).values(rows);
      });
      logActivity(profile.id, req.userId!, `Aria generated wedding checklist (${rows.length} tasks)`, "checklist", { taskCount: rows.length });
      return { ok: true, data: { count: rows.length } };
    }

    if (name === "add_timeline_event") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Please complete your wedding profile before adding timeline events." };
      const eventTitle = String(args.title ?? "").trim();
      const event = {
        time: String(args.time ?? "").trim(),
        title: eventTitle,
        description: String(args.description ?? eventTitle), // fall back to title if no description
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

    if (name === "generate_timeline") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Please complete your wedding profile before generating a timeline." };
      const events = buildAriaTimeline(profile);
      const [created] = await db.transaction(async (tx) => {
        await tx.delete(timelines).where(eq(timelines.profileId, profile.id));
        return tx.insert(timelines).values({ profileId: profile.id, events }).returning();
      });
      logActivity(profile.id, req.userId!, `Aria generated day-of timeline (${events.length} events)`, "timeline", { eventCount: events.length, timelineId: created.id });
      return { ok: true, data: { count: events.length, id: created.id } };
    }

    // ===== VENDORS update/delete =====
    if (name === "update_vendor") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
      const vendor = await findVendor(profile.id, args.vendorId, args.vendorName);
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
        .where(and(eq(vendors.id, vendor.id), eq(vendors.profileId, profile.id))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name, updated: Object.keys(updates).filter(k=>k!=="updatedAt") } };
    }

    if (name === "delete_vendor") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
      const vendor = await findVendor(profile.id, args.vendorId, args.vendorName);
      if (!vendor.ok) return vendor;
      await db.delete(vendorPayments).where(eq(vendorPayments.vendorId, vendor.id));
      await db.delete(vendors).where(and(eq(vendors.id, vendor.id), eq(vendors.profileId, profile.id)));
      return { ok: true, data: { deleted: vendor.name } };
    }

    // ===== VENDOR PAYMENTS update/mark/delete =====
    if (name === "update_vendor_payment" || name === "mark_vendor_payment_paid" || name === "delete_vendor_payment") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
      const payment = await findVendorPayment(profile.id, args.paymentId, args.vendorName, args.matchLabel);
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
          (matchTitle && String(e.title ?? "").toLowerCase().includes(matchTitle)) ||
          (matchTime && timelineEventTime(e as Record<string, unknown>) === matchTime),
        );
      if (indices.length === 0) return { ok: false, error: "No matching event found." };
      if (indices.length > 1) return { ok: false, error: `Multiple events match: ${indices.map(x => `"${String(x.e.title ?? "Untitled")}" @ ${timelineEventTime(x.e as Record<string, unknown>) || "no time"}`).join(", ")}. Be more specific.` };
      const idx = indices[0].i;
      if (name === "delete_timeline_event") {
        const removed = events[idx];
        events.splice(idx, 1);
        await db.update(timelines).set({ events }).where(eq(timelines.id, latest.id));
        return { ok: true, data: { deleted: removed, totalEvents: events.length } };
      }
      const updated = { ...events[idx] };
      if (args.time !== undefined) {
        if ("startTime" in updated) updated.startTime = String(args.time);
        else updated.time = String(args.time);
      }
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
      if (!guestName) return { ok: false, error: "Guest name is required. Ask the user who they want to add.", doNotRetry: true };
      const GUEST_PLACEHOLDER_WORDS = new Set([
        "guest", "new", "person", "someone", "somebody", "friend", "family",
        "invitee", "unknown", "unnamed", "placeholder", "test", "sample",
      ]);
      if (/^(guest\s*\d*|new guest|sample guest|test guest|unnamed|unknown|n\/a|none|tbd|placeholder|someone|somebody)$/i.test(guestName)) {
        return { ok: false, error: `"${guestName}" is not a guest's name. Ask the user who they want to add.`, doNotRetry: true };
      }
      if (guestName.includes("?") || guestName.length > 80 || /^(what'?s|what is|please|could you|can you|tell me|i need|i want|add a |add an )/i.test(guestName)) {
        return { ok: false, error: `"${guestName.slice(0, 40)}" doesn't look like a guest name. Ask the user who they want to add.`, doNotRetry: true };
      }
      if (userBlob && userBlob.length > 0 && !userActuallyMentionedName(guestName, userBlob, GUEST_PLACEHOLDER_WORDS)) {
        return {
          ok: false,
          error: `"${guestName}" doesn't appear in the user's messages — do not invent guest names. Ask the user: "Who would you like me to add to the guest list?" and wait for their reply before calling add_guest again.`,
          doNotRetry: true,
        };
      }
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
        guestCountry: args.guestCountry ? String(args.guestCountry) : null,
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
      const stringFields = ["name","email","phone","rsvpStatus","mealChoice","dietaryNotes","guestGroup","plusOneName","tableAssignment","notes","address","guestCity","guestState","guestZip","guestCountry"] as const;
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
      const side = normalizePartySide(String(args.side ?? "").trim());
      if (!memberName || !role || !side) return { ok: false, error: "Name, role, and side are required. Ask the user for the person's name, role, and whether they are on the bridal party/bride side, groom side, or both.", doNotRetry: true };
      const PARTY_PLACEHOLDER_WORDS = new Set([
        "party", "member", "person", "someone", "somebody", "bridesmaid", "groomsman",
        "groom", "bride", "bridal", "best", "maid", "honor", "new", "sample", "test",
      ]);
      if (/^(party member|wedding party member|new member|sample member|test member|someone|somebody|tbd|unknown|unnamed|n\/a|none)$/i.test(memberName)) {
        return { ok: false, error: `"${memberName}" is not a person's name. Ask who they want to add to the wedding party.`, doNotRetry: true };
      }
      if (memberName.includes("?") || memberName.length > 80 || /^(what'?s|what is|please|could you|can you|tell me|i need|i want|add a |add an )/i.test(memberName)) {
        return { ok: false, error: `"${memberName.slice(0, 40)}" doesn't look like a wedding party member's name. Ask the user for the person's name, role, and side.`, doNotRetry: true };
      }
      if (userBlob && userBlob.length > 0 && !userActuallyMentionedName(memberName, userBlob, PARTY_PLACEHOLDER_WORDS)) {
        return {
          ok: false,
          error: `"${memberName}" doesn't appear in the user's messages - do not invent wedding party members. Ask the user who they want to add, their role, and whether they are on the bridal party/bride side, groom side, or both.`,
          doNotRetry: true,
        };
      }
      const roleTokens = role.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);
      const userMentionedRole = roleTokens.length > 0 && roleTokens.some(t => userBlob.includes(t));
      const userMentionedSide = side === "both"
        ? /\b(both|shared|either)\b/i.test(userBlob)
        : side === "bride"
          ? /\b(bride|bridal)\b/i.test(userBlob)
          : /\bgroom\b/i.test(userBlob);
      if (userBlob && (!userMentionedRole || !userMentionedSide)) {
        return { ok: false, error: "I need the role and side from the user before saving. Ask for their role and whether they are on the bridal party/bride side, groom side, or both.", doNotRetry: true };
      }
      const profile = await resolveProfile(req);
      const [created] = await db.insert(weddingParty).values({
        userId, profileId: profile?.id ?? null, name: memberName, role, side,
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
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Create your wedding profile first." };
      const member = await findPartyMember(profile.id, args.memberId, args.matchName);
      if (!member.ok) return member;
      if (name === "delete_party_member") {
        await db.delete(weddingParty).where(and(eq(weddingParty.id, member.id), eq(weddingParty.profileId, profile.id)));
        return { ok: true, data: { deleted: member.name } };
      }
      const updates: Partial<typeof weddingParty.$inferInsert> = {};
      const fields = ["name","role","side","phone","email","outfitDetails","shoeSize","outfitStore","fittingDate","notes"] as const;
      for (const f of fields) {
        if (args[f] !== undefined) (updates as Record<string, unknown>)[f] = args[f] === null || args[f] === "" ? null : String(args[f]);
      }
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(weddingParty).set(updates)
        .where(and(eq(weddingParty.id, member.id), eq(weddingParty.profileId, profile.id))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name } };
    }

    if (name === "list_party") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: true, data: { members: [] } };
      const rows = await db.select({ id: weddingParty.id, name: weddingParty.name, role: weddingParty.role, side: weddingParty.side })
        .from(weddingParty).where(eq(weddingParty.profileId, profile.id));
      return { ok: true, data: { members: rows } };
    }

    // ===== HOTELS =====
    if (name === "add_hotel") {
      const userId = await resolveScopeUserId(req);
      const profile = await resolveProfile(req);
      const hotelName = String(args.hotelName ?? "").trim();
      if (!hotelName) return { ok: false, error: "Hotel name is required. Ask the user which hotel block they want to add.", doNotRetry: true };
      const HOTEL_PLACEHOLDER_WORDS = new Set([
        "hotel", "block", "room", "rooms", "lodging", "accommodation", "accommodations",
        "new", "sample", "test", "placeholder", "unknown", "unnamed", "grand",
      ]);
      if (/^(hotel\s*\d*|new hotel|hotel block|room block|sample hotel|test hotel|unnamed|unknown|n\/a|none|tbd|placeholder|the grand hotel|grand hotel)$/i.test(hotelName)) {
        return { ok: false, error: `"${hotelName}" is not a hotel name the user provided. Ask the user which hotel to add.`, doNotRetry: true };
      }
      if (hotelName.includes("?") || hotelName.length > 100 || /^(what'?s|what is|please|could you|can you|tell me|i need|i want|add a |add an )/i.test(hotelName)) {
        return { ok: false, error: `"${hotelName.slice(0, 40)}" doesn't look like a hotel name. Ask the user which hotel to add.`, doNotRetry: true };
      }
      if (userBlob && userBlob.length > 0 && !userActuallyMentionedName(hotelName, userBlob, HOTEL_PLACEHOLDER_WORDS)) {
        return {
          ok: false,
          error: `"${hotelName}" doesn't appear in the user's messages - do not invent hotel names. Ask the user: "Which hotel should I add for this block?" and wait for their reply before calling add_hotel again.`,
          doNotRetry: true,
        };
      }
      const userMentionedAddress = /\b(address|located|location|street|road|rd\b|avenue|ave\b|boulevard|blvd\b|drive|dr\b|suite|city|state|zip|postal)\b/i.test(userBlob);
      const userMentionedContact = /\b(phone|call|number|email|contact)\b|@/i.test(userBlob);
      const userMentionedBooking = /\b(link|url|website|booking|book(ing)? link|reserve|reservation)\b|https?:\/\//i.test(userBlob);
      const userMentionedDiscount = /\b(discount|promo|code|group code|block code)\b/i.test(userBlob);
      const userMentionedGroup = /\b(group name|room block name|block name|under the name)\b/i.test(userBlob);
      const userMentionedCutoff = /\b(cutoff|cut off|deadline|due date|expires?|book by|reserve by)\b/i.test(userBlob);
      const userMentionedRooms = /\b(room|rooms|reserved|block(ed)?|hold|holds?)\b/i.test(userBlob) && /\d/.test(userBlob);
      const userMentionedRate = /(\$|\brate\b|price|nightly|per night|\/night|cost|amount)/i.test(userBlob);
      const userMentionedDistance = /\b(distance|miles?|mi\b|minutes?|mins?|from venue|near venue|away)\b/i.test(userBlob);
      const userMentionedNotes = /\b(note|notes|memo|details?|special|shuttle|parking|breakfast|amenit)/i.test(userBlob);
      const [created] = await db.insert(hotelBlocks).values({
        userId, profileId: profile?.id ?? null, hotelName,
        address: userMentionedAddress && args.address ? String(args.address) : null,
        city: userMentionedAddress && args.city ? String(args.city) : null,
        state: userMentionedAddress && args.state ? String(args.state) : null,
        zip: userMentionedAddress && args.zip ? String(args.zip) : null,
        phone: userMentionedContact && args.phone ? String(args.phone) : null,
        email: userMentionedContact && args.email ? String(args.email) : null,
        bookingLink: userMentionedBooking && args.bookingLink ? String(args.bookingLink) : null,
        discountCode: userMentionedDiscount && args.discountCode ? String(args.discountCode) : null,
        groupName: userMentionedGroup && args.groupName ? String(args.groupName) : null,
        cutoffDate: userMentionedCutoff && args.cutoffDate ? String(args.cutoffDate) : null,
        roomsReserved: userMentionedRooms && args.roomsReserved !== undefined ? Number(args.roomsReserved) : null,
        pricePerNight: userMentionedRate && args.pricePerNight !== undefined ? String(Number(args.pricePerNight)) : null,
        distanceFromVenue: userMentionedDistance && args.distanceFromVenue ? String(args.distanceFromVenue) : null,
        notes: userMentionedNotes && args.notes ? String(args.notes) : null,
      }).returning();
      return { ok: true, data: { id: created.id, hotelName: created.hotelName } };
    }

    if (name === "update_hotel" || name === "delete_hotel") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Create your wedding profile first." };
      const hotel = await findHotel(profile.id, args.hotelId, args.matchName);
      if (!hotel.ok) return hotel;
      if (name === "delete_hotel") {
        await db.delete(hotelBlocks).where(and(eq(hotelBlocks.id, hotel.id), eq(hotelBlocks.profileId, profile.id)));
        return { ok: true, data: { deleted: hotel.hotelName } };
      }
      const updates: Partial<typeof hotelBlocks.$inferInsert> = {};
      const stringFields = ["hotelName","address","city","state","zip","phone","email","bookingLink","discountCode","groupName","cutoffDate","distanceFromVenue","notes"] as const;
      for (const f of stringFields) {
        if (args[f] !== undefined) (updates as Record<string, unknown>)[f] = args[f] === null || args[f] === "" ? null : String(args[f]);
      }
      if (args.roomsReserved !== undefined) updates.roomsReserved = Number(args.roomsReserved);
      if (args.pricePerNight !== undefined) updates.pricePerNight = String(Number(args.pricePerNight));
      if (Object.keys(updates).length === 0) return { ok: false, error: "Nothing to update" };
      const [updated] = await db.update(hotelBlocks).set(updates)
        .where(and(eq(hotelBlocks.id, hotel.id), eq(hotelBlocks.profileId, profile.id))).returning();
      return { ok: true, data: { id: updated.id, hotelName: updated.hotelName } };
    }

    if (name === "list_hotels") {
      const profile = await resolveProfile(req);
      const rows = await db.select({ id: hotelBlocks.id, hotelName: hotelBlocks.hotelName, city: hotelBlocks.city, pricePerNight: hotelBlocks.pricePerNight, roomsReserved: hotelBlocks.roomsReserved, roomsBooked: hotelBlocks.roomsBooked })
        .from(hotelBlocks).where(profile ? eq(hotelBlocks.profileId, profile.id) : eq(hotelBlocks.userId, await resolveScopeUserId(req)));
      if (!profile) return { ok: true, data: { hotels: rows } };
      const assignedGuests = await db
        .select({ bookedHotelBlockId: guests.bookedHotelBlockId })
        .from(guests)
        .where(eq(guests.profileId, profile.id));
      const bookedCounts = new Map<number, number>();
      for (const guest of assignedGuests) {
        if (!guest.bookedHotelBlockId) continue;
        bookedCounts.set(guest.bookedHotelBlockId, (bookedCounts.get(guest.bookedHotelBlockId) ?? 0) + 1);
      }
      return { ok: true, data: { hotels: rows.map((hotel) => ({ ...hotel, roomsBooked: bookedCounts.get(hotel.id) ?? 0 })) } };
    }

    // ===== BUDGET ITEMS =====
    if (name === "generate_budget") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const requestedTotal = args.totalBudget !== undefined ? Number(args.totalBudget) : Number(profile.totalBudget ?? 0);
      const totalBudget = Number.isFinite(requestedTotal) && requestedTotal > 0 ? requestedTotal : 0;
      if (totalBudget <= 0) {
        return { ok: false, error: "I need the total wedding budget first. Ask the user for the total amount they want to plan around." };
      }
      const breakdown = buildAriaBudgetBreakdown(totalBudget);
      const budget = await ensureBudget(profile.id, totalBudget);
      const existingItems = await db
        .select({ id: budgetItems.id })
        .from(budgetItems)
        .where(eq(budgetItems.budgetId, budget.id));
      await db.transaction(async (tx) => {
        await tx.update(budgets).set({ totalBudget: String(totalBudget), updatedAt: new Date() }).where(eq(budgets.id, budget.id));
        await tx.update(weddingProfiles).set({ totalBudget: String(totalBudget), updatedAt: new Date() }).where(eq(weddingProfiles.id, profile.id));
        if (existingItems.length > 0) {
          const itemIds = existingItems.map((item) => item.id);
          await tx.delete(budgetPaymentLogs).where(inArray(budgetPaymentLogs.budgetItemId, itemIds));
          await tx.delete(budgetItems).where(eq(budgetItems.budgetId, budget.id));
        }
        await tx.insert(budgetItems).values(breakdown.map((item) => ({
          budgetId: budget.id,
          category: item.category,
          vendor: item.vendor,
          estimatedCost: String(item.estimatedCost),
          actualCost: String(item.estimatedCost),
          amountPaid: "0",
          isPaid: false,
          notes: item.notes,
          nextPaymentDue: null,
        })));
      });
      logActivity(profile.id, req.userId!, `Aria generated wedding budget (${breakdown.length} categories)`, "budget", { totalBudget, categoryCount: breakdown.length });
      return { ok: true, data: { totalBudget, count: breakdown.length } };
    }

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
      const rows = await db.select({ id: budgetItems.id, category: budgetItems.category, vendor: budgetItems.vendor, estimatedCost: budgetItems.estimatedCost, actualCost: budgetItems.actualCost, amountPaid: budgetItems.amountPaid, isPaid: budgetItems.isPaid, notes: budgetItems.notes })
        .from(budgetItems).where(eq(budgetItems.budgetId, budget.id));
      const items = rows.map(r => {
        const estimatedCost = Number(r.estimatedCost);
        const actualCost = Number(r.actualCost);
        const amountPaid = Number(r.amountPaid);
        const committedCost = actualCost > 0 ? actualCost : estimatedCost;
        return {
          ...r,
          estimatedCost,
          actualCost,
          amountPaid,
          overage: Math.max(0, actualCost - estimatedCost),
          remainingDue: Math.max(0, committedCost - amountPaid),
        };
      });
      const totalBudget = Number(budget.totalBudget);
      const committed = items.reduce((sum, item) => sum + (item.actualCost > 0 ? item.actualCost : item.estimatedCost), 0);
      const totalPaid = items.reduce((sum, item) => sum + item.amountPaid, 0);
      const overages = items.filter((item) => item.overage > 0);
      return { ok: true, data: { totalBudget, committed, totalPaid, remaining: totalBudget - committed, overBudget: committed > totalBudget, overages, items } };
    }

    // ===== EXPENSES =====
    if (name === "add_expense") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
      const expName = String(args.name ?? "").trim();
      const category = String(args.category ?? "").trim() || "Other";
      const cost = Number(args.cost);
      if (!expName) return { ok: false, error: "name is required" };
      if (!Number.isFinite(cost)) return { ok: false, error: "cost must be a number" };
      const [created] = await db.insert(manualExpenses).values({
        profileId: profile.id,
        userId: profile.userId,
        name: expName, category,
        cost: String(cost),
        amountPaid: args.amountPaid !== undefined ? String(Number(args.amountPaid)) : "0",
        notes: args.notes ? String(args.notes) : null,
      }).returning();
      return { ok: true, data: { id: created.id, name: created.name } };
    }

    if (name === "update_expense" || name === "delete_expense") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile found." };
      const exp = await findExpense(profile.id, args.expenseId, args.matchName);
      if (!exp.ok) return exp;
      if (name === "delete_expense") {
        await db.delete(manualExpenses).where(and(eq(manualExpenses.id, exp.id), eq(manualExpenses.profileId, profile.id)));
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
        .where(and(eq(manualExpenses.id, exp.id), eq(manualExpenses.profileId, profile.id))).returning();
      return { ok: true, data: { id: updated.id, name: updated.name } };
    }

    if (name === "list_expenses") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: true, data: { expenses: [] } };
      const rows = await db.select({ id: manualExpenses.id, name: manualExpenses.name, category: manualExpenses.category, cost: manualExpenses.cost, amountPaid: manualExpenses.amountPaid })
        .from(manualExpenses).where(eq(manualExpenses.profileId, profile.id));
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
      const allowed = ["partner1Name", "partner2Name", "weddingDate", "ceremonyTime", "receptionTime", "venue", "location", "guestCount", "totalBudget", "weddingVibe"];
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
      const profile = await resolveProfile(req);
      if (!profile) return { ok: true, data: { vendors: [] } };
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
        .where(eq(vendors.profileId, profile.id));

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

      // Keep the tool result small — only fields Aria needs for planning
      // answers. Dropping notes/files/primaryContact reduces token usage
      // by ~40% on a full vendor list and stops small models from dumping
      // raw JSON into their text response.
      const result = rows.map(v => ({
        id: v.id,
        name: v.name,
        category: v.category,
        email: v.email ?? undefined,
        phone: v.phone ?? undefined,
        totalCost: v.totalCost,
        depositAmount: v.depositAmount,
        contractSigned: v.contractSigned,
        nextPaymentDue: v.nextPaymentDue ?? undefined,
        payments: (paymentsByVendor[v.id] ?? []).map(p => ({
          id: p.id, label: p.label, amount: p.amount, dueDate: p.dueDate, isPaid: p.isPaid,
        })),
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
      const profile = await resolveProfile(req);
      if (!profile) return { ok: true, data: [] };
      const rows = await db
        .select({
          id: vendorContracts.id,
          fileName: vendorContracts.fileName,
          fileSize: vendorContracts.fileSize,
          analysis: vendorContracts.analysis,
          createdAt: vendorContracts.createdAt,
        })
        .from(vendorContracts)
        .where(and(
          eq(vendorContracts.userId, userId),
          eq(vendorContracts.profileId, profile.id),
        ))
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
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Contract not found." };
      const contractId = Number(args["contractId"]);
      if (!Number.isFinite(contractId)) return { ok: false, error: "contractId must be a number." };
      const [row] = await db
        .select({
          id: vendorContracts.id,
          fileName: vendorContracts.fileName,
          extractedText: vendorContracts.extractedText,
          analysis: vendorContracts.analysis,
          createdAt: vendorContracts.createdAt,
        })
        .from(vendorContracts)
        .where(and(
          eq(vendorContracts.id, contractId),
          eq(vendorContracts.userId, userId),
          eq(vendorContracts.profileId, profile.id),
        ))
        .limit(1);
      if (!row) return { ok: false, error: "Contract not found." };
      return { ok: true, data: {
        id: row.id,
        fileName: row.fileName,
        uploadedAt: row.createdAt.toISOString(),
        analysis: row.analysis,
        extractedText: row.extractedText ?? "",
      } };
    }

    if (name === "get_summary") {
      const userId = await resolveScopeUserId(req);
      const profile = await resolveProfile(req);

      // Guests
      const allGuests = profile
        ? await db.select({ rsvpStatus: guests.rsvpStatus }).from(guests).where(eq(guests.profileId, profile.id))
        : [];
      const guestCounts = { total: allGuests.length, attending: 0, declined: 0, pending: 0, maybe: 0 };
      for (const g of allGuests) {
        const s = g.rsvpStatus ?? "pending";
        if (s === "attending") guestCounts.attending++;
        else if (s === "declined") guestCounts.declined++;
        else if (s === "maybe") guestCounts.maybe++;
        else guestCounts.pending++;
      }

      // Vendors + upcoming payments
      const allVendors = profile
        ? await db.select({ id: vendors.id, nextPaymentDue: vendors.nextPaymentDue, totalCost: vendors.totalCost }).from(vendors).where(eq(vendors.profileId, profile.id))
        : [];
      const vendorIds = allVendors.map(v => v.id);
      let upcomingPayments = 0;
      let nextDue: string | null = null;
      if (vendorIds.length > 0) {
        const unpaid = await db.select({ dueDate: vendorPayments.dueDate }).from(vendorPayments)
          .where(and(inArray(vendorPayments.vendorId, vendorIds), eq(vendorPayments.isPaid, false)));
        upcomingPayments = unpaid.length;
        const sorted = unpaid.map(p => p.dueDate).filter(Boolean).sort();
        nextDue = sorted[0] ?? null;
      }

      // Budget
      let budgetEstimated = 0;
      let budgetPaid = 0;
      if (profile) {
        const [budget] = await db.select({ id: budgets.id }).from(budgets).where(eq(budgets.profileId, profile.id)).limit(1);
        if (budget) {
          const items = await db.select({ estimatedCost: budgetItems.estimatedCost, amountPaid: budgetItems.amountPaid }).from(budgetItems).where(eq(budgetItems.budgetId, budget.id));
          for (const it of items) { budgetEstimated += Number(it.estimatedCost); budgetPaid += Number(it.amountPaid); }
        }
      }

      // Checklist
      const allChecklist = profile
        ? await db.select({ isCompleted: checklistItems.isCompleted }).from(checklistItems).where(eq(checklistItems.profileId, profile.id))
        : [];
      const checklistTotal = allChecklist.length;
      const checklistDone = allChecklist.filter(c => c.isCompleted).length;

      return { ok: true, data: {
        profile: profile ? {
          partner1Name: profile.partner1Name, partner2Name: profile.partner2Name,
          weddingDate: profile.weddingDate, venue: profile.venue, location: profile.location,
          vibe: profile.weddingVibe, totalBudget: profile.totalBudget,
        } : null,
        guests: guestCounts,
        vendors: { count: allVendors.length, upcomingUnpaidPayments: upcomingPayments, nextPaymentDue: nextDue },
        budget: { estimated: budgetEstimated, paid: budgetPaid, remaining: budgetEstimated - budgetPaid },
        checklist: { total: checklistTotal, completed: checklistDone, remaining: checklistTotal - checklistDone },
      } };
    }

    // ===== SEATING CHARTS =====
    if (name === "generate_seating") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const tableCount = Number(args.tableCount);
      const seatsPerTable = Number(args.seatsPerTable);
      if (!Number.isFinite(tableCount) || tableCount < 1) return { ok: false, error: "tableCount must be a positive number." };
      if (!Number.isFinite(seatsPerTable) || seatsPerTable < 1) return { ok: false, error: "seatsPerTable must be a positive number." };

      const allGuests = await db
        .select({ id: guests.id, name: guests.name, guestGroup: guests.guestGroup, plusOne: guests.plusOne, notes: guests.notes })
        .from(guests).where(and(eq(guests.profileId, profile.id)));
      if (allGuests.length === 0) return { ok: false, error: "No guests found. Add guests first." };

      const guestList = allGuests.map(g =>
        `- ${g.name} (Group: ${g.guestGroup || "General"}${g.plusOne ? ", +1" : ""}${g.notes ? `, Notes: ${g.notes}` : ""})`
      ).join("\n");

      const prompt = `You are an expert wedding planner creating a harmonious seating chart.
GUESTS (${allGuests.length} total):
${guestList}
SETUP: ${tableCount} tables, ${seatsPerTable} seats per table max
${args.additionalNotes ? `ADDITIONAL NOTES: ${args.additionalNotes}` : ""}
Rules:
1. Group family members and friend groups together
2. Keep plus-ones with their partners
3. Distribute guests evenly across tables
Return ONLY valid JSON: { "tables": [{ "tableNumber": 1, "tableName": "Table 1", "guests": ["name",...], "theme": "brief note" }], "insights": ["..."], "warnings": ["..."], "totalSeated": number }`;

      const completion = await openai.chat.completions.create({
        model: getModel(),
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      let result: { tables: unknown[]; insights: string[]; warnings: string[]; totalSeated: number };
      try { result = JSON.parse(raw); } catch { return { ok: false, error: "AI returned invalid seating data. Please try again." }; }

      if (args.saveName) {
        const saveName = String(args.saveName).trim();
        const userId = await resolveScopeUserId(req);
        const [saved] = await db.insert(seatingCharts).values({
          profileId: profile.id,
          userId,
          name: saveName,
          guests: allGuests,
          tables: result.tables,
          tableCount,
          seatsPerTable,
        }).returning({ id: seatingCharts.id });
        return { ok: true, data: { ...result, savedAs: saveName, chartId: saved.id } };
      }
      return { ok: true, data: result };
    }

    if (name === "list_seating_charts") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: true, data: { charts: [] } };
      const rows = await db
        .select({ id: seatingCharts.id, name: seatingCharts.name, tableCount: seatingCharts.tableCount, seatsPerTable: seatingCharts.seatsPerTable, createdAt: seatingCharts.createdAt })
        .from(seatingCharts).where(eq(seatingCharts.profileId, profile.id))
        .orderBy(desc(seatingCharts.createdAt));
      return { ok: true, data: { charts: rows } };
    }

    if (name === "delete_seating_chart") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      if (args.chartId) {
        const chartId = Number(args.chartId);
        const [deleted] = await db.delete(seatingCharts)
          .where(and(eq(seatingCharts.id, chartId), eq(seatingCharts.profileId, profile.id))).returning({ name: seatingCharts.name });
        if (!deleted) return { ok: false, error: "Chart not found." };
        return { ok: true, data: { deleted: deleted.name } };
      }
      if (args.matchName) {
        const search = String(args.matchName).trim();
        const [row] = await db.select({ id: seatingCharts.id, name: seatingCharts.name }).from(seatingCharts)
          .where(and(eq(seatingCharts.profileId, profile.id), ilike(seatingCharts.name, `%${search}%`))).limit(1);
        if (!row) return { ok: false, error: `No seating chart matching "${search}".` };
        await db.delete(seatingCharts).where(eq(seatingCharts.id, row.id));
        return { ok: true, data: { deleted: row.name } };
      }
      return { ok: false, error: "Pass chartId or matchName to delete a chart." };
    }

    // ===== COLLABORATORS =====
    if (name === "invite_collaborator") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "Create your wedding profile first before inviting collaborators." };
      const role = await resolveWorkspaceRole(req.userId!, profile.id);
      if (!hasMinRole(role, "partner")) return { ok: false, error: "Only owners and partners can invite collaborators." };
      const email = String(args.email ?? "").trim().toLowerCase();
      const inviteRole = String(args.role ?? "").trim().toLowerCase();
      if (!email) return { ok: false, error: "email is required." };
      if (!["partner", "planner", "vendor"].includes(inviteRole)) return { ok: false, error: "role must be partner, planner, or vendor." };
      const existing = await db.select({ id: workspaceCollaborators.id }).from(workspaceCollaborators)
        .where(and(eq(workspaceCollaborators.profileId, profile.id), eq(workspaceCollaborators.inviteeEmail, email))).limit(1);
      if (existing.length) return { ok: false, error: `${email} is already a collaborator or has a pending invite.` };
      const { randomUUID } = await import("crypto");
      const [collab] = await db.insert(workspaceCollaborators).values({
        profileId: profile.id,
        inviterUserId: req.userId!,
        inviteeEmail: email,
        role: inviteRole,
        status: "pending",
        inviteToken: randomUUID(),
      }).returning({ id: workspaceCollaborators.id, inviteeEmail: workspaceCollaborators.inviteeEmail, role: workspaceCollaborators.role });
      return { ok: true, data: { id: collab.id, email: collab.inviteeEmail, role: collab.role, status: "pending" } };
    }

    if (name === "list_collaborators") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: true, data: { collaborators: [] } };
      const rows = await db
        .select({ id: workspaceCollaborators.id, email: workspaceCollaborators.inviteeEmail, role: workspaceCollaborators.role, status: workspaceCollaborators.status, invitedAt: workspaceCollaborators.invitedAt })
        .from(workspaceCollaborators).where(eq(workspaceCollaborators.profileId, profile.id))
        .orderBy(desc(workspaceCollaborators.invitedAt));
      return { ok: true, data: { collaborators: rows } };
    }

    if (name === "remove_collaborator") {
      const profile = await resolveProfile(req);
      if (!profile) return { ok: false, error: "No wedding profile yet." };
      const callerRole = await resolveWorkspaceRole(req.userId!, profile.id);
      if (!hasMinRole(callerRole, "partner")) return { ok: false, error: "Only owners and partners can remove collaborators." };
      if (args.collaboratorId) {
        const cid = Number(args.collaboratorId);
        const [deleted] = await db.delete(workspaceCollaborators)
          .where(and(eq(workspaceCollaborators.id, cid), eq(workspaceCollaborators.profileId, profile.id)))
          .returning({ email: workspaceCollaborators.inviteeEmail });
        if (!deleted) return { ok: false, error: "Collaborator not found." };
        return { ok: true, data: { removed: deleted.email } };
      }
      if (args.matchEmail) {
        const search = String(args.matchEmail).trim().toLowerCase();
        const [row] = await db.select({ id: workspaceCollaborators.id, email: workspaceCollaborators.inviteeEmail }).from(workspaceCollaborators)
          .where(and(eq(workspaceCollaborators.profileId, profile.id), ilike(workspaceCollaborators.inviteeEmail, `%${search}%`))).limit(1);
        if (!row) return { ok: false, error: `No collaborator matching "${search}".` };
        await db.delete(workspaceCollaborators).where(eq(workspaceCollaborators.id, row.id));
        return { ok: true, data: { removed: row.email } };
      }
      return { ok: false, error: "Pass collaboratorId or matchEmail to remove a collaborator." };
    }

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (err) {
    req.log?.error({ err, toolName: name }, "Aria tool execution failed");
    return { ok: false, error: friendlyToolError(err, name) };
  }
}

const AI_CONFIGURED_FOR_PROD =
  !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);

/**
 * GET /aria/test — authenticated connectivity check for the OpenAI API.
 * Returns a sanitized status without exposing model, base URL, or provider errors.
 */
router.get("/aria/test", requireAuth, async (req, res) => {
  const configured = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
  if (!configured) {
    return res.json({
      ok: false,
      configured: false,
      error: "AI is not configured.",
    });
  }

  try {
    const result = await openai.chat.completions.create({
      model: getModel(),
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply with just OK" }],
    });
    const reply = result.choices[0]?.message?.content ?? "";
    return res.json({ ok: true, configured: true, reply });
  } catch (err) {
    req.log?.error(err, "aria/test failed");
    return res.json({
      ok: false,
      configured: true,
      error: "AI connectivity check failed.",
    });
  }
});

router.post("/aria/chat", requireAuth, aiLimiter, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    req.log.info({ model: getModel(), userId }, "aria/chat request received");

    const sseHeaders = () => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      // Explicit CORS for SSE — Render's nginx can strip headers on streaming responses
      const origin = req.headers.origin;
      if (isAllowedOrigin(origin)) res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.flushHeaders();
    };

    if (!AI_CONFIGURED_FOR_PROD) {
      sseHeaders();
      res.write(`data: ${JSON.stringify({ type: "error", error: "Aria requires an AI API key. Please add AI_INTEGRATIONS_OPENAI_API_KEY to your Render environment variables." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const dailyCheck = incrementDailyAria(userId);
    if (!dailyCheck.allowed) {
      sseHeaders();
      res.write(`data: ${JSON.stringify({ type: "content", content: "You've reached your daily limit for Aria messages. Limits reset at midnight UTC. You can still browse and edit everything manually in the meantime." })}\n\n`);
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

    // ─── Prompt-injection / abuse guard ───────────────────────────────
    // Cap individual message size at 4,000 chars (~1,000 tokens). This
    // prevents a malicious user from blowing through the AI rate budget
    // with a single huge prompt or attempting to overwhelm the system
    // prompt with a wall of injected instructions.
    const MAX_MSG_CHARS = 4000;
    const offender = messages.find(
      (m) => typeof m?.content === "string" && m.content.length > MAX_MSG_CHARS,
    );
    if (offender) {
      sseHeaders();
      res.write(
        `data: ${JSON.stringify({ type: "content", content: `Your message is too long (max ${MAX_MSG_CHARS} characters). Please trim it down and try again — I'll get a better answer with a focused question anyway.` })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    sseHeaders();

    const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${preferredLanguage}, regardless of what language the user writes in.`
      : "";

    // Keep the last 6 messages (3 exchanges) for meaningful context.
    // Groq llama-3.1-8b-instant has a 20K TPM budget — plenty for the
    // system prompt + tools schema (~3,700 tok) + history + 600 output tokens.
    const recent = messages.slice(-6);

    // Detect when the user is responding to the vendor gathering question.
    // The small model often re-asks the question when the user provides an
    // unconventional name (lowercase, numbers, short words like "test 101").
    // Injecting explicit context breaks the loop reliably without touching
    // the system prompt character budget for every other request.
    const lastAssistantInRecent = [...recent].reverse().find(m => m.role === "assistant");
    const lastAssistantText = typeof lastAssistantInRecent?.content === "string" ? lastAssistantInRecent.content : "";
    const prevWasGatheringQuestion = /What'?s the vendor'?s name|vendor'?s name and category|vendor'?s business name and category/i.test(lastAssistantText);
    const prevWasGuestGatherQuestion = /Who would you like me to add to the guest list/i.test(lastAssistantText);
    const prevWasHotelGatherQuestion = /Which hotel should I add|What'?s the hotel name|hotel block should I add/i.test(lastAssistantText);
    const prevWasPartyGatherQuestion = /Who should I add to the wedding party|person'?s name, role, and side|bridal party\/bride side, groom side, or both/i.test(lastAssistantText);
    const lastUserMsgForContext = [...messages].reverse().find(m => m.role === "user");
    const lastUserTextForContext = typeof lastUserMsgForContext?.content === "string" ? lastUserMsgForContext.content.trim() : "";
    const guestNameFromAssistant = extractGuestNameFromAssistant(lastAssistantText);
    const prevWasGuestNameLoop =
      !!guestNameFromAssistant &&
      /\bguest\b/i.test(lastAssistantText) &&
      /\b(name|plus\s*one|plus-one)\b/i.test(lastAssistantText);
    const gatheringFollowUpHint = prevWasGatheringQuestion && lastUserTextForContext.length > 0 && lastUserTextForContext.length <= 200
      ? `\n\nCURRENT CONTEXT — VENDOR NAME PROVIDED: The user just answered your gathering question. Their message "${lastUserTextForContext}" IS their vendor's name (and possibly category/cost). Accept it immediately. Proceed to Turn 3 of CASE B: write a one-line summary in present/future tense and end with 'Reply "yes" to save.' Do NOT ask the gathering question again.`
      : "";
    const guestFollowUpHint = prevWasGuestNameLoop
      ? `\n\nCURRENT CONTEXT - GUEST NAME IDENTIFIED: The guest's name is "${guestNameFromAssistant}". The user is correcting your prior question, so do NOT ask for the guest's name again and do NOT ask if this is a plus-one. Default "${guestNameFromAssistant}" to a regular guest. Write a one-line summary in present/future tense and end with 'Reply "yes" to save.'`
      : "";

    const convo: Array<Record<string, unknown>> = [
      { role: "system", content: SYSTEM_PROMPT + langInstruction + gatheringFollowUpHint + guestFollowUpHint },
      ...recent,
    ];
    const performedActions: ActionRecord[] = [];

    let toolLoops = 0;
    let textContinuations = 0;
    // 4 tool loops: gather → confirm → save → final-text — covers all multi-step flows.
    const MAX_TOOL_LOOPS = 4;
    // Up to 3 automatic continuations when a text response hits max_tokens.
    const MAX_TEXT_CONTINUATIONS = 3;
    // Master accumulator for the buffered (tool-equipped) text path — collects
    // content from ALL continuation iterations before sending so the model
    // cannot produce 3 identical paragraphs by repeating itself on "Continue.".
    let masterContentAccum = "";

    // Decide whether tools are needed at all, and if so which subset.
    // Three tiers, each cheaper than the last:
    //   1. Pure chitchat ("hi", "thanks") → no tools (~500 tok request).
    //   2. General planning advice ("what should I prioritize?", "what
    //      questions to ask a photographer?") → no tools (~700 tok).
    //   3. Real planning request → only tools matching the intent's
    //      domain (~700-1,500 tok instead of all 35 tools / ~5,000 tok).
    // The shrunken request also lets the model pick the right tool faster
    // because it isn't scanning across 35 lookalike function signatures.
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
    const userIsChoosingGuestPriority =
      /\b(venue|guest list|date|something else|most important|priorit)/i.test(lastAssistantText) &&
      /^(?:guest|guests|guest list|the guest list|my guest list)$/i.test(lastUserText.trim());
    const userClarifiesGuestList =
      /\b(?:talking about|mean|meant|focus on)\s+(?:my\s+)?guest list\b/i.test(lastUserText);

    if (userIsChoosingGuestPriority || userClarifiesGuestList) {
      send({
        type: "content",
        content: "Got it - guest list. Start by splitting everyone into three groups: must-invite, should-invite, and maybe. Then set your target count from the venue/budget, add the must-invites first, and use the maybe list only if there is room. Want me to add the next guest now?",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Explicit cancel / nevermind intent: do not run tools, do not persist.
    // This guarantees users can always back out of a pending requested action.
    if (CANCEL_INTENT.test(lastUserText)) {
      send({
        type: "content",
        content: "Got it — canceled. I won’t make any changes. If you want, tell me what you’d like to do instead.",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Fast-path: if the user just replied "yes" to an Aria vendor save
    // confirmation, execute add_vendor immediately. This avoids occasional
    // model misses where it asks another question instead of saving.
    const pendingVendor = parsePendingVendorConfirmation(lastAssistantText);
    if (pendingVendor && YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const recentUserText = messages
        .filter((m) => m.role === "user")
        .slice(-4)
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ")
        .toLowerCase();
      const result = await executeTool("add_vendor", {
        name: pendingVendor.name,
        category: pendingVendor.category,
      }, req, { recentUserText });
      if (result.ok) {
        send({ type: "action_start", name: "add_vendor", args: { name: pendingVendor.name, category: pendingVendor.category } });
        send({ type: "action_result", name: "add_vendor", ok: true, data: result.data });
        send({
          type: "content",
          content: buildConfirmation([{
            name: "add_vendor",
            args: { name: pendingVendor.name, category: pendingVendor.category },
            result,
          }]),
        });
      } else {
        send({ type: "content", content: `I couldn't save that vendor yet: ${result.error}` });
      }
      send({ type: "done", actions: [{ name: "add_vendor", ok: result.ok, error: result.ok ? undefined : result.error }] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const pendingGuest = parsePendingGuestConfirmation(lastAssistantText);
    if (pendingGuest && YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const recentUserText = messages
        .filter((m) => m.role === "user")
        .slice(-4)
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ")
        .toLowerCase();
      const result = await executeTool("add_guest", {
        name: pendingGuest.name,
      }, req, { recentUserText });
      if (result.ok) {
        send({ type: "action_start", name: "add_guest", args: { name: pendingGuest.name } });
        send({ type: "action_result", name: "add_guest", ok: true, data: result.data });
        send({
          type: "content",
          content: buildConfirmation([{
            name: "add_guest",
            args: { name: pendingGuest.name },
            result,
          }]),
        });
      } else {
        send({ type: "content", content: `I couldn't save that guest yet: ${result.error}` });
      }
      send({ type: "done", actions: [{ name: "add_guest", ok: result.ok, error: result.ok ? undefined : result.error }] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Detect "add a vendor / photographer / florist …" without a real business
    // name. Computed before skipTools so it can gate tools entirely.
    const pendingHotel = parsePendingHotelConfirmation(lastAssistantText);
    if (pendingHotel && YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const recentUserText = messages
        .filter((m) => m.role === "user")
        .slice(-4)
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ")
        .toLowerCase();
      const result = await executeTool("add_hotel", {
        hotelName: pendingHotel.hotelName,
      }, req, { recentUserText });
      if (result.ok) {
        send({ type: "action_start", name: "add_hotel", args: { hotelName: pendingHotel.hotelName } });
        send({ type: "action_result", name: "add_hotel", ok: true, data: result.data });
        send({
          type: "content",
          content: buildConfirmation([{
            name: "add_hotel",
            args: { hotelName: pendingHotel.hotelName },
            result,
          }]),
        });
      } else {
        send({ type: "content", content: `I couldn't save that hotel block yet: ${result.error}` });
      }
      send({ type: "done", actions: [{ name: "add_hotel", ok: result.ok, error: result.ok ? undefined : result.error }] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const pendingParty = parsePendingPartyConfirmation(lastAssistantText);
    if (pendingParty && YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const recentUserText = messages
        .filter((m) => m.role === "user")
        .slice(-4)
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ")
        .toLowerCase();
      const result = await executeTool("add_party_member", {
        name: pendingParty.name,
        role: pendingParty.role,
        side: pendingParty.side,
      }, req, { recentUserText });
      if (result.ok) {
        send({ type: "action_start", name: "add_party_member", args: { name: pendingParty.name, role: pendingParty.role, side: pendingParty.side } });
        send({ type: "action_result", name: "add_party_member", ok: true, data: result.data });
        send({
          type: "content",
          content: buildConfirmation([{
            name: "add_party_member",
            args: { name: pendingParty.name, role: pendingParty.role, side: pendingParty.side },
            result,
          }]),
        });
      } else {
        send({ type: "content", content: `I couldn't save that wedding party member yet: ${result.error}` });
      }
      send({ type: "done", actions: [{ name: "add_party_member", ok: result.ok, error: result.ok ? undefined : result.error }] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (prevWasGuestNameLoop && guestNameFromAssistant && /\b(this|that|correct|yes|yep|name|guest)\b/i.test(lastUserText)) {
      send({
        type: "content",
        content: `Saving ${guestNameFromAssistant} as a guest. Reply "yes" to save.`,
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (prevWasGuestGatherQuestion && lastUserText.trim().length > 0 && lastUserText.trim().length <= 120 && !YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const gatheredGuestName = cleanGatheredName(lastUserText);
      if (gatheredGuestName) {
        send({
          type: "content",
          content: `Saving ${gatheredGuestName} as a guest. Reply "yes" to save.`,
        });
        send({ type: "done", actions: [] });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    if (prevWasGatheringQuestion && lastUserText.trim().length > 0 && lastUserText.trim().length <= 160 && !YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const gatheredVendor = inferGatheredVendor(lastUserText);
      if (gatheredVendor) {
        send({
          type: "content",
          content: `Saving ${gatheredVendor.name} (${gatheredVendor.category}). Reply "yes" to save.`,
        });
        send({ type: "done", actions: [] });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    if (prevWasHotelGatherQuestion && lastUserText.trim().length > 0 && lastUserText.trim().length <= 160 && !YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const gatheredHotel = inferGatheredHotel(lastUserText);
      if (gatheredHotel) {
        send({
          type: "content",
          content: `Saving ${gatheredHotel.hotelName} as a hotel block. Reply "yes" to save.`,
        });
        send({ type: "done", actions: [] });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    if (prevWasPartyGatherQuestion && lastUserText.trim().length > 0 && lastUserText.trim().length <= 180 && !YES_CONFIRM_INTENT.test(lastUserText.trim())) {
      const gatheredParty = inferGatheredPartyMember(lastUserText);
      if (gatheredParty.name && gatheredParty.role && gatheredParty.side) {
        const sideLabel = gatheredParty.side === "bride" ? "bridal party" : gatheredParty.side === "groom" ? "groom side" : "both sides";
        send({
          type: "content",
          content: `Saving ${gatheredParty.name} as ${gatheredParty.role} on the ${sideLabel}. Reply "yes" to save.`,
        });
        send({ type: "done", actions: [] });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      send({
        type: "content",
        content: "I need their name, role, and side before saving. Send it like: `Taylor Smith, bridesmaid, bridal party` or `Jordan Lee, best man, groom side`.",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const VENDOR_CATEGORY_INTENT = /\b(?:add|create|new)\s+(?:(?:a|an)\s+)?(?:new\s+)?(vendor|photographer|videographer|florist|caterer|catering|dj|band|musician|officiant|hair|makeup|transport(?:ation)?|limo|cake|baker|stationery|invitation|rental|planner|venue|coordinator)s?\b/i;
    const GUEST_GATHER_INTENT = /\b(?:add|create|new)\s+(?:(?:a|an)\s+)?(?:new\s+)?(?:guest|invitee|person)\b/i;
    const HOTEL_GATHER_INTENT = /\b(?:add|create|new)\s+(?:(?:a|an)\s+)?(?:new\s+)?(?:hotel|hotel block|room block|lodging|accommodation)s?\b/i;
    const PARTY_GATHER_INTENT = /\b(?:add|create|new)\s+(?:(?:a|an)\s+)?(?:new\s+)?(?:wedding party member|party member|bridesmaid|groomsman|groomsmen|maid of honor|best man|attendant)\b/i;
    const HAS_PROPER_NOUN = /[A-Z][a-z]{2,}|"[^"]+"|'[^']+'/;
    const vendorGatherIntent = VENDOR_CATEGORY_INTENT.test(lastUserText) &&
      !HAS_PROPER_NOUN.test(lastUserText.replace(VENDOR_CATEGORY_INTENT, ""));
    const guestGatherIntent = GUEST_GATHER_INTENT.test(lastUserText) &&
      !HAS_PROPER_NOUN.test(lastUserText.replace(GUEST_GATHER_INTENT, ""));
    const hotelGatherIntent = HOTEL_GATHER_INTENT.test(lastUserText) &&
      !HAS_PROPER_NOUN.test(lastUserText.replace(HOTEL_GATHER_INTENT, ""));
    const partyDetails = inferGatheredPartyMember(lastUserText);
    const partyGatherIntent = PARTY_GATHER_INTENT.test(lastUserText) &&
      (!partyDetails.name || !partyDetails.role || !partyDetails.side);

    if (guestGatherIntent) {
      send({
        type: "content",
        content: "Who would you like me to add to the guest list? Send their name, and any optional details like email, RSVP status, or notes.",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (vendorGatherIntent) {
      send({
        type: "content",
        content: "What's the vendor's business name and category (florist, photographer, caterer, DJ, etc.)? Only the business name is needed to get started.",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (hotelGatherIntent) {
      send({
        type: "content",
        content: "Which hotel should I add for this block? Send the hotel name, and any optional details like room count, rate, cutoff date, or booking link.",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (partyGatherIntent) {
      send({
        type: "content",
        content: "Who should I add to the wedding party? Send the person's name, their role, and whether they're on the bridal party/bride side, groom side, or both.",
      });
      send({ type: "done", actions: [] });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Skip tools for: chitchat, general advice, OR "add a vendor/photographer"
    // without a business name. Skipping tools streams content directly (no
    // buffering, no JSON sanitization) so the model's plain-text gathering
    // question reaches the client cleanly instead of being stripped to empty
    // and replaced with the generic "Sorry — I didn't catch that" fallback.
    const skipTools = !!lastUserText
      && (isConversationalMessage(lastUserText) || isInfoQuestion(lastUserText));
    let filteredTools = skipTools ? [] : pickToolsForMessages(recent as Array<{ role: string; content: string }>);
    // Tools that returned a doNotRetry error this turn — pruned from the next
    // loop iteration so the model can't keep guessing args after a rejection.
    const bannedTools = new Set<string>();

    // When the immediately preceding assistant message confirms a vendor was
    // just added ("✅ Added **X**"), block add_vendor on the follow-up turn.
    // The user is responding to the "any payments?" prompt — the model should
    // call update_vendor + add_vendor_payment, not re-add the same vendor.
    // Server-side enforcement is more reliable than the system prompt rule alone.
    if (!skipTools) {
      const lastAssistantContent = [...recent].reverse().find(m => m.role === "assistant")?.content;
      if (typeof lastAssistantContent === "string" && /✅ Added \*\*/.test(lastAssistantContent)) {
        filteredTools = filteredTools.filter(t => t.function.name !== "add_vendor");
      }
    }

    req.log.info({
      userId,
      skipTools,
      toolsCount: filteredTools.length,
      toolNames: filteredTools.map(t => t.function.name),
      estimatedInputTokens: filteredTools.length * 100 + 700,
    }, "aria/chat tool selection");

    // Helper: call with one automatic retry on Groq rate-limit (429)
    const createStream = async () => {
      const baseParams = {
        model: getModel(),
        // 600 tokens allows thorough conversational responses (~450 words).
        // Groq llama-3.1-8b-instant has 20K TPM — easily covers
        // system prompt + tools schema (~3,700 tok) + 6 history msgs + 600 output.
        // If the model hits this limit, the continuation loop below requests more.
        max_tokens: 600,
        temperature: 0.1,   // low temp = reliable, consistent tool calls
        messages: convo as unknown as Parameters<typeof openai.chat.completions.create>[0]["messages"],
        stream: true as const,
      };
      const params = skipTools
        ? baseParams
        : { ...baseParams, tools: filteredTools, tool_choice: "auto" as const };
      // 55s timeout per attempt — long enough for a full tool chain + response.
      // The frontend has a 90s client-side abort as a final safety net.
      const callWithTimeout = () => openai.chat.completions.create(params, {
        signal: AbortSignal.timeout(55_000),
      });
      try {
        return await callWithTimeout();
      } catch (firstErr) {
        const firstStatus = (firstErr as { status?: number })?.status;
        const isAbort = (firstErr as { name?: string })?.name === "AbortError"
          || (firstErr as { name?: string })?.name === "TimeoutError";
        if (firstStatus === 429) {
          // Honor Groq's actual retry-after hint instead of guessing.
          // Groq returns it via response headers OR embedded in the
          // error message ("Please try again in 14.5s").
          const headers = (firstErr as { headers?: Record<string, string> })?.headers;
          const headerSecs = headers ? Number(headers["retry-after"] ?? headers["Retry-After"]) : NaN;
          const errMsg = (firstErr as { error?: { message?: string }; message?: string })?.error?.message
            ?? (firstErr as { message?: string })?.message
            ?? "";
          const msgMatch = errMsg.match(/try again in ([\d.]+)\s*([ms])/i);
          const msgSecs = msgMatch
            ? (msgMatch[2].toLowerCase() === "m" ? Number(msgMatch[1]) * 60 : Number(msgMatch[1]))
            : NaN;
          const reportedSecs = !Number.isNaN(headerSecs) ? headerSecs
            : !Number.isNaN(msgSecs) ? msgSecs
            : 25;
          // If Groq says wait >90s (i.e. we're in a TPD daily-limit hole),
          // don't waste the user's time on a guaranteed-fail retry — fail
          // fast so the client surfaces a clear "limit reached" message.
          if (reportedSecs > 90) {
            req.log.warn({ reportedSecs, errMsg }, "aria/chat skipping retry: Groq retry-after too long");
            throw firstErr;
          }
          const waitMs = Math.max(3_000, Math.min(60_000, Math.ceil(reportedSecs * 1000) + 1500));
          send({ type: "status", message: `Aria is catching her breath, retrying in ~${Math.round(waitMs / 1000)}s…` });
          await new Promise(resolve => setTimeout(resolve, waitMs));
          return await callWithTimeout();
        }
        if (isAbort) {
          // Reshape the abort error into something the outer catch will
          // surface as a clear "took too long" message instead of a stack.
          throw Object.assign(new Error("Aria's reply took too long. Please try again."), {
            status: 504,
          });
        }
        throw firstErr;
      }
    };

    while (toolLoops < MAX_TOOL_LOOPS) {
      // Stream the response so text tokens appear in the UI immediately
      const stream = await createStream();

      // Accumulate streamed content and tool-call fragments
      let contentAccum = "";
      let finishReason: string | null = null;
      const toolCallsAccum: Record<number, { id: string; name: string; args: string }> = {};

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta;
        if (!delta) continue;

        // Stream text tokens straight to the client.
        // For tool-equipped requests we BUFFER and do not send yet — this
        // lets us intercept text-based function calls (some small Llama
        // models emit {"name":"tool","parameters":{}} in the content field
        // instead of using the tool_calls API) before anything reaches the UI.
        if (delta.content) {
          contentAccum += delta.content;
          if (skipTools) send({ type: "content", content: delta.content });
        }

        // Accumulate tool-call argument fragments
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsAccum[idx]) {
              toolCallsAccum[idx] = { id: "", name: "", args: "" };
            }
            if (tc.id) toolCallsAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallsAccum[idx].name += tc.function.name;
            if (tc.function?.arguments) toolCallsAccum[idx].args += tc.function.arguments;
          }
        }
      }

      let toolCalls = Object.values(toolCallsAccum).filter(tc => tc.name);

      // Guardrail: when confirming a brand-new vendor, some model turns emit
      // both add_vendor and update_vendor in the same response. update_vendor
      // can fail/race because the newly added row may not be resolvable yet by
      // name in that same tool batch, which causes a false "save failed" UX.
      // Keep the add_vendor call and drop update_vendor in this mixed case.
      if (toolCalls.some(tc => tc.name === "add_vendor") && toolCalls.some(tc => tc.name === "update_vendor")) {
        toolCalls = toolCalls.filter(tc => tc.name !== "update_vendor");
      }

      // Fallback: detect text-based function calls emitted by the model in
      // the content field instead of via the tool_calls API (a known quirk
      // of some small Llama models). We intercepted the content without
      // streaming it, so we can silently execute the tool and discard the
      // raw JSON before it ever reaches the user.
      if (!skipTools && toolCalls.length === 0 && contentAccum.includes('"name"')) {
        const textCalls = extractTextBasedToolCalls(contentAccum, filteredTools);
        if (textCalls.length > 0) {
          toolCalls = textCalls;
          contentAccum = ""; // discard raw text; JSON never reaches the user
        }
      }

      if (toolCalls.length === 0) {
        // Collect text into the master accumulator (buffered path only).
        // We gather ALL continuation iterations here before sending so the
        // model cannot produce the same paragraph 3× by repeating itself on
        // "Continue." — each iteration's text is appended, not re-sent.
        if (!skipTools) {
          masterContentAccum += contentAccum;
        }

        // If the model was cut off mid-response, add its partial reply to
        // the conversation and request a seamless continuation. The client
        // sees one unbroken stream — no gap, no "click to continue" needed.
        // NOTE: content is NOT sent here; we wait until all iterations are
        // done so duplicate paragraphs from model repetition are collapsed.
        if (finishReason === "length" && contentAccum && textContinuations < MAX_TEXT_CONTINUATIONS) {
          convo.push({ role: "assistant", content: contentAccum });
          convo.push({ role: "user", content: "Continue." });
          textContinuations++;
          // Don't count against toolLoops — this is a text continuation only.
          continue;
        }

        // For buffered (tool-equipped) requests, flush the accumulated text now
        // that we know the model produced a pure text response (no tool calls).
        // Strip any raw JSON blobs the small model may have echoed from a tool
        // result. If the strip ate everything, fall back to a friendly nudge
        // so the user never sees a stuck loading indicator with no message.
        if (!skipTools && masterContentAccum) {
          const TOOL_NAME_PATTERN = /\{[^{}]{0,200}"name"\s*:\s*"[a-z_]+"[^{}]*(?:"(?:parameters|arguments)"\s*:\s*(?:\{[^{}]*\}|[^{}]*))?[^{}]*\}/gi;
          const sanitized = masterContentAccum
            .replace(TOOL_NAME_PATTERN, "")
            .replace(/\{[^{}]{80,}\}/g, (blob) => {
              const keyCount = (blob.match(/"[^"]+"\s*:/g) ?? []).length;
              return keyCount >= 3 ? "" : blob;
            })
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          // Deduplicate repeated paragraphs — guards against the model echoing
          // the same question/message across multiple continuation iterations.
          const paragraphs = sanitized.split(/\n{2,}/);
          const seen = new Set<string>();
          const deduped = paragraphs
            .filter(p => { const t = p.trim(); if (!t || seen.has(t)) return false; seen.add(t); return true; })
            .join("\n\n");
          if (deduped) {
            send({ type: "content", content: deduped });
          } else {
            // Strip ate everything (model wrote a tool-call envelope as
            // text and nothing else). Don't leave the user with silence.
            req.log.warn({ userId }, "Aria response sanitized to empty");
            send({ type: "content", content: "Sorry — I didn't quite catch that. Could you tell me a bit more about what you'd like me to do?" });
          }
        } else if (!skipTools && !masterContentAccum) {
          // Model returned no content AND no tool calls. Edge case (rate
          // limit / cut connection). Send a fallback so the loader clears.
          req.log.warn({ userId }, "Aria stream finished with no content and no tool calls");
          send({ type: "content", content: "I didn't get a response — could you try that again?" });
        }

        // Pure text response — done
        send({ type: "done", actions: performedActions.map(a => ({ name: a.name, ok: a.result.ok, error: a.result.ok ? undefined : a.result.error })) });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // Push assistant turn with tool calls into conversation history
      convo.push({
        role: "assistant",
        content: contentAccum || "",
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.args },
        })),
      });

      // Parse args + emit action_start synchronously, in order, so the UI
      // shows every tool the model wanted to call right away.
      const parsedToolCalls = toolCalls.map((tc, idx) => {
        const parsedArgs = normalizeToolArgs(tc.name, safeParseToolArgs(tc.args || "{}"));
        if (!tc.id) tc.id = `tool-${Date.now()}-${idx}`;
        return { toolCall: tc, parsedArgs };
      });

      const seenVendorAdds = new Set<string>();
      const dedupedToolCalls: typeof toolCalls = [];
      const parsedArgsList: Record<string, unknown>[] = [];
      for (const { toolCall, parsedArgs } of parsedToolCalls) {
        if (toolCall.name === "add_vendor") {
          const key = vendorDedupeKey(parsedArgs);
          if (key !== ":other" && seenVendorAdds.has(key)) continue;
          seenVendorAdds.add(key);
        }
        dedupedToolCalls.push(toolCall);
        parsedArgsList.push(parsedArgs);
      }
      toolCalls = dedupedToolCalls;
      for (let i = 0; i < toolCalls.length; i++) {
        send({ type: "action_start", name: toolCalls[i].name, args: parsedArgsList[i] });
      }

      // Execute all tools in PARALLEL. Most are independent read queries
      // (list_vendors, list_budget, list_guests, etc.) and serializing them
      // multiplied latency by the number of tools called. With Promise.all,
      // a 4-tool fan-out returns in roughly the time of the slowest single
      // query instead of their sum.
      // Concatenate the last few user turns so executeTool validators can
      // verify the model isn't recording details (e.g. contractSigned=true)
      // that the user never actually mentioned in the conversation.
      const recentUserText = messages
        .filter((m) => m.role === "user")
        .slice(-4)
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ")
        .toLowerCase();
      const hasActionTools = toolCalls.some((tc) => ACTION_TOOLS.has(tc.name));
      const results: ActionResult[] = hasActionTools
        ? []
        : await Promise.all(toolCalls.map((tc, i) => executeTool(tc.name, parsedArgsList[i], req, { recentUserText })));
      if (hasActionTools) {
        for (let i = 0; i < toolCalls.length; i++) {
          results.push(await executeTool(toolCalls[i].name, parsedArgsList[i], req, { recentUserText }));
        }
      }

      // Stream results + record into conversation history in deterministic
      // order so the model sees tool replies aligned with its tool_calls.
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const result = results[i];
        performedActions.push({ name: tc.name, args: parsedArgsList[i], result });
        send({ type: "action_result", name: tc.name, ok: result.ok, error: result.ok ? undefined : result.error });
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
        // If a tool flagged its rejection as "do not retry" (e.g. add_vendor
        // refused a hallucinated business name), drop that tool from the
        // remaining loop iterations. Without this the model loops forever
        // calling add_vendor with new invented names.
        if (!result.ok && (result as { doNotRetry?: boolean }).doNotRetry) {
          bannedTools.add(tc.name);
        }
      }
      if (bannedTools.size > 0) {
        filteredTools = filteredTools.filter((t) => !bannedTools.has(t.function.name));
      }

      // Fast path: if every tool was a write action, skip the second AI call.
      // On failure, surface the tool error directly so a provider hiccup cannot
      // hide the actual save problem behind a generic "Aria encountered an error".
      const allActionTools = toolCalls.every(tc => ACTION_TOOLS.has(tc.name));
      const allSucceeded = results.every(r => r.ok);
      if (allActionTools) {
        const confirmation = allSucceeded
          ? buildConfirmation(performedActions)
          : buildConfirmation(performedActions);
        send({ type: "content", content: confirmation });
        send({ type: "done", actions: performedActions.map(a => ({ name: a.name, ok: a.result.ok, error: a.result.ok ? undefined : a.result.error })) });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
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
        userMsg = "AI API key is invalid or expired. Please check the key set on your server.";
      } else if (status === 429) {
        const lowDetail = detail.toLowerCase();
        if (errCode === "insufficient_quota" || lowDetail.includes("quota") || lowDetail.includes("exceeded your current quota")) {
          userMsg = "Your AI API account has run out of credits. Please top up your Groq or OpenAI account and try again.";
        } else if (lowDetail.includes("per day") || lowDetail.includes("tokens per day") || lowDetail.includes("tpd") || lowDetail.includes("requests per day") || lowDetail.includes("rpd")) {
          // Groq daily limit — waiting 30s won't help, the window resets
          // at UTC midnight. Compute hours-until-reset so the message is
          // actionable instead of just "midnight UTC" (which most users
          // can't translate to their local time without thinking).
          const now = new Date();
          const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
          const hoursLeft = Math.max(1, Math.round((nextMidnight.getTime() - now.getTime()) / 3_600_000));
          userMsg = `Aria has hit today's AI usage limit (~500K Groq tokens). It resets in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} (midnight UTC). To remove this cap permanently, upgrade your Groq plan at console.groq.com/billing — your AI_INTEGRATIONS_OPENAI_API_KEY on Render will keep working with the upgraded account automatically.`;
        } else {
          // Per-minute (TPM/RPM) limit — still hit after the automatic 25s retry. Surface the actual Groq detail so the user can see what's tight.
          const niceDetail = detail.replace(/^.*?Limit /i, "Limit ").replace(/\. Visit.*$/i, ".").slice(0, 240);
          userMsg = niceDetail
            ? `Aria is hitting Groq's per-minute limit. ${niceDetail} Please wait ~60 seconds and try again, or upgrade your Groq plan.`
            : "Aria is currently rate-limited. Please wait 30–60 seconds and try again.";
        }
      } else if (status === 504) {
        userMsg = "Aria's reply took too long to come back. Please try again — usually this clears within a few seconds.";
      } else if (
        detail.toLowerCase().includes("tool call validation failed") ||
        detail.toLowerCase().includes("did not match schema")
      ) {
        // Groq's small Llama models occasionally pick the wrong tool or
        // emit numbers as strings, and Groq rejects with a verbose schema
        // dump. Hide the dump and give the user a clean recovery prompt.
        userMsg = "Aria got a little tangled up trying to use one of her tools. Try rephrasing your message — for general planning advice, you don't need to mention adding anything.";
      } else if (status === 404 || detail.toLowerCase().includes("model")) {
        userMsg = `AI model not found. (${detail || "no detail"})`;
      } else if (detail) {
        req.log?.error({ detail }, "Aria provider error hidden from client");
        userMsg = "Aria encountered an error. Please try again.";
      }

      res.write(`data: ${JSON.stringify({ type: "error", error: userMsg })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
