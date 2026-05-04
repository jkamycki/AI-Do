import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetGuests,
  useAddGuest,
  useUpdateGuest,
  useDeleteGuest,
  useAcknowledgeGuest,
  getGetGuestsQueryKey,
  useGetProfile,
} from "@workspace/api-client-react";
import type { Guest } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Plus, Search, UserCheck, UserX, Clock, Heart, Trash2, Edit2, Download, Tag, ChevronDown, RotateCcw, Link2, Copy, RefreshCw, CheckCheck, Mail, Phone, MapPin, Send, Loader2, Sparkles, X as XIcon, AlertTriangle } from "lucide-react";
import { InvitationSendModal } from "@/components/GuestList/InvitationSendModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authFetch } from "@/lib/authFetch";
import { useTranslation } from "react-i18next";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { COUNTRIES } from "@/lib/countries";
import { getAddressFormat } from "@/lib/addressFormat";

const RSVP_OPTIONS = [
  { value: "attending", label: "Attending", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40" },
  { value: "maybe", label: "Maybe", color: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40" },
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40" },
];

const INVITATION_OPTIONS = [
  { value: "pending", label: "Not Sent", color: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700" },
  { value: "sent", label: "Sent", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40" },
];

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "fish", label: "Fish" },
  { value: "beef", label: "Beef" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "kids", label: "Kids Meal" },
  { value: "other", label: "Other" },
];

const GROUP_OPTIONS = [
  { value: "brides_family", label: "Bride's Family" },
  { value: "grooms_family", label: "Groom's Family" },
  { value: "brides_friends", label: "Bride's Friends" },
  { value: "grooms_friends", label: "Groom's Friends" },
  { value: "brides_coworkers", label: "Bride's Coworkers" },
  { value: "grooms_coworkers", label: "Groom's Coworkers" },
  { value: "other", label: "Other" },
];

function getGroupLabel(value: string | null | undefined): string {
  if (!value) return "";
  const opt = GROUP_OPTIONS.find(o => o.value === value);
  return opt ? opt.label : value;
}

const GROUP_COLORS: Record<string, string> = {
  brides_family: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700",
  grooms_family: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700",
  brides_friends: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700",
  grooms_friends: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700",
  brides_coworkers: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700",
  grooms_coworkers: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700",
  other: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};

const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  invitationStatus: z.enum(["pending", "sent"]).default("pending"),
  rsvpStatus: z.enum(["pending", "attending", "maybe", "declined"]).default("pending"),
  mealChoice: z.string().optional(),
  dietaryNotes: z.string().max(500).optional(),
  guestGroup: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
  tableAssignment: z.string().optional(),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  aptUnit: z.string().optional().default(""),
  guestCity: z.string().optional().default(""),
  guestState: z.string().optional().default(""),
  guestZip: z.string().optional().default(""),
  guestCountry: z.string().optional().default(""),
  notes: z.string().optional(),
});

type GuestFormValues = z.infer<typeof guestSchema>;

function getRsvpBadge(status: string) {
  const opt = RSVP_OPTIONS.find(o => o.value === status);
  // Fall back to "Pending" badge for any legacy/unknown status (e.g. old "sent" rows).
  return opt ?? RSVP_OPTIONS.find(o => o.value === "pending")!;
}

function GuestForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<GuestFormValues>;
  onSubmit: (data: GuestFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const form = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: "",
      email: "",
      invitationStatus: "pending",
      rsvpStatus: "pending",
      mealChoice: "",
      dietaryNotes: "",
      guestGroup: "",
      plusOne: false,
      plusOneFirstName: "",
      plusOneLastName: "",
      tableAssignment: "",
      phone: "",
      address: "",
      aptUnit: "",
      guestCity: "",
      guestState: "",
      guestZip: "",
      guestCountry: "",
      notes: "",
      ...defaultValues,
    },
  });

  const plusOne = form.watch("plusOne");
  const meal = form.watch("mealChoice");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.full_name")} *</FormLabel>
              <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.email_optional")}</FormLabel>
              <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="invitationStatus" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("guests.invitation_status")}</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {INVITATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(`guests.invitation_${o.value}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="rsvpStatus" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.rsvp_status")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {RSVP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(`guests.rsvp_${o.value}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guestGroup" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.group_category")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder={t("guests.select_group")} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t("guests.no_group")}</SelectItem>
                  {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(`guests.group_${o.value}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="mealChoice" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.meal_choice")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder={t("guests.select_meal")} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t("guests.none_selected")}</SelectItem>
                  {MEAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(`guests.meal_${o.value}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="tableAssignment" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.table_assignment")}</FormLabel>
              <FormControl><Input placeholder={t("guests.table_placeholder")} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {meal === "other" && (
          <FormField control={form.control} name="dietaryNotes" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.dietary_notes")}</FormLabel>
              <FormControl>
                <Textarea placeholder={t("guests.dietary_placeholder")} rows={2} maxLength={500} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.phone_label")}</FormLabel>
              <FormControl><Input type="tel" placeholder="(555) 000-0000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guestCountry" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>{t("guests.country")}</FormLabel>
              <Select value={field.value || ""} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("guests.country_placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">{t("guests.country_none")}</SelectItem>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>{t("guests.street_address")}</FormLabel>
              <FormControl>
                <AddressAutocomplete
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onSelect={s => {
                    field.onChange(s.street);
                    form.setValue("guestCity", s.city, { shouldDirty: true });
                    form.setValue("guestState", s.state, { shouldDirty: true });
                    form.setValue("guestZip", s.zip, { shouldDirty: true });
                  }}
                  placeholder="123 Main St"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="aptUnit" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>{t("guests.apt_unit")}</FormLabel>
              <FormControl><Input placeholder="Apt 4B" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {(() => {
            const fmt = getAddressFormat(form.watch("guestCountry"));
            return (
              <>
                {fmt.showState && (
                  <FormField control={form.control} name="guestState" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fmt.stateLabel}</FormLabel>
                      <FormControl><Input placeholder={fmt.statePlaceholder} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="guestCity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{fmt.cityLabel}</FormLabel>
                    <FormControl><Input placeholder={fmt.cityPlaceholder} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {fmt.showZip && (
                  <FormField control={form.control} name="guestZip" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fmt.zipLabel}</FormLabel>
                      <FormControl><Input placeholder={fmt.zipPlaceholder} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </>
            );
          })()}
        </div>

        <FormField control={form.control} name="plusOne" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <FormLabel>{t("guests.plus_one")}</FormLabel>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        {plusOne && (
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="plusOneFirstName" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.plus_one_first")}</FormLabel>
                <FormControl><Input placeholder="Alex" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="plusOneLastName" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.plus_one_last")}</FormLabel>
                <FormControl><Input placeholder="Smith" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("guests.notes_label")}</FormLabel>
            <FormControl>
              <Textarea placeholder={t("guests.notes_placeholder")} className="resize-none" rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex gap-3 mt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => form.reset({ name: "", email: "", invitationStatus: "pending", rsvpStatus: "pending", mealChoice: "", guestGroup: "", plusOne: false, plusOneFirstName: "", plusOneLastName: "", tableAssignment: "", phone: "", address: "", aptUnit: "", guestCity: "", guestState: "", guestZip: "", guestCountry: "", notes: "" })}>
            <RotateCcw className="h-4 w-4 mr-2" /> {t("guests.reset")}
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? t("guests.saving") : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function exportCSV(guestList: Guest[]) {
  const headers = ["Name", "Email", "Invitation Sent", "Group", "RSVP", "Meal", "Plus One", "Plus One Name", "Table", "Street Address", "Apt/Unit", "City", "State", "ZIP", "Country", "Notes"];
  const rows = guestList.map(g => [
    g.name,
    g.email ?? "",
    g.invitationStatus === "sent" ? "Sent" : "Not Sent",
    getGroupLabel(g.guestGroup),
    g.rsvpStatus,
    g.mealChoice ?? "",
    g.plusOne ? "Yes" : "No",
    g.plusOneName ?? "",
    g.tableAssignment ?? "",
    (g as any).address ?? "",
    (g as any).aptUnit ?? "",
    (g as any).guestCity ?? "",
    (g as any).guestState ?? "",
    (g as any).guestZip ?? "",
    (g as any).guestCountry ?? "",
    g.notes ?? "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "guest-list.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function GuestCollectorCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: profile } = useGetProfile();

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const formUrl = token
    ? `${window.location.origin}${base}/collect/${token}`
    : null;
  const collectorUrl = token
    ? `${window.location.origin}/api/guest-collect/${token}/preview`
    : null;

  const coupleNames = profile
    ? `${profile.partner1Name ?? "Partner 1"} & ${profile.partner2Name ?? "Partner 2"}`
    : "Your names";

  const generate = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/guest-collect/generate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate link");
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => setToken(data.token),
    onError: () => toast({ title: t("guests.error"), description: t("guests.could_not_generate"), variant: "destructive" }),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/guest-collect/regenerate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate link");
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => {
      setToken(data.token);
      toast({ title: t("guests.new_link_generated"), description: t("guests.old_link_inactive") });
    },
    onError: () => toast({ title: t("guests.error"), description: t("guests.could_not_regenerate"), variant: "destructive" }),
  });

  const copyLink = () => {
    if (!collectorUrl) return;
    navigator.clipboard.writeText(collectorUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="h-4 w-4 text-primary" />
          {t("guests.collector_title")}
        </CardTitle>
        <CardDescription>
          {t("guests.collector_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t("guests.generating")}</>
            ) : (
              <><Link2 className="h-4 w-4 mr-2" /> {t("guests.generate_link")}</>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Link display + copy */}
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={collectorUrl ?? ""}
                className="text-xs font-mono bg-background/50 border-primary/20 text-primary"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                className="shrink-0 border-primary/20 hover:bg-primary/10"
                title={t("guests.copy_link_title")}
              >
                {copied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Link preview — shows guests what they'll see before clicking */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{t("guests.link_preview_label")}</p>
            <div className="rounded-xl border border-primary/20 bg-background/60 overflow-hidden shadow-sm">
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #E91E8C, #7B2FBE)" }} />
              <div className="flex items-start gap-3 p-3">
                <div className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center bg-primary/15 ring-1 ring-primary/30">
                  <Heart className="h-5 w-5 fill-primary text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5 text-primary">{t("guests.contact_info_request")}</p>
                  <p className="text-sm font-bold text-foreground leading-tight truncate" style={{ fontFamily: "Georgia, serif" }}>{coupleNames}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("guests.collecting_addresses")}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">{formUrl}</p>
                </div>
              </div>
            </div>
            </div>

            {/* Share buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-primary/20 hover:bg-primary/10 text-primary gap-2"
                onClick={() => {
                  const subject = encodeURIComponent(t("guests.email_subject_line") || "Please share your contact info with us!");
                  const body = encodeURIComponent(
                    `Hi!\n\nWe'd love to have your contact details for our wedding guest list. Please take a moment to fill out this quick form below:\n\n${collectorUrl}\n\nThank you!`
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
              >
                <Mail className="h-3.5 w-3.5" /> {t("guests.email_link")}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary gap-1 ml-auto">
                    <RefreshCw className="h-3 w-3" /> {t("guests.regenerate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("guests.regenerate_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("guests.regenerate_desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("guests.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-rose-500 hover:bg-rose-600"
                      onClick={() => regenerate.mutate()}
                    >
                      {t("guests.yes_regenerate")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("guests.link_auto_appears")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Guests() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);

  const [duplicateGuestIds, setDuplicateGuestIds] = useState<Set<number>>(new Set());
  const [pendingGuestData, setPendingGuestData] = useState<GuestFormValues | null>(null);

  const [sendModalGuest, setSendModalGuest] = useState<Guest | null>(null);

  const { data: weddingProfile } = useGetProfile();
  const { data, isLoading, isError } = useGetGuests();
  const addGuest = useAddGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const acknowledgeGuest = useAcknowledgeGuest();

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
    }, 15000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const sendSaveTheDate = useMutation({
    mutationFn: async (guestId: number) => {
      const res = await authFetch(`/api/guests/${guestId}/send-save-the-date`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; details?: string };
        throw new Error(err.details ?? err.error ?? "Failed to send save-the-date");
      }
      return res.json();
    },
    onSuccess: (data: { emailSent?: boolean }, guestId) => {
      optimisticUpdate(guestId, { saveTheDateStatus: "sent" } as any);
      invalidate();
      setSendModalGuest(null);
      if (data?.emailSent) {
        toast({ title: "Save the Date sent!", description: "Email delivered to guest." });
      } else {
        toast({ title: "Save the Date marked as sent.", description: "No email on file — status updated." });
      }
    },
    onError: (err) => toast({ title: "Failed to send Save the Date", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const sendRsvp = useMutation({
    mutationFn: async (guestId: number) => {
      const res = await authFetch(`/api/guests/${guestId}/send-rsvp`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; details?: string };
        throw new Error(err.details ?? err.error ?? "Failed to send RSVP");
      }
      return res.json() as Promise<{ rsvpUrl: string; emailSent: boolean }>;
    },
    onSuccess: (data, guestId) => {
      // Track "sent" on invitationStatus, not rsvpStatus — rsvpStatus is reserved
      // for the guest's actual response (attending / maybe / declined / pending).
      optimisticUpdate(guestId, { invitationStatus: "sent" });
      invalidate();
      setSendModalGuest(null);
      if (data.emailSent) {
        toast({ title: "RSVP Invitation sent!", description: "Email delivered to guest." });
      } else {
        toast({ title: "RSVP Invitation marked as sent.", description: "No email on file — status updated." });
      }
    },
    onError: (err) => toast({ title: "Failed to send RSVP Invitation", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const allGuests = data?.guests ?? [];
  const summary = data?.summary ?? { total: 0, attending: 0, declined: 0, pending: 0, plusOnes: 0 };

  const newGuests = allGuests.filter(g => (g as any).source === "self_collect" && !(g as any).acknowledgedAt);
  const newGuestIds = new Set(newGuests.map(g => g.id));

  const handleAcknowledge = (guestId: number) => {
    if (!newGuestIds.has(guestId)) return;
    queryClient.setQueryData(getGetGuestsQueryKey(), (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        guests: old.guests.map((g: Guest) => g.id === guestId ? { ...g, acknowledgedAt: new Date().toISOString() } as Guest : g),
      };
    });
    acknowledgeGuest.mutate({ id: guestId }, {
      onError: () => queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() }),
    });
  };

  const handleAcknowledgeAll = () => {
    const ids = Array.from(newGuestIds);
    if (ids.length === 0) return;
    queryClient.setQueryData(getGetGuestsQueryKey(), (old: typeof data) => {
      if (!old) return old;
      const now = new Date().toISOString();
      return {
        ...old,
        guests: old.guests.map((g: Guest) => newGuestIds.has(g.id) ? { ...g, acknowledgedAt: now } as Guest : g),
      };
    });
    ids.forEach(id => {
      acknowledgeGuest.mutate({ id }, {
        onError: () => queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() }),
      });
    });
  };

  const usedGroups = [...new Set(allGuests.map(g => g.guestGroup).filter(Boolean))] as string[];

  const filtered = allGuests
    .filter(g => {
      const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || (g.email ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesRsvp = rsvpFilter === "all" || g.rsvpStatus === rsvpFilter;
      const matchesGroup = groupFilter === "all" || g.guestGroup === groupFilter;
      return matchesSearch && matchesRsvp && matchesGroup;
    })
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));

  const queryKey = getGetGuestsQueryKey();
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  function optimisticUpdate(guestId: number, patch: Partial<Guest>) {
    queryClient.setQueryData(queryKey, (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        guests: old.guests.map((g: Guest) => g.id === guestId ? { ...g, ...patch } : g),
      };
    });
  }

  function handleRsvpChange(guest: Guest, newStatus: string) {
    optimisticUpdate(guest.id, { rsvpStatus: newStatus });
    updateGuest.mutate({
      id: guest.id,
      data: {
        name: guest.name,
        email: guest.email ?? undefined,
        invitationStatus: guest.invitationStatus ?? "pending",
        rsvpStatus: newStatus as "pending" | "attending" | "maybe" | "declined",
        mealChoice: guest.mealChoice ?? undefined,
        guestGroup: guest.guestGroup ?? undefined,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName ?? undefined,
        tableAssignment: guest.tableAssignment ?? undefined,
        notes: guest.notes ?? undefined,
      },
    }, {
      onSuccess: () => invalidate(),
      onError: () => {
        optimisticUpdate(guest.id, { rsvpStatus: guest.rsvpStatus });
        toast({ title: "Failed to update RSVP", variant: "destructive" });
      },
    });
  }

  function handleInvitationChange(guest: Guest, newStatus: string) {
    optimisticUpdate(guest.id, { invitationStatus: newStatus });
    updateGuest.mutate({
      id: guest.id,
      data: {
        name: guest.name,
        email: guest.email ?? undefined,
        invitationStatus: newStatus,
        rsvpStatus: guest.rsvpStatus as "pending" | "attending" | "maybe" | "declined",
        mealChoice: guest.mealChoice ?? undefined,
        guestGroup: guest.guestGroup ?? undefined,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName ?? undefined,
        tableAssignment: guest.tableAssignment ?? undefined,
        notes: guest.notes ?? undefined,
      },
    }, {
      onSuccess: () => invalidate(),
      onError: () => {
        optimisticUpdate(guest.id, { invitationStatus: guest.invitationStatus ?? "pending" });
        toast({ title: "Failed to update invitation status", variant: "destructive" });
      },
    });
  }

  function handleGroupChange(guest: Guest, newGroup: string) {
    const val = newGroup === "none" ? null : newGroup;
    optimisticUpdate(guest.id, { guestGroup: val });
    updateGuest.mutate({
      id: guest.id,
      data: {
        name: guest.name,
        email: guest.email ?? undefined,
        invitationStatus: guest.invitationStatus ?? "pending",
        rsvpStatus: guest.rsvpStatus as "pending" | "attending" | "maybe" | "declined",
        mealChoice: guest.mealChoice ?? undefined,
        guestGroup: val ?? undefined,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName ?? undefined,
        tableAssignment: guest.tableAssignment ?? undefined,
        notes: guest.notes ?? undefined,
      },
    }, {
      onSuccess: () => invalidate(),
      onError: () => {
        optimisticUpdate(guest.id, { guestGroup: guest.guestGroup });
        toast({ title: "Failed to update group", variant: "destructive" });
      },
    });
  }

  function handleSaveDateChange(guest: Guest, newStatus: string) {
    const prev = (guest as any).saveTheDateStatus ?? "not_sent";
    optimisticUpdate(guest.id, { saveTheDateStatus: newStatus } as any);
    authFetch(`/api/guests/${guest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveTheDateStatus: newStatus }),
    }).then(async res => {
      if (!res.ok) throw new Error();
      invalidate();
    }).catch(() => {
      optimisticUpdate(guest.id, { saveTheDateStatus: prev } as any);
      toast({ title: "Failed to update save-the-date status", variant: "destructive" });
    });
  }

  function handleMealChange(guest: Guest, newMeal: string) {
    const val = newMeal === "none" ? null : newMeal;
    optimisticUpdate(guest.id, { mealChoice: val });
    updateGuest.mutate({
      id: guest.id,
      data: {
        name: guest.name,
        email: guest.email ?? undefined,
        invitationStatus: guest.invitationStatus ?? "pending",
        rsvpStatus: guest.rsvpStatus as "pending" | "attending" | "maybe" | "declined",
        // Send empty string when clearing — the server converts "" -> NULL.
        // Sending `undefined` would be dropped by JSON.stringify and the
        // server's `if (mealChoice !== undefined)` guard would skip the update.
        mealChoice: val ?? "",
        guestGroup: guest.guestGroup ?? undefined,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName ?? undefined,
        tableAssignment: guest.tableAssignment ?? undefined,
        notes: guest.notes ?? undefined,
      },
    }, {
      onSuccess: () => invalidate(),
      onError: () => {
        optimisticUpdate(guest.id, { mealChoice: guest.mealChoice });
        toast({ title: "Failed to update meal choice", variant: "destructive" });
      },
    });
  }

  function handleAdd(data: GuestFormValues) {
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()].filter(Boolean).join(" ") || undefined
      : undefined;
    addGuest.mutate({
      data: {
        ...data,
        plusOneName,
        email: data.email || undefined,
        mealChoice: data.mealChoice === "none" ? undefined : data.mealChoice || undefined,
        guestGroup: data.guestGroup === "none" ? undefined : data.guestGroup || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Guest added" });
        setIsAdding(false);
        setDuplicateGuestIds(new Set());
        invalidate();
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status === 409) {
          const ids = ((err as { data?: { duplicateIds?: number[] } })?.data?.duplicateIds) ?? [];
          setDuplicateGuestIds(new Set(ids));
          setPendingGuestData(data);
          setIsAdding(false);
        } else {
          toast({
            title: status === 401 ? "Session refreshing — try again in a moment" : "Failed to add guest",
            variant: "destructive",
          });
        }
      },
    });
  }

  async function handleForceAdd() {
    if (!pendingGuestData) return;
    const data = pendingGuestData;
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()].filter(Boolean).join(" ") || undefined
      : undefined;
    const payload = {
      ...data,
      plusOneName,
      email: data.email || undefined,
      mealChoice: data.mealChoice === "none" ? undefined : data.mealChoice || undefined,
      guestGroup: data.guestGroup === "none" ? undefined : data.guestGroup || undefined,
    };
    try {
      const res = await authFetch("/api/guests?force=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add guest");
      toast({ title: "Guest added" });
      setPendingGuestData(null);
      setDuplicateGuestIds(new Set());
      invalidate();
    } catch {
      toast({ title: "Failed to add guest", variant: "destructive" });
    }
  }

  function handleEdit(data: GuestFormValues) {
    if (!editGuest) return;
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()].filter(Boolean).join(" ")
      : "";
    updateGuest.mutate({
      id: editGuest.id,
      data: {
        name: data.name,
        email: data.email || null,
        invitationStatus: data.invitationStatus,
        rsvpStatus: data.rsvpStatus,
        plusOne: data.plusOne,
        plusOneName: plusOneName,
        mealChoice: (data.mealChoice === "none" || !data.mealChoice) ? null : data.mealChoice,
        dietaryNotes: data.mealChoice === "other" ? (data.dietaryNotes?.trim() || null) : null,
        guestGroup: (data.guestGroup === "none" || !data.guestGroup) ? null : data.guestGroup,
        tableAssignment: data.tableAssignment || null,
        notes: data.notes || null,
        phone: data.phone || null,
        address: data.address || null,
        aptUnit: data.aptUnit || null,
        guestCity: data.guestCity || null,
        guestState: data.guestState || null,
        guestZip: data.guestZip || null,
        guestCountry: data.guestCountry || null,
      } as Parameters<typeof updateGuest.mutate>[0]["data"]
    }, {
      onSuccess: () => {
        toast({ title: "Guest updated" });
        setEditGuest(null);
        invalidate();
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        toast({
          title: status === 409 ? "Duplicate guest detected" : "Failed to update guest",
          description: status === 409 ? "A guest with this name or email already exists." : undefined,
          variant: "destructive",
        });
      },
    });
  }

  function handleDelete(id: number) {
    deleteGuest.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Guest removed" });
        invalidate();
      },
      onError: () => toast({ title: "Failed to remove guest", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <p className="text-muted-foreground">Failed to load guest list. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <Users className="h-8 w-8" /> {t("guests.title")}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">{t("guests.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {allGuests.length > 0 && (
            <Button variant="outline" onClick={() => exportCSV(allGuests)}>
              <Download className="h-4 w-4 mr-2" /> {t("guests.export_csv")}
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-md">
                <Plus className="mr-2 h-4 w-4" /> {t("guests.add_guest")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl text-primary">{t("guests.new_guest")}</DialogTitle>
                <DialogDescription>{t("guests.new_guest_desc")}</DialogDescription>
              </DialogHeader>
              <GuestForm onSubmit={handleAdd} isPending={addGuest.isPending} submitLabel={t("guests.add_guest")} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Guest Collector */}
      <GuestCollectorCard />

      {/* RSVP Response Rate Bar */}
      {summary.total > 0 && (
        <div className="bg-card border border-border/60 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{t("guests.rsvp_response_rate")}</span>
            <span className="text-muted-foreground">
              {summary.attending + summary.declined} {t("guests.responded")} {summary.total}
              {summary.total > 0 && (
                <span className="ml-1 text-primary font-semibold">
                  ({Math.round(((summary.attending + summary.declined) / summary.total) * 100)}%)
                </span>
              )}
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            {summary.attending > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(summary.attending / summary.total) * 100}%` }}
              />
            )}
            {summary.declined > 0 && (
              <div
                className="h-full bg-red-400 transition-all duration-500"
                style={{ width: `${(summary.declined / summary.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> {t("guests.stat_attending")} ({summary.attending})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> {t("guests.stat_declined")} ({summary.declined})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> {t("guests.stat_pending")} ({summary.pending})</span>
          </div>
        </div>
      )}

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: Users, labelKey: "stat_total", value: summary.total, color: "text-primary" },
          { icon: UserCheck, labelKey: "stat_attending", value: summary.attending, color: "text-emerald-600" },
          { icon: UserX, labelKey: "stat_declined", value: summary.declined, color: "text-red-500" },
          { icon: Clock, labelKey: "stat_pending", value: summary.pending, color: "text-amber-600" },
          { icon: Heart, labelKey: "stat_plus_ones", value: summary.plusOnes, color: "text-rose-500" },
        ].map(({ icon: Icon, labelKey, value, color }) => (
          <Card key={labelKey} className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Icon className={`h-5 w-5 mb-1 ${color}`} />
              <div className={`text-2xl font-serif font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground">{t(`guests.${labelKey}`)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Group breakdown pills (if groups are used) */}
      {usedGroups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {usedGroups.map(grp => {
            const count = allGuests.filter(g => g.guestGroup === grp).length;
            const colorClass = GROUP_COLORS[grp] ?? "bg-gray-100 text-gray-700 border-gray-200";
            return (
              <button
                key={grp}
                onClick={() => setGroupFilter(groupFilter === grp ? "all" : grp)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${colorClass} ${groupFilter === grp ? "ring-2 ring-offset-1 ring-primary/40" : "opacity-80 hover:opacity-100"}`}
              >
                <Tag className="h-3 w-3" />
                {getGroupLabel(grp)} · {count}
              </button>
            );
          })}
          {groupFilter !== "all" && (
            <button
              onClick={() => setGroupFilter("all")}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("guests.clear_filter")}
            </button>
          )}
        </div>
      )}

      {/* New guests alert — recently self-added via collector link */}
      {newGuests.length > 0 && (
        <Card className="border-amber-300/60 bg-amber-50/70 dark:bg-amber-900/15 dark:border-amber-700/50 shadow-sm">
          <CardContent className="py-3 px-4 flex items-start sm:items-center gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full bg-amber-200/80 dark:bg-amber-800/40 flex items-center justify-center ring-1 ring-amber-300/60 dark:ring-amber-700/60">
              <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {newGuests.length === 1
                  ? t("guests.new_guest_alert_one", { name: newGuests[0].name })
                  : t("guests.new_guest_alert_other", { count: newGuests.length })}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-0.5">
                {t("guests.new_guest_alert_desc")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-amber-900 dark:text-amber-200 hover:bg-amber-200/60 dark:hover:bg-amber-800/30"
              onClick={handleAcknowledgeAll}
              data-testid="button-acknowledge-all-new"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              {t("guests.dismiss_new_alert")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Duplicate confirmation dialog */}
      <AlertDialog open={!!pendingGuestData} onOpenChange={open => { if (!open) { setPendingGuestData(null); setDuplicateGuestIds(new Set()); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Duplicate guest detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              A guest with this name or email already exists — the matching {duplicateGuestIds.size === 1 ? "entry is" : "entries are"} highlighted in the list below. Do you still want to add this guest?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingGuestData(null); setDuplicateGuestIds(new Set()); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600"
              onClick={handleForceAdd}
            >
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate highlight banner (shown after dismissing the dialog) */}
      {duplicateGuestIds.size > 0 && !pendingGuestData && (
        <Card className="border-rose-300/60 bg-rose-50/70 dark:bg-rose-900/15 dark:border-rose-700/50 shadow-sm">
          <CardContent className="py-3 px-4 flex items-start sm:items-center gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full bg-rose-200/80 dark:bg-rose-800/40 flex items-center justify-center ring-1 ring-rose-300/60 dark:ring-rose-700/60">
              <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                Existing {duplicateGuestIds.size === 1 ? "guest" : "guests"} highlighted below
              </p>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/70 mt-0.5">
                {duplicateGuestIds.size === 1 ? "This entry matches" : "These entries match"} the name or email you tried to add.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-rose-900 dark:text-rose-200 hover:bg-rose-200/60 dark:hover:bg-rose-800/30"
              onClick={() => setDuplicateGuestIds(new Set())}
            >
              <XIcon className="h-3.5 w-3.5 mr-1.5" />
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("guests.search_placeholder")}
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={rsvpFilter} onValueChange={setRsvpFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("guests.all_rsvps")}</SelectItem>
            {RSVP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(`guests.rsvp_${o.value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("guests.all_groups")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("guests.all_groups")}</SelectItem>
            {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(`guests.group_${o.value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {allGuests.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">{t("guests.empty_title")}</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">{t("guests.empty_desc")}</p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> {t("guests.add_first_guest")}
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("guests.no_match")}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {filtered.length === 1 ? t("guests.guest_count", { count: filtered.length }) : t("guests.guests_count", { count: filtered.length })} {rsvpFilter !== "all" || groupFilter !== "all" || search ? t("guests.filtered") : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead>{t("guests.col_name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("guests.col_einvite_status")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("guests.col_group")}</TableHead>
                    <TableHead>{t("guests.col_rsvp")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("guests.col_meal")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("guests.col_table")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("guests.col_plus_one")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(g => {
                    const badge = getRsvpBadge(g.rsvpStatus);
                    const grpLabel = g.guestGroup ? t(`guests.group_${g.guestGroup}`, getGroupLabel(g.guestGroup)) : "";
                    const grpColor = g.guestGroup ? (GROUP_COLORS[g.guestGroup] ?? "bg-gray-100 text-gray-700 border-gray-200") : "";
                    const isNew = newGuestIds.has(g.id);
                    const isDuplicate = duplicateGuestIds.has(g.id);
                    return (
                      <TableRow
                        key={g.id}
                        className={`group ${isDuplicate ? "bg-rose-50/60 dark:bg-rose-900/15 border-l-4 border-l-rose-500 dark:border-l-rose-400" : isNew ? "bg-amber-50/40 dark:bg-amber-900/10 border-l-4 border-l-amber-400 dark:border-l-amber-500" : ""}`}
                      >
                        <TableCell className="min-w-[200px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{g.name}</span>
                            {isNew && (
                              <button
                                type="button"
                                onClick={() => handleAcknowledge(g.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-700/60 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-600 hover:opacity-80 transition-opacity"
                                title={t("guests.dismiss_new_badge")}
                                data-testid={`button-dismiss-new-${g.id}`}
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                {t("guests.new_guest_badge")}
                                <XIcon className="h-2.5 w-2.5 opacity-70" />
                              </button>
                            )}
                          </div>
                          {g.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[180px]">{g.email}</span>
                            </div>
                          )}
                          {(g as any).phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{(g as any).phone}</span>
                            </div>
                          )}
                          {((g as any).address || (g as any).guestCity || (g as any).guestState || (g as any).guestZip || (g as any).guestCountry) && (
                            <div className="flex items-start gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="leading-snug">
                                {(g as any).address && <>{(g as any).address}{(g as any).aptUnit && <>, {(g as any).aptUnit}</>}</>}
                                {((g as any).guestCity || (g as any).guestState || (g as any).guestZip) && (
                                  <>{(g as any).address && <br />}{[(g as any).guestCity, (g as any).guestState, (g as any).guestZip].filter(Boolean).join(", ")}</>
                                )}
                                {(g as any).guestCountry && (
                                  <>{((g as any).address || (g as any).guestCity || (g as any).guestState || (g as any).guestZip) && <br />}{(g as any).guestCountry}</>
                                )}
                              </span>
                            </div>
                          )}
                          {g.notes && <div className="text-xs text-muted-foreground italic truncate max-w-[180px] mt-0.5" title={g.notes}>{g.notes}</div>}
                          {grpLabel && (
                            <span className={`sm:hidden inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${grpColor}`}>
                              {grpLabel}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground w-[90px] shrink-0 leading-tight">Save the Date</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${(g as any).saveTheDateStatus === "sent" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40" : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700"}`}>
                                    {(g as any).saveTheDateStatus === "sent" ? "Sent" : "Not Sent"}
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-28">
                                  <DropdownMenuItem
                                    className={`text-xs cursor-pointer ${(g as any).saveTheDateStatus !== "sent" ? "opacity-50 pointer-events-none" : ""}`}
                                    onClick={() => handleSaveDateChange(g, "not_sent")}
                                  >
                                    Not Sent
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className={`text-xs font-medium cursor-pointer ${(g as any).saveTheDateStatus === "sent" ? "opacity-50 pointer-events-none" : ""}`}
                                    onClick={() => handleSaveDateChange(g, "sent")}
                                  >
                                    Sent
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground w-[90px] shrink-0 leading-tight">RSVP Invitation</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${g.invitationStatus === "sent" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40" : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700"}`}>
                                    {g.invitationStatus === "sent" ? "Sent" : "Not Sent"}
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-28">
                                  {INVITATION_OPTIONS.map(opt => (
                                    <DropdownMenuItem
                                      key={opt.value}
                                      className={`text-xs font-medium cursor-pointer ${g.invitationStatus === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                      onClick={() => handleInvitationChange(g, opt.value)}
                                    >
                                      {opt.value === "sent" ? "Sent" : "Not Sent"}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-opacity hover:opacity-80 cursor-pointer ${grpLabel ? grpColor : "border-border/50 text-muted-foreground bg-transparent"}`}>
                                {grpLabel || "—"}
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem
                                className={`text-xs cursor-pointer ${!g.guestGroup ? "opacity-50 pointer-events-none" : ""}`}
                                onClick={() => handleGroupChange(g, "none")}
                              >
                                <span className="text-muted-foreground">— No group</span>
                              </DropdownMenuItem>
                              {GROUP_OPTIONS.map(opt => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={`text-xs font-medium cursor-pointer ${g.guestGroup === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                  onClick={() => handleGroupChange(g, opt.value)}
                                >
                                  {t(`guests.group_${opt.value}`, opt.label)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color} hover:opacity-80 transition-opacity cursor-pointer`}>
                                {t(`guests.rsvp_${g.rsvpStatus}`)}
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                              {RSVP_OPTIONS.map(opt => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={`text-xs font-medium cursor-pointer ${g.rsvpStatus === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                  onClick={() => handleRsvpChange(g, opt.value)}
                                >
                                  <span className={`w-2 h-2 rounded-full mr-2 ${opt.value === "attending" ? "bg-emerald-500" : opt.value === "declined" ? "bg-red-400" : opt.value === "maybe" ? "bg-sky-400" : "bg-amber-400"}`} />
                                  {t(`guests.rsvp_${opt.value}`)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-border/50 text-muted-foreground hover:opacity-80 transition-opacity cursor-pointer capitalize">
                                {g.mealChoice ? g.mealChoice.replace(/_/g, " ") : "—"}
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                              <DropdownMenuItem
                                className={`text-xs cursor-pointer ${!g.mealChoice ? "opacity-50 pointer-events-none" : ""}`}
                                onClick={() => handleMealChange(g, "none")}
                              >
                                <span className="text-muted-foreground">— No meal</span>
                              </DropdownMenuItem>
                              {MEAL_OPTIONS.map(opt => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={`text-xs font-medium cursor-pointer ${g.mealChoice === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                  onClick={() => handleMealChange(g, opt.value)}
                                >
                                  {t(`guests.meal_${opt.value}`, opt.label)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {g.tableAssignment || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {g.plusOne ? (
                            <span className="font-bold text-primary">
                              ♥ {g.plusOneName || t("guests.plus_one_yes")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t("guests.plus_one_no")}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 transition-colors ${
                                g.rsvpStatus === "attending"
                                  ? "text-emerald-500 cursor-default"
                                  : g.rsvpStatus === "declined"
                                    ? "text-red-400 cursor-default"
                                    : g.invitationStatus === "sent"
                                      ? "text-yellow-500 hover:text-yellow-600"
                                      : "text-muted-foreground hover:text-primary"
                              }`}
                              title={
                                g.rsvpStatus === "attending" ? "RSVP confirmed" :
                                g.rsvpStatus === "declined" ? "Declined" :
                                "Preview & Send invitation"
                              }
                              disabled={
                                (g.rsvpStatus === "attending" || g.rsvpStatus === "declined")
                              }
                              onClick={() => {
                                if (g.rsvpStatus === "attending" || g.rsvpStatus === "declined") return;
                                setSendModalGuest(g);
                              }}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { handleAcknowledge(g.id); setEditGuest(g); }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("guests.remove_title", { name: g.name })}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("guests.remove_desc")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("guests.cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-destructive hover:bg-destructive/90">
                                    {t("guests.remove_btn")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editGuest} onOpenChange={open => !open && setEditGuest(null)}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">Edit Guest</DialogTitle>
            <DialogDescription>Update {editGuest?.name}'s details.</DialogDescription>
          </DialogHeader>
          {editGuest && (
            <GuestForm
              defaultValues={{
                name: editGuest.name,
                email: editGuest.email ?? "",
                rsvpStatus: (editGuest.rsvpStatus as "pending" | "attending" | "maybe" | "declined") ?? "pending",
                mealChoice: editGuest.mealChoice ?? "",
                dietaryNotes: (editGuest as any).dietaryNotes ?? "",
                guestGroup: editGuest.guestGroup ?? "",
                plusOne: editGuest.plusOne,
                plusOneFirstName: editGuest.plusOneName?.split(" ").slice(0, 1).join("") ?? "",
                plusOneLastName: editGuest.plusOneName?.split(" ").slice(1).join(" ") ?? "",
                tableAssignment: editGuest.tableAssignment ?? "",
                phone: (editGuest as any).phone ?? "",
                address: (editGuest as any).address ?? "",
                aptUnit: (editGuest as any).aptUnit ?? "",
                guestCity: (editGuest as any).guestCity ?? "",
                guestState: (editGuest as any).guestState ?? "",
                guestZip: (editGuest as any).guestZip ?? "",
                guestCountry: (editGuest as any).guestCountry ?? "",
                notes: editGuest.notes ?? "",
              }}
              onSubmit={handleEdit}
              isPending={updateGuest.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Invitation Preview & Send Modal */}
      <InvitationSendModal
        guest={sendModalGuest}
        profile={weddingProfile ?? null}
        onClose={() => setSendModalGuest(null)}
        onSendSaveTheDate={(guestId) => sendSaveTheDate.mutate(guestId)}
        onSendDigitalInvitation={(guestId) => sendRsvp.mutate(guestId)}
        isSendingSaveTheDate={sendSaveTheDate.isPending}
        isSendingDigital={sendRsvp.isPending}
      />
    </div>
  );
}
