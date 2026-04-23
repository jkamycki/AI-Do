import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetGuests,
  useAddGuest,
  useUpdateGuest,
  useDeleteGuest,
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
import { Users, Plus, Search, UserCheck, UserX, Clock, Heart, Trash2, Edit2, Download, Tag, ChevronDown, RotateCcw, Link2, Copy, RefreshCw, CheckCheck, Mail, Phone, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authFetch } from "@/lib/authFetch";

const RSVP_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "attending", label: "Attending", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-800 border-red-200" },
];

const INVITATION_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "sent", label: "Sent", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
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
  brides_family: "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/40",
  grooms_family: "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800/40",
  brides_friends: "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800/40",
  grooms_friends: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40",
  brides_coworkers: "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/40",
  grooms_coworkers: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/40",
  other: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};

const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  invitationStatus: z.enum(["pending", "sent"]).default("pending"),
  rsvpStatus: z.enum(["pending", "attending", "declined"]).default("pending"),
  mealChoice: z.string().optional(),
  dietaryNotes: z.string().max(500).optional(),
  guestGroup: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
  tableAssignment: z.string().optional(),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  guestCity: z.string().optional().default(""),
  guestState: z.string().optional().default(""),
  guestZip: z.string().optional().default(""),
  notes: z.string().optional(),
});

type GuestFormValues = z.infer<typeof guestSchema>;

