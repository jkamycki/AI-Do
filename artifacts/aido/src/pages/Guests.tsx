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
} from "@workspace/api-client-react";
import type { Guest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Users, Plus, Search, UserCheck, UserX, Clock, Heart, Trash2, Edit2, Download, Tag, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const RSVP_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "attending", label: "Attending", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-800 border-red-200" },
];

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "fish", label: "Fish" },
  { value: "beef", label: "Beef" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "kids", label: "Kids Meal" },
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
  brides_family: "bg-rose-100 text-rose-800 border-rose-200",
  grooms_family: "bg-violet-100 text-violet-800 border-violet-200",
  brides_friends: "bg-pink-100 text-pink-800 border-pink-200",
  grooms_friends: "bg-indigo-100 text-indigo-800 border-indigo-200",
  brides_coworkers: "bg-sky-100 text-sky-800 border-sky-200",
  grooms_coworkers: "bg-teal-100 text-teal-800 border-teal-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  rsvpStatus: z.enum(["pending", "attending", "declined"]).default("pending"),
  mealChoice: z.string().optional(),
  guestGroup: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneName: z.string().optional(),
  tableAssignment: z.string().optional(),
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
      rsvpStatus: "pending",
      mealChoice: "",
      guestGroup: "",
      plusOne: false,
      plusOneName: "",
      tableAssignment: "",
      notes: "",
      ...defaultValues,
    },
  });

  const plusOne = form.watch("plusOne");

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
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

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
          <FormField control={form.control} name="plusOneName" render={({ field }) => (
            <FormItem>
              <FormLabel>Plus One Name</FormLabel>
              <FormControl><Input placeholder="Plus one's name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
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

        <Button type="submit" className="w-full mt-2" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

function exportCSV(guestList: Guest[]) {
  const headers = ["Name", "Email", "Group", "RSVP", "Meal", "Plus One", "Plus One Name", "Table", "Notes"];
  const rows = guestList.map(g => [
    g.name,
    g.email ?? "",
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });

  function handleRsvpChange(guest: Guest, newStatus: string) {
    updateGuest.mutate({
      id: guest.id,
      data: { ...guest, rsvpStatus: newStatus as "pending" | "attending" | "declined" },
    }, {
      onSuccess: () => invalidate(),
      onError: () => toast({ title: "Failed to update RSVP", variant: "destructive" }),
    });
  }

  function handleAdd(data: GuestFormValues) {
    addGuest.mutate({
      data: {
        ...data,
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
    updateGuest.mutate({
      id: editGuest.id,
      data: {
        ...data,
        email: data.email || undefined,
        mealChoice: data.mealChoice === "none" ? undefined : data.mealChoice || undefined,
        guestGroup: data.guestGroup === "none" ? undefined : data.guestGroup || undefined,
      }
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
                        <TableCell>
                          <div className="font-medium">{g.name}</div>
                          {g.notes && <div className="text-xs text-muted-foreground italic truncate max-w-[160px]" title={g.notes}>{g.notes}</div>}
                          <div className="sm:hidden text-xs text-muted-foreground">{g.email}</div>
                          {grpLabel && (
                            <span className={`sm:hidden inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${grpColor}`}>
                              {grpLabel}
                            </span>
                          )}
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
                            <span className="text-rose-500">
                              ♥ {g.plusOneName || "Yes"}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                guestGroup: editGuest.guestGroup ?? "",
                plusOne: editGuest.plusOne,
                plusOneName: editGuest.plusOneName ?? "",
                tableAssignment: editGuest.tableAssignment ?? "",
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
