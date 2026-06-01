import { Router } from "express";
import { db, maintenanceFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getMaintenanceState, isMaintenanceSection } from "../lib/maintenance";

const router = Router();
const PRICING_FLAG_SECTION = "launch-pricing";

router.get("/maintenance/public", async (req, res) => {
  try {
    const section = String(req.query.section ?? "");
    if (!isMaintenanceSection(section)) {
      return res.status(400).json({ error: "Unknown maintenance section" });
    }
    res.json(await getMaintenanceState(section));
  } catch (err) {
    req.log.error({ err }, "Failed to load public maintenance state");
    res.json({ active: false, section: String(req.query.section ?? ""), message: "", activeSection: null, expiresAt: null });
  }
});

router.get("/pricing/public", async (req, res) => {
  try {
    const [flag] = await db
      .select()
      .from(maintenanceFlags)
      .where(eq(maintenanceFlags.section, PRICING_FLAG_SECTION))
      .limit(1);

    res.json({
      enabled: flag?.enabled === true,
      updatedAt: flag?.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load public pricing setting");
    res.json({ enabled: false, updatedAt: null });
  }
});

export default router;
