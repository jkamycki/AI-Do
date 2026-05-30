import { Router, type IRouter, type RequestHandler } from "express";
import healthRouter from "./health";
import profileRouter from "./wedding/profile";
import timelineRouter from "./wedding/timeline";
import vendorRouter from "./wedding/vendor";
import vendorSyncRouter from "./wedding/vendorSync";
import budgetRouter from "./wedding/budget";
import manualExpensesRouter from "./wedding/manualExpenses";
import checklistRouter from "./wedding/checklist";
import dayofRouter from "./wedding/dayof";
import dashboardRouter from "./wedding/dashboard";
import storageRouter from "./storage";
import adminRouter from "./admin";
import collaboratorsRouter from "./collaborators";
import workspaceRouter from "./workspace";
import supportRouter from "./support";
import ariaRouter from "./aria";
import aiTextRouter from "./aiText";
import helpRouter from "./help";
import seatingRouter from "./seating";
import guestsRouter from "./guests";
import hotelsRouter from "./wedding/hotels";
import weddingPartyRouter from "./wedding/weddingParty";
import accountRouter from "./account";
import guestCollectRouter from "./guestCollect";
import messagingRouter from "./wedding/messaging";
import ttsRouter from "./tts";
import authRouter from "./auth";
import rsvpRouter from "./rsvp";
import moodboardRouter from "./moodboard";
import websiteRouter from "./website";
import trackRouter from "./track";
import maintenanceRouter from "./maintenance";
import mobileRouter from "./mobile";
import vendorPartnersRouter from "./vendorPartners";

const router: IRouter = Router();

function lazyRouter(loader: () => Promise<{ default: IRouter }>): IRouter {
  const lazy = Router();
  let loaded: Promise<IRouter> | null = null;
  const handle: RequestHandler = async (req, res, next) => {
    try {
      loaded ??= loader().then((mod) => mod.default);
      const resolved = await loaded;
      resolved(req, res, next);
    } catch (err) {
      loaded = null;
      next(err);
    }
  };
  lazy.use(handle);
  return lazy;
}

router.use(healthRouter);
router.use(profileRouter);
router.use(timelineRouter);
router.use(vendorRouter);
router.use(vendorSyncRouter);
router.use(budgetRouter);
router.use(manualExpensesRouter);
router.use(checklistRouter);
router.use(dayofRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(lazyRouter(() => import("./pdf")));
router.use(adminRouter);
router.use(collaboratorsRouter);
router.use(workspaceRouter);
router.use(supportRouter);
router.use(ariaRouter);
router.use(aiTextRouter);
router.use(helpRouter);
router.use(seatingRouter);
router.use(guestsRouter);
router.use(hotelsRouter);
router.use(weddingPartyRouter);
router.use(lazyRouter(() => import("./contracts")));
router.use(lazyRouter(() => import("./documents")));
router.use(accountRouter);
router.use(guestCollectRouter);
router.use(messagingRouter);
router.use(ttsRouter);
router.use(authRouter);
router.use(rsvpRouter);
router.use(moodboardRouter);
router.use(lazyRouter(() => import("./invitationCustomizations")));
router.use(websiteRouter);
router.use(trackRouter);
router.use(maintenanceRouter);
router.use(mobileRouter);
router.use(vendorPartnersRouter);

export default router;
