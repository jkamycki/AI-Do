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

function extractResponseText(response: unknown) {
  const maybeResponse = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  if (typeof maybeResponse.output_text === "string") return maybeResponse.output_text.trim();
  return maybeResponse.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim() ?? "";
}

function parsePreferredLocations(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|;/)
    .flatMap((chunk) => {
      const parts = chunk.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length <= 2) return parts.length ? [parts.join(", ")] : [];

      const locations: string[] = [];
      for (let index = 0; index < parts.length; index += 2) {
        locations.push(parts.slice(index, index + 2).join(", "));
      }
      return locations;
    })
    .map((location) => location.trim())
    .filter(Boolean);
}

async function generateVenueOptionsWithWebSearch(prompt: string) {
  const responses = (openai as unknown as {
    responses?: {
      create: (params: Record<string, unknown>) => Promise<unknown>;
    };
  }).responses;
  if (!responses?.create) return "";

  const params = {
    model: process.env.AI_VENUE_SEARCH_MODEL || "gpt-4o-mini",
    input: prompt,
    max_output_tokens: 1400,
  };
  let response: unknown;
  try {
    response = await responses.create({
      ...params,
      tools: [{ type: "web_search" }],
    });
  } catch {
    response = await responses.create({
      ...params,
      tools: [{ type: "web_search_preview" }],
    });
  }
  return extractResponseText(response);
}

async function generateSpecificVenueOptionsWithWebSearch(basePrompt: string, minimumVenueCount: number) {
  const firstAttempt = await generateVenueOptionsWithWebSearch(basePrompt);
  if (hasVerifiedVenueLinks(firstAttempt, minimumVenueCount)) return firstAttempt;

  const retryPrompt = [
    basePrompt,
    "",
    "Retry requirement:",
    "The prior answer was too generic. Return only real named venues as linked bullet titles.",
    "Every linked bullet title must be an actual business/venue name, not a category like ballroom, estate, loft, conservatory, country club, or wedding venue.",
    "For example, for Garfield, NJ, a valid named venue could be The Royal Manor if verified with its official website.",
    "If you use a nearby city, keep the bullet under the requested location heading and mention the nearby city in the description.",
  ].join("\n");

  return generateVenueOptionsWithWebSearch(retryPrompt);
}

function buildVenueOptionsFallback(input: {
  guestCount?: string;
  indoorOutdoor?: string;
  budgetRange?: string;
  location?: string;
  style?: string[];
  notes?: string;
}) {
  const locations = parsePreferredLocations(input.location);
  const location = locations.length ? locations.join(", ") : "your preferred areas";
  const guestCount = cleanVenueValue(input.guestCount, "your guest count");
  const budgetRange = cleanVenueValue(input.budgetRange, "your budget");
  const preference = cleanVenueValue(input.indoorOutdoor, "flexible indoor/outdoor needs").toLowerCase();
  const styles = Array.isArray(input.style) && input.style.length ? input.style.map((item) => item.toLowerCase()) : [];
  const notes = cleanVenueValue(input.notes, "your must-haves");
  const wantsGarden = styles.some((style) => ["garden", "boho", "rustic", "coastal"].includes(style));
  const wantsModern = styles.some((style) => ["modern", "industrial"].includes(style));
  const wantsClassic = styles.some((style) => ["ballroom", "classic"].includes(style));

  const locationTargets = locations.length ? locations : [location];
  const venueOptions = locationTargets.flatMap((targetLocation) => [
    wantsGarden
      ? `- [Garden estate or conservatory near ${targetLocation}](${officialVenueSearchUrl(`garden estate conservatory near ${targetLocation}`)}) - strong fit for floral, outdoor, or romantic styling; ask for rain backup, ceremony lawn rules, and included rentals.`
      : `- [Estate venue near ${targetLocation}](${officialVenueSearchUrl(`estate venue near ${targetLocation}`)}) - flexible choice for a polished wedding look; ask about guest flow, ceremony/reception transitions, and rental inclusions.`,
    wantsModern
      ? `- [Modern loft or industrial event space near ${targetLocation}](${officialVenueSearchUrl(`modern loft industrial event space near ${targetLocation}`)}) - good fit for clean decor, dramatic lighting, and flexible layouts; confirm catering rules and sound limits.`
      : `- [Boutique hotel or restaurant event room near ${targetLocation}](${officialVenueSearchUrl(`boutique hotel restaurant wedding venue near ${targetLocation}`)}) - useful for built-in service, guest convenience, and fewer outside rentals; confirm minimum spend and menu flexibility.`,
    wantsClassic
      ? `- [Ballroom or country club near ${targetLocation}](${officialVenueSearchUrl(`ballroom country club wedding venue near ${targetLocation}`)}) - likely fit for ${guestCount} guests and a classic reception; compare package minimums, service fees, and payment dates.`
      : `- [Country club or banquet venue near ${targetLocation}](${officialVenueSearchUrl(`country club banquet wedding venue near ${targetLocation}`)}) - practical option for ${guestCount} guests; compare package minimums, service fees, and payment dates.`,
  ]).slice(0, Math.max(6, Math.min(12, locationTargets.length * 3)));

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

function hasVerifiedVenueLinks(text: string, minimumCount = 1) {
  return extractVerifiedVenueLinks(text).length >= minimumCount && !hasGenericVenueLinkTitles(text);
}

function extractVerifiedVenueLinks(text: string) {
  const markdownLinks = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)];
  return markdownLinks
    .map((match) => ({ name: match[1].trim(), url: match[2].trim() }))
    .filter(({ name, url }) => isOfficialVenueUrl(url) && isSpecificVenueName(name));
}

