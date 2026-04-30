import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ImagePlus,
  Sparkles,
  Trash2,
  GripVertical,
  Wand2,
  Palette,
  X,
  Plus,
  Loader2,
  RefreshCw,
  Tag,
  StickyNote,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageAnalysis {
  styleKeywords: string[];
  dominantColors: string[];
  decorThemes: string[];
  floralStyle?: string;
  venueVibe?: string;
}

interface MoodBoardImage {
  objectPath: string;
  order: number;
  name?: string;
  analysis?: ImageAnalysis;
}

interface ColorSwatch {
  hex: string;
  name: string;
}

interface MoodBoardData {
  images: MoodBoardImage[];
  colorPalette: ColorSwatch[];
  styleTags: string[];
  aiSummary: string | null;
  notes: string | null;
}

// ─── Preset style tags ────────────────────────────────────────────────────────

const PRESET_TAGS = [
  "Romantic", "Rustic", "Modern", "Glam", "Boho",
  "Minimalist", "Vintage", "Garden", "Coastal", "Industrial",
  "Ethereal", "Whimsical", "Classic", "Tropical", "Autumn",
];

// ─── Auth headers helper ──────────────────────────────────────────────────────

async function authFetch(url: string, options: RequestInit = {}, getToken: () => Promise<string | null>) {
  const token = await getToken();
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

// ─── Storage URL helper ──────────────────────────────────────────────────────

function objectUrl(objectPath: string) {
  return `/api/storage/objects/${objectPath.replace(/^\/objects\//, "")}`;
}

// ─── Authenticated image loader ───────────────────────────────────────────────
// The storage route requires a Bearer token; <img> tags can't send one.
// This component fetches the image with the Clerk token and renders it from a
// local blob URL, bypassing the auth issue for both new and saved images.

const AuthImage = memo(function AuthImage({
  objectPath,
  blobUrl,
  alt,
  className,
}: {
  objectPath: string;
  blobUrl?: string;
  alt: string;
  className?: string;
}) {
  const { getToken } = useAuth();
  const [src, setSrc] = useState<string | null>(blobUrl ?? null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (blobUrl) {
      setSrc(blobUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(objectUrl(objectPath), {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setSrc(url);
      } catch {
        // silently fail — broken image placeholder shown
      }
    })();
    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [objectPath, blobUrl, getToken]);

  if (!src) {
    return <div className={cn("bg-muted animate-pulse", className)} />;
  }
  return <img src={src} alt={alt} className={className} />;
});

// ─── Sortable Image Card ──────────────────────────────────────────────────────

function SortableImageCard({
  image,
  blobUrl,
  onDelete,
  onAnalyze,
  analyzing,
}: {
  image: MoodBoardImage;
  blobUrl?: string;
  onDelete: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.objectPath,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl overflow-hidden bg-muted aspect-square shadow-sm border border-border/50",
        isDragging && "shadow-2xl ring-2 ring-primary/40",
      )}
    >
      <AuthImage
        objectPath={image.objectPath}
        blobUrl={blobUrl}
        alt="Mood board image"
        className="w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200" />

      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={onDelete}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70"
        title="Remove image"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {!image.analysis && (
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-primary/85 text-primary-foreground text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
          title="Analyze with AI"
        >
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
      )}

      {image.analysis && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex flex-wrap gap-0.5">
            {image.analysis.styleKeywords.slice(0, 3).map(k => (
              <span key={k} className="text-[9px] font-medium text-white/90 bg-white/20 rounded-full px-1.5 py-0.5">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MoodBoard() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyzingPath, setAnalyzingPath] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [savePending, setSavePending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [localBoard, setLocalBoard] = useState<MoodBoardData | null>(null);
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const urls = blobUrls;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  // ─── Upload hook ──────────────────────────────────────────────────────────
  const { uploadFile, isUploading } = useUpload({
    getToken,
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  // ─── Fetch mood board ─────────────────────────────────────────────────────
  const { data: serverBoard, isLoading } = useQuery<MoodBoardData>({
    queryKey: ["mood-board"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch("/api/mood-board", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  useEffect(() => {
    if (serverBoard && !localBoard) setLocalBoard(serverBoard);
  }, [serverBoard]);

  const board = localBoard ?? serverBoard ?? {
    images: [], colorPalette: [], styleTags: [], aiSummary: null, notes: null,
  };

  // ─── Save helper (debounced) ──────────────────────────────────────────────
  const save = useCallback(async (data: MoodBoardData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSavePending(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const token = await getToken();
        await fetch("/api/mood-board", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(data),
        });
        qc.invalidateQueries({ queryKey: ["mood-board"] });
      } finally {
        setSavePending(false);
      }
    }, 1000);
  }, [getToken, qc]);

  const update = useCallback((patch: Partial<MoodBoardData>) => {
    setLocalBoard(prev => {
      const next = { ...board, ...prev, ...patch };
      save(next);
      return next;
    });
  }, [board, save]);

  // ─── Upload images ────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const uploads = await Promise.all(
      files.map(f => uploadFile(f))
    );

    const successful = uploads
      .map((r, i) => ({ result: r, file: files[i] }))
      .filter(({ result }) => Boolean(result));

    const newImages: MoodBoardImage[] = successful.map(({ result }, i) => ({
      objectPath: result!.objectPath,
      order: board.images.length + i,
      name: successful[i].file?.name,
    }));

    // Create blob URLs for immediate display (no auth round-trip needed)
    setBlobUrls(prev => {
      const next = new Map(prev);
      successful.forEach(({ result, file }) => {
        if (result && file) next.set(result.objectPath, URL.createObjectURL(file));
      });
      return next;
    });

    const updatedImages = [...board.images, ...newImages];
    update({ images: updatedImages });
    e.target.value = "";

    if (newImages.length > 0) {
      toast({ title: `${newImages.length} image${newImages.length > 1 ? "s" : ""} added to your mood board` });
    }
  };

  // ─── Drag-and-drop reorder ────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = board.images.findIndex(img => img.objectPath === active.id);
    const newIndex = board.images.findIndex(img => img.objectPath === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(board.images, oldIndex, newIndex).map((img, i) => ({
      ...img, order: i,
    }));
    update({ images: reordered });
  };

  // ─── Remove image ─────────────────────────────────────────────────────────
  const removeImage = (objectPath: string) => {
    const updated = board.images
      .filter(img => img.objectPath !== objectPath)
      .map((img, i) => ({ ...img, order: i }));
    update({ images: updated });
  };

  // ─── Analyze single image ─────────────────────────────────────────────────
  const analyzeImage = async (objectPath: string) => {
    setAnalyzingPath(objectPath);
    try {
      const r = await authFetch("/api/mood-board/analyze-image", {
        method: "POST",
        body: JSON.stringify({ objectPath }),
      }, getToken);
      if (!r.ok) throw new Error("Analysis failed");
      const { analysis } = await r.json() as { analysis: ImageAnalysis };

      const updatedImages = board.images.map(img =>
        img.objectPath === objectPath ? { ...img, analysis } : img
      );

      const allColors = updatedImages.flatMap(img => img.analysis?.dominantColors ?? []);
      const palette = buildPalette(allColors, board.colorPalette);
      update({ images: updatedImages, colorPalette: palette });
    } catch {
      toast({ title: "Analysis failed", description: "Could not analyze this image.", variant: "destructive" });
    } finally {
      setAnalyzingPath(null);
    }
  };

  // ─── Analyze all unanalyzed ───────────────────────────────────────────────
  const analyzeAll = async () => {
    const unanalyzed = board.images.filter(img => !img.analysis);
    if (!unanalyzed.length) {
      toast({ title: "All images already analyzed" });
      return;
    }
    for (const img of unanalyzed) {
      await analyzeImage(img.objectPath);
    }
    toast({ title: "Analysis complete" });
  };

  // ─── Generate AI summary ──────────────────────────────────────────────────
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const r = await authFetch("/api/mood-board/generate-summary", {
        method: "POST",
        body: JSON.stringify({
          styleTags: board.styleTags,
          images: board.images,
          colorPalette: board.colorPalette,
        }),
      }, getToken);
      if (!r.ok) throw new Error("Failed");
      return (await r.json() as { summary: string }).summary;
    },
    onSuccess: (summary) => {
      update({ aiSummary: summary });
      toast({ title: "Style summary generated" });
    },
    onError: () => toast({ title: "Could not generate summary", variant: "destructive" }),
  });

  // ─── Style tags ───────────────────────────────────────────────────────────
  const toggleTag = (tag: string) => {
    const tags = board.styleTags.includes(tag)
      ? board.styleTags.filter(t => t !== tag)
      : [...board.styleTags, tag];
    update({ styleTags: tags });
  };

  const addCustomTag = () => {
    const tag = newTag.trim();
    if (!tag || board.styleTags.includes(tag)) { setNewTag(""); return; }
    update({ styleTags: [...board.styleTags, tag] });
    setNewTag("");
  };

  // ─── Color palette ────────────────────────────────────────────────────────
  const renameColor = (index: number, name: string) => {
    const updated = board.colorPalette.map((c, i) => i === index ? { ...c, name } : c);
    update({ colorPalette: updated });
  };

  const removeColor = (index: number) => {
    const updated = board.colorPalette.filter((_, i) => i !== index);
    update({ colorPalette: updated });
  };

  // ─── PDF export ───────────────────────────────────────────────────────────
  const hexToRgb = (hex: string) => {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  };

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

  // Crop a data-URL image to fill (cellW × cellH) without distortion (cover semantics).
  const coverCrop = (dataUrl: string, cellW: number, cellH: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 2; // render at 2× for sharpness
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(cellW * scale);
          canvas.height = Math.round(cellH * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(dataUrl); return; }
          const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
          const drawW = img.naturalWidth * s;
          const drawH = img.naturalHeight * s;
          ctx.drawImage(img, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        } catch { resolve(dataUrl); }
      };
      img.onerror = () => reject(new Error("img load failed"));
      img.src = dataUrl;
    });

  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

      // Fetch couple names from profile
      let partner1 = "";
      let partner2 = "";
      try {
        const profileRes = await authFetch(
          `${import.meta.env.BASE_URL}api/profile`.replace(/\/+/g, "/"),
          {},
          getToken
        );
        if (profileRes.ok) {
          const p = await profileRes.json() as { partner1Name?: string; partner2Name?: string };
          partner1 = p.partner1Name ?? "";
          partner2 = p.partner2Name ?? "";
        }
      } catch { /* fall back to generic title */ }

      // Fetch A.IDO logo for embedding
      let logoDataUrl: string | null = null;
      try {
        const logoRes = await fetch(`${import.meta.env.BASE_URL}logo.png`);
        if (logoRes.ok) logoDataUrl = await blobToDataUrl(await logoRes.blob());
      } catch { /* skip logo if unavailable */ }

      const PAGE_W = 595;
      const PAGE_H = 842;
      const MARGIN = 40;
      const CW = PAGE_W - 2 * MARGIN;

      // ── Portal brand colors (dark theme) ────────────────────────────────────
      // background: hsl(270 20% 10%) ≈ #1a141f
      const [BG_R, BG_G, BG_B] = [26, 20, 31];
      // primary gold: hsl(40 82% 52%) ≈ #e7a620
      const [GD_R, GD_G, GD_B] = [231, 166, 32];
      // foreground near-white: hsl(330 30% 95%) ≈ #f6eef2
      const [WH_R, WH_G, WH_B] = [246, 238, 242];
      // muted text: hsl(330 15% 62%) ≈ #ad909e
      const [MT_R, MT_G, MT_B] = [173, 144, 158];
      // border: hsl(270 15% 20%) ≈ #332b3b
      const [BR_R, BR_G, BR_B] = [51, 43, 59];

      // Fill page background
      const fillBg = () => {
        doc.setFillColor(BG_R, BG_G, BG_B);
        doc.rect(0, 0, PAGE_W, PAGE_H, "F");
      };
      fillBg();

      let y = MARGIN;

      const sectionLabel = (text: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(GD_R, GD_G, GD_B);
        doc.text(text.toUpperCase(), MARGIN, y);
        y += 10;
        doc.setDrawColor(BR_R, BR_G, BR_B);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 14;
      };

      // ── Header ─────────────────────────────────────────────────────────────
      // A.IDO logo — pinned to the very top-right corner of the page
      const LOGO_SIZE = 100;
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", PAGE_W - 10 - LOGO_SIZE, 10, LOGO_SIZE, LOGO_SIZE);
      }

      // Couple names (large, centered)
      const coupleLine = partner1 && partner2
        ? `${partner1} & ${partner2}`
        : "Our Wedding";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(WH_R, WH_G, WH_B);
      doc.text(coupleLine, PAGE_W / 2, y, { align: "center" });
      y += 15;

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(MT_R, MT_G, MT_B);
      doc.text("Wedding Mood Board", PAGE_W / 2, y, { align: "center" });
      y += 18;

      // Gold divider
      doc.setDrawColor(GD_R, GD_G, GD_B);
      doc.setLineWidth(0.8);
      doc.line(PAGE_W / 2 - 50, y, PAGE_W / 2 + 50, y);
      y += 24;

      // ── AI Summary ─────────────────────────────────────────────────────────
      if (board.aiSummary) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10.5);
        doc.setTextColor(MT_R, MT_G, MT_B);
        const lines = doc.splitTextToSize(`"${board.aiSummary}"`, CW);
        doc.text(lines, PAGE_W / 2, y, { align: "center" });
        y += (lines.length as number) * 14 + 24;
      }

      // ── Images grid ────────────────────────────────────────────────────────
      if (board.images.length > 0) {
        sectionLabel("Inspiration Images");

        const COLS = 3;
        const GAP = 7;
        const IMG_W = (CW - GAP * (COLS - 1)) / COLS;
        const IMG_H = Math.round(IMG_W * 0.7);

        for (let i = 0; i < board.images.length; i++) {
          const col = i % COLS;
          if (col === 0 && i > 0) {
            y += IMG_H + GAP;
            if (y + IMG_H > PAGE_H - MARGIN) {
              doc.addPage(); fillBg();
              y = MARGIN;
            }
          }
          const x = MARGIN + col * (IMG_W + GAP);
          try {
            const res = await authFetch(objectUrl(board.images[i].objectPath), {}, getToken);
            const blob = await res.blob();
            const dataUrl = await blobToDataUrl(blob);
            // Crop to cell dimensions before embedding so jsPDF has nothing to stretch
            const cropped = await coverCrop(dataUrl, IMG_W, IMG_H);
            doc.addImage(cropped, "JPEG", x, y, IMG_W, IMG_H);
          } catch {
            doc.setFillColor(38, 30, 46);
            doc.roundedRect(x, y, IMG_W, IMG_H, 3, 3, "F");
          }
        }
        y += IMG_H + 28;

        if (y > PAGE_H - MARGIN - 80) {
          doc.addPage(); fillBg();
          y = MARGIN;
        }
      }

      // ── Color Palette ──────────────────────────────────────────────────────
      if (board.colorPalette.length > 0) {
        sectionLabel("Color Palette");
        const SWATCH = 30;
        const SWATCH_GAP = 10;
        board.colorPalette.forEach((color, i) => {
          const x = MARGIN + i * (SWATCH + SWATCH_GAP);
          const rgb = hexToRgb(color.hex);
          if (rgb) {
            doc.setFillColor(rgb.r, rgb.g, rgb.b);
            doc.roundedRect(x, y, SWATCH, SWATCH, 3, 3, "F");
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(MT_R, MT_G, MT_B);
          doc.text(color.hex.toUpperCase(), x + SWATCH / 2, y + SWATCH + 9, { align: "center" });
          if (color.name) doc.text(color.name, x + SWATCH / 2, y + SWATCH + 17, { align: "center" });
        });
        y += SWATCH + 32;
      }

      // ── Style Tags ─────────────────────────────────────────────────────────
      if (board.styleTags.length > 0) {
        sectionLabel("Style");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(WH_R, WH_G, WH_B);
        doc.text(board.styleTags.join("  ·  "), MARGIN, y);
        y += 24;
      }

      // ── Notes ──────────────────────────────────────────────────────────────
      if (board.notes?.trim()) {
        if (y + 60 > PAGE_H - MARGIN) { doc.addPage(); fillBg(); y = MARGIN; }
        sectionLabel("Notes");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(WH_R, WH_G, WH_B);
        const noteLines = doc.splitTextToSize(board.notes.trim(), CW);
        doc.text(noteLines, MARGIN, y);
      }

      // ── Footer on every page ───────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(MT_R, MT_G, MT_B);
        doc.text(
          `Created with A.IDO · aidowedding.net${totalPages > 1 ? `   ${p} / ${totalPages}` : ""}`,
          PAGE_W / 2,
          PAGE_H - 20,
          { align: "center" }
        );
      }

      const filename = partner1 && partner2
        ? `${partner1}-and-${partner2}-Wedding-Mood-Board.pdf`.replace(/\s+/g, "-")
        : "Wedding-Mood-Board.pdf";
      doc.save(filename);
      toast({ title: "PDF ready", description: "Your mood board has been downloaded." });
    } catch (err) {
      console.error(err);
      toast({ title: "Could not generate PDF", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header: centered title + Export PDF button top-right */}
      <div className="relative flex justify-center items-start pb-5 border-b border-border/50">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Your Wedding Mood Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Curate and visualize your dream wedding style.</p>
        </div>
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {savePending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          <button
            onClick={generatePdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent/50 disabled:opacity-60 transition-colors"
          >
            {generatingPdf
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* Hidden file input — used by in-grid upload zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ─── Image Grid ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {board.images.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {board.images.length} image{board.images.length !== 1 ? "s" : ""} · Drag to reorder
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={analyzeAll}
                disabled={!!analyzingPath}
                className="text-xs"
              >
                {analyzingPath
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analyzing…</>
                  : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Analyze All</>
                }
              </Button>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={board.images.map(img => img.objectPath)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {board.images.map(img => (
                  <SortableImageCard
                    key={img.objectPath}
                    image={img}
                    blobUrl={blobUrls.get(img.objectPath)}
                    onDelete={() => removeImage(img.objectPath)}
                    onAnalyze={() => analyzeImage(img.objectPath)}
                    analyzing={analyzingPath === img.objectPath}
                  />
                ))}

                {/* Upload zone (always visible at end) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={cn(
                    "aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2",
                    "hover:border-primary/50 hover:bg-primary/3 transition-all text-muted-foreground hover:text-primary",
                    isUploading && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isUploading
                    ? <Loader2 className="h-6 w-6 animate-spin" />
                    : <ImagePlus className="h-6 w-6" />
                  }
                  <span className="text-xs font-medium">
                    {isUploading ? "Uploading…" : "Add Image"}
                  </span>
                </button>
              </div>
            </SortableContext>
          </DndContext>

          {board.images.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/8 flex items-center justify-center">
                <Palette className="h-8 w-8 text-primary/60" />
              </div>
              <div>
                <p className="font-medium text-foreground">Start your mood board</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Upload photos from Pinterest, Instagram, or your camera roll. Aria will detect your style automatically.
                </p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                <ImagePlus className="h-4 w-4 mr-2" />
                Upload Your First Image
              </Button>
            </div>
          )}
        </div>

        {/* ─── Right Sidebar ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Style Tags */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Style Tags</h3>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all",
                    board.styleTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            {board.styleTags.filter(t => !PRESET_TAGS.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {board.styleTags
                  .filter(t => !PRESET_TAGS.includes(t))
                  .map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button onClick={() => toggleTag(tag)} className="hover:text-destructive">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustomTag()}
                placeholder="Add custom tag…"
                className="flex-1 text-xs bg-muted/40 border border-border/40 rounded-lg px-3 py-1.5 outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground"
              />
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={addCustomTag}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Color Palette */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Color Palette</h3>
            </div>

            {board.colorPalette.length > 0 ? (
              <div className="space-y-2">
                {board.colorPalette.map((swatch, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg border border-border/40 shrink-0 shadow-sm"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <input
                      value={swatch.name}
                      onChange={e => renameColor(i, e.target.value)}
                      className="flex-1 text-xs bg-transparent text-foreground outline-none border-b border-transparent focus:border-border/60 py-0.5"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">{swatch.hex}</span>
                    <button onClick={() => removeColor(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Analyze your images to automatically extract your wedding color palette.
              </p>
            )}

            {board.images.some(img => !img.analysis) && board.images.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={analyzeAll}
                disabled={!!analyzingPath}
              >
                {analyzingPath
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analyzing images…</>
                  : <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> Extract Colors from Images</>
                }
              </Button>
            )}
          </div>

          {/* AI Style Summary */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">AI Style Summary</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
                title="Regenerate"
              >
                {generateSummaryMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />
                }
              </Button>
            </div>
            {board.aiSummary ? (
              <p className="text-sm text-foreground leading-relaxed italic">
                "{board.aiSummary}"
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Upload images and add style tags, then generate your personalized style summary.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => generateSummaryMutation.mutate()}
                  disabled={generateSummaryMutation.isPending}
                >
                  {generateSummaryMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</>
                    : <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> Generate Summary</>
                  }
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Notes & Inspiration</h3>
            </div>
            <Textarea
              value={board.notes ?? ""}
              onChange={e => update({ notes: e.target.value })}
              placeholder="Jot down ideas, inspiration links, or details about your vision…"
              className="resize-none text-sm min-h-[100px] bg-muted/30 border-border/40"
            />
          </div>

          {/* Discovered insights (from analyzed images) */}
          {board.images.some(img => img.analysis) && (
            <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Discovered from Images</h3>
              </div>
              <div className="space-y-2">
                {(() => {
                  const allKeywords = [...new Set(board.images.flatMap(img => img.analysis?.styleKeywords ?? []))];
                  const allThemes = [...new Set(board.images.flatMap(img => img.analysis?.decorThemes ?? []))];
                  const floralStyles = [...new Set(board.images.map(img => img.analysis?.floralStyle).filter(Boolean))];
                  const venueVibes = [...new Set(board.images.map(img => img.analysis?.venueVibe).filter(Boolean))];
                  return (
                    <>
                      {allKeywords.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Aesthetic</p>
                          <div className="flex flex-wrap gap-1">
                            {allKeywords.slice(0, 8).map(k => (
                              <span key={k} className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {allThemes.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Décor Themes</p>
                          <div className="flex flex-wrap gap-1">
                            {allThemes.slice(0, 6).map(t => (
                              <span key={t} className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {floralStyles.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Florals:</span> {floralStyles.join(", ")}
                        </p>
                      )}
                      {venueVibes.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Venue vibe:</span> {venueVibes.join(", ")}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Color palette builder ────────────────────────────────────────────────────

function buildPalette(allColors: string[], existing: ColorSwatch[]): ColorSwatch[] {
  const colorNames: Record<string, string> = {
    "#ffffff": "White", "#f5f5f5": "Off White", "#fafafa": "Ivory",
    "#fff8f0": "Cream", "#f5e6d3": "Blush", "#e8d5c4": "Champagne",
    "#d4b896": "Nude", "#c8a882": "Sand", "#b8860b": "Gold",
    "#ffd700": "Gold", "#c0a060": "Champagne Gold", "#808080": "Silver",
    "#c0c0c0": "Silver", "#4a4a4a": "Charcoal", "#2d2d2d": "Dark",
    "#1a1a2e": "Midnight", "#355070": "Navy", "#6b4c71": "Mauve",
    "#d4a0b0": "Dusty Rose", "#e8a0a8": "Blush Pink", "#f4c2c2": "Light Pink",
    "#c8b4d0": "Lavender", "#b0c4de": "Dusty Blue", "#7ec8c8": "Sage",
    "#8fbc8f": "Sage Green", "#90a878": "Olive", "#556b2f": "Forest",
  };

  const counts = new Map<string, number>();
  for (const color of allColors) {
    counts.set(color.toLowerCase(), (counts.get(color.toLowerCase()) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const selected: ColorSwatch[] = [];

  for (const [hex] of sorted) {
    if (selected.length >= 6) break;
    if (existing.some(c => c.hex.toLowerCase() === hex)) {
      const existingEntry = existing.find(c => c.hex.toLowerCase() === hex)!;
      if (!selected.some(s => s.hex.toLowerCase() === hex)) {
        selected.push(existingEntry);
      }
    } else {
      const name = colorNames[hex] ?? "Wedding Tone";
      selected.push({ hex, name });
    }
  }

  for (const existing_swatch of existing) {
    if (!selected.some(s => s.hex.toLowerCase() === existing_swatch.hex.toLowerCase())) {
      selected.push(existing_swatch);
    }
  }

  return selected.slice(0, 7);
}
