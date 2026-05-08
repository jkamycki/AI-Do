import { Router } from "express";
import { db, hotelBlocks, weddingProfiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveScopeUserId, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "AIDO-WeddingPlanner/1.0 (contact@aidowedding.net)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// Try multiple candidate address strings in order, sleeping ~1.1s between
// requests to respect Nominatim's 1 req/sec rate limit.
async function geocodeFirstHit(candidates: string[]): Promise<{ lat: number; lon: number; query: string } | null> {
  let first = true;
  for (const q of candidates) {
    if (!q) continue;
    if (!first) await new Promise(r => setTimeout(r, 1100));
    first = false;
    const hit = await geocode(q);
    if (hit) return { ...hit, query: q };
  }
  return null;
}

// Build an ordered list of address strings to try, deduping comma-separated
// segments case-insensitively so we don't send Nominatim things like
// "Newark, NJ 07101, Newark, NJ, 07101".
function buildAddressCandidates(parts: { name?: string | null; lines: Array<string | null | undefined> }): string[] {
  const dedupe = (s: string): string => {
    const seen = new Set<string>();
    return s
      .split(",")
      .map(p => p.trim())
      .filter(p => {
        if (!p) return false;
        const k = p.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .join(", ");
  };
  const lines = parts.lines.filter(Boolean) as string[];
  const withoutName = dedupe(lines.join(", "));
  const withName = parts.name ? dedupe([parts.name, ...lines].join(", ")) : "";
  // Last-ditch: just city/state/zip-ish (drop the first line, often a street).
  const cityOnly = lines.length > 1 ? dedupe(lines.slice(1).join(", ")) : "";
  return Array.from(new Set([withoutName, withName, cityOnly].filter(Boolean)));
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sinDlat * sinDlat +
          Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            sinDlon * sinDlon,
      ),
    );
  return R * c;
}

const router = Router();

function fmt(h: typeof hotelBlocks.$inferSelect) {
  return {
    ...h,
    pricePerNight: h.pricePerNight != null ? Number(h.pricePerNight) : null,
    createdAt: h.createdAt.toISOString(),
  };
}

router.post("/hotels/calculate-distance", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const { address, city, state, zip } = req.body as {
      address?: string; city?: string; state?: string; zip?: string;
    };

    const hotelCandidates = buildAddressCandidates({
      lines: [address, [city, state].filter(Boolean).join(", "), zip],
    });
    if (!hotelCandidates.length) {
      res.status(400).json({ error: "No hotel address provided" });
      return;
    }

    const [profile] = await db
      .select({
        location: weddingProfiles.location,
        venueCity: weddingProfiles.venueCity,
        venueState: weddingProfiles.venueState,
        venueZip: weddingProfiles.venueZip,
        venue: weddingProfiles.venue,
      })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      res.status(400).json({ error: "No wedding profile found" });
      return;
    }

    const venueCandidates = buildAddressCandidates({
      name: profile.venue,
      lines: [
        profile.location,
        [profile.venueCity, profile.venueState].filter(Boolean).join(", "),
        profile.venueZip,
      ],
    });

    if (!venueCandidates.length) {
      res.status(400).json({ error: "Venue address not set in your profile" });
      return;
    }

    // Sequentialize to respect Nominatim's 1 req/sec rate limit.
    const hotelHit = await geocodeFirstHit(hotelCandidates);
    if (!hotelHit) {
      req.log.warn({ tried: hotelCandidates }, "Hotel geocode failed");
      res.status(422).json({ error: "Could not find hotel address" });
      return;
    }
    await new Promise(r => setTimeout(r, 1100));
    const venueHit = await geocodeFirstHit(venueCandidates);
    if (!venueHit) {
      req.log.warn({ tried: venueCandidates }, "Venue geocode failed");
      res.status(422).json({ error: "Could not find venue address" });
      return;
    }
    const hotelCoords = hotelHit;
    const venueCoords = venueHit;

    const km = haversineKm(venueCoords, hotelCoords);
    const miles = km * 0.621371;
    const distanceText =
      miles < 0.5 ? `${Math.round(km * 1000)} m from venue` :
      miles < 10 ? `${miles.toFixed(1)} mi from venue` :
      `${Math.round(miles)} mi from venue`;

    res.json({ distance: distanceText, miles: parseFloat(miles.toFixed(1)), km: parseFloat(km.toFixed(1)) });
  } catch (err) {
    req.log.error(err, "Failed to calculate hotel distance");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/hotels", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const rows = await db
      .select()
      .from(hotelBlocks)
      .where(eq(hotelBlocks.userId, userId))
      .orderBy(hotelBlocks.createdAt);
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error(err, "Failed to list hotel blocks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotels", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const {
      hotelName, address, city, state, zip, phone, email, bookingLink, discountCode,
      groupName, cutoffDate, roomsReserved, roomsBooked, pricePerNight,
      distanceFromVenue, notes,
    } = req.body;
    const [created] = await db.insert(hotelBlocks).values({
      userId,
      hotelName: hotelName ?? "",
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip: zip ?? null,
      phone: phone ?? null,
      email: email ?? null,
      bookingLink: bookingLink ?? null,
      discountCode: discountCode ?? null,
      groupName: groupName ?? null,
      cutoffDate: cutoffDate ?? null,
      roomsReserved: roomsReserved ?? null,
      roomsBooked: roomsBooked ?? 0,
      pricePerNight: pricePerNight != null ? String(pricePerNight) : null,
      distanceFromVenue: distanceFromVenue ?? null,
      notes: notes ?? null,
    }).returning();
    res.status(201).json(fmt(created));
  } catch (err) {
    req.log.error(err, "Failed to create hotel block");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotels/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const {
      hotelName, address, city, state, zip, phone, email, bookingLink, discountCode,
      groupName, cutoffDate, roomsReserved, roomsBooked, pricePerNight,
      distanceFromVenue, notes,
    } = req.body;
    const [updated] = await db
      .update(hotelBlocks)
      .set({
        hotelName, address, city: city ?? null, state: state ?? null, zip: zip ?? null,
        phone, email, bookingLink, discountCode,
        groupName, cutoffDate, roomsReserved, roomsBooked,
        pricePerNight: pricePerNight != null ? String(pricePerNight) : null,
        distanceFromVenue, notes,
      })
      .where(and(eq(hotelBlocks.id, id), eq(hotelBlocks.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(fmt(updated));
  } catch (err) {
    req.log.error(err, "Failed to update hotel block");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/hotels/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    await db
      .delete(hotelBlocks)
      .where(and(eq(hotelBlocks.id, id), eq(hotelBlocks.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete hotel block");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
