import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Camera, ImagePlus, Loader2, RefreshCcw } from "lucide-react";
import { apiFetch } from "@/lib/authFetch";
import { getGuestPhotoDeviceId } from "@/lib/guestPhotoDevice";

type FacingMode = "environment" | "user";
type CameraStatus = "starting" | "ready" | "blocked" | "unsupported" | "error";
type FilmEffectId = "classic" | "warm" | "dream" | "mono";

type PendingPhoto = {
  file: File;
  previewUrl: string;
};

const SHOT_LIMIT = 10;
const DEVELOPING_DELAY_MS = 2400;

const FILM_EFFECTS: Array<{
  id: FilmEffectId;
  label: string;
  cssFilter: string;
  canvasFilter: string;
  wash: string;
}> = [
  {
    id: "classic",
    label: "Classic film",
    cssFilter: "contrast(1.12) saturate(1.2) sepia(0.16) brightness(1.03)",
    canvasFilter: "contrast(112%) saturate(120%) sepia(16%) brightness(103%)",
    wash: "rgba(255, 180, 120, 0.08)",
  },
  {
    id: "warm",
    label: "Golden hour",
    cssFilter: "contrast(1.08) saturate(1.28) sepia(0.28) brightness(1.04)",
    canvasFilter: "contrast(108%) saturate(128%) sepia(28%) brightness(104%)",
    wash: "rgba(255, 145, 92, 0.13)",
  },
  {
    id: "dream",
    label: "Soft flash",
    cssFilter: "contrast(0.96) saturate(1.08) sepia(0.12) brightness(1.12)",
    canvasFilter: "contrast(96%) saturate(108%) sepia(12%) brightness(112%)",
    wash: "rgba(248, 221, 229, 0.1)",
  },
  {
    id: "mono",
    label: "B&W keepsake",
    cssFilter: "grayscale(1) contrast(1.18) brightness(1.04)",
    canvasFilter: "grayscale(100%) contrast(118%) brightness(104%)",
    wash: "rgba(255, 255, 255, 0.02)",
  },
];

function sessionKey(slug: string) {
  return `aido_disposable_shots_remaining_${slug || "default"}`;
}

function readShotsRemaining(slug: string) {
  try {
    const stored = window.sessionStorage.getItem(sessionKey(slug));
    if (stored === null) return SHOT_LIMIT;
    const parsed = Number(stored);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= SHOT_LIMIT) return parsed;
  } catch {}
  return SHOT_LIMIT;
}

function saveShotsRemaining(slug: string, remaining: number) {
  try {
    window.sessionStorage.setItem(sessionKey(slug), String(Math.max(0, Math.min(SHOT_LIMIT, remaining))));
  } catch {}
}

