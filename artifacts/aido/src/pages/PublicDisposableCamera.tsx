import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Camera, ExternalLink, ImagePlus, Link, Loader2, Lock, RefreshCw, RefreshCcw, Send, Zap, ZapOff, ZoomIn, ZoomOut } from "lucide-react";
import { apiFetch } from "@/lib/authFetch";
import { getGuestPhotoDeviceId } from "@/lib/guestPhotoDevice";
import { uploadGuestPhoto } from "@/lib/guestPhotoUpload";

type FacingMode = "environment" | "user";
type CameraStatus = "starting" | "ready" | "blocked" | "unsupported" | "error";
type FilmEffectId = "classic" | "warm" | "dream" | "mono";

const DEFAULT_SHOT_LIMIT = 10;
const DEVELOPING_DELAY_MS = 2400;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

const FILM_EFFECTS: Array<{
  id: FilmEffectId;
  label: string;
  canvasFilter: string;
  wash: string;
}> = [
  {
    id: "classic",
    label: "Classic film",
    canvasFilter: "contrast(112%) saturate(120%) sepia(16%) brightness(103%)",
    wash: "rgba(255, 180, 120, 0.08)",
  },
  {
    id: "warm",
    label: "Golden hour",
    canvasFilter: "contrast(108%) saturate(128%) sepia(28%) brightness(104%)",
    wash: "rgba(255, 145, 92, 0.13)",
  },
  {
    id: "dream",
    label: "Soft flash",
    canvasFilter: "contrast(96%) saturate(108%) sepia(12%) brightness(112%)",
    wash: "rgba(248, 221, 229, 0.1)",
  },
  {
    id: "mono",
    label: "B&W keepsake",
    canvasFilter: "grayscale(100%) contrast(118%) brightness(104%)",
    wash: "rgba(255, 255, 255, 0.02)",
  },
];

type ShotRollState = {
  limit: number;
  remaining: number;
  submitted?: boolean;
};

function rollStorageKey(slug: string) {
  return `aido_disposable_roll_${slug || "default"}`;
}

function readShotsRemaining(slug: string, limit: number) {
  try {
    const stored = window.localStorage.getItem(rollStorageKey(slug));
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ShotRollState>;
      const storedLimit = Number(parsed.limit);
      const storedRemaining = Number(parsed.remaining);
      if (Number.isInteger(storedLimit) && storedLimit > 0 && Number.isInteger(storedRemaining)) {
        const usedShots = Math.max(0, storedLimit - Math.max(0, Math.min(storedRemaining, storedLimit)));
        return Math.max(0, Math.min(limit, limit - usedShots));
      }
    }

    const legacyStored = window.sessionStorage.getItem(`aido_disposable_shots_remaining_${slug || "default"}_${limit}`);
    if (legacyStored !== null) {
      const legacyRemaining = Number(legacyStored);
      if (Number.isInteger(legacyRemaining) && legacyRemaining >= 0 && legacyRemaining <= limit) {
        saveShotsRemaining(slug, legacyRemaining, limit);
        return legacyRemaining;
      }
    }
  } catch {}
  return limit;
}

function readRollSubmitted(slug: string) {
  try {
    const stored = window.localStorage.getItem(rollStorageKey(slug));
    if (!stored) return false;
    const parsed = JSON.parse(stored) as Partial<ShotRollState>;
    return parsed.submitted === true;
  } catch {}
  return false;
}

function saveShotsRemaining(slug: string, remaining: number, limit: number, submitted = false) {
  try {
    window.localStorage.setItem(
      rollStorageKey(slug),
      JSON.stringify({
        limit,
        remaining: Math.max(0, Math.min(limit, remaining)),
        submitted,
      } satisfies ShotRollState),
    );
  } catch {}
}

function fileFromBlob(blob: Blob) {
  return new File([blob], `aido-disposable-${Date.now()}.jpg`, { type: "image/jpeg" });
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getFilmEffect(effectId: FilmEffectId) {
  return FILM_EFFECTS.find((effect) => effect.id === effectId) ?? FILM_EFFECTS[0];
}

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));
}

