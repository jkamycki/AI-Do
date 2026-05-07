import { Router } from "express";
import { randomUUID } from "node:crypto";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { aiLimiter, incrementDailySupport } from "../middlewares/rateLimiter";
import { getAuth, clerkClient } from "@clerk/express";
import { db, supportTickets } from "@workspace/db";
import { sendEmail, FROM_EMAIL } from "../lib/resend";

const router = Router();

const OWNER_EMAILS = ["kamyckijoseph@gmail.com"];

// Tool the support chat assistant can invoke to file a real ticket on
// behalf of the signed-in user. Mirrors the public POST /help/support-ticket
// flow (DB insert + ops alert + user confirmation email) so tickets created
// here show up alongside contact-form tickets in the Operations Center.
const SUPPORT_TICKET_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_support_ticket",
    description:
      "File a support ticket on behalf of the user. Call this only after the user has described a real issue/question and you have collected: their name, their email, a short subject (≤80 chars), and the issue details. Confirm with the user before calling. Tickets are visible to the A.IDO ops team in the Operations Center.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "User's full name as they typed it." },
        email: { type: "string", description: "User's email address." },
        category: {
          type: "string",
          enum: ["bug", "feature", "general", "billing", "account", "praise"],
          description: "Best-fit category for triage.",
        },
        subject: { type: "string", description: "One-line summary, max ~80 chars." },
        message: { type: "string", description: "Full description of the issue, including steps to reproduce or context the user gave." },
      },
      required: ["name", "email", "category", "subject", "message"],
    },
  },
};

const SUPPORT_BOT_PROMPT = `You are a friendly and helpful customer support assistant for A.IDO, an AI-powered wedding planning platform. Your role is to help customers with:

- Account and login issues
- Technical problems and bugs
- Feature questions and how-to guidance
- Billing and subscription issues
- General inquiries and feedback
- Issues with any part of the A.IDO platform

## Your approach:
- Be empathetic and understanding — customers may be frustrated
- Ask clarifying questions to understand their issue fully
- Provide clear, step-by-step solutions when possible
- Be honest if you need to escalate to the human support team
- Acknowledge their concern and thank them for their patience
- Keep responses concise and scannable with bullet points when helpful
- Use a warm, professional tone

## When to suggest escalation:
- Account security concerns
- Billing/payment issues that require admin access
- Complex technical issues that need backend access
- Feature requests that need product team review
- Any issue you cannot definitively resolve

Always offer to escalate to the human support team for complex issues.`;

