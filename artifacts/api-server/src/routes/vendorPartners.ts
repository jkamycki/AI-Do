import { Router } from "express";
import { db, vendorPartnerApplications } from "@workspace/db";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_SERVICE_PHOTOS = 3;
const MAX_SERVICE_PHOTO_DATA_URL_LENGTH = 1_100_000;

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
    const servicePhotos = cleanServicePhotos(req.body?.servicePhotos);

    if (!businessName || !contactName || !EMAIL_RE.test(email) || !category || !serviceArea) {
      return res.status(400).json({ error: "Business name, contact name, email, category, and service area are required." });
    }

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
        servicePhotos,
      })
      .returning({ id: vendorPartnerApplications.id });

    res.status(201).json({ success: true, id: application.id });
  } catch (err) {
    req.log.error({ err }, "Vendor partner application submit error");
    res.status(500).json({ error: "Could not submit vendor partner application." });
  }
});

export default router;
