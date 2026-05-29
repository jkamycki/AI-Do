import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { useRoute } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { authFetch } from "@/lib/authFetch";
import { PhotoUploadSection } from "@/components/InvitationCustomization/PhotoUploadSection";
import {
  AiSaveDatePreview,
  AiDigitalInvitationPreview,
  DEFAULT_PHOTO_POSITION,
} from "@/components/InvitationCustomization/AiPreviewComponents";
import { AnimatedInvitationShell } from "@/components/InvitationCustomization/AnimatedInvitationShell";
import {
  PrintInvitationPreview,
  PRINT_SIZES,
  type PrintInvitationSide,
  type PrintInvitationSize,
} from "@/components/InvitationCustomization/PrintInvitationPreview";
import { RsvpPagePreview } from "@/components/InvitationCustomization/RsvpPagePreview";
import { Card, CardContent } from "@/components/ui/card";
import { WEBSITE_THEMES } from "@/lib/websiteThemes";
import {
  buildInvitationDesignDocument,
  type InvitationDeliveryMode,
} from "@/lib/invitationDesignModel";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { qrPngDataUrl } from "@/lib/localQr";
import { publishedWebsiteUrl } from "@/lib/publicUrls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Loader2,
  RefreshCw,
  Save,
  Undo2,
  Heart,
  Mail,
  Printer,
  FileDown,
  Send,
  Plus,
  Trash2,
  Hotel,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type {
  InvitationCustomization,
  ColorPalette,
  PreviewTab,
  WeddingProfileData,
} from "@/types/invitations";
import {
  DEFAULT_RSVP_MEAL_OPTIONS,
  normalizeMealOptions,
  optionValueFromLabel,
  type MealOption,
} from "@/lib/mealOptions";

interface RouteParams {
  [key: string]: string | undefined;
  profileId?: string;
}

interface InvitationCustomizationProps {
  profileId?: number;
  onOpenGuestList?: (defaultInvitation?: "saveTheDate" | "digitalInvitation") => void;
}

type InvitationDesignKey = "saveTheDate" | "rsvpInvitation";
type InvitationDesignFields = {
  backgroundColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: string;
  fontColor: string;
};
type CustomDesignState = Record<InvitationDesignKey, InvitationDesignFields>;
const AIDO_BRAND_COLORS = {
  burgundy: "#8D294D",
  mauve: "#B16C8E",
  dustyRose: "#E6A6B7",
  champagne: "#F2E2C6",
  ivory: "#FFF7F2",
  ink: "#3B1C2B",
};
const AIDO_INVITATION_PALETTE: ColorPalette = {
  primary: AIDO_BRAND_COLORS.burgundy,
  secondary: AIDO_BRAND_COLORS.dustyRose,
  accent: AIDO_BRAND_COLORS.mauve,
  neutral: AIDO_BRAND_COLORS.champagne,
};
type HotelOption = {
  id: number;
  hotelName: string;
  bookingLink?: string | null;
  discountCode?: string | null;
  groupName?: string | null;
  cutoffDate?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  pricePerNight?: number | null;
  distanceFromVenue?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

function safePdfColor(color: string | null | undefined, fallback: string) {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return fallback;
}

function pdfRgb(color: string | null | undefined, fallback: string): [number, number, number] {
  const hex = safePdfColor(color, fallback).replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function formatPrintDate(date: string | null | undefined): string {
  if (!date) return "Wedding date";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrintShortDate(date: string | null | undefined): string {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrintTime(value: string | null | undefined): string {
  if (!value) return "";
  const [hourRaw, minuteRaw = "0"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function printLocationLines(design: ReturnType<typeof buildInvitationDesignDocument>) {
  return [
    design.fields.venue,
    design.fields.venueAddress,
    [design.fields.venueCity, [design.fields.venueState, design.fields.venueZip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  ].filter((line): line is string => Boolean(line));
}

function drawInvitationMarketingFooter(
  doc: {
    setDrawColor: (...args: number[]) => void;
    setLineWidth: (width: number) => void;
    line: (x1: number, y1: number, x2: number, y2: number) => void;
    addImage: (...args: unknown[]) => void;
    setFont: (font: string, style?: string) => void;
    setFontSize: (size: number) => void;
    setTextColor: (...args: number[]) => void;
    text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void;
  },
  pageWidth: number,
  pageHeight: number,
  accent: [number, number, number],
  text: [number, number, number],
  logoDataUrl: string | null,
) {
  const y = pageHeight - 26;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.35);
  doc.line(48, y - 10, pageWidth - 48, y - 10);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", pageWidth / 2 - 18, y - 8, 36, 14);
    } catch {
      doc.setFont("times", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...accent);
      doc.text("A.IDO", pageWidth / 2, y, { align: "center" });
    }
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...text);
  doc.text("Planning your own wedding? Try A.IDO | aidowedding.net", pageWidth / 2, y + 12, { align: "center" });
}

async function fileToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadImageDataUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, { credentials: "include", mode: "cors" });
    if (!response.ok) return null;
    return await fileToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

async function coverImageDataUrl(
  imageDataUrl: string,
  width: number,
  height: number,
  position: { x: number; y: number },
) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create image canvas"));
        return;
      }
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const offsetX = (canvas.width - drawWidth) * (Math.min(100, Math.max(0, position.x)) / 100);
      const offsetY = (canvas.height - drawHeight) * (Math.min(100, Math.max(0, position.y)) / 100);
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.96));
    };
    image.onerror = () => reject(new Error("Could not load invitation photo"));
    image.src = imageDataUrl;
  });
}

function addCenteredText(
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string, index: number) => {
    doc.text(line, x, y + index * lineHeight, { align: "center" });
  });
  return y + lines.length * lineHeight;
}

