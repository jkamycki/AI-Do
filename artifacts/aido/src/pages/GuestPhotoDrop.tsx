import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  Copy,
  Download,
  EyeOff,
  Globe,
  Image as ImageIcon,
  Loader2,
  QrCode,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { publicAppOrigin } from "@/lib/publicUrls";
import { qrSvgDataUrl } from "@/lib/localQr";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type GuestPhotoSettings = {
  enabled: boolean;
  galleryEnabled: boolean;
  displayMode: "portal" | "website" | "both";
  approvalRequired: boolean;
  maxUploads: number;
  uploadLimitMb: number;
  title: string;
  instructions: string;
};

type GuestPhotoUpload = {
  id: number;
  guestName: string;
  guestEmail?: string | null;
  note?: string | null;
  imageUrl: string;
  publicImageUrl?: string | null;
  originalName?: string | null;
  fileSize?: number | null;
  status: "pending" | "approved" | "hidden" | string;
  uploadedAt: string;
};

type GuestPhotoDropData = {
  website: {
    slug: string;
    published: boolean;
  };
  settings: GuestPhotoSettings;
  publicUploadUrl: string;
  summary: {
    total: number;
    pending: number;
    approved: number;
    hidden: number;
  };
  uploads: GuestPhotoUpload[];
};

const statusStyles: Record<string, string> = {
  pending: "border-[#D4A373]/40 bg-[#F2E2C6]/70 text-[#7A4B16]",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  hidden: "border-[#E6A6B7]/50 bg-[#F7DDE2]/60 text-[#8D294D]",
};

const displayModeCopy: Record<GuestPhotoSettings["displayMode"], { label: string; description: string }> = {
  portal: {
    label: "Portal only",
    description: "Approved photos stay inside A.I Do for the couple to review and download.",
  },
  website: {
    label: "Wedding website only",
    description: "Approved photos appear for guests on the published wedding website.",
  },
  both: {
    label: "Portal + website",
    description: "Approved photos are available in the portal and on the published wedding website.",
  },
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string })?.error || response.statusText);
  }
  return body as T;
}