const ARIA_SYSTEM_PROMPT = `You are Aria, an expert AI wedding planning assistant built into A.IDO — an AI-powered wedding planning platform. You have deep knowledge of every aspect of wedding planning and act like a trusted, experienced friend who has helped hundreds of couples plan their weddings.

## Your expertise covers:
- **Budgeting** — realistic cost breakdowns by vendor category, location-based pricing, negotiation tactics, tipping etiquette, and hidden costs to watch for
- **Timeline & scheduling** — ceremony and reception flow, vendor arrival windows, buffer time, day-of runsheets, rehearsal dinner planning
- **Vendors** — how to find, vet, and book photographers, videographers, caterers, florists, DJs, bands, officiants, hair/makeup, transportation; red flags to avoid; contract must-haves
- **Guest management** — RSVP strategy, seating chart logic, dietary restrictions, plus-one policies, managing difficult family dynamics
- **Wedding party** — managing roles and responsibilities, bridesmaid/groomsmen duties, attire coordination, gifts and thank-you etiquette
- **Venues** — indoor vs outdoor, capacity, catering in-house vs outside, venue contract questions, backup weather plans
- **Design & aesthetics** — color palettes, floral styles, table decor, themes, seasonal considerations
- **Legal & logistics** — marriage license requirements, name change process, vendor contracts, insurance
- **Stress & relationships** — handling family opinions, communication between partners, managing expectations
- **Honeymoon** — destination ideas, timing, travel logistics

## A.IDO features you can explain:
- **Wedding Profile** — couple info, date, venue, guest count, total budget, wedding vibe
- **AI Timeline Generator** — minute-by-minute day-of schedule, downloadable as branded PDF
- **AI Vendor Email Assistant** — drafts professional emails for photographers, caterers, florists, etc.
- **Budget Manager** — tracks estimated vs actual costs, payment due dates, spending breakdown
- **Checklist** — personalized month-by-month task list
- **Contracts** — upload vendor contracts, AI flags red flags and drafts negotiation emails
- **Day-Of Coordinator** — emergency AI helper for wedding day issues
- **Guest List, Seating Chart, Wedding Party, Hotel Blocks** — full guest management suite
- **Collaboration** — invite your partner, planner, or vendors with role-based access (Settings)

## Tone & style:
- Warm, confident, and encouraging — like a knowledgeable friend, not a corporate chatbot
- Be specific and practical — give real numbers, real questions to ask, real scripts when helpful
- Use markdown (bullet points, bold, headers) — it renders in the chat
- Keep responses focused and scannable; under 350 words unless a detailed breakdown is genuinely needed
- If the user's question is vague, ask one clarifying question before diving in
- Celebrate wins and acknowledge stress — planning a wedding is emotional, not just logistical

## Filing a support ticket:
You can file support tickets on behalf of the user via the submit_support_ticket tool. Use it when the user reports a bug, billing problem, account issue, broken feature, or anything that genuinely needs the human ops team — NOT for general planning questions you can answer yourself.

Flow:
1. Ask the user to describe the issue clearly (steps, what happened, what they expected).
2. The user's name and email are pre-filled from their account when available — confirm them ("I have you as Jane Doe at jane@example.com — sound right?") before filing. If they're missing, ask.
3. Pick the best category: bug | feature | general | billing | account | praise.
4. Write a one-line subject (≤80 chars) and a full message that includes everything the user told you.
5. Summarize what you're about to file ("Here's what I'll send to the support team: …") and ask the user to confirm before calling submit_support_ticket. Never file silently.
6. After the tool returns, share the ticket number with the user and tell them they'll get an email confirmation.

Don't file tickets for chitchat, planning advice, or things you can solve yourself.`;

// Inserts a support ticket and fires the same notification emails as the
// public POST /help/support-ticket route, so tickets created via Aria's
// tool show up in the Operations Center identically.
async function fileSupportTicket(args: Record<string, unknown>, userId: string | null): Promise<Record<string, unknown>> {
  const name = String(args.name ?? "").trim();
  const email = String(args.email ?? "").trim().toLowerCase();
  const category = String(args.category ?? "").trim().toLowerCase();
  const subject = String(args.subject ?? "").trim();
  const message = String(args.message ?? "").trim();

  if (!name) return { ok: false, error: "Missing the user's name. Ask the user for their full name and try again." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "The email address is missing or malformed. Ask the user for a valid email and try again." };
  }
  if (!subject) return { ok: false, error: "Missing a subject line. Write a short one-line summary of the issue." };
  if (!message) return { ok: false, error: "Missing the issue description. Include what happened and any details the user gave." };
  const VALID_CATEGORIES = new Set(["bug", "feature", "general", "billing", "account", "praise"]);
  const safeCategory = VALID_CATEGORIES.has(category) ? category : "general";

  const ticketNumber = `TKT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        name,
        email,
        category: safeCategory,
        subject: subject.slice(0, 200),
        message,
        status: "open",
        priority: "medium",
        userId,
      })
      .returning();

    sendEmail({
      to: OWNER_EMAILS[0],
      from: FROM_EMAIL,
      replyTo: email,
      subject: `[${ticketNumber}] New Support Ticket: ${subject.slice(0, 80)}`,
      text: [
        `New support ticket filed via Aria support chat`,
        ``,
        `Ticket: ${ticketNumber}`,
        `From:   ${name} <${email}>`,
        `Category: ${safeCategory}`,
        `Subject: ${subject}`,
        ``,
        `--- Issue ---`,
        message,
      ].join("\n"),
    }).catch(() => {});

    sendEmail({
      to: email,
      replyTo: OWNER_EMAILS[0],
      subject: `We received your support request [${ticketNumber}]`,
      text: [
        `Hi ${name},`,
        ``,
        `Thanks for reaching out to A.IDO support. We've received your message and will get back to you as soon as possible.`,
        ``,
        `Your ticket number is: ${ticketNumber}`,
        ``,
        `--- Your message ---`,
        message,
        ``,
        `— The A.IDO Team`,
      ].join("\n"),
    }).catch(() => {});

    return { ok: true, ticketNumber: ticket.ticketNumber, status: "open" };
  } catch (err) {
    return { ok: false, error: `Failed to create ticket: ${(err as Error)?.message ?? "unknown"}` };
  }
}

