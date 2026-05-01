import { Router } from "express";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";

const router = Router();

router.post("/vendor/email", requireAuth, async (req, res) => {
  try {
    const {
      vendorType, emailType, vendorName, weddingDate, venue, guestCount, additionalNotes, preferredLanguage,
    } = req.body;

    const lang = preferredLanguage && preferredLanguage !== "English" ? preferredLanguage : null;

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

Write in a warm, professional tone. Be specific and personable. The email should feel genuine, not like a template.${lang ? `\n\nIMPORTANT: Write the entire email (subject and body) in ${lang}.` : ""}

Return ONLY valid JSON (no markdown) with this structure:
{
  "subject": "Email subject line",
  "body": "Full email body with proper line breaks using \\n",
  "vendorType": "${vendorType}",
  "emailType": "${emailType}"
}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      // Force structured output so Llama-family models don't wrap in markdown
      // or prepend an explanation, which would make JSON.parse fail and the
      // user gets a raw blob in the body field.
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result: { subject?: string; body?: string; vendorType?: string; emailType?: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { subject: "Email", body: content, vendorType, emailType };
    }

    // Always echo back vendorType/emailType so the response matches the schema
    // even if the model omits them.
    const safeResult = {
      subject: result.subject?.trim() || "Email",
      body: result.body?.trim() || content,
      vendorType: result.vendorType ?? vendorType,
      emailType: result.emailType ?? emailType,
    };

    trackEvent(req.userId!, "vendor_email_generated", { vendorType, emailType });
    res.json(safeResult);
  } catch (err) {
    req.log.error(err, "Failed to generate vendor email");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
