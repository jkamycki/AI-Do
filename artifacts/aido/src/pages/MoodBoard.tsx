import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
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
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ImageCropDialog, type CropQueueItem } from "@/components/ImageCropDialog";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import { authFetch } from "@/lib/authFetch";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const TAG_DRAG_TYPE = "application/x-mood-tag";

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
  tags?: string[];
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

import { API_BASE_URL } from "@/lib/apiBase";

const _API = API_BASE_URL;
const STORAGE_BASE_PATH = `${_API}/api/storage`;
function applyApiBase(url: string): string {
  return url.startsWith("/") && _API ? `${_API}${url}` : url;
}
function objectUrl(objectPath: string): string {
  if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) return objectPath;
  if (objectPath.startsWith("/api/storage/objects/")) return objectPath;
  if (objectPath.startsWith("/api/storage/public-objects/")) return objectPath;
  if (objectPath.startsWith("/storage/public-objects/")) return `/api${objectPath}`;
  return `/api/storage/objects/${objectPath.replace(/^\/objects\//, "")}`;
}

// ─── Authenticated image loader ───────────────────────────────────────────────
// The storage route requires a Bearer token; <img> tags can't send one.
// AuthMediaImage handles the auth + cross-origin (VITE_API_URL) URL resolution
// for already-saved images. While an upload is in flight we still have a
// local blob URL on hand and render that directly so the user sees their photo
// immediately, before the server URL has been fetched back as a blob.

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
  if (blobUrl) {
    return <img src={blobUrl} alt={alt} className={className} />;
  }
  return <AuthMediaImage src={objectPath} alt={alt} className={className} />;
});

// ─── Sortable Image Card ──────────────────────────────────────────────────────

