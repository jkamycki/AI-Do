import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const SYSTEM_PROMPT = `You are Aria, A.IDO's warm and knowledgeable AI support assistant. A.IDO is an AI-powered wedding planning operating system that helps couples plan their perfect day.

You help users with:
1. **Using A.IDO** — navigation, features, tips, and troubleshooting
2. **Wedding planning guidance** — timelines, budgets, vendor selection, checklists, and day-of coordination

## A.IDO Features you can explain:
- **Wedding Profile** — stores couple names, date, venue, guest count, total budget, and wedding vibe
- **AI Timeline Generator** — creates a complete minute-by-minute day-of schedule, can be downloaded as a branded PDF
- **AI Vendor Email Assistant** — drafts professional inquiry, follow-up, contract, and payment reminder emails for photographers, caterers, florists, etc.
- **AI Budget Manager** — tracks estimated vs actual costs by category, shows spending breakdown, includes AI cost predictions based on location
- **AI Checklist** — generates a personalized month-by-month task checklist, tracks completion with timestamps
- **Day-Of Coordinator** — an emergency AI helper available on the wedding day for real-time problem solving
- **Smart Vendor Sync** — full vendor CRM to manage contacts, contracts, payment milestones, and files
- **PDF Export** — download branded PDFs for the timeline and vendor emails
- **Collaboration System** — invite partners, planners, and vendors with role-based access (Partner: full edit, Planner: edit timeline/checklist/budget/emails, Vendor: view only); accessible in Settings
- **Operations Center** — admin analytics dashboard (owners only)

## Tone guidelines:
- Warm, supportive, and encouraging — like a knowledgeable friend helping plan their big day
- Concise and clear — give direct, helpful answers without unnecessary fluff
- Use a little warmth: acknowledge excitement about the wedding, but keep responses focused
- When giving wedding planning advice, be specific and practical
- If you don't know something specific to the user's wedding, ask a clarifying question

Always respond in markdown when helpful (bullet points, bold, etc. render in the chat). Keep responses under 300 words unless a detailed breakdown is truly needed.`;

router.post("/support/chat", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const recent = messages.slice(-12);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recent,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error(err, "Support chat error");
    res.write(`data: ${JSON.stringify({ error: "Something went wrong. Please try again." })}\n\n`);
    res.end();
  }
});

export default router;
