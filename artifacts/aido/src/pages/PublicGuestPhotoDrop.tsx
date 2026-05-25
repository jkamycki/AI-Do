import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRoute } from "wouter";
import { Camera, CheckCircle2, Heart, ImagePlus, Loader2, Lock, UploadCloud, X } from "lucide-react";
import { apiFetch } from "@/lib/authFetch";

type PublicPhotoDropPayload = {
  slug: string;
  colorPalette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  couple: {
    partner1Name: string;
    partner2Name: string;
    weddingDate?: string;
    venue?: string;
  };
  guestPhotoDrop?: {
    enabled: boolean;
    approvalRequired: boolean;
    maxUploads: number;
    uploadLimitMb: number;
    title: string;
    instructions: string;
    displayMode?: "portal" | "website" | "both";
  };
};

function coupleName(data: PublicPhotoDropPayload | null) {
  if (!data) return "A.I Do";
  return `${data.couple.partner2Name} & ${data.couple.partner1Name}`;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function PasswordGate({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF7F2] px-5 py-10 text-[#3B1C2B]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (password.trim()) onSubmit(password.trim());
        }}
        className="w-full max-w-md rounded-[2rem] border border-[#E6A6B7]/50 bg-white p-7 text-center shadow-[0_24px_70px_rgba(91,15,42,0.12)]"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F7DDE2] text-[#8D294D]">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#5B0F2A]">Private Photo Drop</h1>
        <p className="mt-2 text-sm leading-6 text-[#6F3E54]">Enter the wedding website password to upload photos.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          placeholder="Password"
          className="mt-6 h-12 w-full rounded-2xl border border-[#E6A6B7]/70 bg-white px-4 text-base outline-none focus:ring-2 focus:ring-[#F7DDE2]"
          disabled={loading}
        />
        {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#8D294D] px-5 font-bold text-white shadow-lg shadow-[#8D294D]/20 transition hover:bg-[#762140] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Open Photo Drop
        </button>
      </form>
    </main>
  );
}