function SortableImageCard({
  image,
  blobUrl,
  onDelete,
  onAnalyze,
  analyzing,
  onAddTag,
  onRemoveTag,
}: {
  image: MoodBoardImage;
  blobUrl?: string;
  onDelete: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.objectPath,
  });
  const [isDropTarget, setIsDropTarget] = useState(false);

  const tags = image.tags ?? image.analysis?.styleKeywords ?? [];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(TAG_DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!isDropTarget) setIsDropTarget(true);
        }
      }}
      onDragLeave={(e) => {
        // Only clear when leaving the card itself, not child elements
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDropTarget(false);
      }}
      onDrop={(e) => {
        const tag = e.dataTransfer.getData(TAG_DRAG_TYPE);
        setIsDropTarget(false);
        if (tag) {
          e.preventDefault();
          onAddTag(tag);
        }
      }}
      className={cn(
        "group relative rounded-xl overflow-hidden bg-muted aspect-square shadow-sm border border-border/50",
        isDragging && "shadow-2xl ring-2 ring-primary/40",
        isDropTarget && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <AuthImage
        objectPath={image.objectPath}
        blobUrl={blobUrl}
        alt="Mood board image"
        className="w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 pointer-events-none" />

      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
        title={t("moodboard.drag_to_reorder", { defaultValue: "Drag to reorder" })}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 shadow-lg opacity-100 transition-colors hover:bg-red-600 hover:text-white hover:border-red-500 z-30"
        title="Remove image"
        aria-label="Remove image"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>Remove</span>
      </button>

      {!image.analysis && (
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="absolute left-2 right-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-primary/90 text-primary-foreground text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60 z-20 shadow-lg"
          style={{ bottom: tags.length > 0 ? 42 : 8 }}
          title="Analyze with AI"
        >
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          {analyzing ? t("moodboard.analyzing", { defaultValue: "Analyzing…" }) : t("moodboard.analyze", { defaultValue: "Analyze" })}
        </button>
      )}

      {tags.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-2 pt-4 pb-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary-foreground bg-primary border border-primary-foreground/20 rounded-full pl-2 pr-0.5 py-[1px] shadow-md leading-tight"
              >
                <span className="tracking-tight">{t}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveTag(t); }}
                  className="rounded-full p-0.5 hover:bg-black/25 transition-colors"
                  aria-label={`Remove ${t}`}
                  title="Remove tag"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {isDropTarget && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/15 backdrop-blur-[1px] pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-lg">
            <Plus className="h-3.5 w-3.5" /> Drop tag here
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MoodBoard() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyzingPath, setAnalyzingPath] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const [newTag, setNewTag] = useState("");
  const [savePending, setSavePending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [localBoard, setLocalBoard] = useState<MoodBoardData | null>(null);
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [cropTotal, setCropTotal] = useState(0);

  useEffect(() => {
    const urls = blobUrls;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  // ─── Upload hook ──────────────────────────────────────────────────────────
  const { uploadFile, isUploading } = useUpload({
    basePath: STORAGE_BASE_PATH,
    getToken,
    onError: (err: Error) => {
      const msg = err?.message ?? "";
      const is401 = msg.includes("401") || msg.toLowerCase().includes("session");
      const isConfig = msg.toLowerCase().includes("storage is not configured") || msg.toLowerCase().includes("r2_");
      toast({
        title: "Upload failed",
        description: is401
          ? "Session refreshing — try again in a moment."
          : isConfig
          ? "Image storage is not configured on the server."
          : undefined,
        variant: "destructive",
      });
    },
  });

  // ─── Fetch mood board ─────────────────────────────────────────────────────
  const { data: serverBoard, isLoading } = useQuery<MoodBoardData>({
    queryKey: ["mood-board", activeWorkspace?.profileId ?? "default"],
    queryFn: async () => {
      const r = await authFetch("/api/mood-board");
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  useEffect(() => {
    if (serverBoard) setLocalBoard(serverBoard);
  }, [serverBoard, activeWorkspace?.profileId]);

  useEffect(() => {
    setLocalBoard(null);
  }, [activeWorkspace?.profileId]);

  const board = localBoard ?? serverBoard ?? {
    images: [], colorPalette: [], styleTags: [], aiSummary: null, notes: null,
  };

  // ─── Save helper (debounced) ──────────────────────────────────────────────
  const saveNow = useCallback(async (data: MoodBoardData) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSavePending(true);
    try {
      const response = await authFetch("/api/mood-board", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save mood board");
      qc.invalidateQueries({ queryKey: ["mood-board", activeWorkspace?.profileId ?? "default"] });
    } catch {
      toast({ title: "Mood board could not be saved", variant: "destructive" });
    } finally {
      setSavePending(false);
    }
  }, [activeWorkspace?.profileId, qc, toast]);

  const save = useCallback((data: MoodBoardData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSavePending(true);
    saveTimerRef.current = setTimeout(() => {
      void saveNow(data);
    }, 1000);
  }, [saveNow]);

  const update = useCallback((patch: Partial<MoodBoardData>) => {
    setLocalBoard(prev => {
      const next = { ...board, ...prev, ...patch };
      save(next);
      return next;
    });
  }, [board, save]);

  // ─── Upload images (with crop step) ──────────────────────────────────────
  // 1. User selects files -> we queue them for the crop dialog.
  // 2. For each file the dialog returns a cropped File (or the original if skipped).
  // 3. We upload that file and append it to the board.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    setCropQueue(files);
    setCropIndex(0);
    setCropTotal(files.length);
  };

  const uploadOne = useCallback(async (file: File) => {
    const result = await uploadFile(file);
    if (!result) return;
    setBlobUrls(prev => {
      const next = new Map(prev);
      next.set(result.objectPath, URL.createObjectURL(file));
      return next;
    });
    setLocalBoard(prev => {
      const current = prev ?? board;
      const newImage: MoodBoardImage = {
        objectPath: result.objectPath,
        order: current.images.length,
        name: file.name,
      };
      const next = { ...current, images: [...current.images, newImage] };
      void saveNow(next);
      return next;
    });
    toast({ title: "Image added to your mood board" });
  }, [uploadFile, board, saveNow, toast]);

  const advanceQueue = useCallback(() => {
    setCropQueue(prev => prev.slice(1));
    setCropIndex(i => i + 1);
  }, []);

  const handleCropComplete = useCallback((cropped: File) => {
    void uploadOne(cropped);
    advanceQueue();
  }, [uploadOne, advanceQueue]);

  const handleCropSkip = useCallback(() => {
    const first = cropQueue[0];
    if (first) void uploadOne(first);
    advanceQueue();
  }, [cropQueue, uploadOne, advanceQueue]);

  const handleCropCancelAll = useCallback(() => {
    setCropQueue([]);
    setCropIndex(0);
    setCropTotal(0);
  }, []);

  const cropItem: CropQueueItem | null = cropQueue.length > 0 && cropQueue[0]
    ? { file: cropQueue[0], index: cropIndex, total: cropTotal }
    : null;

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
    setBlobUrls(prev => {
      const blobUrl = prev.get(objectPath);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const next = new Map(prev);
      next.delete(objectPath);
      return next;
    });
    update({ images: updated });
    toast({ title: "Image removed from your mood board" });
  };

  // ─── Analyze single image ─────────────────────────────────────────────────
  const analyzeImage = async (
    objectPath: string,
    options: { generateSummary?: boolean; sourceBoard?: MoodBoardData } = {},
  ) => {
    setAnalyzingPath(objectPath);
    try {
      const r = await authFetch("/api/mood-board/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath }),
      });
      if (!r.ok) throw new Error("Analysis failed");
      const { analysis } = await r.json() as { analysis: ImageAnalysis };

      const current = options.sourceBoard ?? board;
      const updatedImages = current.images.map(img => {
        if (img.objectPath !== objectPath) return img;
        const existing = img.tags ?? [];
        const aiTags = analysis.styleKeywords ?? [];
        const mergedTags = [...existing, ...aiTags.filter(t => !existing.includes(t))];
        return { ...img, analysis, tags: mergedTags };
      });
      const allColors = updatedImages.flatMap(img => img.analysis?.dominantColors ?? []);
      const palette = buildPalette(allColors, current.colorPalette);
      const nextBoard = { ...current, images: updatedImages, colorPalette: palette };
      setLocalBoard(nextBoard);
      save(nextBoard);
      if (options.generateSummary !== false) {
        await generateSummaryMutation.mutateAsync(nextBoard);
      }
      return nextBoard;
    } catch {
      toast({ title: "Analysis failed", description: "Could not analyze this image.", variant: "destructive" });
      return null;
    } finally {
      setAnalyzingPath(null);
    }
  };

  // ─── Analyze all unanalyzed ───────────────────────────────────────────────
  const analyzeAll = async () => {
    if (analyzingAll) return;
    const needsAnalysis = board.images.filter((img) => {
      const hasKeywords = (img.analysis?.styleKeywords?.length ?? 0) > 0;
      const hasColors = (img.analysis?.dominantColors?.length ?? 0) > 0;
      return !hasKeywords || !hasColors;
    });
    if (!needsAnalysis.length) {
      toast({ title: "All images already analyzed" });
      await generateSummaryMutation.mutateAsync(board);
      return;
    }
    setAnalyzingAll(true);
    setAnalyzeProgress({ done: 0, total: needsAnalysis.length });
    let successCount = 0;
    try {
      let latestBoard: MoodBoardData = board;
      for (const [index, img] of needsAnalysis.entries()) {
        const analyzedBoard = await analyzeImage(img.objectPath, { generateSummary: false, sourceBoard: latestBoard });
        if (analyzedBoard) {
          latestBoard = analyzedBoard;
          successCount += 1;
        }
        setAnalyzeProgress({ done: index + 1, total: needsAnalysis.length });
      }
      if (successCount > 0) {
        await generateSummaryMutation.mutateAsync(latestBoard);
        toast({ title: "Analysis complete", description: `${successCount} image${successCount === 1 ? "" : "s"} analyzed.` });
      } else {
        toast({ title: "Analysis failed", description: "Could not analyze any images. Please try again.", variant: "destructive" });
      }
    } finally {
      setAnalyzeProgress(null);
      setAnalyzingAll(false);
    }
  };

  // ─── Generate AI summary ──────────────────────────────────────────────────
  const generateSummaryMutation = useMutation({
    mutationFn: async (sourceBoard?: MoodBoardData) => {
      const boardForSummary = sourceBoard ?? board;
      const r = await authFetch("/api/mood-board/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleTags: boardForSummary.styleTags,
          images: boardForSummary.images,
          colorPalette: boardForSummary.colorPalette,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      const { summary } = await r.json() as { summary: string };
      return { summary, boardForSummary };
    },
    onSuccess: ({ summary, boardForSummary }) => {
      const nextBoard = { ...boardForSummary, aiSummary: summary };
      setLocalBoard(nextBoard);
      save(nextBoard);
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

  // ─── Per-photo tags (drag-to-assign / X-to-remove) ────────────────────────
  const addImageTag = (objectPath: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const updatedImages = board.images.map(img => {
      if (img.objectPath !== objectPath) return img;
      const current = img.tags ?? img.analysis?.styleKeywords ?? [];
      if (current.includes(trimmed)) return img;
      return { ...img, tags: [...current, trimmed] };
    });
    update({ images: updatedImages });
  };

  const removeImageTag = (objectPath: string, tag: string) => {
    const updatedImages = board.images.map(img => {
      if (img.objectPath !== objectPath) return img;
      const current = img.tags ?? img.analysis?.styleKeywords ?? [];
      return { ...img, tags: current.filter(t => t !== tag) };
    });
    update({ images: updatedImages });
  };

  // ─── Reset entire board ───────────────────────────────────────────────────
  const isBoardEmpty =
    board.images.length === 0 &&
    board.colorPalette.length === 0 &&
    board.styleTags.length === 0 &&
    !board.aiSummary &&
    (!board.notes || board.notes.length === 0);

  const resetBoard = () => {
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    setBlobUrls(new Map());
    update({
      images: [],
      colorPalette: [],
      styleTags: [],
      aiSummary: null,
      notes: null,
    });
    toast({ title: "Mood board cleared" });
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

  // Fit a data-URL image into (cellW × cellH) with CONTAIN semantics: the
  // entire image is preserved (no clipping) and centered, with the page
  // background filling the letterbox area. Returns { dataUrl, drawW, drawH,
  // offsetX, offsetY } so the caller can position it inside the cell.
  type FitResult = { dataUrl: string; drawW: number; drawH: number; offsetX: number; offsetY: number };
  const containFit = (dataUrl: string, cellW: number, cellH: number): Promise<FitResult> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const cellAspect = cellW / cellH;
          let drawW: number, drawH: number;
          if (imgAspect > cellAspect) {
            // image wider than cell -> fit to width, letterbox top/bottom
            drawW = cellW;
            drawH = cellW / imgAspect;
          } else {
            drawH = cellH;
            drawW = cellH * imgAspect;
          }
          const offsetX = (cellW - drawW) / 2;
          const offsetY = (cellH - drawH) / 2;
          // Re-encode to JPEG at the actual draw size (×2 for sharpness)
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(drawW * scale));
          canvas.height = Math.max(1, Math.round(drawH * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve({ dataUrl, drawW, drawH, offsetX, offsetY }); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({
            dataUrl: canvas.toDataURL("image/jpeg", 0.9),
            drawW, drawH, offsetX, offsetY,
          });
        } catch { resolve({ dataUrl, drawW: cellW, drawH: cellH, offsetX: 0, offsetY: 0 }); }
      };
      img.onerror = () => reject(new Error("img load failed"));
      img.src = dataUrl;
    });

  const downloadPdfBlob = (doc: import("jspdf").jsPDF, filename: string) => {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

      // Fetch couple names from profile
      let partner1 = "";
      let partner2 = "";
      try {
        const profileRes = await authFetch("/api/profile");
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

      // A.IDO blush, champagne, and burgundy palette.
      const [BG_R, BG_G, BG_B] = [255, 247, 242];
      const [GD_R, GD_G, GD_B] = [141, 41, 77];
      const [WH_R, WH_G, WH_B] = [36, 23, 29];
      const [MT_R, MT_G, MT_B] = [111, 62, 84];
      const [BR_R, BR_G, BR_B] = [230, 166, 183];

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
      // A.IDO logo — centered with clear space before the title and summary.
      const LOGO_W = 62;
      const LOGO_H = 68;
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", PAGE_W / 2 - LOGO_W / 2, 18, LOGO_W, LOGO_H);
        y = 108;
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
      doc.setFontSize(9.5);
      doc.setTextColor(MT_R, MT_G, MT_B);
      doc.text("Wedding Mood Board", PAGE_W / 2, y, { align: "center" });
      y += 16;

      // Gold divider
      doc.setDrawColor(GD_R, GD_G, GD_B);
      doc.setLineWidth(0.6);
      doc.line(PAGE_W / 2 - 38, y, PAGE_W / 2 + 38, y);
      y += 22;

      // ── AI Summary ─────────────────────────────────────────────────────────
      if (board.aiSummary) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(MT_R, MT_G, MT_B);
        const lines = doc.splitTextToSize(`"${board.aiSummary}"`, CW - 56);
        doc.text(lines, PAGE_W / 2, y, { align: "center" });
        y += (lines.length as number) * 12 + 24;
      }

      // ── Images grid ────────────────────────────────────────────────────────
      if (board.images.length > 0) {
        sectionLabel("Inspiration Images");

        const COLS = 3;
        const GAP = 7;
        // Caption = up to 2 rows of small pill chips, centered under image
        const PILL_FONT = 6.5;
        const PILL_H = 9;
        const PILL_PAD_X = 3.5;
        const PILL_GAP = 3;
        const PILL_ROW_GAP = 2.5;
        const PILL_TOP_OFFSET = 6;
        const CAPTION_H = PILL_TOP_OFFSET + PILL_H * 2 + PILL_ROW_GAP + 2; // ~30
        const IMG_W = (CW - GAP * (COLS - 1)) / COLS;
        const IMG_H = Math.round(IMG_W * 0.7);
        const ROW_H = IMG_H + CAPTION_H;

        for (let i = 0; i < board.images.length; i++) {
          const col = i % COLS;
          if (col === 0) {
            if (i > 0) y += ROW_H + GAP;
            // Page break check: include the inter-row GAP so the next row's
            // bottom (caption included) is fully inside the page margins.
            if (y + ROW_H > PAGE_H - MARGIN) {
              doc.addPage(); fillBg();
              y = MARGIN;
            }
          }
          const x = MARGIN + col * (IMG_W + GAP);
          try {
            const rawPath = board.images[i].objectPath;
            const resolved = objectUrl(rawPath);
            const resolvedUrl = applyApiBase(resolved);
            const isPublicPath = resolved.startsWith("/api/storage/public-objects/")
              || resolved.startsWith("/storage/public-objects/")
              || resolved.startsWith("http://")
              || resolved.startsWith("https://");

            let res: Response;
            if (isPublicPath) {
              // Public objects are best fetched without auth headers to avoid
              // CORS/preflight issues on some storage/CDN setups.
              res = await fetch(resolvedUrl);
            } else {
              // Use the same authenticated media fetcher path as the on-screen
              // image component. It knows the active workspace and auth token.
              res = await authFetch(resolved);
            }

            if (!res.ok && !isPublicPath) {
              const token = await getToken();
              res = await fetch(resolvedUrl, {
                credentials: "include",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
            }

            if (!res.ok && !isPublicPath) {
              // Fallback for deployments where objects are publicly readable
              // but auth/credentials fetch fails due to proxy/CORS policy.
              res = await fetch(resolvedUrl);
            }
            if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
            const blob = await res.blob();
            const dataUrl = await blobToDataUrl(blob);
            // CONTAIN-fit so no part of the user's photo is clipped.
            // We draw at the fitted size and center inside the cell — the
            // page background fills any letterbox area naturally.
            const fit = await containFit(dataUrl, IMG_W, IMG_H);
            doc.addImage(
              fit.dataUrl,
              "JPEG",
              x + fit.offsetX,
              y + fit.offsetY,
              fit.drawW,
              fit.drawH,
            );
          } catch {
            doc.setFillColor(249, 236, 232);
            doc.roundedRect(x, y, IMG_W, IMG_H, 3, 3, "F");
          }
          // Per-photo tags — render as small gold pill chips centered under
          // each image, wrapping into at most 2 rows. Overflow becomes "+N".
          const imgTags = board.images[i].tags ?? board.images[i].analysis?.styleKeywords ?? [];
          if (imgTags.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(PILL_FONT);

            // Measure each pill width: text + horizontal padding
            const pills = imgTags.map(t => ({
              text: t,
              w: doc.getTextWidth(t) + PILL_PAD_X * 2,
            }));

            // Greedy line-break into rows that fit within IMG_W
            const MAX_ROWS = 2;
            const rows: { text: string; w: number }[][] = [[]];
            for (const p of pills) {
              const row = rows[rows.length - 1]!;
              const additional = (row.length === 0 ? 0 : PILL_GAP) + p.w;
              const rowW = row.reduce((s, t, idx) => s + t.w + (idx > 0 ? PILL_GAP : 0), 0);
              if (rowW + additional > IMG_W && row.length > 0) {
                if (rows.length >= MAX_ROWS) break;
                rows.push([p]);
              } else {
                row.push(p);
              }
            }

            // If any tags didn't fit, replace tail of last row with "+N"
            const placed = rows.reduce((n, r) => n + r.length, 0);
            if (placed < pills.length) {
              const remaining = pills.length - placed;
              const lastRow = rows[rows.length - 1]!;
              const more = { text: `+${remaining}`, w: doc.getTextWidth(`+${remaining}`) + PILL_PAD_X * 2 };
              let lastW = lastRow.reduce((s, t, idx) => s + t.w + (idx > 0 ? PILL_GAP : 0), 0);
              while (lastRow.length > 0 && lastW + PILL_GAP + more.w > IMG_W) {
                const removed = lastRow.pop()!;
                lastW -= removed.w + (lastRow.length > 0 ? PILL_GAP : 0);
              }
              lastRow.push(more);
            }

            // Render each row centered horizontally within the image cell
            let captionY = y + IMG_H + PILL_TOP_OFFSET;
            doc.setDrawColor(GD_R, GD_G, GD_B);
            doc.setLineWidth(0.4);
            doc.setTextColor(GD_R, GD_G, GD_B);
            for (const row of rows) {
              if (row.length === 0) continue;
              const rowW = row.reduce((s, t, idx) => s + t.w + (idx > 0 ? PILL_GAP : 0), 0);
              let pillX = x + (IMG_W - rowW) / 2;
              for (const t of row) {
                doc.roundedRect(pillX, captionY, t.w, PILL_H, PILL_H / 2, PILL_H / 2, "S");
                doc.text(t.text, pillX + t.w / 2, captionY + PILL_H - 2.7, { align: "center" });
                pillX += t.w + PILL_GAP;
              }
              captionY += PILL_H + PILL_ROW_GAP;
            }
          }
        }
        y += ROW_H + 22;

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
      downloadPdfBlob(doc, filename);
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
      {/* Header: centered title + actions. Stacks on mobile so actions never overlap the title. */}
      <div className="flex flex-col gap-4 pb-5 border-b border-border/50 sm:relative sm:flex-row sm:justify-center sm:items-start">
        <div className="text-center px-2 sm:px-0">
          <h1 className="text-2xl font-bold tracking-tight">{t("moodboard.title", { defaultValue: "Your Wedding Mood Board" })}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("moodboard.subtitle", { defaultValue: "Curate and visualize your dream wedding style." })}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:absolute sm:right-0 sm:top-0 sm:justify-end">
          {savePending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("moodboard.saving", { defaultValue: "Saving…" })}
            </span>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isBoardEmpty}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={isBoardEmpty ? t("moodboard.nothing_to_reset", { defaultValue: "Nothing to reset" }) : t("moodboard.clear_entire_board", { defaultValue: "Clear the entire mood board" })}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("moodboard.reset", { defaultValue: "Reset" })}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("moodboard.clear_confirm_title", { defaultValue: "Clear your mood board?" })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("moodboard.clear_confirm_desc", { defaultValue: "This removes all images, the color palette, style tags, the AI style summary, and your notes from this mood board. Uploaded files remain in storage but will no longer appear here. This cannot be undone." })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("moodboard.cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={resetBoard}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("moodboard.clear_everything", { defaultValue: "Clear everything" })}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button
            onClick={generatePdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent/50 disabled:opacity-60 transition-colors"
          >
            {generatingPdf
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            {t("moodboard.export_pdf", { defaultValue: "Export PDF" })}
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

      {/* Crop dialog — shown one image at a time after the user selects files */}
      <ImageCropDialog
        item={cropItem}
        onComplete={handleCropComplete}
        onSkip={handleCropSkip}
        onCancelAll={handleCropCancelAll}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ─── Image Grid ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {board.images.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {board.images.length} {board.images.length !== 1 ? t("moodboard.images_label", { defaultValue: "images" }) : t("moodboard.image_label", { defaultValue: "image" })} · {t("moodboard.drag_to_reorder_hint", { defaultValue: "Drag to reorder" })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={analyzeAll}
                disabled={analyzingAll || !!analyzingPath}
                className="text-xs"
              >
                {analyzingAll || analyzingPath
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> {analyzeProgress ? `Analyzing ${analyzeProgress.done}/${analyzeProgress.total}` : t("moodboard.analyzing_all", { defaultValue: "Analyzing..." })}</>
                  : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> {t("moodboard.analyze_all", { defaultValue: "Analyze All" })}</>
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
                    onAddTag={(tag) => addImageTag(img.objectPath, tag)}
                    onRemoveTag={(tag) => removeImageTag(img.objectPath, tag)}
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
                    {isUploading ? t("moodboard.uploading", { defaultValue: "Uploading…" }) : t("moodboard.add_image", { defaultValue: "Add Image" })}
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
                <p className="font-medium text-foreground">{t("moodboard.start_your_board", { defaultValue: "Start your mood board" })}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {t("moodboard.start_your_board_desc", { defaultValue: "Upload photos from Pinterest, Instagram, or your camera roll. Aria will detect your style automatically." })}
                </p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                <ImagePlus className="h-4 w-4 mr-2" />
                {t("moodboard.upload_first_image", { defaultValue: "Upload Your First Image" })}
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
              <h3 className="text-sm font-semibold">{t("moodboard.style_tags", { defaultValue: "Style Tags" })}</h3>
            </div>
            {board.images.length > 0 && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("moodboard.style_tags_hint_1", { defaultValue: "Tap to add to your overall style." })}{" "}
                <span className="text-foreground/80">{t("moodboard.style_tags_hint_drag", { defaultValue: "Drag any tag onto a photo" })}</span>{" "}
                {t("moodboard.style_tags_hint_2", { defaultValue: "to assign it to that image." })}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TAG_DRAG_TYPE, tag);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all cursor-grab active:cursor-grabbing select-none",
                    board.styleTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                  title="Click to toggle on board · Drag onto a photo to assign"
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
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 text-xs cursor-grab active:cursor-grabbing select-none"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(TAG_DRAG_TYPE, tag);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      title="Drag onto a photo to assign · Click X to remove from board"
                    >
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
                placeholder={t("moodboard.add_custom_tag", { defaultValue: "Add custom tag…" })}
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
              <h3 className="text-sm font-semibold">{t("moodboard.color_palette", { defaultValue: "Color Palette" })}</h3>
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
                {t("moodboard.palette_empty_desc", { defaultValue: "Analyze your images to automatically extract your wedding color palette." })}
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
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> {t("moodboard.analyzing_images", { defaultValue: "Analyzing images…" })}</>
                  : <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> {t("moodboard.extract_colors", { defaultValue: "Extract Colors from Images" })}</>
                }
              </Button>
            )}
          </div>

          {/* AI Style Summary */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t("moodboard.ai_style_summary", { defaultValue: "AI Style Summary" })}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => generateSummaryMutation.mutate(board)}
                disabled={generateSummaryMutation.isPending}
                title={t("moodboard.regenerate", { defaultValue: "Regenerate" })}
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
                  {t("moodboard.summary_empty_desc", { defaultValue: "Upload images and add style tags, then generate your personalized style summary." })}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => generateSummaryMutation.mutate(board)}
                  disabled={generateSummaryMutation.isPending}
                >
                  {generateSummaryMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> {t("moodboard.generating", { defaultValue: "Generating…" })}</>
                    : <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> {t("moodboard.generate_summary", { defaultValue: "Generate Summary" })}</>
                  }
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{t("moodboard.notes_inspiration", { defaultValue: "Notes & Inspiration" })}</h3>
            </div>
            <Textarea
              value={board.notes ?? ""}
              onChange={e => update({ notes: e.target.value })}
              placeholder={t("moodboard.notes_placeholder", { defaultValue: "Jot down ideas, inspiration links, or details about your vision…" })}
              className="resize-none text-sm min-h-[100px] bg-muted/30 border-border/40"
            />
          </div>

          {/* Discovered insights (from analyzed images) */}
          {board.images.some(img => img.analysis) && (
            <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t("moodboard.discovered_from_images", { defaultValue: "Discovered from Images" })}</h3>
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
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("moodboard.aesthetic", { defaultValue: "Aesthetic" })}</p>
                          <div className="flex flex-wrap gap-1">
                            {allKeywords.slice(0, 8).map(k => (
                              <span key={k} className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {allThemes.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("moodboard.decor_themes", { defaultValue: "Décor Themes" })}</p>
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