async function setWidestSupportedCameraZoom(stream: MediaStream) {
  const [track] = stream.getVideoTracks();
  if (!track) return;

  try {
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min?: number } };
    const minZoom = capabilities.zoom?.min;
    if (typeof minZoom === "number") {
      await track.applyConstraints({ advanced: [{ zoom: minZoom } as MediaTrackConstraintSet] });
    }
  } catch {
    // Some mobile browsers expose zoom capabilities but reject applying them.
  }
}

function supportsTorch(stream: MediaStream) {
  const [track] = stream.getVideoTracks();
  if (!track) return false;

  try {
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    return capabilities.torch === true;
  } catch {
    return false;
  }
}

async function applyTorch(stream: MediaStream | null, enabled: boolean) {
  const [track] = stream?.getVideoTracks() ?? [];
  if (!track) return false;

  try {
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    if (capabilities.torch !== true) return false;
    await track.applyConstraints({ advanced: [{ torch: enabled } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

async function loadImage(file: File) {
  if ("createImageBitmap" in window) {
    return window.createImageBitmap(file);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not prepare this photo."));
    };
    image.src = url;
  });
}

async function applyFilmEffect(file: File, effectId: FilmEffectId) {
  const effect = getFilmEffect(effectId);
  const image = await loadImage(file);
  const width = image.width;
  const height = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not apply the film effect.");

  context.filter = effect.canvasFilter;
  context.drawImage(image, 0, 0, width, height);
  context.filter = "none";
  context.fillStyle = effect.wash;
  context.fillRect(0, 0, width, height);

  const vignette = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(30,0,12,0.34)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  const lightLeak = context.createLinearGradient(0, 0, width * 0.4, height);
  lightLeak.addColorStop(0, "rgba(255,120,120,0.22)");
  lightLeak.addColorStop(0.42, "rgba(255,180,120,0.06)");
  lightLeak.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = lightLeak;
  context.fillRect(0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not finish this photo.");
  return fileFromBlob(blob);
}

export default function PublicDisposableCamera() {
  const [, params] = useRoute("/wedding/:slug/disposable");
  const [location] = useLocation();
  const pathSlug = location.match(/^\/wedding\/([^/]+)\/disposable\/?$/)?.[1];
  const routeSlug = params ? params.slug : undefined;
  const slug = decodeURIComponent(routeSlug ?? pathSlug ?? "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const flashEnabledRef = useRef(false);
  const shutterTimeoutRef = useRef<number | null>(null);

  const [deviceId, setDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [shotLimit, setShotLimit] = useState(DEFAULT_SHOT_LIMIT);
  const [shotsRemaining, setShotsRemaining] = useState(() => readShotsRemaining(slug, DEFAULT_SHOT_LIMIT));
  const [flash, setFlash] = useState(false);
  const [shutterAnimating, setShutterAnimating] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoRoll, setPhotoRoll] = useState<File[]>([]);
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState<FilmEffectId>("classic");
  const [zoom, setZoom] = useState(1);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [rollSubmitted, setRollSubmitted] = useState(() => readRollSubmitted(slug));
  const [submittedThisVisit, setSubmittedThisVisit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeEffect = getFilmEffect(selectedEffect);

  useEffect(() => {
    document.title = "Disposable Camera | A.I DO";
  }, []);

  useEffect(() => {
    flashEnabledRef.current = flashEnabled;
  }, [flashEnabled]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setDeviceId(getGuestPhotoDeviceId(slug));
    void apiFetch(`/api/website/public/${encodeURIComponent(slug)}/photo-drop`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        const maxUploads = Number((body as { guestPhotoDrop?: { maxUploads?: number } }).guestPhotoDrop?.maxUploads);
        const nextLimit = Number.isFinite(maxUploads) ? Math.max(1, Math.min(10, Math.floor(maxUploads))) : DEFAULT_SHOT_LIMIT;
        if (!active) return;
        setShotLimit(nextLimit);
        setShotsRemaining((current) => {
          const savedShots = readShotsRemaining(slug, nextLimit);
          const alreadySubmitted = readRollSubmitted(slug);
          const safeShots = Math.min(current, savedShots, nextLimit);
          setRollSubmitted(alreadySubmitted);
          setShowUploadPrompt(!alreadySubmitted && safeShots === 0 && photoRoll.length > 0);
          saveShotsRemaining(slug, safeShots, nextLimit, alreadySubmitted);
          return safeShots;
        });
      })
      .catch(() => {
        const savedShots = readShotsRemaining(slug, DEFAULT_SHOT_LIMIT);
        const alreadySubmitted = readRollSubmitted(slug);
        const safeShots = savedShots;
        if (!active) return;
        setRollSubmitted(alreadySubmitted);
        setShotsRemaining(safeShots);
        setShowUploadPrompt(!alreadySubmitted && safeShots === 0 && photoRoll.length > 0);
        saveShotsRemaining(slug, safeShots, DEFAULT_SHOT_LIMIT, alreadySubmitted);
      });
    return () => {
      active = false;
    };
  }, [photoRoll.length, slug]);

  const stopCamera = useCallback(() => {
    void applyTorch(streamRef.current, false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(async () => {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setMessage("Camera is not supported in this browser. You can still upload from your camera roll.");
      return;
    }

    setStatus("starting");
    stopCamera();

    try {
      const videoConstraints: MediaTrackConstraints =
        facingMode === "user"
          ? {
              facingMode: { ideal: "user" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              aspectRatio: { ideal: 16 / 9 },
            }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1440 },
              height: { ideal: 1920 },
            };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
      if (facingMode === "user") {
        await setWidestSupportedCameraZoom(stream);
      }
      streamRef.current = stream;
      const canUseTorch = facingMode === "environment" && supportsTorch(stream);
      setTorchSupported(canUseTorch);
      if (canUseTorch && flashEnabledRef.current) {
        await applyTorch(stream, true);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("ready");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setStatus(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "error");
      setMessage(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access was blocked. Allow camera access in your browser, or upload from your camera roll."
          : "We could not open the camera. You can still upload from your camera roll.",
      );
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (rollSubmitted) {
      stopCamera();
      return () => {
        if (shutterTimeoutRef.current !== null) window.clearTimeout(shutterTimeoutRef.current);
        stopCamera();
      };
    }
    void startCamera();
    return () => {
      if (shutterTimeoutRef.current !== null) window.clearTimeout(shutterTimeoutRef.current);
      stopCamera();
    };
  }, [rollSubmitted, startCamera, stopCamera]);

  function addPhotoToLockedRoll(file: File) {
    const nextRemaining = Math.max(0, shotsRemaining - 1);
    setPhotoRoll((current) => [...current, file].slice(0, shotLimit));
    setShotsRemaining(nextRemaining);
    saveShotsRemaining(slug, nextRemaining, shotLimit);
    setMessage(nextRemaining === 0 ? null : "Photo saved to your locked roll.");
    if (nextRemaining === 0) setShowUploadPrompt(true);
  }

  async function postDisposablePhoto(file: File) {
    await uploadGuestPhoto({
      slug,
      file,
      guestName: "Disposable Camera Guest",
      caption: "Captured with the disposable camera",
      deviceId,
    });
  }

  async function uploadLockedRoll() {
    if (!photoRoll.length || uploading) return;
    setUploading(true);
    setDeveloping(true);
    setMessage(null);
    setRollSubmitted(false);
    setUploadProgress(0);

    try {
      await Promise.all([
        (async () => {
          for (let index = 0; index < photoRoll.length; index += 1) {
            await postDisposablePhoto(photoRoll[index]);
            setUploadProgress(index + 1);
          }
        })(),
        wait(DEVELOPING_DELAY_MS),
      ]);
      setPhotoRoll([]);
      setShowUploadPrompt(false);
      setShotsRemaining(0);
      saveShotsRemaining(slug, 0, shotLimit, true);
      setSubmittedThisVisit(true);
      setRollSubmitted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed. Please try again.");
      setShowUploadPrompt(true);
    } finally {
      setUploading(false);
      setDeveloping(false);
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) throw new Error("Camera is still starting. Try again in a moment.");
    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1440;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Camera capture is not available in this browser.");
    const sourceWidth = width / zoom;
    const sourceHeight = height / zoom;
    const sourceX = (width - sourceWidth) / 2;
    const sourceY = (height - sourceHeight) / 2;
    if (facingMode === "user") {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Could not capture this photo.");
    return fileFromBlob(blob);
  }

  async function handleShutter() {
    if (shotsRemaining <= 0 || uploading) return;
    triggerShutterEffect();
    try {
      const file = await applyFilmEffect(await captureFrame(), selectedEffect);
      addPhotoToLockedRoll(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not take this photo.");
    }
  }

  async function handleCameraRoll(files: FileList | null) {
    const file = files?.[0];
    if (!file || shotsRemaining <= 0 || uploading) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose a photo file.");
      return;
    }
    triggerShutterEffect();
    try {
      addPhotoToLockedRoll(await applyFilmEffect(file, selectedEffect));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this photo.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function shareDisposableLink() {
    const link = window.location.href;
    const title = "A.I DO disposable camera";
    const text = "Add photos to the wedding disposable camera.";

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: link });
        return;
      }
      await navigator.clipboard?.writeText(link);
      setMessage("Camera link copied. Send it to anyone you want to invite.");
    } catch {
      try {
        await navigator.clipboard?.writeText(link);
        setMessage("Camera link copied. Send it to anyone you want to invite.");
      } catch {
        setMessage("Copy this page link from your browser to share the camera.");
      }
    }
  }

  function zoomIn() {
    setZoom((current) => clampZoom(current + ZOOM_STEP));
  }

  function zoomOut() {
    setZoom((current) => clampZoom(current - ZOOM_STEP));
  }

  function resetZoom() {
    setZoom(1);
  }

  function triggerShutterEffect() {
    try {
      navigator.vibrate?.([24, 18, 18]);
    } catch {}
    setShutterAnimating(false);
    if (shutterTimeoutRef.current !== null) window.clearTimeout(shutterTimeoutRef.current);
    window.requestAnimationFrame(() => {
      setShutterAnimating(true);
      shutterTimeoutRef.current = window.setTimeout(() => setShutterAnimating(false), 620);
    });

    if (flashEnabled) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 150);
    }
  }

  async function toggleFlash() {
    const nextEnabled = !flashEnabled;
    setFlashEnabled(nextEnabled);
    flashEnabledRef.current = nextEnabled;

    if (facingMode === "environment") {
      const torchApplied = await applyTorch(streamRef.current, nextEnabled);
      if (nextEnabled && !torchApplied) {
        setMessage("Flash is on. This browser will use a screen flash when you take the photo.");
      } else if (torchApplied) {
        setMessage(nextEnabled ? "Flash is on." : "Flash is off.");
      }
      return;
    }

    setMessage(nextEnabled ? "Selfie flash is on. The screen will flash when you take the photo." : "Flash is off.");
  }

  const canShoot = status === "ready" && shotsRemaining > 0 && !uploading && !showUploadPrompt && !rollSubmitted;
  const flashModeLabel = torchSupported && facingMode === "environment" ? "Camera flash" : "Screen flash";

  return (
    <main className={`fixed inset-0 overflow-hidden bg-[#070203] text-white ${shutterAnimating ? "aido-camera-kick" : ""}`}>
      <style>{`
        @keyframes aido-camera-kick {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); }
          10% { transform: translate3d(-2px, 2px, 0) rotate(-0.28deg); }
          22% { transform: translate3d(2px, -1px, 0) rotate(0.22deg); }
          45% { transform: translate3d(-1px, 1px, 0) rotate(-0.12deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }
        .aido-camera-kick {
          animation: aido-camera-kick 360ms cubic-bezier(0.18, 0.92, 0.2, 1) both;
        }
        @keyframes aido-viewfinder-blink {
          0% { opacity: 0; transform: scale(1.06); }
          9% { opacity: 1; transform: scale(1); }
          28% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.08); }
        }
        @keyframes aido-shutter-iris {
          0% { transform: translate(-50%, -50%) scale(1.65); opacity: 0; }
          11% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          24% { transform: translate(-50%, -50%) scale(0.22); opacity: 1; }
          42% { transform: translate(-50%, -50%) scale(0.22); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.75); opacity: 0; }
        }
        @keyframes aido-shutter-slit {
          0% { transform: translate(-50%, -50%) scaleX(1.8) scaleY(0.08); opacity: 0; }
          16% { transform: translate(-50%, -50%) scaleX(1) scaleY(1); opacity: 1; }
          40% { transform: translate(-50%, -50%) scaleX(0.08) scaleY(0.08); opacity: 1; }
          100% { transform: translate(-50%, -50%) scaleX(1.8) scaleY(0.08); opacity: 0; }
        }
        @keyframes aido-film-advance-pill {
          0%, 38% { transform: translateX(-130%); opacity: 0; }
          48% { opacity: 1; }
          82% { transform: translateX(22%); opacity: 1; }
          100% { transform: translateX(130%); opacity: 0; }
        }
      `}</style>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full bg-black transition-transform duration-200 ${
          facingMode === "user" ? "object-contain" : "object-cover"
        } ${status !== "ready" ? "opacity-0" : ""}`}
        style={{
          filter: activeEffect.canvasFilter,
          transform: `${facingMode === "user" ? "scaleX(-1) " : ""}scale(${zoom})`,
          transformOrigin: "center",
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_38%,rgba(0,0,0,0.18)_60%,rgba(0,0,0,0.72)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: `
            linear-gradient(120deg, ${activeEffect.wash}, rgba(255,255,255,0) 48%),
            radial-gradient(circle at 50% 48%, rgba(255,255,255,0) 42%, rgba(30,0,12,0.32) 100%)
          `,
          mixBlendMode: selectedEffect === "mono" ? "screen" : "soft-light",
        }}
      />
      <div className="pointer-events-none absolute inset-x-5 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.25rem))] z-[2] h-[calc(100%-15rem)] rounded-[2rem] border border-white/18 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />

      {status !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#12080B] px-6 text-center">
          <div className="max-w-sm rounded-[2rem] border border-white/10 bg-white/[0.06] px-6 py-8 shadow-2xl backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F8DDE5] text-[#8D294D]">
              {status === "starting" ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-8 w-8" />}
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-[#F8DDE5]">A.I DO POV</p>
            <h1 className="mt-2 text-3xl font-bold">{status === "starting" ? "Opening camera" : "Camera unavailable"}</h1>
            {message && <p className="mt-3 text-sm leading-6 text-white/72">{message}</p>}
            {status !== "starting" && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 rounded-full bg-[#F8DDE5] px-5 py-3 text-sm font-bold text-[#8D294D]"
              >
                Upload from camera roll
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 to-transparent px-5 pb-28 pt-[max(1.1rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-white/14 bg-black/30 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8DDE5] text-[#8D294D]">
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#F8DDE5]">A.I DO POV</p>
              <p className="text-sm font-bold leading-tight">Disposable camera</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void shareDisposableLink()}
              className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-white/12 px-3 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white"
            >
              <Link className="h-3.5 w-3.5 text-[#F8DDE5]" />
              Share
            </button>
            <p className={`rounded-full px-3 py-2 text-xs font-black ${shotsRemaining > 0 ? "bg-white/12 text-white" : "bg-[#F8DDE5] text-[#8D294D]"}`}>
              {photoRoll.length}/{shotLimit}
            </p>
          </div>
        </div>
      </div>

      {message && status === "ready" && (
        <div className="absolute inset-x-4 top-[max(5.25rem,calc(env(safe-area-inset-top)+4rem))] z-30 rounded-3xl border border-white/12 bg-black/72 px-4 py-3 text-center text-sm text-white shadow-xl backdrop-blur">
          {message}
        </div>
      )}

      <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2">
        <button
          type="button"
          aria-label={flashEnabled ? "Turn flash off" : "Turn flash on"}
          title={`${flashModeLabel} ${flashEnabled ? "on" : "off"}`}
          onClick={() => void toggleFlash()}
          disabled={uploading || showUploadPrompt || status !== "ready"}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg backdrop-blur transition active:scale-95 disabled:opacity-40 ${
            flashEnabled ? "border-[#F8DDE5] bg-[#F8DDE5] text-[#8D294D]" : "border-white/12 bg-black/45 text-white"
          }`}
        >
          {flashEnabled ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={zoomIn}
          disabled={uploading || showUploadPrompt || zoom >= MAX_ZOOM}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-black/45 text-white shadow-lg backdrop-blur transition active:scale-95 disabled:opacity-40"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={resetZoom}
          disabled={uploading || showUploadPrompt || zoom === 1}
          className="min-w-12 rounded-full border border-white/12 bg-black/45 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur transition active:scale-95 disabled:opacity-40"
        >
          {zoom.toFixed(zoom % 1 === 0 ? 0 : 2)}x
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={zoomOut}
          disabled={uploading || showUploadPrompt || zoom <= MIN_ZOOM}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-black/45 text-white shadow-lg backdrop-blur transition active:scale-95 disabled:opacity-40"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute inset-x-0 top-[max(5.35rem,calc(env(safe-area-inset-top)+4.4rem))] z-30 px-5">
        <div className="mx-auto max-w-md rounded-[1.6rem] border border-white/12 bg-black/42 p-3 shadow-xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
            <span>Film effect</span>
            <span>{shotsRemaining > 0 ? `${shotsRemaining} left` : "Roll full"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FILM_EFFECTS.map((effect) => {
            const active = effect.id === selectedEffect;
            return (
              <button
                key={effect.id}
                type="button"
                onClick={() => setSelectedEffect(effect.id)}
                disabled={uploading || showUploadPrompt}
                className={`min-h-11 rounded-2xl border px-2 py-2 text-center text-[0.7rem] font-black leading-tight transition disabled:opacity-50 ${
                  active
                    ? "border-[#F8DDE5] bg-[#F8DDE5] text-[#8D294D]"
                    : "border-white/12 bg-white/[0.08] text-white"
                }`}
              >
                {effect.label}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/82 to-transparent px-5 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-24">
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
          <Lock className="h-3.5 w-3.5" />
          <span>{shotsRemaining > 0 ? `${shotsRemaining} shot${shotsRemaining === 1 ? "" : "s"} remaining` : "Roll full"}</span>
        </div>
        <div className="mx-auto flex max-w-sm items-end justify-center gap-7">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleCameraRoll(event.target.files)}
          />
          <button
            type="button"
            aria-label="Upload from camera roll"
            onClick={() => fileInputRef.current?.click()}
            disabled={shotsRemaining <= 0 || uploading || showUploadPrompt}
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/14 text-white shadow-lg backdrop-blur disabled:opacity-40"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Take photo"
            onClick={() => void handleShutter()}
            disabled={!canShoot}
            className="flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-[#F8DDE5] bg-white/12 shadow-[0_0_0_8px_rgba(248,221,229,0.16),0_18px_45px_rgba(141,41,77,0.35)] backdrop-blur transition active:scale-95 disabled:opacity-40"
          >
            <span className="h-16 w-16 rounded-full bg-gradient-to-br from-white to-[#F8DDE5]" />
          </button>
          <button
            type="button"
            aria-label="Flip camera"
            onClick={() => {
              setFacingMode((current) => (current === "environment" ? "user" : "environment"));
              void applyTorch(streamRef.current, false);
              resetZoom();
            }}
            disabled={uploading || showUploadPrompt}
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/14 text-white shadow-lg backdrop-blur disabled:opacity-40"
          >
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {flash && <div className="pointer-events-none absolute inset-0 z-40 bg-white" />}

      {shutterAnimating && (
        <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
          <div
            className="absolute inset-0 bg-black"
            style={{ animation: "aido-viewfinder-blink 620ms cubic-bezier(0.16, 0.9, 0.18, 1) both" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[78vmin] w-[78vmin] rounded-full border-[36vmin] border-black shadow-[0_0_0_160vmax_rgba(0,0,0,0.88)]"
            style={{ animation: "aido-shutter-iris 620ms cubic-bezier(0.16, 0.9, 0.18, 1) both" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-12 w-[72vmin] rounded-full bg-[#070203] shadow-[0_0_32px_rgba(255,255,255,0.18)]"
            style={{ animation: "aido-shutter-slit 620ms cubic-bezier(0.16, 0.9, 0.18, 1) both" }}
          />
          <div
            className="absolute bottom-[max(7.2rem,calc(env(safe-area-inset-bottom)+6.2rem))] left-1/2 h-1.5 w-24 -translate-x-1/2 overflow-hidden rounded-full bg-white/10"
            style={{ animation: "aido-viewfinder-blink 620ms cubic-bezier(0.16, 0.9, 0.18, 1) both" }}
          >
            <div
              className="h-full w-14 rounded-full bg-[#F8DDE5]"
              style={{ animation: "aido-film-advance-pill 620ms cubic-bezier(0.2, 0.85, 0.2, 1) both" }}
            />
          </div>
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),rgba(255,255,255,0)_34%),linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_22%,rgba(255,255,255,0)_78%,rgba(255,255,255,0.08))]"
            style={{ animation: "aido-viewfinder-blink 420ms ease-out both" }}
          />
        </div>
      )}

      {showUploadPrompt && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#080304]/94 px-6 text-center text-white backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/12 bg-white/[0.07] px-6 py-8 shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F8DDE5] text-[#8D294D]">
              <Lock className="h-8 w-8" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-[#F8DDE5]">Roll complete</p>
            <h2 className="mt-2 text-3xl font-bold">Your {shotLimit} photos are locked</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Just like a disposable camera, guests cannot view the photos. Upload the roll so the couple can develop and review them.
            </p>
            <button
              type="button"
              onClick={() => void uploadLockedRoll()}
              disabled={uploading || photoRoll.length === 0}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#F8DDE5] text-sm font-black text-[#8D294D] shadow-[0_18px_45px_rgba(141,41,77,0.35)] disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading ? "Uploading roll..." : "Upload my roll"}
            </button>
          </div>
        </div>
      )}

      {rollSubmitted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#FFF7F2] px-6 text-center text-[#3B1C2B]">
          <div className="w-full max-w-sm rounded-[2rem] border border-[#E6A6B7]/50 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(91,15,42,0.18)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F8DDE5] text-[#8D294D]">
              <Camera className="h-8 w-8" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-[#B16C8E]">Roll submitted</p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-[#8D294D]">
              {submittedThisVisit ? "Thanks for sharing the memories" : "You already submitted your roll"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6F3E54]">
              {submittedThisVisit
                ? "Your disposable camera roll was sent to the couple for review. Planning a wedding too? Try A.I DO to build your website, manage RSVPs, organize guests, and collect photos."
                : `This phone has already submitted its ${shotLimit}-photo disposable camera roll for this wedding. To keep it fair, scanning the same QR code will not unlock more shots.`}
            </p>
            <a
              href="https://aidowedding.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#8D294D] px-5 text-sm font-black text-white shadow-[0_18px_45px_rgba(141,41,77,0.25)]"
            >
              Try A.I DO
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => {
                setMessage("This phone already submitted its disposable roll.");
              }}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#E6A6B7]/70 bg-white px-4 text-xs font-black text-[#8D294D]"
            >
              <RefreshCw className="h-4 w-4" />
              Roll already submitted
            </button>
          </div>
        </div>
      )}

      {developing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#080304]/94 px-6 text-center">
          <div className="w-full max-w-xs rounded-[2rem] border border-white/12 bg-white/[0.07] px-7 py-8 shadow-2xl backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F8DDE5] text-[#8D294D]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <p className="mt-5 text-2xl font-bold">Developing your roll...</p>
            <p className="mt-2 text-sm text-white/60">
              {uploadProgress > 0 ? `${uploadProgress} of ${photoRoll.length} photos sent.` : "Sending it to the couple."}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