export default function InvitationCustomizationPage({
  profileId: propProfileId,
  onOpenGuestList,
}: InvitationCustomizationProps = {}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [, params] = useRoute<RouteParams>("/guests/:profileId");

  const profileId =
    propProfileId ||
    (params?.profileId
      ? parseInt(params.profileId)
      : activeWorkspace?.profileId);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("saveTheDate");
  const designMode = "custom" as const;
  const [deliveryMode, setDeliveryMode] = useState<InvitationDeliveryMode>("digital");
  const [printSize, setPrintSize] = useState<PrintInvitationSize>("5x7");
  const [printSide, setPrintSide] = useState<PrintInvitationSide>("front");
  const [includePrintQr, setIncludePrintQr] = useState(true);
  const [exportingPrintPdf, setExportingPrintPdf] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [customDesign, setCustomDesign] = useState<CustomDesignState>({
    saveTheDate: { backgroundColor: AIDO_BRAND_COLORS.ivory, accentColor: AIDO_BRAND_COLORS.burgundy, fontFamily: "Playfair Display", fontSize: "16", fontColor: AIDO_BRAND_COLORS.ink },
    rsvpInvitation: { backgroundColor: AIDO_BRAND_COLORS.ivory, accentColor: AIDO_BRAND_COLORS.burgundy, fontFamily: "Playfair Display", fontSize: "16", fontColor: AIDO_BRAND_COLORS.ink },
  });
  const [previewRefreshNonce, setPreviewRefreshNonce] = useState(0);
  const [showRsvpFlowPreview, setShowRsvpFlowPreview] = useState(false);

  // ── Shared brand-color state ──────────────────────────────────────────────
  const [primaryColor, setPrimaryColor] = useState(AIDO_BRAND_COLORS.burgundy);
  const [autoGeneratedPalette, setAutoGeneratedPalette] =
    useState<ColorPalette>(AIDO_INVITATION_PALETTE);
  const [customColors, setCustomColors] =
    useState<Partial<ColorPalette> | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    null,
  );

  // ── Photos ────────────────────────────────────────────────────────────────
  const [saveTheDatePhotoUrl, setSaveTheDatePhotoUrl] = useState<string | null>(null);
  const [saveTheDatePhotoPosition, setSaveTheDatePhotoPosition] = useState(DEFAULT_PHOTO_POSITION);
  const [saveTheDatePhotoZoom, setSaveTheDatePhotoZoom] = useState(1);
  const [saveTheDatePhotoEffect, setSaveTheDatePhotoEffect] = useState("none");
  const [digitalInvitationPhotoUrl, setDigitalInvitationPhotoUrl] = useState<string | null>(null);
  const [digitalInvitationPhotoPosition, setDigitalInvitationPhotoPosition] = useState(DEFAULT_PHOTO_POSITION);
  const [digitalInvitationPhotoZoom, setDigitalInvitationPhotoZoom] = useState(1);
  const [digitalInvitationPhotoEffect, setDigitalInvitationPhotoEffect] = useState("none");

  // ── Messages ──────────────────────────────────────────────────────────────
  const [saveTheDateMessage, setSaveTheDateMessage] = useState("");
  const [invitationMessage, setInvitationMessage] = useState("");
  // RSVP deadline shown on the RSVP invitation (preview, email, public page).
  // Stored as ISO YYYY-MM-DD so it round-trips through <input type="date">.
  const [rsvpByDate, setRsvpByDate] = useState<string>("");
  const [rsvpAskHotel, setRsvpAskHotel] = useState(false);
  const [rsvpHotelBlockId, setRsvpHotelBlockId] = useState<string>("all");
  const [saveTheDateShowHotel, setSaveTheDateShowHotel] = useState(false);
  const [saveTheDateHotelBlockId, setSaveTheDateHotelBlockId] = useState<string>("all");
  const [rsvpMealOptions, setRsvpMealOptions] = useState<MealOption[]>(DEFAULT_RSVP_MEAL_OPTIONS);
  const [newMealOption, setNewMealOption] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);

  // ── Misc ──────────────────────────────────────────────────────────────────
  const skipNextAutoSave = useRef(true);
  const hasInitialized = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const customDesignUndoRef = useRef<Record<InvitationDesignKey, InvitationDesignFields[]>>({
    saveTheDate: [],
    rsvpInvitation: [],
  });
  const [customDesignUndoCounts, setCustomDesignUndoCounts] = useState<Record<InvitationDesignKey, number>>({
    saveTheDate: 0,
    rsvpInvitation: 0,
  });
  const latestValuesRef = useRef({
    profileId,
    primaryColor,
    autoGeneratedPalette,
    customColors,
    selectedPalette,
    saveTheDatePhotoUrl,
    saveTheDatePhotoPosition,
    saveTheDatePhotoZoom,
    saveTheDatePhotoEffect,
    digitalInvitationPhotoUrl,
    digitalInvitationPhotoPosition,
    digitalInvitationPhotoZoom,
    digitalInvitationPhotoEffect,
    backgroundImageUrl,
    customDesign,
    rsvpByDate,
    rsvpAskHotel,
    rsvpHotelBlockId,
    saveTheDateShowHotel,
    saveTheDateHotelBlockId,
    rsvpMealOptions,
  });
  const saveTheDateBlobUrlRef = useRef<string | null>(null);
  const digitalInvitationBlobUrlRef = useRef<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const printPreviewRef = useRef<HTMLDivElement>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(0);

  const resetCustomDesignUndo = useCallback(() => {
    customDesignUndoRef.current = { saveTheDate: [], rsvpInvitation: [] };
    setCustomDesignUndoCounts({ saveTheDate: 0, rsvpInvitation: 0 });
  }, []);

  const designsEqual = useCallback((a: InvitationDesignFields, b: InvitationDesignFields) => {
    return (
      a.backgroundColor === b.backgroundColor &&
      a.accentColor === b.accentColor &&
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontColor === b.fontColor
    );
  }, []);

  const pushCustomDesignUndo = useCallback(
    (key: InvitationDesignKey, fields: InvitationDesignFields) => {
      const stack = customDesignUndoRef.current[key];
      const last = stack[stack.length - 1];
      if (last && designsEqual(last, fields)) return;
      customDesignUndoRef.current[key] = [...stack.slice(-24), { ...fields }];
      setCustomDesignUndoCounts((prev) => ({
        ...prev,
        [key]: customDesignUndoRef.current[key].length,
      }));
    },
    [designsEqual],
  );

  const setCustomDesignForKey = useCallback(
    (key: InvitationDesignKey, nextFields: InvitationDesignFields) => {
      setCustomDesign((prev) => {
        if (designsEqual(prev[key], nextFields)) return prev;
        pushCustomDesignUndo(key, prev[key]);
        return { ...prev, [key]: nextFields };
      });
    },
    [designsEqual, pushCustomDesignUndo],
  );

  const updateCustomDesignField = useCallback(
    (key: InvitationDesignKey, field: keyof InvitationDesignFields, value: string) => {
      setCustomDesign((prev) => {
        if (prev[key][field] === value) return prev;
        pushCustomDesignUndo(key, prev[key]);
        return {
          ...prev,
          [key]: { ...prev[key], [field]: value },
        };
      });
    },
    [pushCustomDesignUndo],
  );

  const undoCustomDesign = useCallback(
    (key: InvitationDesignKey) => {
      const stack = customDesignUndoRef.current[key];
      const previous = stack[stack.length - 1];
      if (!previous) return;
      customDesignUndoRef.current[key] = stack.slice(0, -1);
      setCustomDesignUndoCounts((prev) => ({
        ...prev,
        [key]: customDesignUndoRef.current[key].length,
      }));
      setCustomDesign((prev) => ({ ...prev, [key]: previous }));
    },
    [],
  );

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setPreviewContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  latestValuesRef.current = {
    profileId,
    primaryColor,
    autoGeneratedPalette,
    customColors,
    selectedPalette,
    saveTheDatePhotoUrl,
    saveTheDatePhotoPosition,
    saveTheDatePhotoZoom,
    saveTheDatePhotoEffect,
    digitalInvitationPhotoUrl,
    digitalInvitationPhotoPosition,
    digitalInvitationPhotoZoom,
    digitalInvitationPhotoEffect,
    backgroundImageUrl,
    customDesign,
    rsvpByDate,
    rsvpAskHotel,
    rsvpHotelBlockId,
    saveTheDateShowHotel,
    saveTheDateHotelBlockId,
    rsvpMealOptions,
  };

  useEffect(() => {
    return () => {
      if (saveTheDateBlobUrlRef.current)
        URL.revokeObjectURL(saveTheDateBlobUrlRef.current);
      if (digitalInvitationBlobUrlRef.current)
        URL.revokeObjectURL(digitalInvitationBlobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      const v = latestValuesRef.current;
      if (!v.profileId) return;
      if (v.saveTheDatePhotoUrl?.startsWith("blob:")) return;
      if (v.digitalInvitationPhotoUrl?.startsWith("blob:")) return;
      const finalCustomColors = {
        ...(v.customColors ?? {}),
        accent: v.customDesign.saveTheDate.accentColor,
        primary: v.customDesign.saveTheDate.accentColor,
        saveTheDateAccent: v.customDesign.saveTheDate.accentColor,
        digitalInvitationAccent: v.customDesign.rsvpInvitation.accentColor,
        saveTheDatePhotoEffect: v.saveTheDatePhotoEffect,
        digitalInvitationPhotoEffect: v.digitalInvitationPhotoEffect,
        saveTheDatePhotoZoom: v.saveTheDatePhotoZoom,
        digitalInvitationPhotoZoom: v.digitalInvitationPhotoZoom,
        rsvpAskHotel: false,
        rsvpHotelBlockId: null,
        saveTheDateShowHotel: v.saveTheDateShowHotel,
        saveTheDateHotelBlockId: v.saveTheDateHotelBlockId === "all" ? "all" : Number(v.saveTheDateHotelBlockId),
        rsvpMealOptions: normalizeMealOptions(v.rsvpMealOptions),
      };
      const body = JSON.stringify({
        profileId: v.profileId,
        primaryColor: v.primaryColor,
        colorPalette: v.autoGeneratedPalette,
        customColors: finalCustomColors,
        selectedPalette: v.selectedPalette,
        saveTheDatePhotoUrl: v.saveTheDatePhotoUrl,
        digitalInvitationPhotoUrl: v.digitalInvitationPhotoUrl,
        saveTheDatePhotoPosition: v.saveTheDatePhotoPosition,
        digitalInvitationPhotoPosition: v.digitalInvitationPhotoPosition,
        backgroundImageUrl: v.backgroundImageUrl,
        useGeneratedInvitation: false,
        saveTheDateBackground: v.customDesign.saveTheDate.backgroundColor,
        digitalInvitationBackground: v.customDesign.rsvpInvitation.backgroundColor,
        saveTheDateFont: v.customDesign.saveTheDate.fontFamily,
        digitalInvitationFont: v.customDesign.rsvpInvitation.fontFamily,
        saveTheDateFontColor: v.customDesign.saveTheDate.fontColor,
        digitalInvitationFontColor: v.customDesign.rsvpInvitation.fontColor,
        saveTheDateFontSize: v.customDesign.saveTheDate.fontSize,
        digitalInvitationFontSize: v.customDesign.rsvpInvitation.fontSize,
        rsvpByDate: v.rsvpByDate || null,
      });

      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
      const saveUrl = `${apiBase}/api/invitation-customizations`;

      const cachedToken = tokenRef.current;
      if (cachedToken) {
        fetch(saveUrl, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cachedToken}`,
          },
          body,
        }).catch(() => {});
      } else if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        try {
          navigator.sendBeacon(
            saveUrl,
            new Blob([body], { type: "application/json" }),
          );
        } catch {
          // ignore — best-effort
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    if (token) tokenRef.current = token;
    return authFetch(url, {
      ...init,
      credentials: "include",
      headers: {
        ...(!(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const setCustomizationCache = useCallback(
    (
      updater: (
        old: InvitationCustomization | null | undefined,
      ) => InvitationCustomization | null | undefined,
    ) => {
      if (!profileId) return;
      queryClient.setQueryData(
        ["invitation-customizations", profileId],
        updater,
      );
    },
    [profileId, queryClient],
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: weddingProfile } = useQuery({
    queryKey: ["wedding-profile", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const r = await authedFetch(`/api/profile`);
      if (!r.ok) throw new Error("Failed to fetch profile");
      return r.json() as Promise<WeddingProfileData>;
    },
    enabled: !!profileId,
    retry: 1,
  });

  const { data: customization } = useQuery({
    queryKey: ["invitation-customizations", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const r = await authedFetch(
        `/api/invitation-customizations?profileId=${profileId}`,
      );
      if (!r.ok) throw new Error("Failed to fetch customizations");
      return r.json() as Promise<InvitationCustomization>;
    },
    enabled: !!profileId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: websiteRecord } = useQuery({
    queryKey: ["wedding-website", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const r = await authedFetch("/api/website/me");
      if (!r.ok) return null;
      return r.json() as Promise<{ slug?: string; published?: boolean }>;
    },
    enabled: !!profileId,
    retry: 1,
  });

  const { data: hotelBlocks = [] } = useQuery<HotelOption[]>({
    queryKey: ["hotels", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const r = await authedFetch("/api/hotels");
      if (!r.ok) return [];
      return r.json() as Promise<HotelOption[]>;
    },
    enabled: !!profileId,
    retry: 1,
  });

  // ── Load DB data into state ───────────────────────────────────────────────
  useEffect(() => {
    if (!customization) return;

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      skipNextAutoSave.current = true;

      setPrimaryColor(customization.primaryColor);
      setAutoGeneratedPalette(customization.colorPalette);
      setCustomColors(customization.customColors);
      setSelectedPalette(customization.selectedPalette);
      setBackgroundImageUrl(customization.backgroundImageUrl);

      setSaveTheDatePhotoUrl(customization.saveTheDatePhotoUrl);
      setDigitalInvitationPhotoUrl(customization.digitalInvitationPhotoUrl);
      setSaveTheDatePhotoEffect(customization.customColors?.saveTheDatePhotoEffect ?? "none");
      setDigitalInvitationPhotoEffect(customization.customColors?.digitalInvitationPhotoEffect ?? "none");
      setSaveTheDatePhotoZoom(customization.customColors?.saveTheDatePhotoZoom ?? 1);
      setDigitalInvitationPhotoZoom(customization.customColors?.digitalInvitationPhotoZoom ?? 1);
      setRsvpByDate(customization.rsvpByDate ?? "");
      setRsvpAskHotel(!!customization.customColors?.rsvpAskHotel);
      setRsvpHotelBlockId(
        customization.customColors?.rsvpHotelBlockId
          ? String(customization.customColors.rsvpHotelBlockId)
          : "all",
      );
      setSaveTheDateShowHotel(!!customization.customColors?.saveTheDateShowHotel);
      setSaveTheDateHotelBlockId(
        customization.customColors?.saveTheDateHotelBlockId
          ? String(customization.customColors.saveTheDateHotelBlockId)
          : "all",
      );
      setRsvpMealOptions(normalizeMealOptions(customization.customColors?.rsvpMealOptions));

      // Restore the per-invitation custom design fields from the saved record.
      const fallbackAccent =
        customization.customColors?.accent ??
        customization.colorPalette?.accent ??
        AIDO_BRAND_COLORS.burgundy;
      // Prefer the dedicated per-invitation column, then the JSONB backup key
      // (saveTheDateAccent / digitalInvitationAccent stored inside customColors),
      // then the shared legacy accent as last resort.
      const stdAccentInit =
        customization.saveTheDateAccentColor ??
        customization.customColors?.saveTheDateAccent ??
        fallbackAccent;
      const digAccentInit =
        customization.digitalInvitationAccentColor ??
        customization.customColors?.digitalInvitationAccent ??
        fallbackAccent;
      setCustomDesign({
        saveTheDate: {
          backgroundColor: customization.saveTheDateBackground ?? AIDO_BRAND_COLORS.ivory,
          accentColor: stdAccentInit,
          fontFamily: customization.saveTheDateFont ?? "Playfair Display",
          fontSize: customization.saveTheDateFontSize ?? "16",
          fontColor: customization.saveTheDateFontColor ?? AIDO_BRAND_COLORS.ink,
        },
        rsvpInvitation: {
          backgroundColor: customization.digitalInvitationBackground ?? AIDO_BRAND_COLORS.ivory,
          accentColor: digAccentInit,
          fontFamily: customization.digitalInvitationFont ?? "Playfair Display",
          fontSize: customization.digitalInvitationFontSize ?? "16",
          fontColor: customization.digitalInvitationFontColor ?? AIDO_BRAND_COLORS.ink,
        },
      });
      resetCustomDesignUndo();

      if (customization.saveTheDatePhotoPosition) {
        setSaveTheDatePhotoPosition(customization.saveTheDatePhotoPosition);
      }
      if (customization.digitalInvitationPhotoPosition) {
        setDigitalInvitationPhotoPosition(customization.digitalInvitationPhotoPosition);
      }
    } else {
      const latestStd = latestValuesRef.current.saveTheDatePhotoUrl;
      const latestDig = latestValuesRef.current.digitalInvitationPhotoUrl;
      const stdFromDb = customization.saveTheDatePhotoUrl;
      const digFromDb = customization.digitalInvitationPhotoUrl;

      if (stdFromDb && (!latestStd || latestStd.startsWith("blob:"))) {
        skipNextAutoSave.current = true;
        setSaveTheDatePhotoUrl(stdFromDb);
        if (customization.saveTheDatePhotoPosition) {
          setSaveTheDatePhotoPosition(customization.saveTheDatePhotoPosition);
        }
        setSaveTheDatePhotoZoom(customization.customColors?.saveTheDatePhotoZoom ?? 1);
      }
      if (digFromDb && (!latestDig || latestDig.startsWith("blob:"))) {
        skipNextAutoSave.current = true;
        setDigitalInvitationPhotoUrl(digFromDb);
        if (customization.digitalInvitationPhotoPosition) {
          setDigitalInvitationPhotoPosition(customization.digitalInvitationPhotoPosition);
        }
        setDigitalInvitationPhotoZoom(customization.customColors?.digitalInvitationPhotoZoom ?? 1);
      }
    }
  }, [customization, resetCustomDesignUndo]);

  // ── Load messages from wedding profile ────────────────────────────────────
  useEffect(() => {
    if (weddingProfile) {
      const couple = [weddingProfile.partner2Name, weddingProfile.partner1Name]
        .filter(Boolean)
        .join(" & ");
      setSaveTheDateMessage(
        weddingProfile.saveTheDateMessage ||
          (couple
            ? `Mark your calendar! ${couple} are getting married and we'd love to celebrate with you. Formal invitation to follow.`
            : "Mark your calendar! We're getting married and we'd love to celebrate with you. Formal invitation to follow."),
      );
      setInvitationMessage(
        weddingProfile.invitationMessage ||
          (couple
            ? `Together with their families, ${couple} joyfully invite you to celebrate their wedding day with them.`
            : "Together with their families, we joyfully invite you to celebrate our wedding day with us."),
      );
    }
  }, [weddingProfile]);

  // ── Photo upload mutation ─────────────────────────────────────────────────
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({
      file,
      type,
    }: {
      file: File;
      type: "save-the-date" | "digital-invitation";
    }) => {
      if (!profileId) throw new Error("Profile ID required");
      const formData = new FormData();
      formData.append("file", file);
      const token = await getToken();
      if (token) tokenRef.current = token;
      const params = new URLSearchParams({
        type,
        profileId: String(profileId),
      });
      const r = await authFetch(
        `/api/invitation-customizations/upload?${params}`,
        {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        },
      );
      if (!r.ok) {
        const error = await r.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `Upload failed with status ${r.status}`);
      }
      return r.json() as Promise<{ url: string }>;
    },
    onSuccess: (data, variables) => {
      if (variables.type === "save-the-date") {
        if (saveTheDateBlobUrlRef.current) {
          URL.revokeObjectURL(saveTheDateBlobUrlRef.current);
          saveTheDateBlobUrlRef.current = null;
        }
        latestValuesRef.current.saveTheDatePhotoUrl = data.url;
        latestValuesRef.current.saveTheDatePhotoPosition = DEFAULT_PHOTO_POSITION;
        latestValuesRef.current.saveTheDatePhotoZoom = 1;
        setSaveTheDatePhotoUrl(data.url);
        setSaveTheDatePhotoPosition(DEFAULT_PHOTO_POSITION);
        setSaveTheDatePhotoZoom(1);
        setCustomizationCache((old) =>
          old ? { ...old, saveTheDatePhotoUrl: data.url, saveTheDatePhotoPosition: DEFAULT_PHOTO_POSITION } : old,
        );
      } else {
        if (digitalInvitationBlobUrlRef.current) {
          URL.revokeObjectURL(digitalInvitationBlobUrlRef.current);
          digitalInvitationBlobUrlRef.current = null;
        }
        latestValuesRef.current.digitalInvitationPhotoUrl = data.url;
        latestValuesRef.current.digitalInvitationPhotoPosition = DEFAULT_PHOTO_POSITION;
        latestValuesRef.current.digitalInvitationPhotoZoom = 1;
        setDigitalInvitationPhotoUrl(data.url);
        setDigitalInvitationPhotoPosition(DEFAULT_PHOTO_POSITION);
        setDigitalInvitationPhotoZoom(1);
        setCustomizationCache((old) =>
          old ? { ...old, digitalInvitationPhotoUrl: data.url, digitalInvitationPhotoPosition: DEFAULT_PHOTO_POSITION } : old,
        );
      }

      skipNextAutoSave.current = true;
      const isSaveTheDate = variables.type === "save-the-date";
      const stdUrl = isSaveTheDate ? data.url : saveTheDatePhotoUrl;
      const digUrl = !isSaveTheDate ? data.url : digitalInvitationPhotoUrl;
      const payload: Record<string, unknown> = buildPayload(stdUrl, digUrl);
      if (typeof payload.saveTheDatePhotoUrl === "string" && payload.saveTheDatePhotoUrl.startsWith("blob:")) {
        delete payload.saveTheDatePhotoUrl;
      }
      if (typeof payload.digitalInvitationPhotoUrl === "string" && payload.digitalInvitationPhotoUrl.startsWith("blob:")) {
        delete payload.digitalInvitationPhotoUrl;
      }
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
      const cachedToken = tokenRef.current;
      fetch(`${apiBase}/api/invitation-customizations`, {
        method: "POST",
        keepalive: true,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  // ── Photo selection handlers ──────────────────────────────────────────────
  const handleSaveTheDatePhotoSelected = (file: File | null) => {
    if (saveTheDateBlobUrlRef.current) {
      URL.revokeObjectURL(saveTheDateBlobUrlRef.current);
      saveTheDateBlobUrlRef.current = null;
    }
    if (!file) { setSaveTheDatePhotoUrl(null); return; }
    setSaveTheDatePhotoPosition(DEFAULT_PHOTO_POSITION);
    const localUrl = URL.createObjectURL(file);
    saveTheDateBlobUrlRef.current = localUrl;
    setSaveTheDatePhotoUrl(localUrl);
    uploadPhotoMutation.mutate({ file, type: "save-the-date" });
  };

  const handleDigitalInvitationPhotoSelected = (file: File | null) => {
    if (digitalInvitationBlobUrlRef.current) {
      URL.revokeObjectURL(digitalInvitationBlobUrlRef.current);
      digitalInvitationBlobUrlRef.current = null;
    }
    if (!file) { setDigitalInvitationPhotoUrl(null); return; }
    setDigitalInvitationPhotoPosition(DEFAULT_PHOTO_POSITION);
    const localUrl = URL.createObjectURL(file);
    digitalInvitationBlobUrlRef.current = localUrl;
    setDigitalInvitationPhotoUrl(localUrl);
    uploadPhotoMutation.mutate({ file, type: "digital-invitation" });
  };

  // ── Save mutation (manual) ────────────────────────────────────────────────
  const saveCustomizationsMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Profile ID required");
      const payload = buildPayload(saveTheDatePhotoUrl, digitalInvitationPhotoUrl);
      const body: Record<string, unknown> = { ...payload };
      if (typeof body.saveTheDatePhotoUrl === "string" && (body.saveTheDatePhotoUrl as string).startsWith("blob:")) {
        delete body.saveTheDatePhotoUrl;
      }
      if (typeof body.digitalInvitationPhotoUrl === "string" && (body.digitalInvitationPhotoUrl as string).startsWith("blob:")) {
        delete body.digitalInvitationPhotoUrl;
      }
      const r = await authedFetch("/api/invitation-customizations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({ error: "Failed to save" }));
        throw new Error((errBody as { error?: string }).error || "Failed to save");
      }
      return r.json();
    },
    onSuccess: (savedCustomization: InvitationCustomization) => {
      queryClient.setQueryData(["invitation-customizations", profileId], savedCustomization);
      toast({ title: "Saved", description: "Your invitation customizations have been saved." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save customizations",
        variant: "destructive",
      });
    },
  });

  // ── Message save + AI generate ───────────────────────────────────────────
  const saveMessage = async (type: "saveTheDate" | "digitalInvitation") => {
    setSavingMessage(true);
    try {
      const body = type === "saveTheDate" ? { saveTheDateMessage } : { invitationMessage };
      const r = await authedFetch("/api/profile/invitation-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to save");
      toast({ title: "Message saved" });
    } catch {
      toast({ title: "Failed to save message", variant: "destructive" });
    } finally {
      setSavingMessage(false);
    }
  };

  // ── Reset colors to brand defaults ───────────────────────────────────────
  const BRAND_PALETTE: ColorPalette = AIDO_INVITATION_PALETTE;
  const handleResetToDefault = useCallback(() => {
    setPrimaryColor(AIDO_BRAND_COLORS.burgundy);
    setAutoGeneratedPalette(BRAND_PALETTE);
    setCustomColors(null);
    setSelectedPalette(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Build save payload ────────────────────────────────────────────────────
  const buildPayload = (
    stdPhotoUrl = saveTheDatePhotoUrl,
    digPhotoUrl = digitalInvitationPhotoUrl,
    customDesignOverride?: CustomDesignState,
  ) => {
    const d = customDesignOverride ?? customDesign;
    // Also store per-invitation accents inside customColors JSONB as a backup
    // so the send modal can show independent accents even when the dedicated
    // DB columns are null (e.g. before migration runs on first deploy).
    const enhancedCustomColors = {
      ...(customColors ?? {}),
      saveTheDateAccent: d.saveTheDate.accentColor,
      digitalInvitationAccent: d.rsvpInvitation.accentColor,
      saveTheDatePhotoEffect,
      digitalInvitationPhotoEffect,
      saveTheDatePhotoZoom,
      digitalInvitationPhotoZoom,
      rsvpAskHotel: false,
      rsvpHotelBlockId: null,
      saveTheDateShowHotel,
      saveTheDateHotelBlockId: saveTheDateHotelBlockId === "all" ? "all" : Number(saveTheDateHotelBlockId),
      rsvpMealOptions: normalizeMealOptions(rsvpMealOptions),
    };
    return {
      profileId,
      primaryColor,
      colorPalette: autoGeneratedPalette,
      customColors: enhancedCustomColors,
      selectedPalette,
      saveTheDatePhotoUrl: stdPhotoUrl,
      digitalInvitationPhotoUrl: digPhotoUrl,
      saveTheDatePhotoPosition,
      digitalInvitationPhotoPosition,
      backgroundImageUrl,
      useGeneratedInvitation: false,
      saveTheDateBackground: d.saveTheDate.backgroundColor,
      digitalInvitationBackground: d.rsvpInvitation.backgroundColor,
      saveTheDateFont: d.saveTheDate.fontFamily,
      digitalInvitationFont: d.rsvpInvitation.fontFamily,
      saveTheDateFontColor: d.saveTheDate.fontColor,
      digitalInvitationFontColor: d.rsvpInvitation.fontColor,
      saveTheDateFontSize: d.saveTheDate.fontSize,
      digitalInvitationFontSize: d.rsvpInvitation.fontSize,
      // Per-invitation accent colors — independent of each other and of the
      // legacy shared customColors.accent.
      saveTheDateAccentColor: d.saveTheDate.accentColor,
      digitalInvitationAccentColor: d.rsvpInvitation.accentColor,
      selectedLayout: "classic",
      saveTheDateLayout: "classic",
      digitalInvitationLayout: "classic",
      // Couple-set RSVP deadline; null clears a previously-saved value.
      rsvpByDate: rsvpByDate || null,
    };
  };

  // ── Load Google Font when a custom font is selected ──────────────────────
  useEffect(() => {
    const fonts = new Set([
      customDesign.saveTheDate.fontFamily,
      customDesign.rsvpInvitation.fontFamily,
    ]);
    fonts.forEach((family) => {
      if (!family) return;
      const id = `gfont-${family.replace(/\s+/g, "-")}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`;
      document.head.appendChild(link);
    });
  }, [customDesign.saveTheDate.fontFamily, customDesign.rsvpInvitation.fontFamily]);

  // ── Auto-save (debounced 1s, skip initial load) ───────────────────────────
  useEffect(() => {
    if (!profileId) return;
    if (skipNextAutoSave.current) {
      skipNextAutoSave.current = false;
      return;
    }
    if (saveTheDatePhotoUrl?.startsWith("blob:")) return;
    if (digitalInvitationPhotoUrl?.startsWith("blob:")) return;

    const timer = setTimeout(async () => {
      try {
        const payload = buildPayload();
        const r = await authedFetch("/api/invitation-customizations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const error = await r.json().catch(() => ({ error: "Unknown error" }));
          console.error("Auto-save failed:", error);
          return;
        }
        queryClient.setQueryData(
          ["invitation-customizations", profileId],
          (old: InvitationCustomization | null | undefined) =>
            old ? { ...old, ...payload } : old,
        );
      } catch (error) {
        console.error("Auto-save error:", error);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    profileId,
    primaryColor,
    autoGeneratedPalette,
    customColors,
    selectedPalette,
    saveTheDatePhotoUrl,
    saveTheDatePhotoPosition,
    saveTheDatePhotoZoom,
    digitalInvitationPhotoUrl,
    digitalInvitationPhotoPosition,
    digitalInvitationPhotoZoom,
    saveTheDatePhotoEffect,
    digitalInvitationPhotoEffect,
    backgroundImageUrl,
    customDesign,
    rsvpByDate,
    rsvpAskHotel,
    rsvpHotelBlockId,
    saveTheDateShowHotel,
    saveTheDateHotelBlockId,
    rsvpMealOptions,
  ]);

  // Flush any pending position changes to the DB when navigating away so the
  // email always uses the latest photo crop, not a debounce-lagged value.
  useEffect(() => {
    return () => {
      const v = latestValuesRef.current;
      if (!v.profileId) return;
      if (v.saveTheDatePhotoUrl?.startsWith("blob:")) return;
      if (v.digitalInvitationPhotoUrl?.startsWith("blob:")) return;
      const payload = {
        profileId: v.profileId,
        saveTheDatePhotoPosition: v.saveTheDatePhotoPosition,
        digitalInvitationPhotoPosition: v.digitalInvitationPhotoPosition,
        customColors: {
          ...(v.customColors ?? {}),
          saveTheDatePhotoEffect: v.saveTheDatePhotoEffect,
          digitalInvitationPhotoEffect: v.digitalInvitationPhotoEffect,
          rsvpAskHotel: false,
          rsvpHotelBlockId: null,
          saveTheDateShowHotel: v.saveTheDateShowHotel,
          saveTheDateHotelBlockId: v.saveTheDateHotelBlockId === "all" ? "all" : Number(v.saveTheDateHotelBlockId),
          rsvpMealOptions: normalizeMealOptions(v.rsvpMealOptions),
        },
      };
      authFetch("/api/invitation-customizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload }),
      }).catch(() => {});
    };
  }, []);

  const isSTD = previewTab === "saveTheDate";

  useEffect(() => {
    if (isSTD && printSide === "back") {
      setPrintSide("front");
    }
  }, [isSTD, printSide]);

  if (!profileId)
    return <div className="p-4 text-center">Profile not found</div>;

  const defaultWeddingProfile: WeddingProfileData = {
    id: profileId,
    partner1Name: "Partner 1",
    partner2Name: "Partner 2",
    weddingDate: new Date().toISOString(),
    ceremonyTime: "3:00 PM",
    receptionTime: "5:00 PM",
    venue: "TBD",
    location: "TBD",
  };

  const displayWeddingProfile = weddingProfile || defaultWeddingProfile;
  const displayPalette = customColors
    ? { ...autoGeneratedPalette, ...customColors }
    : autoGeneratedPalette;
  const activeCustomStyle = isSTD
    ? customDesign.saveTheDate
    : customDesign.rsvpInvitation;
  const selectedSaveTheDateHotels = saveTheDateShowHotel
    ? saveTheDateHotelBlockId === "all"
      ? hotelBlocks
      : hotelBlocks.filter((hotel) => String(hotel.id) === saveTheDateHotelBlockId)
    : [];
  const activeDesignDocument = buildInvitationDesignDocument({
    kind: previewTab,
    deliveryMode,
    designMode,
    profile: displayWeddingProfile,
    customization,
    message: isSTD
      ? saveTheDateMessage || weddingProfile?.saveTheDateMessage || null
      : invitationMessage || weddingProfile?.invitationMessage || null,
    photoUrl: isSTD ? saveTheDatePhotoUrl : digitalInvitationPhotoUrl,
    photoPosition: isSTD ? saveTheDatePhotoPosition : digitalInvitationPhotoPosition,
    photoZoom: isSTD ? saveTheDatePhotoZoom : digitalInvitationPhotoZoom,
    customStyle: activeCustomStyle,
    rsvpByDate,
    hotelOptions: isSTD ? selectedSaveTheDateHotels : hotelBlocks,
  });
  const websiteUrl =
    websiteRecord?.slug && websiteRecord?.published
      ? publishedWebsiteUrl(websiteRecord.slug, "rsvp")
      : null;
  const websiteLinkPendingMessage = !websiteUrl
    ? "Your wedding website link will be added here automatically once your website is published."
    : null;
  const canUsePrintBack = !isSTD;
  const effectivePrintSide: PrintInvitationSide = canUsePrintBack ? printSide : "front";

  const downloadPrintPdf = async () => {
    setExportingPrintPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const spec = PRINT_SIZES[printSize];
      const pageWidth = printSize === "5x7" ? 5 * 72 : 4 * 72;
      const pageHeight = printSize === "5x7" ? 7 * 72 : 6 * 72;
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: [pageWidth, pageHeight] });
      const bg = pdfRgb(activeDesignDocument.style.backgroundColor, AIDO_BRAND_COLORS.ivory);
      const accent = pdfRgb(activeDesignDocument.style.accentColor, AIDO_BRAND_COLORS.burgundy);
      const text = pdfRgb(activeDesignDocument.style.textColor, "#1f2933");
      const isSaveTheDate = activeDesignDocument.kind === "saveTheDate";
      const locLines = printLocationLines(activeDesignDocument);
      const saveTheDateLocation = [
        activeDesignDocument.fields.venueCity,
        activeDesignDocument.fields.venueState,
      ].filter(Boolean).join(", ");
      const timeLines = [
        activeDesignDocument.fields.ceremonyTime && `Ceremony ${formatPrintTime(activeDesignDocument.fields.ceremonyTime)}`,
        activeDesignDocument.fields.receptionTime && `Reception ${formatPrintTime(activeDesignDocument.fields.receptionTime)}`,
      ].filter((line): line is string => Boolean(line));
      const rsvpDate = formatPrintShortDate(activeDesignDocument.fields.rsvpByDate);

      doc.setFillColor(...bg);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setDrawColor(...accent);
      doc.setLineWidth(1);
      doc.rect(18, 18, pageWidth - 36, pageHeight - 36);
      doc.setLineDashPattern([4, 4], 0);
      doc.setDrawColor(102, 102, 102);
      doc.rect(34, 34, pageWidth - 68, pageHeight - 68);
      doc.setLineDashPattern([], 0);
      doc.setTextColor(...text);
      const logoDataUrl = await loadImageDataUrl("/logo.png");

      if (effectivePrintSide === "front") {
        const aiPrint = activeDesignDocument.designMode === "ai";
        let y = aiPrint ? 72 : 56;
        const photoUrl = resolveMediaUrl(activeDesignDocument.image.url);
        const photoDataUrl = await loadImageDataUrl(photoUrl);

        if (aiPrint) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(...accent);
          doc.text(isSaveTheDate ? "SAVE THE DATE" : "WEDDING RSVP", pageWidth / 2, y, { align: "center" });
          y += 30;

          doc.setFont("times", "italic");
          doc.setFontSize(printSize === "5x7" ? 31 : 27);
          y = addCenteredText(doc, activeDesignDocument.couple, pageWidth / 2, y, pageWidth - 84, 32) + 10;

          if (photoDataUrl) {
            const photoX = 48;
            const photoY = y;
            const photoWidth = pageWidth - 96;
            const photoHeight = isSaveTheDate ? pageHeight * 0.39 : pageHeight * 0.37;
            const coveredPhoto = await coverImageDataUrl(
              photoDataUrl,
              photoWidth * 3,
              photoHeight * 3,
              activeDesignDocument.image.position,
            );
            doc.addImage(coveredPhoto, "JPEG", photoX, photoY, photoWidth, photoHeight);
            y = photoY + photoHeight + 16;
          }

          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.4);
          doc.line(60, y, pageWidth - 60, y);
          y += 18;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...text);
          doc.text(formatPrintDate(activeDesignDocument.fields.weddingDate), pageWidth / 2, y, { align: "center" });
          y += 18;

          if (isSaveTheDate) {
            const cityState = [activeDesignDocument.fields.venueCity, activeDesignDocument.fields.venueState]
              .filter(Boolean)
              .join(", ");
            if (cityState) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9);
              doc.text(cityState, pageWidth / 2, y, { align: "center" });
              y += 16;
            }
          }
        } else if (photoDataUrl) {
          const photoX = 48;
          const photoY = 48;
          const photoWidth = pageWidth - 96;
          const photoHeight = isSaveTheDate ? pageHeight * 0.45 : pageHeight * 0.43;
          const coveredPhoto = await coverImageDataUrl(
            photoDataUrl,
            photoWidth * 3,
            photoHeight * 3,
            activeDesignDocument.image.position,
          );
          doc.addImage(coveredPhoto, "JPEG", photoX, photoY, photoWidth, photoHeight);
          doc.setDrawColor(...accent);
          doc.rect(photoX, photoY, photoWidth, photoHeight);
          y = photoY + photoHeight + (isSaveTheDate ? 26 : 20);
        } else {
          y = pageHeight * 0.2;
        }

        if (!aiPrint) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...accent);
          doc.text(isSaveTheDate ? "SAVE THE DATE" : "THE WEDDING CELEBRATION OF", pageWidth / 2, y, { align: "center" });

          doc.setFont("times", "italic");
          doc.setFontSize(printSize === "5x7" ? 34 : 29);
          y = addCenteredText(doc, activeDesignDocument.couple, pageWidth / 2, y + 36, pageWidth - 84, 36) + 8;

          doc.setDrawColor(...accent);
          doc.line(pageWidth / 2 - 42, y, pageWidth / 2 + 42, y);
          y += 28;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...text);
          doc.text(formatPrintDate(activeDesignDocument.fields.weddingDate), pageWidth / 2, y, { align: "center" });
          y += 26;
        }

        if (isSaveTheDate && saveTheDateLocation) {
          doc.setFont("times", "normal");
          doc.setFontSize(14);
          doc.text(saveTheDateLocation, pageWidth / 2, y, { align: "center", maxWidth: pageWidth - 82 });
          y += 18;
          y += 4;
        }

        if (!isSaveTheDate && (locLines.length > 0 || timeLines.length > 0 || rsvpDate)) {
          const boxX = 52;
          const boxW = pageWidth - 104;
          doc.setDrawColor(...accent);
          doc.setLineWidth(0.8);
          doc.line(boxX, y - 4, boxX + boxW, y - 4);
          y += 13;

          if (activeDesignDocument.fields.venue) {
            doc.setFont("times", "bold");
            doc.setFontSize(16);
            doc.setTextColor(...accent);
            y = addCenteredText(doc, activeDesignDocument.fields.venue, pageWidth / 2, y, boxW - 26, 18) + 2;
          }

          if (activeDesignDocument.fields.venueAddress || locLines[2]) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...text);
            if (activeDesignDocument.fields.venueAddress) {
              doc.text(activeDesignDocument.fields.venueAddress, pageWidth / 2, y, { align: "center", maxWidth: boxW - 30 });
              y += 12;
            }
            if (locLines[2]) {
              doc.text(locLines[2], pageWidth / 2, y, { align: "center", maxWidth: boxW - 30 });
              y += 12;
            }
          }

          if (timeLines.length > 0) {
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...accent);
            doc.text(timeLines.join("   "), pageWidth / 2, y, { align: "center", maxWidth: boxW - 20 });
            y += 17;
          }

          if (rsvpDate) {
            const label = `RSVP BY ${rsvpDate.toUpperCase()}`;
            const labelW = Math.min(boxW - 34, doc.getTextWidth(label) + 22);
            doc.setFillColor(...accent);
            doc.rect(pageWidth / 2 - labelW / 2, y - 10, labelW, 18, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(255, 255, 255);
            doc.text(label, pageWidth / 2, y + 2, { align: "center" });
            y += 18;
          }

          doc.setDrawColor(...accent);
          doc.line(boxX, y + 2, boxX + boxW, y + 2);
          doc.setTextColor(...text);
          y += 10;
        }

        if (activeDesignDocument.message) {
          doc.setFont("times", "italic");
          doc.setFontSize(aiPrint ? 11.5 : 12);
          y = addCenteredText(doc, activeDesignDocument.message, pageWidth / 2, y + 8, pageWidth - 92, 16);
        }

        if (aiPrint && isSaveTheDate) {
          doc.setFont("times", "italic");
          doc.setFontSize(10.5);
          doc.setTextColor(190, 190, 190);
          doc.text("Formal invitation to follow", pageWidth / 2, y + 14, { align: "center" });
        }
      } else {
        let y = pageHeight * 0.2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...accent);
        doc.text("RSVP ONLINE", pageWidth / 2, y, { align: "center" });
        y += 34;

        doc.setFont("times", "italic");
        doc.setFontSize(26);
        doc.setTextColor(...text);
        y = addCenteredText(doc, "We hope to celebrate with you", pageWidth / 2, y, pageWidth - 82, 30) + 10;

        if (includePrintQr && websiteUrl) {
          const qrDataUrl = await qrPngDataUrl(websiteUrl);
          if (qrDataUrl) {
            const qrSize = 150;
            const qrX = pageWidth / 2 - qrSize / 2;
            doc.setFillColor(255, 255, 255);
            doc.rect(qrX - 8, y, qrSize + 16, qrSize + 16, "F");
            doc.setDrawColor(...accent);
            doc.rect(qrX - 8, y, qrSize + 16, qrSize + 16);
            doc.addImage(qrDataUrl, "PNG", qrX, y + 8, qrSize, qrSize);
            y += qrSize + 40;
          }
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...text);
        y = addCenteredText(
          doc,
          websiteUrl ? "Use the link below to RSVP and see wedding details." : "Publish your wedding website to turn this into a live RSVP link.",
          pageWidth / 2,
          y,
          pageWidth - 88,
          13,
        ) + 12;

        if (websiteUrl) {
          doc.setTextColor(...accent);
          doc.setFontSize(8);
          y = addCenteredText(doc, websiteUrl, pageWidth / 2, y, pageWidth - 82, 11) + 18;
        } else if (includePrintQr) {
          doc.setTextColor(...text);
          doc.setFontSize(8);
          y = addCenteredText(
            doc,
            "Publish your wedding website to automatically add a scannable RSVP QR code.",
            pageWidth / 2,
            y,
            pageWidth - 100,
            11,
          ) + 18;
        }

        doc.setTextColor(...text);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(formatPrintDate(activeDesignDocument.fields.weddingDate), pageWidth / 2, y, { align: "center" });
        y += 18;
        for (const line of locLines) {
          doc.text(line, pageWidth / 2, y, { align: "center", maxWidth: pageWidth - 82 });
          y += 13;
        }
      }

      drawInvitationMarketingFooter(doc, pageWidth, pageHeight, accent, text, logoDataUrl);

      const safeCouple = activeDesignDocument.couple.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "wedding";
      doc.save(`${safeCouple}_${activeDesignDocument.kind}_${spec.label.replace(/\s+/g, "")}_${effectivePrintSide}.pdf`);
    } catch (error) {
      console.error("Print PDF export failed", error);
      toast({
        title: "Could not export PDF",
        description: error instanceof Error ? error.message : "Please try again after the print preview finishes loading.",
        variant: "destructive",
      });
    } finally {
      setExportingPrintPdf(false);
    }
  };

  const selectPreviewTab = (tab: PreviewTab) => {
    setPreviewTab(tab);
    setShowRsvpFlowPreview(false);
    setPreviewRefreshNonce((current) => current + 1);
  };

  const selectDeliveryMode = (mode: InvitationDeliveryMode) => {
    setDeliveryMode(mode);
    setShowRsvpFlowPreview(false);
    setPreviewRefreshNonce((current) => current + 1);
  };

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    if (!testRecipientEmail && email) {
      setTestRecipientEmail(email);
    }
  }, [testRecipientEmail, user?.primaryEmailAddress?.emailAddress]);

  const sendTestInvitation = () => {
    const email = testRecipientEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Enter a valid email",
        description: "Add the email address that should receive the test invitation.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Test invitation sent",
      description: `${isSTD ? "Save the Date" : "RSVP invitation"} test sent to ${email}.`,
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold">
          Invitation Studio
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Design your invitation, then send it from the guest list or export a print version.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.35fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Invitation</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={previewTab === "saveTheDate" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => selectPreviewTab("saveTheDate")}
              >
                <Calendar className="h-4 w-4" />
                Save Date
              </Button>
              <Button
                type="button"
                variant={previewTab === "digitalInvitation" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => selectPreviewTab("digitalInvitation")}
              >
                <Heart className="h-4 w-4" />
                RSVP
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Send Type</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={deliveryMode === "digital" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => selectDeliveryMode("digital")}
              >
                <Mail className="h-4 w-4" />
                Digital
              </Button>
              <Button
                type="button"
                variant={deliveryMode === "print" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => selectDeliveryMode("print")}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Send Test Invitation</p>
            <div className="mt-2 flex gap-2">
              <Input
                type="email"
                value={testRecipientEmail}
                onChange={(event) => setTestRecipientEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-9 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                onClick={sendTestInvitation}
              >
                <Send className="h-4 w-4" />
                Send Test
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Finish</p>
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full gap-2"
              onClick={
                deliveryMode === "digital"
                  ? () => onOpenGuestList?.(previewTab)
                  : downloadPrintPdf
              }
              disabled={deliveryMode === "digital" ? !onOpenGuestList : exportingPrintPdf}
            >
              {deliveryMode === "digital" ? (
                <>
                  <Send className="h-4 w-4" />
                  Send From Guest List
                </>
              ) : (
                <>
                  {exportingPrintPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Download Print PDF
                </>
              )}
            </Button>
          </div>
        </div>

        {deliveryMode === "digital" && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                  Send test invitation
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send this {isSTD ? "Save the Date" : "RSVP invitation"} preview to any email before sending from the guest list.
                </p>
                <Input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(event) => setTestRecipientEmail(event.target.value)}
                  placeholder="Enter test recipient email"
                  className="mt-3 h-10 bg-background"
                />
              </div>
              <Button
                type="button"
                className="gap-2 sm:w-auto"
                onClick={sendTestInvitation}
              >
                <Send className="h-4 w-4" />
                Send test invitation
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-1 space-y-4 lg:max-h-[90vh] lg:overflow-y-auto">
          {deliveryMode === "print" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Printer className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Print Settings</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Physical invitations use a print layout separate from the digital email.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Print size</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["5x7", "4x6"] as PrintInvitationSize[]).map((size) => (
                      <Button
                        key={size}
                        type="button"
                        size="sm"
                        variant={printSize === size ? "default" : "outline"}
                        onClick={() => setPrintSize(size)}
                      >
                        {PRINT_SIZES[size].label}
                      </Button>
                    ))}
                  </div>
                </div>
                {canUsePrintBack ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Side</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["front", "back"] as PrintInvitationSide[]).map((side) => (
                          <Button
                            key={side}
                            type="button"
                            size="sm"
                            variant={printSide === side ? "default" : "outline"}
                            onClick={() => setPrintSide(side)}
                            className="capitalize"
                          >
                            {side}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      <span>Show RSVP code area on back</span>
                      <input
                        type="checkbox"
                        checked={includePrintQr}
                        onChange={(event) => setIncludePrintQr(event.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      When your wedding website is published, this back side will
                      automatically include a scannable QR code for guests to RSVP.
                      Until then, the preview shows a publish-first note.
                    </p>
                  </>
                ) : (
                  <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                    Save-the-Dates are front-only announcements. RSVP links and QR codes are only added to RSVP invitations.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Photo */}
          <PhotoUploadSection
            mode={previewTab}
            onSaveTheDatePhotoChange={handleSaveTheDatePhotoSelected}
            onDigitalInvitationPhotoChange={handleDigitalInvitationPhotoSelected}
            saveTheDatePreviewUrl={saveTheDatePhotoUrl}
            digitalInvitationPreviewUrl={digitalInvitationPhotoUrl}
            isLoading={uploadPhotoMutation.isPending || saveCustomizationsMutation.isPending}
            isUploadingPhoto={uploadPhotoMutation.isPending}
            isSavingPhoto={saveCustomizationsMutation.isPending}
            onSavePhoto={() => saveCustomizationsMutation.mutate()}
            saveTheDatePhotoPosition={saveTheDatePhotoPosition}
            onSaveTheDatePositionChange={setSaveTheDatePhotoPosition}
            saveTheDatePhotoZoom={saveTheDatePhotoZoom}
            onSaveTheDateZoomChange={setSaveTheDatePhotoZoom}
            digitalInvitationPhotoPosition={digitalInvitationPhotoPosition}
            onDigitalInvitationPositionChange={setDigitalInvitationPhotoPosition}
            digitalInvitationPhotoZoom={digitalInvitationPhotoZoom}
            onDigitalInvitationZoomChange={setDigitalInvitationPhotoZoom}
            saveTheDatePhotoEffect={saveTheDatePhotoEffect}
            onSaveTheDatePhotoEffectChange={setSaveTheDatePhotoEffect}
            digitalInvitationPhotoEffect={digitalInvitationPhotoEffect}
            onDigitalInvitationPhotoEffectChange={setDigitalInvitationPhotoEffect}
          />

          {/* Message */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">
                {isSTD ? "Save the Date Message" : "Invitation Message"}
              </p>
              <Textarea
                placeholder={
                  isSTD
                    ? "e.g. Mark your calendar! We're getting married…"
                    : "e.g. Together with their families, we joyfully invite you…"
                }
                value={isSTD ? saveTheDateMessage : invitationMessage}
                onChange={(e) =>
                  isSTD
                    ? setSaveTheDateMessage(e.target.value)
                    : setInvitationMessage(e.target.value)
                }
                rows={4}
                maxLength={400}
                className="resize-none text-sm"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    const couple = [
                      displayWeddingProfile.partner2Name,
                      displayWeddingProfile.partner1Name,
                    ]
                      .filter(Boolean)
                      .join(" & ");
                    if (isSTD) {
                      setSaveTheDateMessage(
                        couple
                          ? `Mark your calendar! ${couple} are getting married and we'd love to celebrate with you. Formal invitation to follow.`
                          : "Mark your calendar! We're getting married and we'd love to celebrate with you. Formal invitation to follow.",
                      );
                    } else {
                      setInvitationMessage(
                        couple
                          ? `Together with their families, ${couple} joyfully invite you to celebrate their wedding day with them.`
                          : "Together with their families, we joyfully invite you to celebrate our wedding day with us.",
                      );
                    }
                  }}
                >
                  <RefreshCw className="inline h-3 w-3 mr-1" />
                  Reset to template
                </button>
                <p className="text-xs text-muted-foreground">
                  {(isSTD ? saveTheDateMessage : invitationMessage).length}/400
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={() => saveMessage(isSTD ? "saveTheDate" : "digitalInvitation")}
                disabled={savingMessage}
              >
                {savingMessage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {savingMessage ? "Saving…" : "Save Message"}
              </Button>
            </CardContent>
          </Card>

          {/* RSVP By date — only meaningful for the RSVP invitation, so hide it
              when the user is editing the Save the Date. Autosaves through the
              same debounced effect as the rest of this tab. */}
          {isSTD && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Hotel className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Hotel Block</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Add hotel booking details to the Save the Date preview and guest link.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={saveTheDateShowHotel}
                        onChange={(event) => setSaveTheDateShowHotel(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        aria-label="Show hotel block on save the date"
                      />
                    </div>
                  </div>
                </div>

                {saveTheDateShowHotel && (
                  <div className="space-y-2">
                    {hotelBlocks.length > 0 ? (
                      <>
                        <label className="block text-xs space-y-1">
                          <span className="text-muted-foreground">Hotel shown</span>
                          <select
                            value={saveTheDateHotelBlockId}
                            onChange={(event) => setSaveTheDateHotelBlockId(event.target.value)}
                            className="block h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="all">Show all hotel blocks</option>
                            {hotelBlocks.map((hotel) => (
                              <option key={hotel.id} value={String(hotel.id)}>
                                {hotel.hotelName || "Unnamed Hotel"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                          {selectedSaveTheDateHotels[0]?.hotelName || "Hotel block"} will appear in the preview below.
                          {selectedSaveTheDateHotels.length > 1 ? ` Guests can see ${selectedSaveTheDateHotels.length} hotel options.` : ""}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                        Add a hotel block in Hotels first, then come back here to show it on the Save the Date.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!isSTD && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="rsvpByDate" className="text-sm font-medium block">
                    RSVP By
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Date you want guests to RSVP by. Shown as "RSVP By: (Date)" on the invitation preview, email, and the public RSVP page.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="rsvpByDate"
                      type="date"
                      value={rsvpByDate}
                      onChange={(e) => setRsvpByDate(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {rsvpByDate && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs h-9 px-2"
                        onClick={() => setRsvpByDate("")}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Meal choices</p>
                    <p className="text-xs text-muted-foreground">
                      These options appear in the RSVP form for guests and plus-ones.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {rsvpMealOptions.map((option, index) => (
                      <div key={option.value} className="flex items-center gap-2">
                        <Input
                          value={option.label}
                          onChange={(event) => {
                            const label = event.target.value;
                            setRsvpMealOptions((options) =>
                              options.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label } : item,
                              ),
                            );
                          }}
                          className="h-9 text-sm"
                          aria-label={`Meal choice ${index + 1}`}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 shrink-0"
                          onClick={() =>
                            setRsvpMealOptions((options) =>
                              options.length > 1 ? options.filter((_, itemIndex) => itemIndex !== index) : options,
                            )
                          }
                          disabled={rsvpMealOptions.length <= 1}
                          aria-label={`Remove ${option.label || "meal choice"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={newMealOption}
                      onChange={(event) => setNewMealOption(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const label = newMealOption.trim();
                        if (!label) return;
                        setRsvpMealOptions((options) => [
                          ...options,
                          { value: optionValueFromLabel(label, options), label },
                        ]);
                        setNewMealOption("");
                      }}
                      placeholder="Add meal choice"
                      className="h-9 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 gap-2 shrink-0"
                      onClick={() => {
                        const label = newMealOption.trim();
                        if (!label) return;
                        setRsvpMealOptions((options) => [
                          ...options,
                          { value: optionValueFromLabel(label, options), label },
                        ]);
                        setNewMealOption("");
                      }}
                      disabled={!newMealOption.trim() || rsvpMealOptions.length >= 12}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => setRsvpMealOptions(DEFAULT_RSVP_MEAL_OPTIONS)}
                  >
                    Reset meal choices
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Custom Design controls — only render when this invitation's mode is "custom". */}
          {(() => {
            const activeKey: InvitationDesignKey =
              previewTab === "saveTheDate" ? "saveTheDate" : "rsvpInvitation";
            const fields = customDesign[activeKey];
            const updateField = (field: keyof typeof fields, value: string) => {
              updateCustomDesignField(activeKey, field, value);
            };
            const isThemeActive = (themeId: string) => {
              const t = WEBSITE_THEMES.find((x) => x.id === themeId);
              if (!t) return false;
              return (
                fields.backgroundColor.toLowerCase() === t.background.toLowerCase() &&
                fields.accentColor.toLowerCase() === t.primary.toLowerCase() &&
                fields.fontColor.toLowerCase() === t.text.toLowerCase() &&
                fields.fontFamily === t.font
              );
            };
            return (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Custom Design</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={() => undoCustomDesign(activeKey)}
                      disabled={customDesignUndoCounts[activeKey] === 0}
                      title={`Undo last ${isSTD ? "Save the Date" : "RSVP Invitation"} custom design change`}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Undo
                    </Button>
                  </div>

                  {/* Theme presets — same swatches as the website editor.
                      Clicking one populates the colour + font fields below
                      so the Save the Date / RSVP invitation can match the
                      wedding website at a tap. */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Quick themes (same as the website editor)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {WEBSITE_THEMES.map((theme) => {
                        const active = isThemeActive(theme.id);
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => {
                              const newCustomDesign = {
                                ...customDesign,
                                [activeKey]: {
                                  ...customDesign[activeKey],
                                  backgroundColor: theme.background,
                                  accentColor: theme.primary,
                                  fontColor: theme.text,
                                  fontFamily: theme.font,
                                },
                              };
                              setCustomDesignForKey(activeKey, newCustomDesign[activeKey]);
                              skipNextAutoSave.current = true;
                              const payload = buildPayload(undefined, undefined, newCustomDesign);
                              // Update the query cache optimistically so the theme
                              // persists if the user navigates away and back before
                              // the API response completes.
                              queryClient.setQueryData(
                                ["invitation-customizations", profileId],
                                (old: InvitationCustomization | null | undefined) =>
                                  old ? { ...old, ...payload } : old,
                              );
                              authedFetch("/api/invitation-customizations", {
                                method: "POST",
                                body: JSON.stringify(payload),
                              }).catch(() => {});
                            }}
                            className={`text-left p-2 rounded-md border transition-all ${
                              active
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex gap-1 mb-1.5">
                              <div className="w-3.5 h-3.5 rounded-full" style={{ background: theme.primary }} />
                              <div className="w-3.5 h-3.5 rounded-full" style={{ background: theme.secondary }} />
                              <div className="w-3.5 h-3.5 rounded-full" style={{ background: theme.neutral }} />
                            </div>
                            <div className="text-[11px] font-medium leading-tight">{theme.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom palette — three colour codes combine into a
                      Quick-Theme-style palette. The first sets the card,
                      the second the accent (couple name + dividers), and
                      the third the body text. We don't label each swatch
                      individually so the row reads as one unit, matching
                      the Quick Theme cards above. */}
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Your palette</div>
                    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20">
                      <label className="flex-1 cursor-pointer">
                        <span className="sr-only">Card colour</span>
                        <input
                          type="color"
                          value={fields.backgroundColor}
                          onChange={(e) => updateField("backgroundColor", e.target.value)}
                          className="block h-9 w-full rounded border border-input cursor-pointer"
                        />
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <span className="sr-only">Accent colour</span>
                        <input
                          type="color"
                          value={fields.accentColor}
                          onChange={(e) => updateField("accentColor", e.target.value)}
                          className="block h-9 w-full rounded border border-input cursor-pointer"
                        />
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <span className="sr-only">Text colour</span>
                        <input
                          type="color"
                          value={fields.fontColor}
                          onChange={(e) => updateField("fontColor", e.target.value)}
                          className="block h-9 w-full rounded border border-input cursor-pointer"
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Pick three colours — they style the card, the accent (couple name &amp; dividers), and the body text.
                    </p>
                  </div>

                  <label className="block text-xs space-y-1">
                    <span className="text-muted-foreground">Font size (px)</span>
                    <input
                      type="number"
                      min={8}
                      max={72}
                      value={fields.fontSize}
                      onChange={(e) => updateField("fontSize", e.target.value)}
                      className="block h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-muted-foreground">Font family</span>
                    <select
                      value={fields.fontFamily}
                      onChange={(e) => updateField("fontFamily", e.target.value)}
                      className="block h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="Playfair Display">Playfair Display</option>
                      <option value="Cormorant Garamond">Cormorant Garamond</option>
                      <option value="Lora">Lora</option>
                      <option value="Cinzel">Cinzel</option>
                      <option value="Great Vibes">Great Vibes</option>
                      <option value="Tangerine">Tangerine</option>
                      <option value="Inter">Inter</option>
                      <option value="Montserrat">Montserrat</option>
                    </select>
                  </label>
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Right Panel — Preview */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col lg:h-[90vh]">
            <div className="border-b p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Preview</p>
                  <p className="text-sm font-medium">
                    {activeDesignDocument.title} / {deliveryMode === "digital" ? "Digital" : "Print"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {deliveryMode === "print" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={downloadPrintPdf}
                      disabled={exportingPrintPdf}
                    >
                      {exportingPrintPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                      PDF
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div ref={previewContainerRef} className="flex-1 overflow-auto p-3 sm:p-4">
              {deliveryMode === "print" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-2.5 py-1">{PRINT_SIZES[printSize].label}</span>
                    <span className="rounded-full border px-2.5 py-1 capitalize">{effectivePrintSide}</span>
                    <span className="rounded-full border px-2.5 py-1">Safe margin visible</span>
                    {isSTD && (
                      <span className="rounded-full border px-2.5 py-1">No RSVP or QR</span>
                    )}
                  </div>
                  <PrintInvitationPreview
                    ref={printPreviewRef}
                    design={activeDesignDocument}
                    size={printSize}
                    side={effectivePrintSide}
                    includeQr={canUsePrintBack && includePrintQr}
                    websiteUrl={websiteUrl}
                  />
                </div>
              ) : (
              (() => {
                // Same AI layout in both modes. In "custom" mode we only swap
                // colors/font/size by feeding the existing palette/font/backgroundColor
                // props and wrapping in a styled div for inheritable typography.
                const activeMode = designMode;
                const cd = isSTD ? customDesign.saveTheDate : customDesign.rsvpInvitation;
                const isCustom = activeMode === "custom";
                const customPalette = isCustom
                  ? { ...displayPalette, primary: cd.accentColor, secondary: cd.accentColor, accent: cd.accentColor }
                  : displayPalette;
                // Build the CustomColors object so the card shell (bg, dots,
                // borders) actually picks up the chosen theme colors instead
                // of always rendering the hardcoded dark-navy defaults.
                const previewCustomColors = isCustom
                  ? {
                      bg: cd.backgroundColor,
                      accent: cd.accentColor,
                      text: cd.fontColor,
                      muted: cd.fontColor + "99",
                      cardBdr: cd.accentColor + "33",
                      font: cd.fontFamily,
                      fontSize: cd.fontSize,
                    }
                  : undefined;
                const activeInvitationLayout = "classic";
                const previewRefreshKey = `${previewTab}-${deliveryMode}-${designMode}-${activeInvitationLayout}-${previewRefreshNonce}`;
                if (!isSTD && showRsvpFlowPreview) {
                  const flowScale = Math.min(1, Math.max(0.72, ((previewContainerWidth || 430) - 32) / 390));
                  return (
                    <div className="space-y-3">
                      <div className="mx-auto flex max-w-[390px] items-center justify-between gap-3 rounded-lg border bg-card/95 px-3 py-2 text-sm shadow-sm">
                        <div>
                          <p className="font-medium">Guest RSVP flow preview</p>
                          <p className="text-xs text-muted-foreground">This is what opens after a guest clicks RSVP Now.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRsvpFlowPreview(false)}
                        >
                          Back
                        </Button>
                      </div>
                      <RsvpPagePreview
                        colors={isCustom ? customPalette : { ...displayPalette, accent: AIDO_BRAND_COLORS.burgundy, primary: AIDO_BRAND_COLORS.burgundy }}
                        font={isCustom ? cd.fontFamily : null}
                        backgroundColor={isCustom ? cd.backgroundColor : null}
                        fontColor={isCustom ? cd.fontColor : null}
                        fontSize={isCustom ? cd.fontSize : null}
                        coupleColor={isCustom ? undefined : AIDO_BRAND_COLORS.burgundy}
                        partner1Name={displayWeddingProfile.partner1Name}
                        partner2Name={displayWeddingProfile.partner2Name}
                        weddingDate={displayWeddingProfile.weddingDate}
                        venue={displayWeddingProfile.venue}
                        venueAddress={displayWeddingProfile.location}
                        venueCity={displayWeddingProfile.venueCity}
                        venueState={displayWeddingProfile.venueState}
                        venueZip={displayWeddingProfile.venueZip}
                        ceremonyTime={displayWeddingProfile.ceremonyTime}
                        receptionTime={displayWeddingProfile.receptionTime}
                        invitationMessage={invitationMessage || weddingProfile?.invitationMessage}
                        photoUrl={digitalInvitationPhotoUrl}
                        photoPosition={digitalInvitationPhotoPosition}
                        onPhotoPositionChange={setDigitalInvitationPhotoPosition}
                        hotelOptions={[]}
                        selectedHotelBlockId="all"
                        askHotel={false}
                        mealOptions={normalizeMealOptions(rsvpMealOptions)}
                        scale={flowScale}
                      />
                    </div>
                  );
                }
                return (
                  <AnimatedInvitationShell
                    key={previewRefreshKey}
                    layout={activeInvitationLayout}
                    accent={cd.accentColor}
                    paper={isCustom ? cd.backgroundColor : undefined}
                    darkPanel={isCustom ? cd.accentColor : undefined}
                    replayKey={previewRefreshKey}
                    monogram={`${displayWeddingProfile.partner2Name || ""} ${displayWeddingProfile.partner1Name || ""}`}
                  >
                    {isSTD ? (
                      <AiSaveDatePreview
                        profile={{
                          partner1Name: displayWeddingProfile.partner1Name,
                          partner2Name: displayWeddingProfile.partner2Name,
                          weddingDate: displayWeddingProfile.weddingDate,
                          venue: displayWeddingProfile.venue,
                          venueCity: displayWeddingProfile.venueCity,
                          venueState: displayWeddingProfile.venueState,
                          venueZip: displayWeddingProfile.venueZip,
                          ceremonyTime: displayWeddingProfile.ceremonyTime,
                          receptionTime: displayWeddingProfile.receptionTime,
                          saveTheDateMessage: saveTheDateMessage || weddingProfile?.saveTheDateMessage,
                        }}
                        palette={customPalette}
                        photoUrl={saveTheDatePhotoUrl}
                        photoPosition={saveTheDatePhotoPosition}
                        photoZoom={saveTheDatePhotoZoom}
                        onPhotoPositionChange={setSaveTheDatePhotoPosition}
                        customColors={previewCustomColors}
                        fullPhoto={false}
                        photoEffect={saveTheDatePhotoEffect}
                        hotelOptions={selectedSaveTheDateHotels}
                      />
                    ) : (
                      <AiDigitalInvitationPreview
                        profile={{
                          partner1Name: displayWeddingProfile.partner1Name,
                          partner2Name: displayWeddingProfile.partner2Name,
                          weddingDate: displayWeddingProfile.weddingDate,
                          venue: displayWeddingProfile.venue,
                          venueAddress: displayWeddingProfile.location,
                          venueCity: displayWeddingProfile.venueCity,
                          venueState: displayWeddingProfile.venueState,
                          venueZip: displayWeddingProfile.venueZip,
                          ceremonyTime: displayWeddingProfile.ceremonyTime,
                          receptionTime: displayWeddingProfile.receptionTime,
                          invitationMessage: invitationMessage || weddingProfile?.invitationMessage,
                          rsvpByDate,
                          websiteUrl,
                          websiteLinkPendingMessage,
                        }}
                        palette={isCustom ? customPalette : { ...displayPalette, accent: AIDO_BRAND_COLORS.burgundy, primary: AIDO_BRAND_COLORS.burgundy }}
                        photoUrl={digitalInvitationPhotoUrl}
                        photoPosition={digitalInvitationPhotoPosition}
                        photoZoom={digitalInvitationPhotoZoom}
                        onPhotoPositionChange={setDigitalInvitationPhotoPosition}
                        customColors={isCustom ? previewCustomColors : undefined}
                        photoEffect={digitalInvitationPhotoEffect}
                        fullPhoto={false}
                        onRsvpClick={() => setShowRsvpFlowPreview(true)}
                      />
                    )}
                  </AnimatedInvitationShell>
                );
              })()
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