router.post("/support/bot", async (req, res) => {
  try {
    const { messages, preferredLanguage } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      preferredLanguage?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const MAX_MSG_CHARS = 4000;
    const tooLong = messages.find(
      (m) => typeof m?.content === "string" && m.content.length > MAX_MSG_CHARS,
    );
    if (tooLong) {
      return res.status(400).json({
        error: `Your message is too long (max ${MAX_MSG_CHARS} characters). Please trim it and try again.`,
      });
    }

    const recent = messages.slice(-20);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${preferredLanguage}, regardless of what language the user writes in.`
      : "";

    const convo: Array<{ role: string; content: string }> = [
      { role: "system", content: SUPPORT_BOT_PROMPT + langInstruction },
      ...recent,
    ];

    const callWithTimeout = () => openai.chat.completions.create({
      model: getModel(),
      max_completion_tokens: 1024,
      messages: convo as unknown as Parameters<typeof openai.chat.completions.create>[0]["messages"],
      stream: true as const,
    }, {
      signal: AbortSignal.timeout(55_000),
    });

    const callWithRetry = async (): Promise<ReturnType<typeof callWithTimeout>> => {
      try {
        return await callWithTimeout();
      } catch (firstErr) {
        const firstStatus = (firstErr as { status?: number })?.status;
        const isAbort = (firstErr as { name?: string })?.name === "AbortError"
          || (firstErr as { name?: string })?.name === "TimeoutError";
        if (firstStatus === 429) {
          const headers = (firstErr as { headers?: Record<string, string> })?.headers;
          const headerSecs = headers ? Number(headers["retry-after"] ?? headers["Retry-After"]) : NaN;
          const errMsg = (firstErr as { error?: { message?: string }; message?: string })?.error?.message ?? (firstErr as { message?: string })?.message ?? "";
          const msgMatch = errMsg.match(/try again in ([\d.]+)\s*([ms])/i);
          const msgSecs = msgMatch
            ? (msgMatch[2].toLowerCase() === "m" ? Number(msgMatch[1]) * 60 : Number(msgMatch[1]))
            : NaN;
          const waitMs = !Number.isNaN(headerSecs) ? Math.ceil(headerSecs * 1000) + 1000
            : !Number.isNaN(msgSecs) ? Math.ceil(msgSecs * 1000) + 1000
            : 25_000;
          res.write(`data: ${JSON.stringify({ status: "Support team is busy, retrying shortly…" })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 60_000)));
          return await callWithTimeout();
        }
        if (isAbort) {
          throw Object.assign(new Error("Support assistant's reply took too long. Please try again."), { status: 504 });
        }
        throw firstErr;
      }
    };

    const MAX_CONTINUATIONS = 3;
    let continuations = 0;
    while (true) {
      const stream = await callWithRetry();
      let accumulated = "";
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const content = choice?.delta?.content;
        if (content) {
          accumulated += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (finishReason === "length" && accumulated && continuations < MAX_CONTINUATIONS) {
        convo.push({ role: "assistant", content: accumulated });
        convo.push({ role: "user", content: "Continue." });
        continuations++;
        continue;
      }
      break;
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error(err, "Support bot error");
    try {
      const apiErr = err as { status?: number; message?: string; error?: { message?: string; code?: string } };
      const status = apiErr?.status;
      const detail = apiErr?.error?.message || apiErr?.message || "";
      const errCode = apiErr?.error?.code ?? "";
      let userMsg = "Something went wrong. Please try again.";
      if (status === 401) {
        userMsg = "AI API key is invalid or expired. Please check the key set on your server.";
      } else if (status === 429) {
        if (errCode === "insufficient_quota" || detail.toLowerCase().includes("quota") || detail.toLowerCase().includes("exceeded your current quota")) {
          userMsg = "Support assistant is at capacity. Please try again in a few minutes.";
        } else {
          userMsg = "Support assistant is currently busy. Please wait 30–60 seconds and try again.";
        }
      } else if (status === 504) {
        userMsg = "Support assistant's reply took too long. Please try again.";
      } else if (status === 404 || detail.toLowerCase().includes("model")) {
        userMsg = `AI model not found. (${detail || "no detail"})`;
      } else if (detail) {
        userMsg = `Support assistant encountered an error: ${detail}`;
      }
      res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
      res.end();
    } catch {}
  }
});