function isOfficialVenueUrl(rawUrl: string) {
  const url = rawUrl.toLowerCase();
  return !url.includes("google.com/search")
    && !url.includes("bing.com/search")
    && !url.includes("yahoo.com/search")
    && !url.includes("maps.google")
    && !url.includes("facebook.com")
    && !url.includes("instagram.com")
    && !url.includes("theknot.com")
    && !url.includes("weddingwire.com");
}

function isSpecificVenueName(name: string) {
  const lower = name.toLowerCase();
  if (lower.length < 3) return false;
  const genericPatterns = [
    /\bnear\b/,
    /\bwedding venue\b/,
    /\bevent space\b/,
    /\bevent venue\b/,
    /\bbanquet venue\b/,
    /\bvenue option\b/,
    /\bgarden estate\b/,
    /\bconservatory\b/,
    /\bmodern loft\b/,
    /\bindustrial event\b/,
    /\bballroom or\b/,
    /\bcountry club or\b/,
    /\bestate venue\b/,
    /\bboutique hotel\b/,
    /\brestaurant event room\b/,
    /\bprivate estate\b/,
  ];
  return !genericPatterns.some((pattern) => pattern.test(lower));
}

function hasGenericVenueLinkTitles(text: string) {
  const markdownLinks = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)];
  return markdownLinks.some((match) => !isSpecificVenueName(match[1].trim()));
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

    const preferredLocations = parsePreferredLocations(location);
    const detailLines = [
      `Couple / event: ${coupleNames?.trim() || "Wedding couple"}`,
      `Guest count: ${guestCount?.trim() || "Not provided"}`,
      `Indoor / outdoor preference: ${indoorOutdoor?.trim() || "Flexible / not provided"}`,
      `Budget range: ${budgetRange?.trim() || "Not provided"}`,
      `Preferred location(s): ${preferredLocations.length ? preferredLocations.join(" | ") : location?.trim() || "Not provided"}`,
      `Style preferences: ${Array.isArray(style) && style.length ? style.join(", ") : "Not provided"}`,
      notes?.trim() ? `Notes:\n${notes.trim()}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = [
      "You are an expert wedding venue researcher inside A.IDO.",
      "Use live web search to find real wedding venues near the user's preferred city/state locations.",
      "Group results by location using a markdown heading for each city/state, for example: ### Garfield, NJ.",
      "For each location, provide 2-3 real named wedding venues near that city/state. If there is only one location, provide 5-8 real named venues near it.",
      "Each venue bullet must begin with the venue name as a markdown hyperlink to the venue's official website, like - [Venue Name](https://official-venue-site.example) - why it may fit.",
      "Do not title bullets with generic venue types. The linked text must be the actual venue/business name.",
      "Do not use directory links, social media links, map links, search links, or made-up URLs.",
      "If you cannot verify an official website for a real venue, omit that venue.",
      "Balance results across all provided cities/states instead of concentrating on one area.",
      "Never claim exact pricing, availability, package details, or capacity unless the source clearly supports it or the user provided it.",
      "After the grouped venues, include short sections for Questions to ask and Red flags.",
      "Return concise markdown only.",
    ].join(" ");
    const userPrompt = `Generate real wedding venue suggestions from these details:\n\n${detailLines}`;
    const minimumVenueCount = preferredLocations.length > 1
      ? Math.max(2, preferredLocations.length * 2)
      : 3;

    let text = "";
    try {
      text = await generateSpecificVenueOptionsWithWebSearch(`${systemPrompt}\n\n${userPrompt}`, minimumVenueCount);
    } catch (err) {
      req.log.warn(err, "AI venue web search failed");
    }

    if (!text || !hasVerifiedVenueLinks(text, minimumVenueCount)) {
      res.status(502).json({ error: "Could not verify real venues with official website links for those locations. Please try again." });
      return;
    }
    res.json({ text });
  } catch (err) {
    req.log.error(err, "AI venue options failed");
    res.status(500).json({ error: "Failed to verify real venue options. Please try again." });
  }
});

export default router;
