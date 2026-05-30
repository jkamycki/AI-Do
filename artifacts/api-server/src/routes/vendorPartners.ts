import { Router } from "express";
import { db, vendorPartnerApplications } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { cleanVendorDirectoryListing, ensureVendorPartnerDirectoryColumns } from "../lib/vendorPartnerDirectory";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_SERVICE_PHOTOS = 3;
// Intake photos are optimized in the browser before submit. Keeping each data
// URL under 2 MB prevents one application from exhausting the small API worker.
const MAX_SERVICE_PHOTO_DATA_URL_LENGTH = 2_000_000;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanServicePhotos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SERVICE_PHOTOS).flatMap((photo) => {
    if (!photo || typeof photo !== "object") return [];
    const item = photo as { name?: unknown; type?: unknown; dataUrl?: unknown };
    const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl : "";
    if (!PHOTO_DATA_URL_RE.test(dataUrl) || dataUrl.length > MAX_SERVICE_PHOTO_DATA_URL_LENGTH) return [];
    return [{
      name: cleanText(item.name, 120) || "service-photo.jpg",
      type: cleanText(item.type, 80) || "image/jpeg",
      dataUrl,
    }];
  });
}

function cleanServices(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(item => cleanText(item, 120))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map(item => cleanText(item, 120))
      .filter(Boolean)
      .slice(0, 10);
  }
  return [];
}

function cleanBusinessLogo(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as { name?: unknown; type?: unknown; dataUrl?: unknown };
  const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl : "";
  if (!PHOTO_DATA_URL_RE.test(dataUrl) || dataUrl.length > MAX_SERVICE_PHOTO_DATA_URL_LENGTH) return null;
  return {
    name: cleanText(item.name, 120) || "business-logo.png",
    type: cleanText(item.type, 80) || "image/png",
    dataUrl,
  };
}

router.post("/vendor-partners", async (req, res) => {
  try {
    const businessName = cleanText(req.body?.businessName, 140);
    const contactName = cleanText(req.body?.contactName, 120);
    const email = cleanText(req.body?.email, 180).toLowerCase();
    const phone = cleanText(req.body?.phone, 60);
    const category = cleanText(req.body?.category, 80);
    const serviceArea = cleanText(req.body?.serviceArea, 140);
    const website = cleanText(req.body?.website, 240);
    const instagram = cleanText(req.body?.instagram, 120);
    const startingPrice = cleanText(req.body?.startingPrice, 80);
    const description = cleanText(req.body?.description, 1200);
    const about = cleanText(req.body?.about, 1600);
    const services = cleanServices(req.body?.services);
    const businessLogo = cleanBusinessLogo(req.body?.businessLogo);
    const servicePhotos = cleanServicePhotos(req.body?.servicePhotos);

    if (!businessName || !contactName || !EMAIL_RE.test(email) || !category || !serviceArea || !about || services.length === 0) {
      return res.status(400).json({ error: "Business name, contact name, email, category, service area, About Us, and at least one service are required." });
    }

    await ensureVendorPartnerDirectoryColumns();
    const [application] = await db
      .insert(vendorPartnerApplications)
      .values({
        businessName,
        contactName,
        email,
        phone: phone || null,
        category,
        serviceArea,
        website: website || null,
        instagram: instagram || null,
        startingPrice: startingPrice || null,
        description: description || null,
        about,
        services,
        businessLogo,
        servicePhotos,
      })
      .returning({ id: vendorPartnerApplications.id });

    res.status(201).json({ success: true, id: application.id });
  } catch (err) {
    req.log.error({ err }, "Vendor partner application submit error");
    res.status(500).json({ error: "Could not submit vendor partner application." });
  }
});

router.get("/vendor-partners/directory", async (req, res) => {
  try {
    await ensureVendorPartnerDirectoryColumns();
    const applications = await db
      .select()
      .from(vendorPartnerApplications)
      .where(eq(vendorPartnerApplications.directoryStatus, "published"))
      .orderBy(desc(vendorPartnerApplications.directoryPublishedAt), desc(vendorPartnerApplications.updatedAt));

    res.json({
      listings: applications.map((application) =>
        cleanVendorDirectoryListing(application.directoryListing, application),
      ),
    });
  } catch (err) {
    req.log.error({ err }, "Vendor partner directory load error");
    res.status(500).json({ error: "Could not load vendor partner directory." });
  }
});

router.get("/vendor-partners/directory/:id", async (req, res) => {
  try {
    await ensureVendorPartnerDirectoryColumns();
    const requestedId = String(req.params.id ?? "").trim();
    if (!requestedId) return res.status(404).json({ error: "Vendor partner profile not found." });

    const applications = await db
      .select()
      .from(vendorPartnerApplications)
      .where(eq(vendorPartnerApplications.directoryStatus, "published"))
      .orderBy(desc(vendorPartnerApplications.directoryPublishedAt), desc(vendorPartnerApplications.updatedAt));

    const listing = applications
      .map((application) => cleanVendorDirectoryListing(application.directoryListing, application))
      .find((item) => item.id === requestedId);

    if (!listing) return res.status(404).json({ error: "Vendor partner profile not found." });
    res.json({ listing });
  } catch (err) {
    req.log.error({ err }, "Vendor partner profile load error");
    res.status(500).json({ error: "Could not load vendor partner profile." });
  }
});

export default router;
