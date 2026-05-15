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

export default router;
