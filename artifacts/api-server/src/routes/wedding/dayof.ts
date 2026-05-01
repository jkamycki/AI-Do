import { Router } from "express";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";

const router = Router();

router.post("/dayof/emergency", requireAuth, async (req, res) => {
  try {
    const { situation } = req.body;

    const prompt = `You are an experienced wedding coordinator helping a couple on their wedding day. They have encountered an emergency situation and need immediate, calm, practical advice.

Situation: ${situation}

Provide calm, clear, actionable advice. Be reassuring but practical. Focus on solutions, not panic.

Return ONLY valid JSON (no markdown) with this structure:
{
  "advice": "A brief 1-2 sentence calming overview of how to handle this",
  "steps": ["Step 1 action", "Step 2 action", "Step 3 action", "Step 4 action"]
}

The steps should be concrete, actionable, and prioritized. Include 3-6 steps.`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      // Emergency advice is short (1-2 sentences + 3-6 steps). 600 tokens is
      // plenty and keeps us safely under Groq free-tier 6000 TPM cap.
      max_completion_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { advice: content, steps: [] };
    }

    trackEvent(req.userId!, "day_of_mode_activated", { situation: typeof situation === "string" ? situation.slice(0, 100) : undefined });
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to get emergency advice");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
