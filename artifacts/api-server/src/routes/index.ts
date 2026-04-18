import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./wedding/profile";
import timelineRouter from "./wedding/timeline";
import vendorRouter from "./wedding/vendor";
import vendorSyncRouter from "./wedding/vendorSync";
import budgetRouter from "./wedding/budget";
import checklistRouter from "./wedding/checklist";
import dayofRouter from "./wedding/dayof";
import dashboardRouter from "./wedding/dashboard";
import storageRouter from "./storage";
import pdfRouter from "./pdf";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(timelineRouter);
router.use(vendorRouter);
router.use(vendorSyncRouter);
router.use(budgetRouter);
router.use(checklistRouter);
router.use(dayofRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(pdfRouter);

export default router;
