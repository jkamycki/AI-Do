import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetProfile, useSaveProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Save, RotateCcw, ImageIcon, Upload, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUpload } from "@workspace/object-storage-web";
import { InvitationCropDialog } from "@/components/InvitationCropDialog";

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish",
];

const profileSchema = z.object({
  partner1Name: z.string().min(1, "Name is required"),
  partner2Name: z.string().min(1, "Name is required"),
  weddingDate: z.string().min(1, "Date is required"),
  ceremonyTime: z.string().min(1, "Time is required"),
  receptionTime: z.string().min(1, "Time is required"),
  venue: z.string().min(1, "Venue is required"),
  location: z.string().optional().default(""),
  venueCity: z.string().optional().default(""),
  venueState: z.string().optional().default(""),
  venueZip: z.string().optional().default(""),
  ceremonyAtVenue: z.boolean().default(true),
  ceremonyVenueName: z.string().optional().default(""),
  ceremonyAddress: z.string().optional().default(""),
  ceremonyCity: z.string().optional().default(""),
  ceremonyState: z.string().optional().default(""),
  ceremonyZip: z.string().optional().default(""),
  guestCount: z.coerce.number().min(1, "Must be at least 1"),
  totalBudget: z.coerce.number().min(1, "Must be at least 1"),
  weddingVibe: z.string().min(1, "Vibe is required"),
  preferredLanguage: z.string().default("English"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: profile, isLoading, isFetching, isError, error, refetch } = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: isLoaded && !!isSignedIn,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    }
  });
  const saveProfile = useSaveProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      partner1Name: "",
      partner2Name: "",
      weddingDate: "",
      ceremonyTime: "16:00",
      receptionTime: "18:00",
      venue: "",
      location: "",
      venueCity: "",
      venueState: "",
      venueZip: "",
      ceremonyAtVenue: true,
      ceremonyVenueName: "",
      ceremonyAddress: "",
      ceremonyCity: "",
      ceremonyState: "",
      ceremonyZip: "",
      guestCount: 100,
      totalBudget: 30000,
      weddingVibe: "Romantic & Elegant",
      preferredLanguage: "English",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        partner1Name: profile.partner1Name,
        partner2Name: profile.partner2Name,
        weddingDate: (profile.weddingDate ?? "").split('T')[0],
        ceremonyTime: profile.ceremonyTime,
        receptionTime: profile.receptionTime,
        venue: profile.venue,
        location: profile.location,
        venueCity: profile.venueCity ?? "",
        venueState: profile.venueState ?? "",
        venueZip: profile.venueZip ?? "",
        ceremonyAtVenue: profile.ceremonyAtVenue ?? true,
        ceremonyVenueName: profile.ceremonyVenueName ?? "",
        ceremonyAddress: profile.ceremonyAddress ?? "",
        ceremonyCity: profile.ceremonyCity ?? "",
        ceremonyState: profile.ceremonyState ?? "",
        ceremonyZip: profile.ceremonyZip ?? "",
        guestCount: profile.guestCount,
        totalBudget: profile.totalBudget,
        weddingVibe: profile.weddingVibe,
        preferredLanguage: profile.preferredLanguage ?? "English",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: ProfileFormValues) => {
    saveProfile.mutate({ data }, {
      onSuccess: () => {
        toast({
          title: t("profile.saved_toast"),
          description: t("profile.saved_toast_desc"),
        });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("profile.save_error"),
        });
      }
    });
  };

  if (isError && !profile && !isFetching) {
    const is404 = (error as any)?.status === 404;
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <p className="text-muted-foreground text-sm">
          {is404
            ? "No profile found. Please complete onboarding from the Dashboard."
            : "Could not load your profile. The server may be starting up — please try again."}
        </p>
        {!is404 && (
          <Button variant="outline" onClick={() => void refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        )}
      </div>
    );
  }

  if (isLoading || (!profile && !isError)) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-primary">{t("profile.title")}</h1>
        <p className="text-lg text-muted-foreground mt-2">{t("profile.subtitle")}</p>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
          <CardTitle className="font-serif text-2xl text-primary">{t("profile.your_details")}</CardTitle>
          <CardDescription>{t("profile.your_details_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="partner1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.groom_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder="James" {...field} data-testid="input-partner1" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="partner2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.bride_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Sophia" {...field} data-testid="input-partner2" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="weddingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.wedding_date")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="date" {...field} data-testid="input-date" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ceremonyTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.ceremony_time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-ceremony-time" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receptionTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.reception_time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-reception-time" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="venue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.venue_name")}</FormLabel>
                    <FormControl>
                      <Input placeholder="The Historic Magnolia Estate" {...field} data-testid="input-venue" className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.street_address")}</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Magnolia Lane" {...field} data-testid="input-location" className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="venueCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.city")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Charleston" {...field} data-testid="input-venue-city" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="venueState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.state")}</FormLabel>
                      <FormControl>
                        <Input placeholder="SC" {...field} data-testid="input-venue-state" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="venueZip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.zip")}</FormLabel>
                      <FormControl>
                        <Input placeholder="29401" {...field} data-testid="input-venue-zip" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-lg border border-primary/10 bg-primary/5 p-5 space-y-5">
                <FormField
                  control={form.control}
                  name="ceremonyAtVenue"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={!field.value}
                          onCheckedChange={(checked) => field.onChange(!checked)}
                          data-testid="checkbox-ceremony-at-venue"
                          className="mt-0.5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-tight">
                        <FormLabel className="cursor-pointer">{t("profile.ceremony_at_venue")}</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("profile.ceremony_at_venue_desc")}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {!form.watch("ceremonyAtVenue") && (
                  <div className="space-y-4 pt-2 border-t border-primary/10">
                    <FormField
                      control={form.control}
                      name="ceremonyVenueName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.ceremony_venue_name")}</FormLabel>
                          <FormControl>
                            <Input placeholder="St. Mary's Cathedral" {...field} data-testid="input-ceremony-venue-name" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ceremonyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.ceremony_street_address")}</FormLabel>
                          <FormControl>
                            <Input placeholder="200 Broad Street" {...field} data-testid="input-ceremony-address" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="ceremonyCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("profile.city")}</FormLabel>
                            <FormControl>
                              <Input placeholder="Charleston" {...field} data-testid="input-ceremony-city" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ceremonyState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("profile.state")}</FormLabel>
                            <FormControl>
                              <Input placeholder="SC" {...field} data-testid="input-ceremony-state" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ceremonyZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("profile.zip")}</FormLabel>
                            <FormControl>
                              <Input placeholder="29401" {...field} data-testid="input-ceremony-zip" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.guest_count")}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-guests" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.total_budget")}</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          data-testid="input-budget"
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weddingVibe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.wedding_vibe")}</FormLabel>
                    <Select
                      key={field.value || "empty"}
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background" data-testid="select-vibe">
                          <SelectValue placeholder={t("profile.select_vibe")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Romantic & Elegant">{t("profile.vibe_romantic")}</SelectItem>
                        <SelectItem value="Modern & Minimalist">{t("profile.vibe_modern")}</SelectItem>
                        <SelectItem value="Rustic & Boho">{t("profile.vibe_rustic")}</SelectItem>
                        <SelectItem value="Vintage & Classic">{t("profile.vibe_vintage")}</SelectItem>
                        <SelectItem value="Glamorous & Luxurious">{t("profile.vibe_glamorous")}</SelectItem>
                        <SelectItem value="Casual & Intimate">{t("profile.vibe_casual")}</SelectItem>
                        <SelectItem value="Whimsical & Playful">{t("profile.vibe_whimsical")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => form.reset({
                    partner1Name: "",
                    partner2Name: "",
                    weddingDate: "",
                    ceremonyTime: "",
                    receptionTime: "",
                    venue: "",
                    location: "",
                    venueCity: "",
                    venueState: "",
                    venueZip: "",
                    ceremonyAtVenue: true,
                    ceremonyVenueName: "",
                    ceremonyAddress: "",
                    ceremonyCity: "",
                    ceremonyState: "",
                    ceremonyZip: "",
                    guestCount: 0,
                    totalBudget: 0,
                    weddingVibe: "",
                    preferredLanguage: "English",
                  })}
                  className="px-6"
                  data-testid="btn-reset-profile"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t("profile.reset")}
                  </span>
                </Button>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={saveProfile.isPending}
                  className="px-8 shadow-md"
                  data-testid="btn-save-profile"
                >
                  {saveProfile.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      {t("profile.saving")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {t("profile.save_details")}
                    </span>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>

      <InvitationPhotoCard />
    </div>
  );
}

