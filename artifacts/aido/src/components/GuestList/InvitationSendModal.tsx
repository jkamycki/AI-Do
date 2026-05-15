import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, Loader2, AlertTriangle, Eye, Heart, CheckCircle2, XCircle,
  MapPin, Paintbrush, ChevronRight, Calendar, User, ImageOff, Mail,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { Guest } from "@workspace/api-client-react";
import type { TextOverrides, ColorPalette } from "@/types/invitations";
import { SaveTheDatePreview } from "@/components/InvitationCustomization/SaveTheDatePreview";
import { AiSaveDatePreview, AiDigitalInvitationPreview, type CustomColors } from "@/components/InvitationCustomization/AiPreviewComponents";
import { AnimatedInvitationShell } from "@/components/InvitationCustomization/AnimatedInvitationShell";
import { evaluateCustomDesignCompleteness } from "@/lib/customDesignValidation";

interface Customization {
  useGeneratedInvitation: boolean;
  saveTheDatePhotoUrl: string | null;
  digitalInvitationPhotoUrl: string | null;
  saveTheDatePhotoPosition: { x: number; y: number } | null;
  digitalInvitationPhotoPosition: { x: number; y: number } | null;
  colorPalette: ColorPalette | null;
  customColors: Partial<ColorPalette> | null;
  selectedFont: string | null;
  selectedLayout: string | null;
  saveTheDateFont: string;
  digitalInvitationFont: string;
  saveTheDateLayout: string;
  digitalInvitationLayout: string;
  saveTheDateBackground: string | null;
  digitalInvitationBackground: string | null;
  saveTheDateFontColor: string | null;
  digitalInvitationFontColor: string | null;
  saveTheDateFontSize: string | null;
  digitalInvitationFontSize: string | null;
  saveTheDateAccentColor: string | null;
  digitalInvitationAccentColor: string | null;
  textOverrides: TextOverrides;
  // Couple-set RSVP deadline (YYYY-MM-DD) shown on the RSVP invitation.
  rsvpByDate?: string | null;
}

interface Profile {
  id?: number;
  partner1Name?: string | null;
  partner2Name?: string | null;
  weddingDate?: string | null;
  venue?: string | null;
  location?: string | null;
  venueAddress?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
  venueZip?: string | null;
  ceremonyTime?: string | null;
  receptionTime?: string | null;
  invitationMessage?: string | null;
  saveTheDateMessage?: string | null;
  ceremonyAtVenue?: boolean;
  ceremonyVenueName?: string | null;
  ceremonyAddress?: string | null;
  ceremonyCity?: string | null;
  ceremonyState?: string | null;
  ceremonyZip?: string | null;
}

interface Props {
  guest: Guest | null;
  profile: Profile | null;
  onClose: () => void;
  onSendSaveTheDate: (guestId: number) => void;
  onSendDigitalInvitation: (guestId: number) => void;
  onSendRsvpReminder?: (guestId: number) => void;
  isSendingSaveTheDate: boolean;
  isSendingDigital: boolean;
  isSendingRsvpReminder?: boolean;
  defaultTab?: "saveTheDate" | "digitalInvitation";
  reminderOnly?: boolean;
}

function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatWeddingDate(dateStr: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string | null {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", opts ?? {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta = "'Plus Jakarta Sans', system-ui, sans-serif";

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "steak", label: "Steak" },
  { value: "fish", label: "Fish" },
  { value: "none", label: "None / No preference" },
];

const rsvpSchema = z.object({
  attendance: z.enum(["attending", "declined"], { required_error: "Please select Accept or Decline." }),
  mealChoice: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
  plusOneMealChoice: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
});

type RsvpFormData = z.infer<typeof rsvpSchema>;

function isPhotoComplete(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("blob:")) return false;
  return true;
}


