import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Gift, Globe, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  parseRegistryLinks,
  type RegistryLink,
  type WebsiteRendererPayload,
} from "@/components/website/WebsiteRenderer";
import { stripEditableHiddenMarkers } from "@/components/website/hiddenMarker";

type WebsiteRecord = WebsiteRendererPayload & {
  id: number;
  slug: string;
  published: boolean;
  lastUpdated?: string;
};

const REGISTRY_QUERY_KEY = ["portal-registry-website"];

const DEFAULT_TITLE = "Registry";
const DEFAULT_SUBTITLE = "With love";
const DEFAULT_NOTE = "Your presence is the greatest gift. If you would like to celebrate with a gift, our registry details are below.";

const emptyLink = (): RegistryLink => ({
  name: "",
  url: "",
});

async function fetchOrCreateWebsite(): Promise<WebsiteRecord> {
  const current = await authFetch("/api/website/me");
  if (current.ok) return current.json();
  if (current.status !== 404) {
    const body = await current.json().catch(() => ({}));
    throw new Error(body?.error || "Could not load registry settings.");
  }

  const created = await authFetch("/api/website/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!created.ok) {
    const body = await created.json().catch(() => ({}));
    throw new Error(body?.error || "Could not create your wedding website.");
  }
  return created.json();
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function Registry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draftLinks, setDraftLinks] = useState<RegistryLink[] | null>(null);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [draftSubtitle, setDraftSubtitle] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [draftEnabled, setDraftEnabled] = useState<boolean | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: REGISTRY_QUERY_KEY,
    queryFn: fetchOrCreateWebsite,
  });

  const links = draftLinks ?? parseRegistryLinks(data?.customText?._registryLinks);
  const title = stripEditableHiddenMarkers(draftTitle ?? data?.customText?.registry_title) || DEFAULT_TITLE;
  const subtitle = stripEditableHiddenMarkers(draftSubtitle ?? data?.customText?.registry_subtitle) || DEFAULT_SUBTITLE;
  const note = stripEditableHiddenMarkers(draftNote ?? data?.customText?.registry) || DEFAULT_NOTE;
  const enabled = draftEnabled ?? data?.sectionsEnabled?.registry ?? true;

  const publicUrl = useMemo(() => {
    if (!data?.slug) return "";
    return `${window.location.origin}/${data.slug}/registry`;
  }, [data?.slug]);

  const hasChanges = !!data && (
    draftLinks !== null ||
    draftTitle !== null ||
    draftSubtitle !== null ||
    draftNote !== null ||
    draftEnabled !== null
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Registry settings are not loaded yet.");
      const cleanedLinks = links
        .map((link) => ({
          name: link.name.trim(),
          url: normalizeUrl(link.url),
        }))
        .filter((link) => link.name || link.url);

      const response = await authFetch("/api/website/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionsEnabled: {
            ...data.sectionsEnabled,
            registry: enabled,
          },
          customText: {
            ...data.customText,
            registry_title: stripEditableHiddenMarkers(title) || DEFAULT_TITLE,
            registry_subtitle: stripEditableHiddenMarkers(subtitle) || DEFAULT_SUBTITLE,
            registry: stripEditableHiddenMarkers(note) || DEFAULT_NOTE,
            _registryLinks: JSON.stringify(cleanedLinks),
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Could not save registry.");
      }
      return response.json() as Promise<WebsiteRecord>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(REGISTRY_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEY });
      setDraftLinks(null);
      setDraftTitle(null);
      setDraftSubtitle(null);
      setDraftNote(null);
      setDraftEnabled(null);
      toast({ title: "Registry synced to website" });
    },
    onError: (err: Error) => {
      toast({
        title: "Registry could not be saved",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateLink = (index: number, patch: Partial<RegistryLink>) => {
    const next = links.map((link, i) => (i === index ? { ...link, ...patch } : link));
    setDraftLinks(next);
  };

  const removeLink = (index: number) => {
    setDraftLinks(links.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-primary/10" />
          <div className="h-56 animate-pulse rounded-2xl bg-primary/10" />
          <div className="h-80 animate-pulse rounded-2xl bg-primary/10" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl border-destructive/20">
          <CardHeader>
            <CardTitle>Registry could not load</CardTitle>
            <CardDescription>{error instanceof Error ? error.message : "Please refresh and try again."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Wedding website</p>
            <h1 className="font-serif text-4xl text-foreground">Registry</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Add gift registry wording and links here. This syncs directly to the Registry section in Website Editor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" disabled={!publicUrl}>
              <Link href="/website-editor?section=registry">
                <Globe className="mr-2 h-4 w-4" />
                Open editor
              </Link>
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save registry
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Website registry section
                </CardTitle>
                <CardDescription>
                  Turn this on when you want registry details visible to guests.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-primary/15 bg-primary/5 px-4 py-2">
                <Label htmlFor="registry-enabled" className="text-sm font-semibold">
                  Show on website
                </Label>
                <Switch
                  id="registry-enabled"
                  checked={enabled}
                  onCheckedChange={(checked) => setDraftEnabled(checked)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="registry-title">Section title</Label>
                  <Input
                    id="registry-title"
                    value={title}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder={DEFAULT_TITLE}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registry-subtitle">Subtitle</Label>
                  <Input
                    id="registry-subtitle"
                    value={subtitle}
                    onChange={(event) => setDraftSubtitle(event.target.value)}
                    placeholder={DEFAULT_SUBTITLE}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registry-note">Registry message</Label>
                <Textarea
                  id="registry-note"
                  value={note}
                  onChange={(event) => setDraftNote(event.target.value)}
                  placeholder={DEFAULT_NOTE}
                  className="min-h-[130px]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Guest preview</p>
              <h2 className="mt-3 font-serif text-3xl text-foreground">{title || DEFAULT_TITLE}</h2>
              <p className="mt-1 text-sm font-medium text-primary">{subtitle || DEFAULT_SUBTITLE}</p>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{note || DEFAULT_NOTE}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {links.filter((link) => link.name || link.url).slice(0, 4).map((link, index) => (
                  <span
                    key={`${link.name}-${index}`}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    {link.name || "Registry link"}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                ))}
                {links.filter((link) => link.name || link.url).length === 0 && (
                  <span className="text-xs text-muted-foreground">Add registry links below.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registry links</CardTitle>
            <CardDescription>
              Add one or more buttons for Zola, Amazon, Target, honeymoon funds, or any custom registry URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {links.length === 0 && (
              <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-5 text-sm text-muted-foreground">
                No registry links yet.
              </div>
            )}
            {links.map((link, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-primary/15 p-3 sm:grid-cols-[0.7fr_1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`registry-label-${index}`}>Button label</Label>
                  <Input
                    id={`registry-label-${index}`}
                    value={link.name}
                    onChange={(event) => updateLink(index, { name: event.target.value })}
                    placeholder="Zola Registry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`registry-url-${index}`}>Registry URL</Label>
                  <Input
                    id={`registry-url-${index}`}
                    value={link.url}
                    onChange={(event) => updateLink(index, { url: event.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeLink(index)}
                  aria-label="Remove registry link"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraftLinks([...links, emptyLink()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add registry link
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