function InvitationPhotoCard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), enabled: isLoaded && !!isSignedIn },
  });

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewSrc, setPreviewSrcRaw] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [cropSrc, setCropSrcRaw] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("invitation");

  // Track blob URLs we created so we can revoke them when replaced or on
  // unmount, avoiding a slow memory leak from repeated upload + crop cycles.
  const previewBlobRef = useRef<string | null>(null);
  const cropBlobRef = useRef<string | null>(null);

  const setPreviewSrc = useCallback((next: string | null) => {
    if (previewBlobRef.current && previewBlobRef.current !== next) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    if (next?.startsWith("blob:")) previewBlobRef.current = next;
    setPreviewSrcRaw(next);
  }, []);

  const setCropSrc = useCallback((next: string | null) => {
    if (cropBlobRef.current && cropBlobRef.current !== next) {
      URL.revokeObjectURL(cropBlobRef.current);
      cropBlobRef.current = null;
    }
    if (next?.startsWith("blob:")) cropBlobRef.current = next;
    setCropSrcRaw(next);
  }, []);

  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      if (cropBlobRef.current) URL.revokeObjectURL(cropBlobRef.current);
    };
  }, []);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiDetails, setAiDetails] = useState("");
  const [generating, setGenerating] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (profile && !initializedRef.current) {
      initializedRef.current = true;
      const p = profile.invitationPhotoUrl ?? null;
      const m = profile.invitationMessage ?? null;
      const p1 = profile.partner1Name ?? "";
      const p2 = profile.partner2Name ?? "";
      setPhotoUrl(p);
      if (m) {
        setMessage(m);
      } else if (p1 || p2) {
        const couple = [p1, p2].filter(Boolean).join(" & ");
        setMessage(`Together with their families, ${couple} joyfully invite you to celebrate their wedding day with them.`);
      }
      if (p) setPreviewSrc(`/api/storage/objects/${p.replace("/objects/", "")}`);
    }
  }, [profile]);

  const [messageHighlight, setMessageHighlight] = useState(false);

  const generateMessage = async () => {
    setGenerating(true);
    try {
      const res = await authFetch("/api/profile/generate-invitation-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details: aiDetails }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      const generated = (data.message ?? "").trim();
      if (!generated) throw new Error("Empty response");
      setMessage(generated);
      setAiDetails("");
      setShowAiPanel(false);
      setMessageHighlight(true);
      setTimeout(() => setMessageHighlight(false), 2000);
    } catch {
      toast({ title: "Failed to generate message", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const { uploadFile, isUploading } = useUpload({
    getToken,
    onSuccess: (resp: { objectPath: string }) => {
      setPhotoUrl(resp.objectPath);
      // previewSrc is already set to the (cropped or original) file before upload
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 5 MB.", variant: "destructive" });
      resetFileInput();
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif"];
    if (!allowed.includes(file.type) && !file.name.toLowerCase().match(/\.(jpg|jpeg|png|heic|heif)$/)) {
      toast({ title: "Unsupported format", description: "Please upload a JPG, PNG, or HEIC photo.", variant: "destructive" });
      resetFileInput();
      return;
    }

    // HEIC/HEIF can't render in <img> in most browsers, so we can't show a cropper.
    // Upload the original directly in that case.
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name);
    if (isHeic) {
      setPreviewSrc(URL.createObjectURL(file));
      await uploadFile(file);
      return;
    }

    // For JPG/PNG, open the crop dialog before uploading.
    setCropFileName(file.name);
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (cropped: File) => {
    setCropSrc(null);
    setPreviewSrc(URL.createObjectURL(cropped));
    await uploadFile(cropped);
    resetFileInput();
  };

  const handleCropCancel = () => {
    setCropSrc(null);
    resetFileInput();
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await authFetch("/api/profile/invitation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationPhotoUrl: photoUrl, invitationMessage: message }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Invitation settings saved!" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    setRemovingPhoto(true);
    setPhotoUrl(null);
    setPreviewSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    try {
      await authFetch("/api/profile/invitation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationPhotoUrl: null }),
      });
      toast({ title: "Photo removed" });
    } catch {
      toast({ title: "Failed to remove photo", variant: "destructive" });
    } finally {
      setRemovingPhoto(false);
    }
  };

  if (profileLoading) return null;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-serif text-primary flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Digital Invitation Photo
          <span className="text-xs font-sans font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
        </CardTitle>
        <CardDescription>
          Optionally add a photo that appears at the top of your digital invitation when guests open their RSVP link. Not used for printed materials. JPG, PNG, or HEIC — max 5 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {previewSrc ? (
            <div className="relative group rounded-xl overflow-hidden border border-border/50 shadow-sm">
              <img
                src={previewSrc}
                alt="Invitation photo preview"
                className="w-full max-h-72 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Change Photo
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={removePhoto}
                  disabled={removingPhoto}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                  <p className="text-white text-sm font-medium">Uploading…</p>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary/80 hover:bg-primary/3 transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm font-medium">Uploading…</p></>
              ) : (
                <><Upload className="h-8 w-8" /><div className="text-center"><p className="text-sm font-medium">Click to upload a photo</p><p className="text-xs mt-1">Optional · For digital invitations only · JPG, PNG, or HEIC · Max 5 MB</p></div></>
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={handleFileSelect}
          />
          {cropSrc && (
            <InvitationCropDialog
              imageSrc={cropSrc}
              originalFileName={cropFileName}
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Invitation Message <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7 px-2.5 border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => setShowAiPanel(v => !v)}
            >
              <Sparkles className="h-3 w-3" />
              AI Generate
              {showAiPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          {showAiPanel && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <Textarea
                placeholder="e.g. We're getting married in a garden at sunset, it's a small intimate ceremony with close family and friends, we want guests to feel the warmth and excitement…"
                value={aiDetails}
                onChange={e => setAiDetails(e.target.value)}
                rows={3}
                className="resize-none text-sm bg-background"
              />
              <Button
                size="sm"
                className="gap-2 w-full"
                onClick={generateMessage}
                disabled={generating || !aiDetails.trim()}
              >
                {generating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                  : <><Sparkles className="h-3.5 w-3.5" /> Generate Message</>
                }
              </Button>
            </div>
          )}

          <Textarea
            placeholder="e.g. Together with their families, we joyfully invite you to celebrate our wedding…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            maxLength={400}
            className={`resize-none transition-all duration-300 ${messageHighlight ? "ring-2 ring-primary border-primary bg-primary/5" : ""}`}
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                const p1 = profile?.partner1Name ?? "";
                const p2 = profile?.partner2Name ?? "";
                const couple = [p1, p2].filter(Boolean).join(" & ");
                setMessage(couple
                  ? `Together with their families, ${couple} joyfully invite you to celebrate their wedding day with them.`
                  : "Together with their families, we joyfully invite you to celebrate our wedding day with us.");
              }}
            >
              <RefreshCw className="inline h-3 w-3 mr-1" />Reset to template
            </button>
            <p className="text-xs text-muted-foreground">{message.length}/400</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={saveSettings}
            disabled={saving || isUploading}
            className="gap-2 px-6"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Invitation Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
