import { Router } from "express";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { aiLimiter, incrementDailySupport } from "../middlewares/rateLimiter";
import { getAuth } from "@clerk/express";

const router = Router();

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
- Celebrate wins and acknowledge stress — planning a wedding is emotional, not just logistical`;

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

    const recent = messages.slice(-20);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${preferredLanguage}, regardless of what language the user writes in.`
      : "";

    // Conversation history passed to the model — starts as user history, extended
    // with assistant turns when continuing a cut-off response.
    const convo: Array<{ role: string; content: string }> = [
      { role: "system", content: ARIA_SYSTEM_PROMPT + langInstruction },
      ...recent,
    ];

    const callWithTimeout = () => openai.chat.completions.create({
      model: getModel(),
      // 2048 tokens allows thorough responses (~1500 words). Groq's 20K TPM
      // free tier easily handles this since the support prompt has no tools schema.
      max_completion_tokens: 2048,
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

    // Stream with automatic continuation when the model hits max_completion_tokens.
    // Each continuation adds the partial response to the conversation and asks the
    // model to keep going — the client sees one seamless stream.
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

      // If the model was cut off mid-response, request a seamless continuation.
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
