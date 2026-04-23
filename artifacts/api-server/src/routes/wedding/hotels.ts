import { Router } from "express";
import { db, hotelBlocks } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveScopeUserId } from "../../lib/workspaceAccess";

const router = Router();

function fmt(h: typeof hotelBlocks.$inferSelect) {
  return {
    ...h,
    pricePerNight: h.pricePerNight != null ? Number(h.pricePerNight) : null,
    createdAt: h.createdAt.toISOString(),
  };
}

router.get("/hotels", requireAuth, async (req, res) => {
  try {
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
