import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type { VendorPartnerApplication } from "@workspace/db";

export type VendorDirectoryListing = {
  about: string;
  category: string;
  contactName: string;
  email: string;
  fit: string;
  gallery: string[];
  id: string;
  instagram: string;
  location: string;
  logoLabel: string;
  name: string;
  phone: string;
  price: number;
  reviews: number;
  rating: string;
  responseTime: string;
  services: string[];
  tags: string[];
  website: string;
};

let directoryColumnsReady: Promise<void> | null = null;

export function ensureVendorPartnerDirectoryColumns() {
  directoryColumnsReady ??= db.execute(sql`
    ALTER TABLE "vendor_partner_applications"
      ADD COLUMN IF NOT EXISTS "directory_listing" jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "directory_status" text NOT NULL DEFAULT 'not_created',
      ADD COLUMN IF NOT EXISTS "directory_published_at" timestamp
  `).then(() => undefined);
  return directoryColumnsReady;
}

function cleanText(value: unknown, fallback = "", maxLength = 600) {
  return (typeof value === "string" ? value.trim() : fallback).slice(0, maxLength);
}

function cleanStringList(value: unknown, fallback: string[], maxItems = 8) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map(item => cleanText(item, "", 90))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parsePrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string") return 0;
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function makeListingId(application: Pick<VendorPartnerApplication, "id" | "businessName">) {
  const slug = application.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "vendor"}-${application.id}`;
}

export function buildVendorDirectoryListing(application: VendorPartnerApplication): VendorDirectoryListing {
  const gallery = (application.servicePhotos ?? [])
    .map(photo => photo.dataUrl)
    .filter(Boolean)
    .slice(0, 4);
  const category = application.category || "Wedding Vendor";
  const location = application.serviceArea || "Service area available on request";
  return {
    about: application.description || `${application.businessName} is an A.I DO partner serving ${location}.`,
    category,
    contactName: application.contactName,
    email: application.email,
    fit: application.description?.slice(0, 180) || `${category} partner serving ${location}.`,
    gallery: gallery.length ? gallery : ["/images/default-wedding-couple.jpg", "/images/floral-bg.png", "/opengraph.jpg"],
    id: makeListingId(application),
    instagram: application.instagram || "",
    location,
    logoLabel: application.businessName,
    name: application.businessName,
    phone: application.phone || "",
    price: parsePrice(application.startingPrice),
    reviews: 0,
    rating: "New",
    responseTime: "Replies after inquiry",
    services: [`${category} services`, "Wedding consultation", "Custom quote"],
    tags: [category, location, "A.I DO Partner"],
    website: application.website || "",
  };
}

export function cleanVendorDirectoryListing(raw: unknown, application: VendorPartnerApplication): VendorDirectoryListing {
  const fallback = buildVendorDirectoryListing(application);
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    about: cleanText(value.about, fallback.about, 1400),
    category: cleanText(value.category, fallback.category, 80),
    contactName: cleanText(value.contactName, fallback.contactName, 120),
    email: cleanText(value.email, fallback.email, 180).toLowerCase(),
    fit: cleanText(value.fit, fallback.fit, 240),
    gallery: cleanStringList(value.gallery, fallback.gallery, 6),
    id: cleanText(value.id, fallback.id, 90).replace(/[^a-zA-Z0-9-]/g, "-"),
    instagram: cleanText(value.instagram, fallback.instagram, 120),
    location: cleanText(value.location, fallback.location, 140),
    logoLabel: cleanText(value.logoLabel, fallback.logoLabel, 80),
    name: cleanText(value.name, fallback.name, 140),
    phone: cleanText(value.phone, fallback.phone, 60),
    price: parsePrice(value.price ?? fallback.price),
    reviews: parsePrice(value.reviews ?? fallback.reviews),
    rating: cleanText(value.rating, fallback.rating, 20),
    responseTime: cleanText(value.responseTime, fallback.responseTime, 80),
    services: cleanStringList(value.services, fallback.services, 10),
    tags: cleanStringList(value.tags, fallback.tags, 8),
    website: cleanText(value.website, fallback.website, 240),
  };
}