function getRsvpBadge(status: string) {
  const opt = RSVP_OPTIONS.find(o => o.value === status);
  return opt ? opt : RSVP_OPTIONS[0];
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
      guestCity: "",
      guestState: "",
      guestZip: "",
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
              <FormLabel>Full Name *</FormLabel>
              <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email (optional)</FormLabel>
              <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="invitationStatus" render={({ field }) => (
          <FormItem>
            <FormLabel>Invitation Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {INVITATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="rsvpStatus" render={({ field }) => (
            <FormItem>
              <FormLabel>RSVP Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {RSVP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guestGroup" render={({ field }) => (
            <FormItem>
              <FormLabel>Group / Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="mealChoice" render={({ field }) => (
            <FormItem>
              <FormLabel>Meal Choice</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select meal" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None selected</SelectItem>
                  {MEAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="tableAssignment" render={({ field }) => (
            <FormItem>
              <FormLabel>Table Assignment</FormLabel>
              <FormControl><Input placeholder="e.g. Table 5" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {meal === "other" && (
          <FormField control={form.control} name="dietaryNotes" render={({ field }) => (
            <FormItem>
              <FormLabel>Dietary Needs / Custom Preference</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g. Gluten-free, nut allergy, halal, kosher…" rows={2} maxLength={500} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input type="tel" placeholder="(555) 000-0000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guestCity" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="Boston" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guestState" render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl><Input placeholder="MA" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guestZip" render={({ field }) => (
            <FormItem>
              <FormLabel>ZIP Code</FormLabel>
              <FormControl><Input placeholder="02101" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="plusOne" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <FormLabel>Plus One</FormLabel>
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
                <FormLabel>Plus One First Name</FormLabel>
                <FormControl><Input placeholder="Alex" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="plusOneLastName" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl><Input placeholder="Smith" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea placeholder="Dietary restrictions, accessibility needs, VIP…" className="resize-none" rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex gap-3 mt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => form.reset({ name: "", email: "", invitationStatus: "pending", rsvpStatus: "pending", mealChoice: "", guestGroup: "", plusOne: false, plusOneFirstName: "", plusOneLastName: "", tableAssignment: "", phone: "", address: "", guestCity: "", guestState: "", guestZip: "", notes: "" })}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function exportCSV(guestList: Guest[]) {
  const headers = ["Name", "Email", "Invitation Sent", "Group", "RSVP", "Meal", "Plus One", "Plus One Name", "Table", "Notes"];
  const rows = guestList.map(g => [
    g.name,
    g.email ?? "",
    g.invitationStatus === "sent" ? "Sent" : "Pending",
    getGroupLabel(g.guestGroup),
    g.rsvpStatus,
    g.mealChoice ?? "",
    g.plusOne ? "Yes" : "No",
    g.plusOneName ?? "",
    g.tableAssignment ?? "",
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
    onError: () => toast({ title: "Error", description: "Could not generate link.", variant: "destructive" }),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/guest-collect/regenerate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate link");
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => {
      setToken(data.token);
      toast({ title: "New link generated", description: "The old link is now inactive." });
    },
    onError: () => toast({ title: "Error", description: "Could not regenerate link.", variant: "destructive" }),
  });

  const copyLink = () => {
    if (!collectorUrl) return;
    navigator.clipboard.writeText(collectorUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="border-rose-200 bg-rose-50/30 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="h-4 w-4 text-rose-500" />
          Guest Collector Link
        </CardTitle>
        <CardDescription>
          Generate a shareable link so guests can submit their mailing address and contact info for invitations. RSVP is managed separately by you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="bg-rose-500 hover:bg-rose-600 text-white"
          >
            {generate.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Link2 className="h-4 w-4 mr-2" /> Generate Collection Link</>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Link display + copy */}
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={collectorUrl ?? ""}
                className="text-xs font-mono bg-white border-rose-200 text-rose-700"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                className="shrink-0 border-rose-200 hover:bg-rose-100"
                title="Copy link"
              >
                {copied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Link preview — shows guests what they'll see before clicking */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Preview — what guests see when you share this link:</p>
            <div className="rounded-xl border border-rose-100 bg-white overflow-hidden shadow-sm">
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #f43f5e, #a855f7)" }} />
              <div className="flex items-start gap-3 p-3">
                <div className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fecdd3, #f9a8d4)" }}>
                  <Heart className="h-5 w-5 fill-rose-400 text-rose-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#a855f7" }}>Contact Info Request</p>
                  <p className="text-sm font-bold text-gray-900 leading-tight truncate" style={{ fontFamily: "Georgia, serif" }}>{coupleNames}</p>
                  <p className="text-xs text-gray-500 mt-0.5">are collecting addresses for their wedding invitations</p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{formUrl}</p>
                </div>
              </div>
            </div>
            </div>

            {/* Share buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 hover:bg-rose-50 text-rose-700 gap-2"
                onClick={() => {
                  const subject = encodeURIComponent("Please share your contact info with us!");
                  const body = encodeURIComponent(
                    `Hi!\n\nWe'd love to have your contact details for our wedding guest list. Please take a moment to fill out this quick form below:\n\n${collectorUrl}\n\nThank you!`
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
              >
                <Mail className="h-3.5 w-3.5" /> Email Link
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-rose-600 gap-1 ml-auto">
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate link?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The current link will stop working immediately. Anyone who has the old link won't be able to use it anymore.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-rose-500 hover:bg-rose-600"
                      onClick={() => regenerate.mutate()}
                    >
                      Yes, Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <p className="text-xs text-muted-foreground">
              Their info will appear in your guest list automatically once submitted.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Guests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);

  const { data, isLoading, isError } = useGetGuests();
  const addGuest = useAddGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();

  const allGuests = data?.guests ?? [];
  const summary = data?.summary ?? { total: 0, attending: 0, declined: 0, pending: 0, plusOnes: 0 };

  const usedGroups = [...new Set(allGuests.map(g => g.guestGroup).filter(Boolean))] as string[];

  const filtered = allGuests.filter(g => {
    const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || (g.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesRsvp = rsvpFilter === "all" || g.rsvpStatus === rsvpFilter;
    const matchesGroup = groupFilter === "all" || g.guestGroup === groupFilter;
    return matchesSearch && matchesRsvp && matchesGroup;
  });

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
        rsvpStatus: newStatus as "pending" | "attending" | "declined",
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
        rsvpStatus: guest.rsvpStatus as "pending" | "attending" | "declined",
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
        invalidate();
      },
      onError: () => toast({ title: "Failed to add guest", variant: "destructive" }),
    });
  }

  function handleEdit(data: GuestFormValues) {
    if (!editGuest) return;
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()].filter(Boolean).join(" ") || null
      : null;
    updateGuest.mutate({
      id: editGuest.id,
      data: {
        name: data.name,
        email: data.email || null,
        invitationStatus: data.invitationStatus,
        rsvpStatus: data.rsvpStatus,
        plusOne: data.plusOne,
        plusOneName: plusOneName ?? undefined,
        mealChoice: (data.mealChoice === "none" || !data.mealChoice) ? null : data.mealChoice,
        dietaryNotes: data.mealChoice === "other" ? (data.dietaryNotes?.trim() || null) : null,
        guestGroup: (data.guestGroup === "none" || !data.guestGroup) ? null : data.guestGroup,
        tableAssignment: data.tableAssignment || null,
        notes: data.notes || null,
        phone: data.phone || null,
        address: data.address || null,
        guestCity: data.guestCity || null,
        guestState: data.guestState || null,
        guestZip: data.guestZip || null,
      } as Parameters<typeof updateGuest.mutate>[0]["data"]
    }, {
      onSuccess: () => {
        toast({ title: "Guest updated" });
        setEditGuest(null);
        invalidate();
      },
      onError: () => toast({ title: "Failed to update guest", variant: "destructive" }),
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
            <Users className="h-8 w-8" /> Guest List
          </h1>
          <p className="text-lg text-muted-foreground mt-2">Track RSVPs, meals, and seating for everyone.</p>
        </div>
        <div className="flex gap-2">
          {allGuests.length > 0 && (
            <Button variant="outline" onClick={() => exportCSV(allGuests)}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-md">
                <Plus className="mr-2 h-4 w-4" /> Add Guest
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl text-primary">New Guest</DialogTitle>
                <DialogDescription>Add someone to your guest list.</DialogDescription>
              </DialogHeader>
              <GuestForm onSubmit={handleAdd} isPending={addGuest.isPending} submitLabel="Add Guest" />
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
            <span className="font-medium text-foreground">RSVP Response Rate</span>
            <span className="text-muted-foreground">
              {summary.attending + summary.declined} of {summary.total} responded
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
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Attending ({summary.attending})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Declined ({summary.declined})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> Awaiting ({summary.pending})</span>
          </div>
        </div>
      )}

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: Users, label: "Total", value: summary.total, color: "text-primary" },
          { icon: UserCheck, label: "Attending", value: summary.attending, color: "text-emerald-600" },
          { icon: UserX, label: "Declined", value: summary.declined, color: "text-red-500" },
          { icon: Clock, label: "Pending", value: summary.pending, color: "text-amber-600" },
          { icon: Heart, label: "Plus Ones", value: summary.plusOnes, color: "text-rose-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Icon className={`h-5 w-5 mb-1 ${color}`} />
              <div className={`text-2xl font-serif font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
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
              Clear filter ×
            </button>
          )}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
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
            <SelectItem value="all">All RSVPs</SelectItem>
            {RSVP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
            <h3 className="text-xl font-serif text-foreground mb-2">Your guest list is empty</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Start adding guests to track RSVPs, meal choices, and seating assignments.</p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Your First Guest
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No guests match your search or filter.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "guest" : "guests"} {rsvpFilter !== "all" || groupFilter !== "all" || search ? "(filtered)" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Invitation</TableHead>
                    <TableHead className="hidden sm:table-cell">Group</TableHead>
                    <TableHead>RSVP</TableHead>
                    <TableHead className="hidden md:table-cell">Meal</TableHead>
                    <TableHead className="hidden md:table-cell">Table</TableHead>
                    <TableHead className="hidden lg:table-cell">+1</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(g => {
                    const badge = getRsvpBadge(g.rsvpStatus);
                    const grpLabel = getGroupLabel(g.guestGroup);
                    const grpColor = g.guestGroup ? (GROUP_COLORS[g.guestGroup] ?? "bg-gray-100 text-gray-700 border-gray-200") : "";
                    return (
                      <TableRow key={g.id} className="group">
                        <TableCell className="min-w-[200px]">
                          <div className="font-medium">{g.name}</div>
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
                          {(g as any).address && (
                            <div className="flex items-start gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="leading-snug">
                                {(g as any).address}
                                {((g as any).guestCity || (g as any).guestState || (g as any).guestZip) && (
                                  <><br />{[(g as any).guestCity, (g as any).guestState, (g as any).guestZip].filter(Boolean).join(", ")}</>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${INVITATION_OPTIONS.find(o => o.value === g.invitationStatus)?.color ?? INVITATION_OPTIONS[0].color}`}>
                                {INVITATION_OPTIONS.find(o => o.value === g.invitationStatus)?.label ?? "Pending"}
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                              {INVITATION_OPTIONS.map(opt => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={`text-xs font-medium cursor-pointer ${g.invitationStatus === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                  onClick={() => handleInvitationChange(g, opt.value)}
                                >
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {grpLabel ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${grpColor}`}>
                              {grpLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color} hover:opacity-80 transition-opacity cursor-pointer`}>
                                {badge.label}
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
                                  <span className={`w-2 h-2 rounded-full mr-2 ${opt.value === "attending" ? "bg-emerald-500" : opt.value === "declined" ? "bg-red-400" : "bg-amber-400"}`} />
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground capitalize">
                          {g.mealChoice ? g.mealChoice.replace(/_/g, " ") : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {g.tableAssignment || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {g.plusOne ? (
                            <span className="font-bold text-primary">
                              ♥ {g.plusOneName || "Yes"}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => setEditGuest(g)}
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
                                  <AlertDialogTitle>Remove {g.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove them from your guest list.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-destructive hover:bg-destructive/90">
                                    Remove
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
                rsvpStatus: (editGuest.rsvpStatus as "pending" | "attending" | "declined") ?? "pending",
                mealChoice: editGuest.mealChoice ?? "",
                dietaryNotes: (editGuest as any).dietaryNotes ?? "",
                guestGroup: editGuest.guestGroup ?? "",
                plusOne: editGuest.plusOne,
                plusOneFirstName: editGuest.plusOneName?.split(" ").slice(0, 1).join("") ?? "",
                plusOneLastName: editGuest.plusOneName?.split(" ").slice(1).join(" ") ?? "",
                tableAssignment: editGuest.tableAssignment ?? "",
                phone: (editGuest as any).phone ?? "",
                address: (editGuest as any).address ?? "",
                guestCity: (editGuest as any).guestCity ?? "",
                guestState: (editGuest as any).guestState ?? "",
                guestZip: (editGuest as any).guestZip ?? "",
                notes: editGuest.notes ?? "",
              }}
              onSubmit={handleEdit}
              isPending={updateGuest.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