router.post("/support/chat", requireAuth, aiLimiter, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dailyCheck = incrementDailySupport(userId);
    if (!dailyCheck.allowed) {
      res.setHeader("Content-Type", "text/event-stream");
      res.write(`data: ${JSON.stringify({ error: "You've reached your daily limit for Aria support messages. Limits reset at midnight UTC." })}\n\n`);
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

    // Same 4,000-char guard as Aria — stops a single huge prompt from
    // burning the AI rate budget or attempting prompt-injection at scale.
    const MAX_MSG_CHARS = 4000;
    const tooLong = messages.find(
      (m) => typeof m?.content === "string" && m.content.length > MAX_MSG_CHARS,
    );
    if (tooLong) {
      return res.status(400).json({
        error: `Your message is too long (max ${MAX_MSG_CHARS} characters). Please trim it and try again.`,
      });
    }

    // Pre-fetch the signed-in user's name + email so Aria can confirm them
    // instead of asking from scratch when filing a ticket.
    let knownName = "";
    let knownEmail = "";
    try {
      const user = await clerkClient.users.getUser(userId);
      const first = user.firstName ?? "";
      const last = user.lastName ?? "";
      knownName = `${first} ${last}`.trim();
      knownEmail = user.emailAddresses?.[0]?.emailAddress ?? "";
    } catch { /* ignore — Aria will ask if missing */ }

    const recent = messages.slice(-20);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${preferredLanguage}, regardless of what language the user writes in.`
      : "";

    const userContextNote = (knownName || knownEmail)
      ? `\n\n## User context (already known — confirm before using to file a ticket):\n- Name: ${knownName || "(unknown — ask the user)"}\n- Email: ${knownEmail || "(unknown — ask the user)"}`
      : "";

    // Conversation history passed to the model — starts as user history, extended
    // with assistant turns when continuing a cut-off response or after tool calls.
    const convo: Array<Record<string, unknown>> = [
      { role: "system", content: ARIA_SYSTEM_PROMPT + userContextNote + langInstruction },
      ...recent,
    ];

    const callWithTimeout = () => openai.chat.completions.create({
      model: getModel(),
      max_completion_tokens: 2048,
      messages: convo as unknown as Parameters<typeof openai.chat.completions.create>[0]["messages"],
      tools: [SUPPORT_TICKET_TOOL] as unknown as Parameters<typeof openai.chat.completions.create>[0]["tools"],
      stream: true as const,
    }, {
      signal: AbortSignal.timeout(55_000),
    });

    const callWithRetry = async (): Promise<ReturnType<typeof callWithTimeout>> => {
      try {
        return await callWithTimeout();
      } catch (firstErr) {
        const firstStatus = (firstErr as { status?: number })?.status;
        const isAbort = (firstErr as { name?: string })?.name === "AbortError"
          || (firstErr as { name?: string })?.name === "TimeoutError";
        if (firstStatus === 429) {
          // Honor Groq's retry-after header when present; fall back to 25s.
          const headers = (firstErr as { headers?: Record<string, string> })?.headers;
          const headerSecs = headers ? Number(headers["retry-after"] ?? headers["Retry-After"]) : NaN;
          const errMsg = (firstErr as { error?: { message?: string }; message?: string })?.error?.message ?? (firstErr as { message?: string })?.message ?? "";
          const msgMatch = errMsg.match(/try again in ([\d.]+)\s*([ms])/i);
          const msgSecs = msgMatch
            ? (msgMatch[2].toLowerCase() === "m" ? Number(msgMatch[1]) * 60 : Number(msgMatch[1]))
            : NaN;
          const waitMs = !Number.isNaN(headerSecs) ? Math.ceil(headerSecs * 1000) + 1000
            : !Number.isNaN(msgSecs) ? Math.ceil(msgSecs * 1000) + 1000
            : 25_000;
          res.write(`data: ${JSON.stringify({ status: "Aria is catching her breath, retrying shortly…" })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 60_000)));
          return await callWithTimeout();
        }
        if (isAbort) {
          throw Object.assign(new Error("Aria's reply took too long. Please try again."), { status: 504 });
        }
        throw firstErr;
      }
    };

    // Stream with automatic continuation when the model hits max_completion_tokens
    // OR fires a tool call (e.g. submit_support_ticket). After a tool runs we feed
    // its result back into the conversation and let the model produce its
    // user-facing reply.
    const MAX_TURNS = 4;
    let turns = 0;
    while (turns < MAX_TURNS) {
      turns++;
      const stream = await callWithRetry();
      let accumulated = "";
      let finishReason: string | null = null;
      // Tool calls arrive as deltas keyed by index; assemble them here.
      const toolCallAcc: Array<{ id?: string; name?: string; args: string }> = [];

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const content = choice?.delta?.content;
        if (content) {
          accumulated += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
        const tcDeltas = (choice?.delta as { tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> })?.tool_calls;
        if (tcDeltas) {
          for (const d of tcDeltas) {
            if (!toolCallAcc[d.index]) toolCallAcc[d.index] = { args: "" };
            const slot = toolCallAcc[d.index];
            if (d.id) slot.id = d.id;
            if (d.function?.name) slot.name = d.function.name;
            if (d.function?.arguments) slot.args += d.function.arguments;
          }
        }
      }

      const hasToolCalls = toolCallAcc.some((tc) => tc?.name);
      if (hasToolCalls) {
        // Tell the client an action is happening (UI can render a status pill).
        for (const tc of toolCallAcc) {
          if (!tc?.name) continue;
          res.write(`data: ${JSON.stringify({ status: "Filing your support ticket…" })}\n\n`);
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.args || "{}"); } catch {}
          let toolResult: Record<string, unknown> = { ok: false, error: "Unknown tool" };
          if (tc.name === "submit_support_ticket") {
            toolResult = await fileSupportTicket(parsed, userId);
            if ((toolResult as { ok?: boolean }).ok) {
              const ticketNumber = (toolResult as { ticketNumber?: string }).ticketNumber;
              res.write(`data: ${JSON.stringify({ content: `\n\n📨 Filed support ticket **${ticketNumber}** — you'll get an email confirmation shortly.` })}\n\n`);
            }
          }
          // Append the assistant turn (with the tool call) and the tool result
          // back into the conversation so the next round can craft the reply.
          convo.push({
            role: "assistant",
            content: accumulated || null,
            tool_calls: [{
              id: tc.id ?? `call_${Date.now()}`,
              type: "function",
              function: { name: tc.name, arguments: tc.args || "{}" },
            }],
          });
          convo.push({
            role: "tool",
            tool_call_id: tc.id ?? `call_${Date.now()}`,
            content: JSON.stringify(toolResult),
          });
        }
        continue; // run another turn so the model produces its closing reply
      }

      if (finishReason === "length" && accumulated && turns < MAX_TURNS) {
        convo.push({ role: "assistant", content: accumulated });
        convo.push({ role: "user", content: "Continue." });
        continue;
      }
      break;
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error(err, "Support chat error");
    try {
      const apiErr = err as { status?: number; message?: string; error?: { message?: string; code?: string } };
      const status = apiErr?.status;
      const detail = apiErr?.error?.message || apiErr?.message || "";
      const errCode = apiErr?.error?.code ?? "";
      let userMsg = "Something went wrong. Please try again.";
      if (status === 401) {
        userMsg = "AI API key is invalid or expired. Please check the key set on your server.";
      } else if (status === 429) {
        if (errCode === "insufficient_quota" || detail.toLowerCase().includes("quota") || detail.toLowerCase().includes("exceeded your current quota")) {
          userMsg = "Your AI API account has run out of credits. Please top up your Groq or OpenAI account and try again.";
        } else {
          userMsg = "Aria is currently rate-limited. Please wait 30–60 seconds and try again.";
        }
      } else if (status === 504) {
        userMsg = "Aria's reply took too long to come back. Please try again — usually this clears within a few seconds.";
      } else if (status === 404 || detail.toLowerCase().includes("model")) {
        userMsg = `AI model not found. (${detail || "no detail"})`;
      } else if (detail) {
        userMsg = `Aria encountered an error: ${detail}`;
      }
      res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
