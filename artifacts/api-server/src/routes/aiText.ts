import { Router } from "express";
import { openai, getModel, supportsCustomTemperature } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function cleanVenueValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function officialVenueSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} official wedding venue website`)}`;
}

function buildVenueOptionsFallback(input: {
  guestCount?: string;
  indoorOutdoor?: string;
  budgetRange?: string;
  location?: string;
  style?: string[];
  notes?: string;
}) {
  const location = cleanVenueValue(input.location, "your preferred areas");
  const guestCount = cleanVenueValue(input.guestCount, "your guest count");
  const budgetRange = cleanVenueValue(input.budgetRange, "your budget");
  const preference = cleanVenueValue(input.indoorOutdoor, "flexible indoor/outdoor needs").toLowerCase();
  const styles = Array.isArray(input.style) && input.style.length ? input.style.map((item) => item.toLowerCase()) : [];
  const notes = cleanVenueValue(input.notes, "your must-haves");
  const wantsGarden = styles.some((style) => ["garden", "boho", "rustic", "coastal"].includes(style));
  const wantsModern = styles.some((style) => ["modern", "industrial"].includes(style));
  const wantsClassic = styles.some((style) => ["ballroom", "classic"].includes(style));

  const venueOptions = [
    wantsGarden
      ? `- [Garden estate or conservatory near ${location}](${officialVenueSearchUrl(`garden estate conservatory near ${location}`)}) - strong fit for floral, outdoor, or romantic styling; ask for rain backup, ceremony lawn rules, and included rentals.`
      : `- [Estate venue near ${location}](${officialVenueSearchUrl(`estate venue near ${location}`)}) - flexible choice for a polished wedding look; ask about guest flow, ceremony/reception transitions, and rental inclusions.`,
    wantsModern
      ? `- [Modern loft or industrial event space near ${location}](${officialVenueSearchUrl(`modern loft industrial event space near ${location}`)}) - good fit for clean decor, dramatic lighting, and flexible layouts; confirm catering rules and sound limits.`
      : `- [Boutique hotel or restaurant event room near ${location}](${officialVenueSearchUrl(`boutique hotel restaurant wedding venue near ${location}`)}) - useful for built-in service, guest convenience, and fewer outside rentals; confirm minimum spend and menu flexibility.`,
    wantsClassic
      ? `- [Ballroom or country club near ${location}](${officialVenueSearchUrl(`ballroom country club wedding venue near ${location}`)}) - likely fit for ${guestCount} guests and a classic reception; compare package minimums, service fees, and payment dates.`
      : `- [Country club or banquet venue near ${location}](${officialVenueSearchUrl(`country club banquet wedding venue near ${location}`)}) - practical option for ${guestCount} guests; compare package minimums, service fees, and payment dates.`,
    `- [Historic mansion, museum, or gallery near ${location}](${officialVenueSearchUrl(`historic mansion museum gallery wedding venue near ${location}`)}) - strong option if you want character without heavy decor; ask about vendor restrictions, load-in rules, and accessibility.`,
    `- [Winery, brewery, or private estate near ${location}](${officialVenueSearchUrl(`winery brewery private estate wedding venue near ${location}`)}) - can work well for a distinctive guest experience; confirm transportation, parking, noise limits, and weather backup.`,
  ];

  return [
    "### Venue options to explore",
    "",
    `These options are based on ${guestCount} guests, ${preference}, ${budgetRange}, and notes like ${notes}. Add each promising match to your shortlist, then attach the venue's official website once confirmed.`,
    "",
    ...venueOptions,
    "",
    "### Questions to ask first",
    "",
    "- What dates are available in your preferred season?",
    "- What is included in the venue fee, and what rentals are extra?",
    "- Are catering, bar, decor, music, or vendor choices restricted?",
    "- What deposit amount, payment schedule, and cancellation terms apply?",
    "- What is the rain plan, parking plan, and accessibility setup?",
    "",
    "### Simple shortlist score",
    "",
    "Score each venue from 1-5 for budget fit, guest fit, style fit, logistics, and rule flexibility. Keep the highest total scores for tours.",
  ].join("\n");
}

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
      `Preferred location(s): ${location?.trim() || "Not provided"}`,
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
            "Provide 5-8 venue options. When the preferred location or locations are specific enough, make them real named venues in or near those areas.",
            "Every suggested venue must start with the venue name as a markdown hyperlink, like - [Venue Name](https://official-venue-site.example) - why it may fit.",
            "Choose venues whose official homepages are likely well-known. If you cannot provide a likely website URL for a venue, choose a different venue.",
            "Do not use generic directory links, social media links, map links, or made-up URLs.",
            "Never claim exact addresses, prices, availability, package details, or capacity unless the user provided them.",
            "If the locations are too vague for real named venues, still provide practical venue option types tailored to the details, then mention what location detail would make the names more specific.",
            "Return concise markdown only.",
            "Do not return unlinked venue bullets.",
            "Include: Suggested venues, questions to ask these venues, possible red flags, and a simple shortlist scoring method.",
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
      res.json({ text: buildVenueOptionsFallback({ guestCount, indoorOutdoor, budgetRange, location, style, notes }) });
      return;
    }
    res.json({ text });
  } catch (err) {
    req.log.error(err, "AI venue options failed");
    res.json({ text: buildVenueOptionsFallback(req.body as Record<string, unknown>) });
  }
});

export default router;
