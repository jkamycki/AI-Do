import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";

const router = Router();

router.post("/vendor/email", requireAuth, async (req, res) => {
  try {
    const {
      vendorType, emailType, vendorName, weddingDate, venue, guestCount, additionalNotes
    } = req.body;

    const emailTypeDescriptions: Record<string, string> = {
      inquiry: "initial inquiry email introducing ourselves and asking about availability",
      quote: "quote request email asking for detailed pricing and packages",
      negotiation: "negotiation email politely discussing pricing and asking for a better rate",
      followup: "follow-up email checking in after a previous inquiry",
    };

    const prompt = `Write a professional and warm ${emailTypeDescriptions[emailType] || emailType} to a ${vendorType}${vendorName ? ` named "${vendorName}"` : ""}.

Wedding details:
- Wedding Date: ${weddingDate}
- Venue: ${venue}
- Guest Count: ${guestCount}
${additionalNotes ? `- Additional Notes: ${additionalNotes}` : ""}

Write in a warm, professional tone. Be specific and personable. The email should feel genuine, not like a template.

Return ONLY valid JSON (no markdown) with this structure:
{
  "subject": "Email subject line",
  "body": "Full email body with proper line breaks using \\n",
  "vendorType": "${vendorType}",
  "emailType": "${emailType}"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { subject: "Email", body: content, vendorType, emailType };
    }

    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to generate vendor email");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