export default function PublicGuestPhotoDrop() {
  const [, params] = useRoute("/photo-drop/:slug");
  const slug = params?.slug ?? "";
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);

  const [data, setData] = useState<PublicPhotoDropPayload | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const drop = data?.guestPhotoDrop;
  const maxUploads = drop?.maxUploads ?? 5;
  const uploadLimitMb = drop?.uploadLimitMb ?? 5;
  const primary = data?.colorPalette?.primary || "#8D294D";
  const accent = data?.colorPalette?.accent || "#D4A373";

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setNeedsPassword(false);
    setData(null);
    apiFetch(`/api/website/public/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (response.status === 401) {
          const body = await response.json().catch(() => ({}));
          if (body?.passwordRequired) {
            setNeedsPassword(true);
            return;
          }
        }
        if (response.status === 404) {
          setError("This photo drop is not available yet.");
          return;
        }
        if (!response.ok) {
          setError("We could not load this photo drop. Please try again.");
          return;
        }
        const body = (await response.json()) as PublicPhotoDropPayload;
        setData(body);
      })
      .catch(() => setError("We could not load this photo drop. Please try again."))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    document.title = data ? `${coupleName(data)} Photo Drop` : "Guest Photo Drop";
  }, [data]);

  const unlock = async (nextPassword: string) => {
    setUnlocking(true);
    setPasswordError(null);
    try {
      const response = await apiFetch(`/api/website/public/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nextPassword }),
      });
      if (response.status === 401) {
        setPasswordError("That password did not work. Please try again.");
        return;
      }
      if (!response.ok) {
        setPasswordError("We could not unlock this photo drop. Please try again.");
        return;
      }
      const body = (await response.json()) as PublicPhotoDropPayload;
      setPassword(nextPassword);
      setData(body);
      setNeedsPassword(false);
    } catch {
      setPasswordError("We could not unlock this photo drop. Please try again.");
    } finally {
      setUnlocking(false);
    }
  };

  const addFiles = (selected: FileList | null) => {
    const incoming = Array.from(selected ?? []);
    if (incoming.length === 0) return;
    setSubmitError(null);
    setSuccess(null);
    const limitBytes = uploadLimitMb * 1024 * 1024;
    const oversized = incoming.find((file) => file.size > limitBytes);
    if (oversized) {
      setSubmitError(`${oversized.name} is too large. Each photo must be ${uploadLimitMb} MB or less.`);
      return;
    }
    const imagesOnly = incoming.filter((file) => file.type.startsWith("image/"));
    if (imagesOnly.length !== incoming.length) {
      setSubmitError("Please choose photos only.");
      return;
    }
    setFiles((current) => [...current, ...imagesOnly].slice(0, maxUploads));
  };

  const submitPhotos = async (event: FormEvent) => {
    event.preventDefault();
    if (!drop?.enabled) return;
    if (!guestName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (files.length === 0) {
      setSubmitError("Please take or choose at least one photo.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSuccess(null);
    const form = new FormData();
    form.append("guestName", guestName.trim());
    if (guestEmail.trim()) form.append("guestEmail", guestEmail.trim());
    if (note.trim()) form.append("note", note.trim());
    files.forEach((file) => form.append("photos", file));
    try {
      const response = await apiFetch(`/api/website/public/${encodeURIComponent(slug)}/photo-drop`, {
        method: "POST",
        headers: password ? { "X-Site-Password": password } : undefined,
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((body as { error?: string })?.error || "Upload failed.");
      setSuccess((body as { message?: string })?.message || "Your photos were sent. Thank you!");
      setFiles([]);
      setNote("");
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data && !needsPassword && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8D294D]" />
      </main>
    );
  }

  if (needsPassword) {
    return <PasswordGate loading={unlocking} error={passwordError} onSubmit={unlock} />;
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7F2] px-5 text-center">
        <div className="max-w-md rounded-[2rem] border border-[#E6A6B7]/50 bg-white p-7 shadow-[0_24px_70px_rgba(91,15,42,0.12)]">
          <h1 className="font-serif text-3xl font-bold text-[#5B0F2A]">Photo Drop Unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-[#6F3E54]">{error ?? "This photo drop is not available yet."}</p>
        </div>
      </main>
    );
  }

  if (!drop?.enabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7F2] px-5 text-center">
        <div className="max-w-md rounded-[2rem] border border-[#E6A6B7]/50 bg-white p-7 shadow-[0_24px_70px_rgba(91,15,42,0.12)]">
          <Heart className="mx-auto mb-4 h-9 w-9 text-[#D4A373]" />
          <h1 className="font-serif text-3xl font-bold text-[#5B0F2A]">Photo Drop Is Off</h1>
          <p className="mt-3 text-sm leading-6 text-[#6F3E54]">The couple has not turned on guest photo uploads yet.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF7F2] px-4 py-5 text-[#3B1C2B]">
      <div className="mx-auto max-w-lg">
        <section className="overflow-hidden rounded-[2.2rem] border border-[#E6A6B7]/50 bg-white shadow-[0_24px_70px_rgba(91,15,42,0.14)]">
          <div className="bg-gradient-to-br from-[#FFF7F2] via-[#F7DDE2]/70 to-[#F2E2C6]/50 px-6 pb-7 pt-8 text-center">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
            >
              <Camera className="h-8 w-8" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8D294D]">Guest Photo Drop</p>
            <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-[#5B0F2A]">{coupleName(data)}</h1>
            <p className="mt-3 text-sm leading-6 text-[#6F3E54]">{drop.instructions}</p>
          </div>

          <form onSubmit={submitPhotos} className="space-y-5 px-5 py-6">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex min-h-28 flex-col items-center justify-center rounded-[1.6rem] border border-[#E6A6B7]/60 bg-[#FFF7F2] px-3 text-center font-bold text-[#5B0F2A] shadow-sm"
              >
                <Camera className="mb-2 h-7 w-7 text-[#8D294D]" />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                className="flex min-h-28 flex-col items-center justify-center rounded-[1.6rem] border border-[#E6A6B7]/60 bg-[#FFF7F2] px-3 text-center font-bold text-[#5B0F2A] shadow-sm"
              >
                <ImagePlus className="mb-2 h-7 w-7 text-[#D4A373]" />
                Choose Photos
              </button>
            </div>

            <p className="text-center text-xs leading-5 text-[#6F3E54]">
              Add up to {maxUploads} photos. {uploadLimitMb} MB max each.
            </p>

            {files.length > 0 && (
              <div className="space-y-2 rounded-[1.5rem] border border-[#E6A6B7]/45 bg-[#FFF7F2]/80 p-3">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-[#6F3E54]">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      className="rounded-full p-1 text-[#8D294D] hover:bg-[#F7DDE2]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="grid gap-1.5 text-sm font-bold text-[#5B0F2A]">
              Your name
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                maxLength={120}
                placeholder="Jane Smith"
                className="h-12 rounded-2xl border border-[#E6A6B7]/70 bg-white px-4 text-base font-normal outline-none focus:ring-2 focus:ring-[#F7DDE2]"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-[#5B0F2A]">
              Email optional
              <input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                maxLength={200}
                placeholder="you@example.com"
                className="h-12 rounded-2xl border border-[#E6A6B7]/70 bg-white px-4 text-base font-normal outline-none focus:ring-2 focus:ring-[#F7DDE2]"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-[#5B0F2A]">
              Note optional
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="A quick caption or memory"
                className="rounded-2xl border border-[#E6A6B7]/70 bg-white px-4 py-3 text-base font-normal outline-none focus:ring-2 focus:ring-[#F7DDE2]"
              />
            </label>

            {submitError && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>}
            {success && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#8D294D] px-5 text-base font-bold text-white shadow-lg shadow-[#8D294D]/20 transition hover:bg-[#762140] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
              Upload Photos
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
