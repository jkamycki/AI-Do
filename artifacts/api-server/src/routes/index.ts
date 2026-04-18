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
import adminRouter from "./admin";
import collaboratorsRouter from "./collaborators";
import workspaceRouter from "./workspace";

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
router.use(adminRouter);
router.use(collaboratorsRouter);
router.use(workspaceRouter);

export default router;
