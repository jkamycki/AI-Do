import { Router, type IRouter, type RequestHandler } from "express";
import healthRouter from "./health";

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
router.use(lazyRouter(() => import("./wedding/profile")));
router.use(lazyRouter(() => import("./wedding/timeline")));
router.use(lazyRouter(() => import("./wedding/vendor")));
router.use(lazyRouter(() => import("./wedding/vendorSync")));
router.use(lazyRouter(() => import("./wedding/budget")));
router.use(lazyRouter(() => import("./wedding/manualExpenses")));
router.use(lazyRouter(() => import("./wedding/checklist")));
router.use(lazyRouter(() => import("./wedding/dayof")));
router.use(lazyRouter(() => import("./wedding/dashboard")));
router.use(lazyRouter(() => import("./storage")));
router.use(lazyRouter(() => import("./pdf")));
router.use(lazyRouter(() => import("./admin")));
router.use(lazyRouter(() => import("./collaborators")));
router.use(lazyRouter(() => import("./workspace")));
router.use(lazyRouter(() => import("./support")));
router.use(lazyRouter(() => import("./aria")));
router.use(lazyRouter(() => import("./aiText")));
router.use(lazyRouter(() => import("./help")));
router.use(lazyRouter(() => import("./seating")));
router.use(lazyRouter(() => import("./guests")));
router.use(lazyRouter(() => import("./wedding/hotels")));
router.use(lazyRouter(() => import("./wedding/weddingParty")));
router.use(lazyRouter(() => import("./contracts")));
router.use(lazyRouter(() => import("./documents")));
router.use(lazyRouter(() => import("./account")));
router.use(lazyRouter(() => import("./guestCollect")));
router.use(lazyRouter(() => import("./wedding/messaging")));
router.use(lazyRouter(() => import("./tts")));
router.use(lazyRouter(() => import("./auth")));
router.use(lazyRouter(() => import("./rsvp")));
router.use(lazyRouter(() => import("./moodboard")));
router.use(lazyRouter(() => import("./invitationCustomizations")));
router.use(lazyRouter(() => import("./website")));
router.use(lazyRouter(() => import("./track")));
router.use(lazyRouter(() => import("./maintenance")));
router.use(lazyRouter(() => import("./mobile")));
router.use(lazyRouter(() => import("./vendorPartners")));

export default router;