function formatFileSize(size?: number | null) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GuestPhotoDrop() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<GuestPhotoSettings | null>(null);

  const photoDropQuery = useQuery<GuestPhotoDropData>({
    queryKey: ["guest-photo-drop"],
    queryFn: async () => readJson<GuestPhotoDropData>(await authFetch("/api/website/photo-drop")),
    staleTime: 15_000,
  });

  const data = photoDropQuery.data;
  const settings = draft ?? data?.settings ?? null;
  const publicUrl = useMemo(() => {
    if (!data?.website.slug) return "";
    return data.publicUploadUrl || `${publicAppOrigin()}/photo-drop/${data.website.slug}`;
  }, [data?.publicUploadUrl, data?.website.slug]);
  const qrUrl = useMemo(() => publicUrl ? qrSvgDataUrl(publicUrl, 10, 4) : "", [publicUrl]);

  const saveSettings = useMutation({
    mutationFn: async (payload: GuestPhotoSettings) => readJson<{ settings: GuestPhotoSettings }>(
      await authFetch("/api/website/photo-drop/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ),
    onSuccess: (body) => {
      setDraft(body.settings);
      queryClient.invalidateQueries({ queryKey: ["guest-photo-drop"] });
      toast({ title: "Guest Photo Drop saved" });
    },
    onError: (err) => {
      toast({
        title: "Could not save settings",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const setUploadStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => readJson<{ upload: GuestPhotoUpload }>(
      await authFetch(`/api/website/photo-drop/uploads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guest-photo-drop"] }),
    onError: (err) => {
      toast({
        title: "Could not update photo",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteUpload = useMutation({
    mutationFn: async (id: number) => readJson<{ success: boolean }>(
      await authFetch(`/api/website/photo-drop/uploads/${id}`, { method: "DELETE" }),
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guest-photo-drop"] }),
    onError: (err) => {
      toast({
        title: "Could not delete photo",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDraft = (patch: Partial<GuestPhotoSettings>) => {
    if (!settings) return;
    setDraft({ ...settings, ...patch });
  };

  const updateDraftAndSave = (patch: Partial<GuestPhotoSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setDraft(next);
    saveSettings.mutate(next);
  };

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (photoDropQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (photoDropQuery.isError) {
    const message = photoDropQuery.error instanceof Error ? photoDropQuery.error.message : "Guest Photo Drop could not load.";
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-[#E6A6B7]/50 bg-white/90 shadow-[0_24px_70px_rgba(91,15,42,0.10)]">
          <CardHeader>
            <CardTitle className="font-serif text-3xl text-[#5B0F2A]">Create your wedding website first</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-full bg-[#8D294D] px-6 text-white hover:bg-[#762140]">
              <Link href="/website-editor">Open Website Editor</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || !settings) return null;

  const uploads = data.uploads;
  const pendingUploads = uploads.filter((upload) => upload.status === "pending");
  const reviewedUploads = uploads.filter((upload) => upload.status !== "pending");
  const displayMode = settings.displayMode ?? (settings.galleryEnabled ? "both" : "portal");

  return (
    <div className="min-h-screen bg-[#FFF7F2] px-4 py-8 text-[#3B1C2B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4A373]/50 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#8D294D]">
              <Camera className="h-3.5 w-3.5 text-[#D4A373]" />
              Guest Experience
            </div>
            <h1 className="font-serif text-4xl font-bold text-[#5B0F2A] sm:text-5xl">Guest Photo Drop</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6F3E54] sm:text-base">
              Give guests a QR code on wedding day, collect their photos privately, then choose whether approved photos live in the portal, on the wedding website, or both.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => photoDropQuery.refetch()}
            className="w-fit rounded-full border-[#E6A6B7]/70 bg-white/80 text-[#8D294D] hover:bg-[#F7DDE2]/50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Pending review", value: data.summary.pending },
            { label: "Approved", value: data.summary.approved },
            { label: "Hidden", value: data.summary.hidden },
          ].map((stat) => (
            <Card key={stat.label} className="border-[#E6A6B7]/40 bg-white/85 shadow-[0_18px_50px_rgba(91,15,42,0.08)]">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8D294D]">{stat.label}</p>
                <p className="mt-2 font-serif text-4xl font-bold text-[#5B0F2A]">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="border-[#E6A6B7]/40 bg-white/90 shadow-[0_24px_70px_rgba(91,15,42,0.10)]">
            <CardHeader>
              <CardTitle className="font-serif text-2xl text-[#5B0F2A]">Photo Drop Settings</CardTitle>
              <CardDescription>Public access only works when your wedding website is published and this feature is turned on.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingSwitch
                  title="Turn on Guest Photo Drop"
                  description="Guests can open the QR link and upload photos."
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateDraftAndSave({ enabled: checked })}
                />
                <div className="rounded-2xl border border-[#E6A6B7]/45 bg-[#FFF7F2]/70 p-4">
                  <Label className="text-sm font-bold text-[#5B0F2A]">Where approved photos show</Label>
                  <Select
                    value={displayMode}
                    onValueChange={(value: GuestPhotoSettings["displayMode"]) => updateDraftAndSave({
                      displayMode: value,
                      galleryEnabled: value === "website" || value === "both",
                    })}
                  >
                    <SelectTrigger className="mt-2 rounded-xl border-[#E6A6B7]/70 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(displayModeCopy) as GuestPhotoSettings["displayMode"][]).map((value) => (
                        <SelectItem key={value} value={value}>{displayModeCopy[value].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs leading-5 text-[#6F3E54]">{displayModeCopy[displayMode].description}</p>
                </div>
                <SettingSwitch
                  title="Require approval"
                  description="New uploads stay private until you approve them."
                  checked={settings.approvalRequired}
                  onCheckedChange={(checked) => updateDraftAndSave({ approvalRequired: checked })}
                />
                <div className="rounded-2xl border border-[#E6A6B7]/45 bg-[#FFF7F2]/70 p-4">
                  <Label className="text-sm font-bold text-[#5B0F2A]">Photos per upload</Label>
                  <Select value={String(settings.maxUploads)} onValueChange={(value) => updateDraftAndSave({ maxUploads: Number(value) })}>
                    <SelectTrigger className="mt-2 rounded-xl border-[#E6A6B7]/70 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <SelectItem key={value} value={String(value)}>{value} photo{value === 1 ? "" : "s"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs leading-5 text-[#6F3E54]">{settings.uploadLimitMb} MB max per photo.</p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#5B0F2A]">Public page title</span>
                  <Input
                    value={settings.title}
                    maxLength={80}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    className="rounded-xl border-[#E6A6B7]/70 bg-white"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#5B0F2A]">Guest instructions</span>
                  <textarea
                    value={settings.instructions}
                    maxLength={500}
                    onChange={(event) => updateDraft({ instructions: event.target.value })}
                    className="min-h-28 rounded-xl border border-[#E6A6B7]/70 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7DDE2]"
                  />
                </label>
              </div>

              <Button
                type="button"
                onClick={() => saveSettings.mutate(settings)}
                disabled={saveSettings.isPending}
                className="rounded-full bg-[#8D294D] px-6 text-white hover:bg-[#762140]"
              >
                {saveSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#E6A6B7]/40 bg-white/90 shadow-[0_24px_70px_rgba(91,15,42,0.10)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl text-[#5B0F2A]">
                <QrCode className="h-5 w-5 text-[#D4A373]" />
                QR Sign Link
              </CardTitle>
              <CardDescription>Print this on a reception sign or table card.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!data.website.published && (
                <div className="rounded-2xl border border-[#D4A373]/40 bg-[#F2E2C6]/40 p-3 text-sm text-[#6F3E54]">
                  Publish your website before sharing this QR code with guests.
                </div>
              )}
              {qrUrl && (
                <div className="mx-auto w-fit rounded-3xl border border-[#E6A6B7]/50 bg-white p-4 shadow-sm">
                  <img src={qrUrl} alt="Guest Photo Drop QR code" className="h-44 w-44" />
                </div>
              )}
              <div className="flex items-center gap-2 rounded-2xl border border-[#E6A6B7]/45 bg-[#FFF7F2]/70 px-3 py-2 text-xs">
                <Globe className="h-4 w-4 shrink-0 text-[#D4A373]" />
                <span className="min-w-0 flex-1 truncate font-mono text-[#6F3E54]">{publicUrl}</span>
                <button type="button" onClick={copyPublicUrl} className="rounded-full p-1 text-[#8D294D] hover:bg-[#F7DDE2]/60">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="grid gap-2">
                <a
                  href={qrUrl}
                  download="aido-guest-photo-drop-qr.svg"
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#D4A373] px-4 text-sm font-bold text-white transition hover:opacity-90"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download QR
                </a>
                <Button asChild variant="outline" className="rounded-full border-[#E6A6B7]/70 bg-white/80 text-[#8D294D] hover:bg-[#F7DDE2]/50">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  Preview guest upload page
                </a>
              </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <UploadQueue
          title="Needs Review"
          description="Approve only the photos you want visible in the selected destination."
          empty="No photos waiting for review."
          uploads={pendingUploads}
          onApprove={(id) => setUploadStatus.mutate({ id, status: "approved" })}
          onHide={(id) => setUploadStatus.mutate({ id, status: "hidden" })}
          onDelete={(id) => deleteUpload.mutate(id)}
        />

        <UploadQueue
          title="Reviewed Photos"
          description={`Current approved photo destination: ${displayModeCopy[displayMode].label}. Hidden photos stay private.`}
          empty="No reviewed photos yet."
          uploads={reviewedUploads}
          onApprove={(id) => setUploadStatus.mutate({ id, status: "approved" })}
          onHide={(id) => setUploadStatus.mutate({ id, status: "hidden" })}
          onDelete={(id) => deleteUpload.mutate(id)}
        />
      </div>
    </div>
  );
}

function SettingSwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#E6A6B7]/45 bg-[#FFF7F2]/70 p-4">
      <div>
        <p className="font-bold text-[#5B0F2A]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#6F3E54]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function UploadQueue({
  title,
  description,
  empty,
  uploads,
  onApprove,
  onHide,
  onDelete,
}: {
  title: string;
  description: string;
  empty: string;
  uploads: GuestPhotoUpload[];
  onApprove: (id: number) => void;
  onHide: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Card className="border-[#E6A6B7]/40 bg-white/90 shadow-[0_24px_70px_rgba(91,15,42,0.10)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-2xl text-[#5B0F2A]">
          <ImageIcon className="h-5 w-5 text-[#D4A373]" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {uploads.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-3xl border border-dashed border-[#E6A6B7]/60 bg-[#FFF7F2]/60 p-6 text-center text-sm text-[#6F3E54]">
            <UploadCloud className="mb-2 h-7 w-7 text-[#D4A373]" />
            {empty}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {uploads.map((upload) => (
              <div key={upload.id} className="overflow-hidden rounded-3xl border border-[#E6A6B7]/45 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-[#FFF7F2]">
                  <AuthMediaImage
                    src={upload.imageUrl}
                    alt={upload.note || `Photo from ${upload.guestName}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#3B1C2B]">{upload.guestName}</p>
                      <p className="text-xs text-[#6F3E54]">
                        {new Date(upload.uploadedAt).toLocaleString()} {formatFileSize(upload.fileSize) ? `- ${formatFileSize(upload.fileSize)}` : ""}
                      </p>
                    </div>
                    <Badge className={statusStyles[upload.status] ?? statusStyles.pending} variant="outline">
                      {upload.status}
                    </Badge>
                  </div>
                  {upload.note && <p className="text-sm leading-6 text-[#6F3E54]">{upload.note}</p>}
                  {upload.guestEmail && <p className="truncate text-xs text-[#6F3E54]">{upload.guestEmail}</p>}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onApprove(upload.id)}
                      className="rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onHide(upload.id)}
                      className="rounded-full border-[#E6A6B7]/70 text-[#8D294D] hover:bg-[#F7DDE2]/50"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(upload.id)}
                      className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