function RsvpSimulation({ guest, profile }: { guest: Guest; profile: Profile }) {
  const form = useForm<RsvpFormData>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      attendance: undefined,
      mealChoice: "",
      plusOne: false,
      plusOneFirstName: "",
      plusOneLastName: "",
      plusOneMealChoice: "",
      dietaryRestrictions: "",
    },
  });

  const attendance = form.watch("attendance");
  const plusOne = form.watch("plusOne");

  const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const weddingDateStr = formatWeddingDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const ceremonyTimeStr = formatTime(profile.ceremonyTime);
  const receptionTimeStr = formatTime(profile.receptionTime);
  const cityStateZip = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const ceremonyCityStateZip = [
    profile.ceremonyCity,
    [profile.ceremonyState, profile.ceremonyZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const hasSeparateCeremony = !!(
    !profile.ceremonyAtVenue &&
    (profile.ceremonyVenueName || profile.ceremonyAddress || profile.ceremonyCity)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Badge variant="secondary" className="text-xs gap-1.5 py-1">
          <Eye className="h-3 w-3" /> Preview Mode — Not Submitted
        </Badge>
        <span className="text-xs text-muted-foreground">This is exactly what your guest will see</span>
      </div>

      <div className="rounded-xl overflow-hidden border border-border" style={{ background: "#1a141f" }}>
        <div className="p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Heart className="h-7 w-7 fill-primary text-primary" />
            </div>
          </div>
          <div>
            <p style={{ fontFamily: jakarta, fontSize: "10px", fontWeight: 600, letterSpacing: "0.4em", textTransform: "uppercase", color: "hsl(var(--primary))" }}>
              Wedding RSVP
            </p>
            <h3 style={{ fontFamily: cormorant, fontSize: "1.8rem", fontWeight: 400, fontStyle: "italic", color: "#fff", lineHeight: 1.15, marginTop: "6px" }}>
              {couple}
            </h3>
            {weddingDateStr && (
              <p style={{ fontFamily: jakarta, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>
                {weddingDateStr}
              </p>
            )}
          </div>
          {hasSeparateCeremony ? (
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              <div className="rounded-lg border p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                <p style={{ fontFamily: jakarta, fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "hsl(var(--primary))", marginBottom: "4px" }}>Ceremony</p>
                {ceremonyTimeStr && <p style={{ fontFamily: jakarta, fontSize: "13px", fontWeight: 600, color: "#fff" }}>{ceremonyTimeStr}</p>}
                {profile.ceremonyVenueName && <p style={{ fontFamily: cormorant, fontSize: "14px", color: "rgba(255,255,255,0.8)", marginTop: "2px" }}>{profile.ceremonyVenueName}</p>}
                {profile.ceremonyAddress && <p style={{ fontFamily: jakarta, fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{profile.ceremonyAddress}</p>}
                {ceremonyCityStateZip && <p style={{ fontFamily: jakarta, fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{ceremonyCityStateZip}</p>}
              </div>
              <div className="rounded-lg border p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                <p style={{ fontFamily: jakarta, fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "hsl(var(--primary))", marginBottom: "4px" }}>Reception</p>
                {receptionTimeStr && <p style={{ fontFamily: jakarta, fontSize: "13px", fontWeight: 600, color: "#fff" }}>{receptionTimeStr}</p>}
                {profile.venue && <p style={{ fontFamily: cormorant, fontSize: "14px", color: "rgba(255,255,255,0.8)", marginTop: "2px" }}>{profile.venue}</p>}
                {profile.venueAddress && <p style={{ fontFamily: jakarta, fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{profile.venueAddress}</p>}
                {cityStateZip && <p style={{ fontFamily: jakarta, fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{cityStateZip}</p>}
              </div>
            </div>
          ) : profile.venue ? (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary/80" />
                <p style={{ fontFamily: cormorant, fontSize: "1.1rem", color: "rgba(255,255,255,0.8)" }}>{profile.venue}</p>
              </div>
              {profile.venueAddress && <p style={{ fontFamily: jakarta, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{profile.venueAddress}</p>}
              {cityStateZip && <p style={{ fontFamily: jakarta, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{cityStateZip}</p>}
              {(ceremonyTimeStr || receptionTimeStr) && (
                <p style={{ fontFamily: jakarta, fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
                  {[ceremonyTimeStr && `Ceremony ${ceremonyTimeStr}`, receptionTimeStr && `Reception ${receptionTimeStr}`].filter(Boolean).join("  ·  ")}
                </p>
              )}
            </div>
          ) : null}
          {profile.invitationMessage && (
            <p style={{ fontFamily: cormorant, fontSize: "1rem", fontStyle: "italic", lineHeight: 1.7, color: "rgba(255,255,255,0.7)" }}>
              &ldquo;{profile.invitationMessage}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="h-1 w-full bg-primary" />
        <div className="p-5 space-y-5">
          <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
            Dear <span className="font-semibold text-white">{guest.name}</span>, will you be joining us?
          </p>

          <Form {...form}>
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <FormField
                control={form.control}
                name="attendance"
                render={({ field }) => (
                  <FormItem>
                    <FormMessage className="text-center" />
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => field.onChange("attending")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          field.value === "attending"
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                            : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                        }`}
                      >
                        <CheckCircle2 className={`h-6 w-6 ${field.value === "attending" ? "text-emerald-400" : "text-white/40"}`} />
                        <span className="font-semibold text-sm">Joyfully Accepts</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("declined")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          field.value === "declined"
                            ? "border-red-500 bg-red-500/15 text-red-300"
                            : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                        }`}
                      >
                        <XCircle className={`h-6 w-6 ${field.value === "declined" ? "text-red-400" : "text-white/40"}`} />
                        <span className="font-semibold text-sm">Declines with Regrets</span>
                      </button>
                    </div>
                  </FormItem>
                )}
              />

              {attendance === "attending" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <FormField
                    control={form.control}
                    name="mealChoice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-white/50" /> Your Meal Selection
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/10 border-white/15 text-white">
                              <SelectValue placeholder="Select a meal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MEAL_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(guest as any).plusOneAllowed !== false && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="plusOne"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <div>
                              <FormLabel className="text-white/90 text-base">Are you bringing a plus one?</FormLabel>
                              <p className="text-xs text-white/50 mt-0.5">You&apos;re welcome to bring a guest with you.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => field.onChange(true)}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                  field.value ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
                                }`}
                              >Yes</button>
                              <button
                                type="button"
                                onClick={() => field.onChange(false)}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                  !field.value ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
                                }`}
                              >No</button>
                            </div>
                          </FormItem>
                        )}
                      />
                      {plusOne && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="plusOneFirstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Guest first name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="First name" className="bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:border-primary" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="plusOneLastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Guest last name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Last name" className="bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:border-primary" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="plusOneMealChoice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white/80 flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-white/50" /> Guest&apos;s Meal Selection
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-white/10 border-white/15 text-white">
                                      <SelectValue placeholder="Select a meal" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {MEAL_OPTIONS.map(o => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="dietaryRestrictions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">Dietary restrictions or notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. vegetarian, gluten-free, nut allergy — leave blank if none"
                            className="bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:border-primary resize-none min-h-[70px]"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button
                type="button"
                className="w-full font-semibold py-4 rounded-xl opacity-60 cursor-not-allowed"
                disabled
                size="lg"
              >
                <Heart className="h-4 w-4 mr-2 fill-current" /> Submit RSVP
                <span className="ml-2 text-xs font-normal opacity-80">(preview only)</span>
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

const PHOTO_LABELS = new Set(["Save the Date photo", "RSVP Invitation photo"]);

function BlockedScreen({
  onGoToCustomization,
  onClose,
  missing,
  onContinueWithoutPhotos,
}: {
  onGoToCustomization: () => void;
  onClose: () => void;
  missing: string[];
  onContinueWithoutPhotos: () => void;
}) {
  const [showPhotoConfirm, setShowPhotoConfirm] = useState(false);
  const onlyPhotosMissing = missing.length > 0 && missing.every((m) => PHOTO_LABELS.has(m));

  if (showPhotoConfirm) {
    return (
      <div className="flex flex-col items-center text-center gap-6 py-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center ring-1 ring-border">
          <ImageOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-lg font-semibold text-foreground">Continue without photos?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your invitation will be sent without a photo. You can always add photos later from the Invitation Customization page.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={onContinueWithoutPhotos} className="gap-2">
            <Send className="h-4 w-4" /> Yes, send without photos
          </Button>
          <Button variant="outline" onClick={onGoToCustomization} className="gap-2">
            <Paintbrush className="h-4 w-4" /> No, add photos instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-6 py-6">
      <div className="h-16 w-16 rounded-full bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold text-foreground">Custom design is not finished</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your custom design is not finished. Please complete your customization or switch to an AI-generated design before sending.
        </p>
        {missing.length > 0 && (
          <div className="pt-2 text-left rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Still needed:</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={onGoToCustomization} className="gap-2">
          <Paintbrush className="h-4 w-4" /> Complete My Design
          <ChevronRight className="h-4 w-4" />
        </Button>
        {onlyPhotosMissing && (
          <Button variant="outline" onClick={() => setShowPhotoConfirm(true)} className="gap-2">
            <Send className="h-4 w-4" /> Continue without photos
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function InvitationSendModal({
  guest,
  profile,
  onClose,
  onSendSaveTheDate,
  onSendDigitalInvitation,
  onSendRsvpReminder,
  isSendingSaveTheDate,
  isSendingDigital,
  isSendingRsvpReminder,
  defaultTab = "saveTheDate",
  reminderOnly = false,
}: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"saveTheDate" | "digitalInvitation">(defaultTab);
  const [bypassBlock, setBypassBlock] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!guest) setBypassBlock(false);
  }, [guest?.id]);

  // Share the cache key with InvitationCustomization so the optimistic theme
  // updates from the customization page are reflected here immediately.
  const { data: rawCustomization, isLoading: loadingCustomization } = useQuery({
    queryKey: ["invitation-customizations", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const r = await authFetch(`/api/invitation-customizations?profileId=${profile.id}`);
      if (!r.ok) throw new Error("Failed to fetch customizations");
      return r.json();
    },
    enabled: !!guest && !!profile?.id,
    // Prefer the optimistic cache updates from the customization page over an
    // immediate re-fetch. 30 s is long enough to cover theme-pick → modal-open
    // in the same session without showing stale data across sessions.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const customization: Customization | null = rawCustomization
    ? {
        useGeneratedInvitation: rawCustomization.useGeneratedInvitation !== false,
        saveTheDatePhotoUrl: rawCustomization.saveTheDatePhotoUrl ?? null,
        digitalInvitationPhotoUrl: rawCustomization.digitalInvitationPhotoUrl ?? null,
        saveTheDatePhotoPosition: rawCustomization.saveTheDatePhotoPosition ?? null,
        digitalInvitationPhotoPosition: rawCustomization.digitalInvitationPhotoPosition ?? null,
        colorPalette: rawCustomization.colorPalette ?? null,
        customColors: rawCustomization.customColors ?? null,
        selectedFont: rawCustomization.selectedFont ?? null,
        selectedLayout: rawCustomization.selectedLayout ?? null,
        saveTheDateFont: rawCustomization.saveTheDateFont || rawCustomization.selectedFont || "Playfair Display",
        digitalInvitationFont: rawCustomization.digitalInvitationFont || rawCustomization.selectedFont || "Playfair Display",
        saveTheDateLayout: rawCustomization.saveTheDateLayout || rawCustomization.selectedLayout || "classic",
        digitalInvitationLayout: rawCustomization.digitalInvitationLayout || rawCustomization.selectedLayout || "classic",
        saveTheDateBackground: rawCustomization.saveTheDateBackground ?? null,
        digitalInvitationBackground: rawCustomization.digitalInvitationBackground ?? null,
        saveTheDateFontColor: rawCustomization.saveTheDateFontColor ?? null,
        digitalInvitationFontColor: rawCustomization.digitalInvitationFontColor ?? null,
        saveTheDateFontSize: rawCustomization.saveTheDateFontSize ?? null,
        digitalInvitationFontSize: rawCustomization.digitalInvitationFontSize ?? null,
        saveTheDateAccentColor: rawCustomization.saveTheDateAccentColor ?? null,
        digitalInvitationAccentColor: rawCustomization.digitalInvitationAccentColor ?? null,
        textOverrides: rawCustomization.textOverrides ?? {},
        rsvpByDate: rawCustomization.rsvpByDate ?? null,
      }
    : null;

  const setCustomization = (
    updater: (c: Customization | null) => Customization | null,
  ) => {
    if (!profile?.id) return;
    queryClient.setQueryData<typeof rawCustomization>(
      ["invitation-customizations", profile.id],
      (old: typeof rawCustomization) => {
        const cur = old
          ? {
              useGeneratedInvitation: old.useGeneratedInvitation !== false,
              saveTheDatePhotoUrl: old.saveTheDatePhotoUrl ?? null,
              digitalInvitationPhotoUrl: old.digitalInvitationPhotoUrl ?? null,
              saveTheDatePhotoPosition: old.saveTheDatePhotoPosition ?? null,
              digitalInvitationPhotoPosition: old.digitalInvitationPhotoPosition ?? null,
              colorPalette: old.colorPalette ?? null,
              customColors: old.customColors ?? null,
              selectedFont: old.selectedFont ?? null,
              selectedLayout: old.selectedLayout ?? null,
              saveTheDateFont: old.saveTheDateFont || old.selectedFont || "Playfair Display",
              digitalInvitationFont: old.digitalInvitationFont || old.selectedFont || "Playfair Display",
              saveTheDateLayout: old.saveTheDateLayout || old.selectedLayout || "classic",
              digitalInvitationLayout: old.digitalInvitationLayout || old.selectedLayout || "classic",
              saveTheDateBackground: old.saveTheDateBackground ?? null,
              digitalInvitationBackground: old.digitalInvitationBackground ?? null,
              saveTheDateFontColor: old.saveTheDateFontColor ?? null,
              digitalInvitationFontColor: old.digitalInvitationFontColor ?? null,
              saveTheDateFontSize: old.saveTheDateFontSize ?? null,
              digitalInvitationFontSize: old.digitalInvitationFontSize ?? null,
              saveTheDateAccentColor: old.saveTheDateAccentColor ?? null,
              digitalInvitationAccentColor: old.digitalInvitationAccentColor ?? null,
              textOverrides: old.textOverrides ?? {},
              rsvpByDate: old.rsvpByDate ?? null,
            }
          : null;
        const next = updater(cur);
        if (!next) return old;
        return { ...(old ?? {}), ...next };
      },
    );
  };

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleGoToCustomization = () => {
    onClose();
    window.location.href = `${base}/invitation-customization`;
  };

  const palette: ColorPalette = {
    ...(customization?.colorPalette ?? {
      primary: "#D4A017",
      secondary: "#F5C842",
      accent: "#D4A017",
      neutral: "#E8E0D0",
    }),
    ...(customization?.customColors ?? {}),
  };

  const isCustomMode = customization ? !customization.useGeneratedInvitation : false;

  // Build previewCustomColors using the exact same formula as InvitationCustomization's
  // previewCustomColors — this guarantees both previews are pixel-for-pixel identical.
  // Each invitation type uses its own saved accent color so STD and RSVP are independent.
  const fallbackAccent = palette.accent || "#D4A017";
  // Prefer the dedicated per-invitation column, then the JSONB backup key
  // stored inside customColors (written by buildPayload as a migration safety net).
  const stdAccent =
    (isCustomMode && (customization?.saveTheDateAccentColor || customization?.customColors?.saveTheDateAccent)) ||
    fallbackAccent;
  const digAccent =
    (isCustomMode && (customization?.digitalInvitationAccentColor || customization?.customColors?.digitalInvitationAccent)) ||
    fallbackAccent;
  const stdFontColor = customization?.saveTheDateFontColor ?? "#222222";
  const digFontColor = customization?.digitalInvitationFontColor ?? "#222222";
  const stdPreviewColors: CustomColors | undefined = isCustomMode && customization
    ? {
        bg: customization.saveTheDateBackground ?? "#FFFFFF",
        accent: stdAccent,
        text: stdFontColor,
        muted: stdFontColor + "99",
        cardBdr: stdAccent + "33",
        font: customization.saveTheDateFont ?? "Playfair Display",
        fontSize: customization.saveTheDateFontSize ?? "16",
      }
    : undefined;
  const digPreviewColors: CustomColors | undefined = isCustomMode && customization
    ? {
        bg: customization.digitalInvitationBackground ?? "#FFFFFF",
        accent: digAccent,
        text: digFontColor,
        muted: digFontColor + "99",
        cardBdr: digAccent + "33",
        font: customization.digitalInvitationFont ?? "Playfair Display",
        fontSize: customization.digitalInvitationFontSize ?? "16",
      }
    : undefined;
  const stdPalette = stdPreviewColors
    ? { ...palette, primary: stdAccent, secondary: stdAccent, accent: stdAccent }
    : palette;
  const digPalette = digPreviewColors
    ? { ...palette, primary: digAccent, secondary: digAccent, accent: digAccent }
    : palette;

  const completeness = evaluateCustomDesignCompleteness({
    customization: customization
      ? {
          saveTheDatePhotoUrl: customization.saveTheDatePhotoUrl,
          digitalInvitationPhotoUrl: customization.digitalInvitationPhotoUrl,
          colorPalette: customization.colorPalette,
          selectedFont: customization.selectedFont ?? undefined,
          saveTheDateFont: customization.saveTheDateFont,
          digitalInvitationFont: customization.digitalInvitationFont,
          selectedLayout: customization.selectedLayout ?? undefined,
          saveTheDateLayout: customization.saveTheDateLayout,
          digitalInvitationLayout: customization.digitalInvitationLayout,
        }
      : null,
    profile: profile
      ? {
          partner1Name: profile.partner1Name ?? undefined,
          partner2Name: profile.partner2Name ?? undefined,
          weddingDate: profile.weddingDate ?? undefined,
          venue: profile.venue ?? undefined,
          ceremonyTime: profile.ceremonyTime ?? undefined,
        }
      : null,
  });
  const customDesignComplete = completeness.isComplete;
  const isBlocked = isCustomMode && !customDesignComplete && !bypassBlock;

  let title = "Preview & Send Invitation";
  if (isBlocked) title = "Design Incomplete";
  else if (isCustomMode) title = "Review & Send Custom Design";

  return (
    <Dialog open={!!guest} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="font-serif text-xl text-primary flex items-center gap-2">
            <Send className="h-5 w-5" />
            {title}
            {guest && (
              <span className="text-base font-normal text-muted-foreground ml-1">for {guest.name}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {loadingCustomization || !customization ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : isBlocked ? (
            <BlockedScreen
              onGoToCustomization={handleGoToCustomization}
              onClose={onClose}
              missing={completeness.missing}
              onContinueWithoutPhotos={() => setBypassBlock(true)}
            />
          ) : isCustomMode ? (
            /* ── Custom Design — Complete ── */
            <div className="space-y-5">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Custom design is complete</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your personalized design will be sent with matching colors and fonts. Animated templates play after the guest opens the invitation link.
                  </p>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "saveTheDate" | "digitalInvitation")}>
                {!reminderOnly && (
                  <TabsList className="w-full">
                    <TabsTrigger value="saveTheDate" className="flex-1 text-xs">
                      <Calendar className="h-3.5 w-3.5 mr-1" /> Save the Date
                    </TabsTrigger>
                    <TabsTrigger value="digitalInvitation" className="flex-1 text-xs">
                      <Heart className="h-3.5 w-3.5 mr-1" /> RSVP Invitation
                    </TabsTrigger>
                  </TabsList>
                )}

                <TabsContent value="saveTheDate" className="pt-4 space-y-4">
                  <p className="text-xs text-muted-foreground text-center">
                    The guest link opens with this custom animation
                  </p>
                  <div className="flex justify-center">
                    {profile && (
                      <AnimatedInvitationShell
                        layout={customization.saveTheDateLayout}
                        accent={stdAccent}
                      >
                      <AiSaveDatePreview
                        profile={profile}
                        palette={stdPalette}
                        photoUrl={customization.saveTheDatePhotoUrl || null}
                        photoPosition={customization.saveTheDatePhotoPosition ?? undefined}
                        customColors={stdPreviewColors}
                      />
                      </AnimatedInvitationShell>
                    )}
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={() => guest && onSendSaveTheDate(guest.id)}
                    disabled={isSendingSaveTheDate}
                  >
                    {isSendingSaveTheDate
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : <><Send className="h-4 w-4" /> {guest?.email ? "Send Save the Date email" : "Mark Save the Date as sent"}</>
                    }
                  </Button>
                  {!guest?.email && (
                    <p className="text-xs text-muted-foreground text-center">No email on file — status will be updated without sending an email.</p>
                  )}
                </TabsContent>

                <TabsContent value="digitalInvitation" className="pt-4 space-y-4">
                  <p className="text-xs text-muted-foreground text-center">
                    The guest link opens with this custom animation
                  </p>
                  <div className="flex justify-center">
                    {profile && (
                      <AnimatedInvitationShell
                        layout={customization.digitalInvitationLayout}
                        accent={digAccent}
                      >
                      <AiDigitalInvitationPreview
                        profile={{
                          partner1Name: profile.partner1Name,
                          partner2Name: profile.partner2Name,
                          weddingDate: profile.weddingDate,
                          venue: profile.venue,
                          venueAddress: profile.location ?? profile.venueAddress,
                          venueCity: profile.venueCity,
                          venueState: profile.venueState,
                          venueZip: profile.venueZip,
                          ceremonyTime: profile.ceremonyTime,
                          receptionTime: profile.receptionTime,
                          invitationMessage: profile.invitationMessage,
                          guestName: guest?.name ?? "Guest",
                          rsvpByDate: customization.rsvpByDate ?? null,
                        }}
                        palette={digPalette}
                        photoUrl={customization.digitalInvitationPhotoUrl || null}
                        photoPosition={customization.digitalInvitationPhotoPosition ?? undefined}
                        onPhotoPositionChange={(pos) => setCustomization((c) => c ? { ...c, digitalInvitationPhotoPosition: pos } : c)}
                        customColors={digPreviewColors}
                      />
                      </AnimatedInvitationShell>
                    )}
                  </div>
                  {reminderOnly ? (
                    guest?.rsvpStatus === "pending" && onSendRsvpReminder ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => guest && onSendRsvpReminder(guest.id)}
                          disabled={!!isSendingRsvpReminder}
                        >
                          {isSendingRsvpReminder
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> {guest?.email ? "Sending reminder…" : "Marking as sent…"}</>
                            : <><Mail className="h-4 w-4" /> {guest?.email ? "Send RSVP Reminder" : "Mark Reminder as Sent"}</>
                          }
                        </Button>
                        {!guest?.email && (
                          <p className="text-xs text-muted-foreground text-center">No email on file — reminder status will be marked as sent.</p>
                        )}
                      </>
                    ) : null
                  ) : (
                    <Button
                      className="w-full gap-2"
                      onClick={() => guest && onSendDigitalInvitation(guest.id)}
                      disabled={isSendingDigital}
                    >
                      {isSendingDigital
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                        : <><Send className="h-4 w-4" /> {guest?.email ? "Send RSVP Invitation email" : "Mark RSVP Invitation as sent"}</>
                      }
                    </Button>
                  )}
                  {!reminderOnly && !guest?.email && (
                    <p className="text-xs text-muted-foreground text-center">No email on file — status will be updated without sending an email.</p>
                  )}
                </TabsContent>

              </Tabs>
            </div>
          ) : (
            /* ── AI-Generated Mode ── */
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "saveTheDate" | "digitalInvitation")}>
                {!reminderOnly && (
                  <TabsList className="w-full">
                    <TabsTrigger value="saveTheDate" className="flex-1 text-xs">
                      <Calendar className="h-3.5 w-3.5 mr-1" /> Save the Date
                    </TabsTrigger>
                    <TabsTrigger value="digitalInvitation" className="flex-1 text-xs">
                      <Heart className="h-3.5 w-3.5 mr-1" /> RSVP Invitation
                    </TabsTrigger>
                  </TabsList>
                )}

                <TabsContent value="saveTheDate" className="pt-4 space-y-4">
                  <p className="text-xs text-muted-foreground text-center">Email preview — this is what your guest will receive in their inbox</p>
                  {profile && (
                    <AiSaveDatePreview
                      profile={profile}
                      palette={{ ...palette, accent: "#D4A017", primary: "#D4A017" }}
                      photoUrl={customization.saveTheDatePhotoUrl || null}
                      photoPosition={customization.saveTheDatePhotoPosition ?? undefined}
                    />
                  )}
                  <Button
                    className="w-full gap-2"
                    onClick={() => guest && onSendSaveTheDate(guest.id)}
                    disabled={isSendingSaveTheDate}
                  >
                    {isSendingSaveTheDate
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : <><Send className="h-4 w-4" /> {guest?.email ? "Send Save the Date email" : "Mark Save the Date as sent"}</>
                    }
                  </Button>
                  {!guest?.email && (
                    <p className="text-xs text-muted-foreground text-center">No email on file — status will be updated without sending an email.</p>
                  )}
                </TabsContent>

                <TabsContent value="digitalInvitation" className="pt-4 space-y-4">
                  <p className="text-xs text-muted-foreground text-center">Email preview — this is what your guest will receive in their inbox</p>
                  {profile && (
                    <AiDigitalInvitationPreview
                      profile={{
                        partner1Name: profile.partner1Name,
                        partner2Name: profile.partner2Name,
                        weddingDate: profile.weddingDate,
                        venue: profile.venue,
                        venueAddress: profile.location ?? profile.venueAddress,
                        venueCity: profile.venueCity,
                        venueState: profile.venueState,
                        venueZip: profile.venueZip,
                        ceremonyTime: profile.ceremonyTime,
                        receptionTime: profile.receptionTime,
                        invitationMessage: profile.invitationMessage,
                        guestName: guest?.name ?? "Guest",
                        rsvpByDate: customization.rsvpByDate ?? null,
                      }}
                      palette={{ ...palette, accent: "#D4A017", primary: "#D4A017" }}
                      photoUrl={customization.digitalInvitationPhotoUrl || null}
                      photoPosition={customization.digitalInvitationPhotoPosition ?? undefined}
                    />
                  )}
                  {reminderOnly ? (
                    guest?.rsvpStatus === "pending" && onSendRsvpReminder ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => guest && onSendRsvpReminder(guest.id)}
                          disabled={!!isSendingRsvpReminder}
                        >
                          {isSendingRsvpReminder
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> {guest?.email ? "Sending reminder…" : "Marking as sent…"}</>
                            : <><Mail className="h-4 w-4" /> {guest?.email ? "Send RSVP Reminder" : "Mark Reminder as Sent"}</>
                          }
                        </Button>
                        {!guest?.email && (
                          <p className="text-xs text-muted-foreground text-center">No email on file — reminder status will be marked as sent.</p>
                        )}
                      </>
                    ) : null
                  ) : (
                    <Button
                      className="w-full gap-2"
                      onClick={() => guest && onSendDigitalInvitation(guest.id)}
                      disabled={isSendingDigital}
                    >
                      {isSendingDigital
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                        : <><Send className="h-4 w-4" /> {guest?.email ? "Send RSVP Invitation email" : "Mark RSVP Invitation as sent"}</>
                      }
                    </Button>
                  )}
                  {!reminderOnly && !guest?.email && (
                    <p className="text-xs text-muted-foreground text-center">No email on file — status will be updated without sending an email.</p>
                  )}
                </TabsContent>

              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