function fileFromBlob(blob: Blob) {
  return new File([blob], `aido-disposable-${Date.now()}.jpg`, { type: "image/jpeg" });
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function playShutterSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(980, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(240, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    window.setTimeout(() => void context.close().catch(() => undefined), 180);
  } catch {}
}

function getFilmEffect(effectId: FilmEffectId) {
  return FILM_EFFECTS.find((effect) => effect.id === effectId) ?? FILM_EFFECTS[0];
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

  const [deviceId, setDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [shotsRemaining, setShotsRemaining] = useState(() => readShotsRemaining(slug));
  const [flash, setFlash] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<FilmEffectId>("classic");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Disposable Camera | A.I DO";
  }, []);

  useEffect(() => {
    if (!slug) return;
    setDeviceId(getGuestPhotoDeviceId(slug));
    setShotsRemaining(readShotsRemaining(slug));
  }, [slug]);

  useEffect(() => {
    return () => {
      if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.previewUrl);
    };
  }, [pendingPhoto]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1440 },
          height: { ideal: 1920 },
        },
      });
      streamRef.current = stream;
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
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  function decrementShot() {
    setShotsRemaining((current) => {
      const next = Math.max(0, current - 1);
      saveShotsRemaining(slug, next);
      return next;
    });
  }

  function showEffectPreview(file: File) {
    setSelectedEffect("classic");
    setMessage(null);
    setPendingPhoto((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }

  async function uploadDisposablePhoto(file: File) {
    setUploading(true);
    setDeveloping(true);
    setMessage(null);

    const form = new FormData();
    form.append("guestName", "Disposable Camera Guest");
    form.append("caption", "Captured with the disposable camera");
    if (deviceId) form.append("deviceId", deviceId);
    form.append("photos", file);

    try {
      const [response] = await Promise.all([
        apiFetch(`/api/website/public/${encodeURIComponent(slug)}/photo-drop`, {
          method: "POST",
          body: form,
        }),
        wait(DEVELOPING_DELAY_MS),
      ]);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((body as { error?: string })?.error || "Upload failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed. Please try again.");
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
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Could not capture this photo.");
    return fileFromBlob(blob);
  }

  async function handleShutter() {
    if (shotsRemaining <= 0 || uploading) return;
    playShutterSound();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    try {
      const file = await captureFrame();
      decrementShot();
      showEffectPreview(file);
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
    playShutterSound();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    decrementShot();
    showEffectPreview(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSendPhoto() {
    if (!pendingPhoto || uploading) return;
    try {
      const filteredPhoto = await applyFilmEffect(pendingPhoto.file, selectedEffect);
      setPendingPhoto((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
      await uploadDisposablePhoto(filteredPhoto);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send this photo.");
    }
  }

  const canShoot = status === "ready" && shotsRemaining > 0 && !uploading && !pendingPhoto;
  const activeEffect = getFilmEffect(selectedEffect);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#070203] text-white">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover ${status !== "ready" ? "opacity-0" : ""} ${facingMode === "user" ? "-scale-x-100" : ""}`}
      />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_38%,rgba(0,0,0,0.18)_60%,rgba(0,0,0,0.72)_100%)]" />
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

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 to-transparent px-5 pb-20 pt-[max(1.1rem,env(safe-area-inset-top))]">
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
          <p className={`rounded-full px-3 py-2 text-xs font-black ${shotsRemaining > 0 ? "bg-white/12 text-white" : "bg-[#F8DDE5] text-[#8D294D]"}`}>
            {shotsRemaining > 0 ? `${shotsRemaining} left` : "No shots left"}
          </p>
        </div>
      </div>

      {message && status === "ready" && (
        <div className="absolute inset-x-4 top-[max(5.25rem,calc(env(safe-area-inset-top)+4rem))] z-30 rounded-3xl border border-white/12 bg-black/72 px-4 py-3 text-center text-sm text-white shadow-xl backdrop-blur">
          {message}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/82 to-transparent px-6 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-24">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
          {shotsRemaining > 0 ? `${shotsRemaining} shot${shotsRemaining === 1 ? "" : "s"} remaining` : "No shots left"}
        </p>
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
          disabled={shotsRemaining <= 0 || uploading}
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
          onClick={() => setFacingMode((current) => (current === "environment" ? "user" : "environment"))}
          disabled={uploading}
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/14 text-white shadow-lg backdrop-blur disabled:opacity-40"
        >
          <RefreshCcw className="h-5 w-5" />
        </button>
        </div>
      </div>

      {flash && <div className="pointer-events-none absolute inset-0 z-40 bg-white" />}

      {pendingPhoto && (
        <div className="absolute inset-0 z-40 flex flex-col bg-[#080304] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.2rem,env(safe-area-inset-top))] text-white">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-full border border-white/14 bg-white/[0.07] px-4 py-3 backdrop-blur">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#F8DDE5]">Choose film</p>
              <p className="text-sm font-bold">Pick a disposable look</p>
            </div>
            <p className="rounded-full bg-[#F8DDE5] px-3 py-2 text-xs font-black text-[#8D294D]">{shotsRemaining} left</p>
          </div>

          <div className="relative mx-auto mt-5 min-h-0 w-full max-w-md flex-1 overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.05] shadow-2xl">
            <img
              src={pendingPhoto.previewUrl}
              alt="Captured photo preview"
              className="h-full w-full object-cover"
              style={{ filter: activeEffect.cssFilter }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(45,0,18,0.42)_100%)]" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#ff7878]/20 via-[#ffb478]/5 to-transparent" />
          </div>

          <div className="mx-auto mt-4 w-full max-w-md">
            <div className="grid grid-cols-2 gap-2">
              {FILM_EFFECTS.map((effect) => {
                const active = effect.id === selectedEffect;
                return (
                  <button
                    key={effect.id}
                    type="button"
                    onClick={() => setSelectedEffect(effect.id)}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${
                      active
                        ? "border-[#F8DDE5] bg-[#F8DDE5] text-[#8D294D]"
                        : "border-white/12 bg-white/[0.07] text-white"
                    }`}
                  >
                    {effect.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void handleSendPhoto()}
              disabled={uploading}
              className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-[#F8DDE5] text-sm font-black text-[#8D294D] shadow-[0_18px_45px_rgba(141,41,77,0.35)] disabled:opacity-60"
            >
              {uploading ? "Sending..." : "Use this effect"}
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
            <p className="mt-5 text-2xl font-bold">Developing your photo...</p>
            <p className="mt-2 text-sm text-white/60">Sending it to the couple.</p>
          </div>
        </div>
      )}
    </main>
  );
}
