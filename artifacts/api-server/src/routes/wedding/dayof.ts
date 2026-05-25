import { Router } from "express";
import { db, guests, weddingParty } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../../lib/workspaceAccess";
import { getRequestLanguage } from "../../lib/language";

const router = Router();
const CEREMONY_SECTIONS = new Set(["processional", "rings", "officiant", "recessional"]);
const DEFAULT_UNPLUGGED_SCRIPT =
  "The couple invites you to be fully present during the ceremony. Please silence and put away phones and cameras until the recessional.";

type CeremonySection = "processional" | "rings" | "officiant" | "recessional";

function jsonFromText(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function fallbackCeremonyPlan({
  section,
  currentPlan,
  profile,
  guestNames,
  partyNames,
}: {
  section: CeremonySection;
  currentPlan: Record<string, unknown>;
  profile: Record<string, unknown>;
  guestNames: string[];
  partyNames: Array<{ name: string; role: string }>;
}) {
  const partner2 = asString(profile.partner2Name, "Partner");
  const partner1 = asString(profile.partner1Name, "Partner");
  const base = {
    processional: Array.isArray(currentPlan.processional) ? currentPlan.processional : [],
    ringsAndVows: typeof currentPlan.ringsAndVows === "object" && currentPlan.ringsAndVows ? currentPlan.ringsAndVows : {},
    officiantCues: typeof currentPlan.officiantCues === "object" && currentPlan.officiantCues ? currentPlan.officiantCues : {},
    recessional: typeof currentPlan.recessional === "object" && currentPlan.recessional ? currentPlan.recessional : {},
  };
  const allNames = [...partyNames.map((member) => member.name), ...guestNames];
  const honorAttendant = partyNames.find((member) => /honor|best/i.test(member.role))?.name || allNames[0] || "";

  if (section === "processional") {
    base.processional = [
      { id: "suggested-officiant", personName: "", role: "Officiant", walksWith: "None", notes: "Standing at the front before music begins." },
      { id: "suggested-family", personName: allNames[1] || "", role: "Parent", walksWith: "None", notes: "Seated before wedding party enters." },
      { id: "suggested-party", personName: "", role: "Wedding Party", walksWith: "Partnered attendant", notes: "Attendants enter in pairs or one at a time." },
      { id: "suggested-child-attendants", personName: "", role: "Flower Girl", walksWith: "Ring Bearer", notes: "Pause at the aisle before walking." },
      { id: "suggested-partner-2", personName: partner2, role: "Partner", walksWith: "Parent or escort", notes: "Final entrance before ceremony begins." },
      { id: "suggested-partner-1", personName: partner1, role: "Partner", walksWith: "None", notes: "Adjust order to match your ceremony tradition." },
    ];
  }

  if (section === "rings") {
    base.ringsAndVows = {
      ringHolder: honorAttendant,
      vowHolder: partner2,
      printedVows: true,
      remindToPrintVows: true,
      keepsakes: [
        { id: "rings", label: "Wedding rings", checked: true },
        { id: "printed-vows", label: "Printed vows", checked: true },
        { id: "marriage-license", label: "Marriage license", checked: true },
        { id: "vow-books", label: "Vow books", checked: true },
        { id: "heirloom", label: "Family heirloom or unity item", checked: false },
      ],
    };
  }

  if (section === "officiant") {
    base.officiantCues = {
      licenseSigning: true,
      licenseSigningTime: "Immediately after ceremony",
      unpluggedAnnouncement: true,
      unpluggedScript: DEFAULT_UNPLUGGED_SCRIPT,
      readings: [{ id: "suggested-reading", readerName: allNames[2] || "", title: "Short reading or blessing" }],
      pronunciationNotes: "",
      specialAnnouncement: "Cocktail hour directions",
      specialAnnouncementNotes: "Tell guests where to go while family photos are taken.",
    };
  }

  if (section === "recessional") {
    base.recessional = {
      coupleExitsTo: "Private room",
      weddingPartyExitOrder: [
        { id: "suggested-exit-couple", personName: `${partner2} & ${partner1}`, role: "Partner", walksWith: "Each other", notes: "Exit first." },
        { id: "suggested-exit-party", personName: "Wedding party", role: "Wedding Party", walksWith: "Paired attendants", notes: "Follow the couple." },
        { id: "suggested-exit-family", personName: "Immediate family", role: "Parent", walksWith: "Family", notes: "Follow wedding party for photos." },
      ],
      familyPhotoGroups: [
        { id: "suggested-family-photos", groupName: "Immediate family", members: "Couple, parents, siblings, grandparents" },
        { id: "suggested-party-photos", groupName: "Wedding party", members: "All attendants, flower girl, ring bearer" },
      ],
      guestFlow: "Cocktail hour",
    };
  }

  return base;
}

router.post("/dayof/emergency", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const { situation } = req.body;
    const profile = await resolveProfile(req);
    const requestLanguage = getRequestLanguage(req, profile?.preferredLanguage);
    const lang = requestLanguage !== "English" ? requestLanguage : null;
    const langInstruction = lang
      ? `\n\nLANGUAGE: Translate the values of "advice" and the "steps" array into ${lang}. Keep JSON keys ("advice", "steps") in English.`
      : "";

    const prompt = `You are an experienced wedding coordinator helping a couple on their wedding day. They have encountered an emergency situation and need immediate, calm, practical advice.

Situation: ${situation}

Provide calm, clear, actionable advice. Be reassuring but practical. Focus on solutions, not panic.

Return ONLY valid JSON (no markdown) with this structure:
{
  "advice": "A brief 1-2 sentence calming overview of how to handle this",
  "steps": ["Step 1 action", "Step 2 action", "Step 3 action", "Step 4 action"]
}

The steps should be concrete, actionable, and prioritized. Include 3-6 steps.${langInstruction}`;

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

router.post("/dayof/ceremony-suggestions", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

    const section = String(req.body?.section ?? "") as CeremonySection;
    if (!CEREMONY_SECTIONS.has(section)) return res.status(400).json({ error: "Invalid ceremony section." });

    const profile = await resolveProfile(req);
    if (!profile?.id) return res.status(400).json({ error: "Complete your wedding profile before generating ceremony suggestions." });

    const currentPlan =
      req.body?.currentPlan && typeof req.body.currentPlan === "object"
        ? req.body.currentPlan as Record<string, unknown>
        : {};

    const [guestRows, partyRows] = await Promise.all([
      db
        .select({ name: guests.name, plusOneName: guests.plusOneName })
        .from(guests)
        .where(eq(guests.profileId, profile.id)),
      db
        .select({ name: weddingParty.name, role: weddingParty.role })
        .from(weddingParty)
        .where(eq(weddingParty.profileId, profile.id)),
    ]);

    const guestRowsTyped = guestRows as Array<{ name: string | null; plusOneName: string | null }>;
    const partyRowsTyped = partyRows as Array<{ name: string | null; role: string | null }>;
    const guestNames: string[] = Array.from(
      new Set(
        guestRowsTyped
          .flatMap((guest: { name: string | null; plusOneName: string | null }) => [guest.name, guest.plusOneName])
          .filter((name: string | null): name is string => typeof name === "string" && name.trim().length > 0)
          .map((name: string) => name.trim())
      )
    );
    const partyNames = partyRowsTyped
      .filter((member: { name: string | null }) => !!member.name?.trim())
      .map((member: { name: string | null; role: string | null }) => ({ name: member.name!.trim(), role: member.role ?? "Wedding Party" }));

    const fallback = fallbackCeremonyPlan({
      section,
      currentPlan,
      profile: profile as unknown as Record<string, unknown>,
      guestNames,
      partyNames,
    });

    const requestLanguage = getRequestLanguage(req, profile.preferredLanguage);
    const langInstruction =
      requestLanguage !== "English"
        ? `\nTranslate user-facing string values into ${requestLanguage}. Keep JSON keys and enums in English.`
        : "";

    try {
      const prompt = `You are A.I Do's ceremony planning assistant. Generate a clean, realistic structured ceremony plan for only the "${section}" section while preserving the other sections from Current Plan.

Wedding profile:
${JSON.stringify({
  partner1Name: profile.partner1Name,
  partner2Name: profile.partner2Name,
  weddingDate: profile.weddingDate,
  venue: profile.venue,
  ceremonyTime: profile.ceremonyTime,
  guestCount: profile.guestCount,
  vibe: profile.vibe,
}, null, 2)}

Guest names:
${JSON.stringify(guestNames.slice(0, 80))}

Wedding party:
${JSON.stringify(partyNames.slice(0, 40))}

Current Plan:
${JSON.stringify(currentPlan)}

Return ONLY valid JSON in this shape:
{
  "processional": [{"id":"string","personName":"string","role":"string","walksWith":"string","notes":"string"}],
  "ringsAndVows": {"ringHolder":"string","vowHolder":"string","printedVows":true,"remindToPrintVows":true,"keepsakes":[{"id":"string","label":"string","checked":true,"custom":false}]},
  "officiantCues": {"licenseSigning":true,"licenseSigningTime":"string","unpluggedAnnouncement":true,"unpluggedScript":"string","readings":[{"id":"string","readerName":"string","title":"string"}],"pronunciationNotes":"string","specialAnnouncement":"string","specialAnnouncementNotes":"string"},
  "recessional": {"coupleExitsTo":"string","weddingPartyExitOrder":[{"id":"string","personName":"string","role":"string","walksWith":"string","notes":"string"}],"familyPhotoGroups":[{"id":"string","groupName":"string","members":"string"}],"guestFlow":"string"}
}

Rules:
- Keep the plan practical and not overly long.
- Use saved guest and wedding party names when useful, but do not invent full names.
- For unknown people, leave personName empty and use role/notes.
- Do not include markdown or commentary.${langInstruction}`;

      const completion = await openai.chat.completions.create({
        model: getModel(),
        max_completion_tokens: 1800,
        messages: [{ role: "user", content: prompt }],
      });
      const content = completion.choices[0]?.message?.content ?? "";
      const parsed = jsonFromText(content);
      if (!parsed || typeof parsed !== "object") throw new Error("AI did not return valid ceremony JSON.");
      trackEvent(req.userId!, "day_of_ceremony_suggestion_generated", { section, fallback: false });
      return res.json({ section, plan: parsed });
    } catch (aiErr) {
      req.log.warn({ err: String(aiErr) }, "Ceremony suggestion AI failed; using fallback plan");
      trackEvent(req.userId!, "day_of_ceremony_suggestion_generated", { section, fallback: true });
      return res.json({ section, plan: fallback, fallback: true });
    }
  } catch (err) {
    req.log.error(err, "Failed to generate ceremony suggestion");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
