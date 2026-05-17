import { Router } from "express";
import { openai, getModel, supportsCustomTemperature } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// Small AI-rewrite endpoint used by the inline TextStyleToolbar's
// "AI generate" button on the wedding website editor (and any other
// EditableText in the app). Takes a short user prompt + the current
// text and returns a single rewritten string ready to drop in.
router.post("/ai/generate-text", requireAuth, async (req, res) => {
  try {
    const { prompt, currentText, context, language } = req.body as {
      prompt: string;
      currentText?: string;
      context?: string;
      language?: string;
    };
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const langInstruction = language && language !== "en"
      ? `Write the response in the language with code "${language}".`
      : "";

    const sys = [
      "You are a copywriting assistant for a wedding-planning website editor.",
      "The user is editing a single block of text and wants help writing it.",
      "Return ONLY the rewritten text — no preamble, no quotes, no markdown.",
      "Match the existing tone and length when possible (concise if the slot is short, longer if it's a paragraph).",
      "Don't invent specific names, dates, or venues unless the user mentioned them in the prompt.",
      langInstruction,
    ].filter(Boolean).join(" ");

    const userMessage = [
      context ? `Context: ${context}` : "",
      currentText?.trim() ? `Current text: ${currentText.trim()}` : "",
      `User asked: ${prompt.trim()}`,
    ].filter(Boolean).join("\n\n");

    const model = getModel();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 600,
      ...(supportsCustomTemperature(model) ? { temperature: 0.8 } : {}),
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res.status(500).json({ error: "AI returned an empty response. Please try again." });
      return;
    }
    // Strip surrounding quotes the model sometimes adds even when told not to.
    const cleaned = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
    res.json({ text: cleaned });
  } catch (err) {
    req.log.error(err, "AI text generate failed");
    res.status(500).json({ error: "Failed to generate. Please try again." });
  }
});

router.post("/ai/venue-options", requireAuth, async (req, res) => {
  try {
    const {
      guestCount,
      indoorOutdoor,
      budgetRange,
      location,
      style,
      notes,
      coupleNames,
    } = req.body as {
      guestCount?: string;
      indoorOutdoor?: string;
      budgetRange?: string;
      location?: string;
      style?: string[];
      notes?: string;
      coupleNames?: string;
    };

    const detailLines = [
      `Couple / event: ${coupleNames?.trim() || "Wedding couple"}`,
      `Guest count: ${guestCount?.trim() || "Not provided"}`,
      `Indoor / outdoor preference: ${indoorOutdoor?.trim() || "Flexible / not provided"}`,
      `Budget range: ${budgetRange?.trim() || "Not provided"}`,
      `Location: ${location?.trim() || "Not provided"}`,
      `Style preferences: ${Array.isArray(style) && style.length ? style.join(", ") : "Not provided"}`,
      notes?.trim() ? `Notes:\n${notes.trim()}` : "",
    ].filter(Boolean).join("\n");

    const model = getModel();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "You are an expert wedding venue strategist inside A.IDO.",
            "Use the couple's venue discovery details to suggest named wedding venues that may fit their request.",
            "When the location is specific enough, provide 5-8 real venue names in or near that area.",
            "For each venue, include a short reason it may fit the guest count, style, budget range, indoor/outdoor preference, or notes.",
            "Never claim exact addresses, prices, availability, package details, or capacity unless the user provided them.",
            "If the location is too vague to suggest named venues, say exactly what location detail is needed, such as city/state or preferred radius.",
            "Return concise markdown only.",
            "Include: Suggested venues, why each may fit, questions to ask these venues, possible red flags, and a simple shortlist scoring method.",
            "Do not include generic search terms or tell the user to search for venue types. The main value is named venue suggestions.",
            "Keep it helpful, specific, and under 600 words.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Generate venue suggestions, venue options, and shortlist guidance from these details:\n\n${detailLines}`,
        },
      ],
      max_completion_tokens: 950,
      ...(supportsCustomTemperature(model) ? { temperature: 0.75 } : {}),
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res.status(500).json({ error: "AI returned an empty response. Please try again." });
      return;
    }
    res.json({ text });
  } catch (err) {
    req.log.error(err, "AI venue options failed");
    res.status(500).json({ error: "Failed to generate venue options. Please try again." });
  }
});

export default router;
