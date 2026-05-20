import { Router } from "express";
import { getMaintenanceState, isMaintenanceSection } from "../lib/maintenance";

const router = Router();

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

export default router;
