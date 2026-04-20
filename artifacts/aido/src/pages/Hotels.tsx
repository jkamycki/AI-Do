import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Hotel, Plus, ExternalLink, Phone, Mail, Copy, Check,
  Trash2, Edit2, BedDouble, Calendar, DollarSign, MapPin, Tag, RotateCcw,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

interface HotelBlock {
  id: number;
  hotelName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  bookingLink?: string | null;
  discountCode?: string | null;
  groupName?: string | null;
  cutoffDate?: string | null;
  roomsReserved?: number | null;
  roomsBooked: number;
  pricePerNight?: number | null;
  distanceFromVenue?: string | null;
  notes?: string | null;
  createdAt: string;
}

const EMPTY: Partial<HotelBlock> = {
  hotelName: "", address: "", city: "", state: "", zip: "", phone: "", email: "", bookingLink: "",
  discountCode: "", groupName: "", cutoffDate: "", roomsReserved: undefined,
  roomsBooked: 0, pricePerNight: undefined, distanceFromVenue: "", notes: "",
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }
  return { copied, copy };
}

function RoomsBar({ reserved, booked }: { reserved?: number | null; booked: number }) {
  if (!reserved) return null;
  const pct = Math.min(100, Math.round((booked / reserved) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{booked} booked / {reserved} reserved</span>
        <span className={`font-semibold ${pct >= 90 ? "text-red-600" : pct >= 60 ? "text-amber-600" : "text-emerald-600"}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HotelForm({
  defaultValues = {},
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<HotelBlock>;
  onSubmit: (data: Partial<HotelBlock>) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<Partial<HotelBlock>>({ ...EMPTY, ...defaultValues });
  const set = (k: keyof HotelBlock, v: string | number | null) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form); }}
      className="space-y-4 py-1"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Hotel Name</Label>
          <Input placeholder="Marriott Newark" value={form.hotelName ?? ""} onChange={e => set("hotelName", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Street Address</Label>
          <Input placeholder="123 Main St" value={form.address ?? ""} onChange={e => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input placeholder="Newark" value={form.city ?? ""} onChange={e => set("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input placeholder="NJ" value={form.state ?? ""} onChange={e => set("state", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>ZIP Code</Label>
          <Input placeholder="07101" value={form.zip ?? ""} onChange={e => set("zip", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Distance from Venue</Label>
          <Input placeholder="e.g. 0.5 miles" value={form.distanceFromVenue ?? ""} onChange={e => set("distanceFromVenue", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input type="tel" placeholder="(555) 000-0000" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="reservations@hotel.com" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Booking Link</Label>
          <Input type="url" placeholder="https://..." value={form.bookingLink ?? ""} onChange={e => set("bookingLink", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Discount / Group Code</Label>
          <Input placeholder="WEDDING2025" value={form.discountCode ?? ""} onChange={e => set("discountCode", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Group Name (for the block)</Label>
          <Input placeholder="Smith-Johnson Wedding" value={form.groupName ?? ""} onChange={e => set("groupName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cutoff Date</Label>
          <Input type="date" value={form.cutoffDate ?? ""} onChange={e => set("cutoffDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Price / Night ($)</Label>
          <Input type="number" min="0" step="0.01" placeholder="189.00" value={form.pricePerNight ?? ""} onChange={e => set("pricePerNight", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="space-y-1.5">
          <Label>Rooms Reserved</Label>
          <Input type="number" min="0" placeholder="20" value={form.roomsReserved ?? ""} onChange={e => set("roomsReserved", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="space-y-1.5">
          <Label>Rooms Booked So Far</Label>
          <Input type="number" min="0" placeholder="0" value={form.roomsBooked ?? 0} onChange={e => set("roomsBooked", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea placeholder="Shuttle available, free breakfast included…" rows={2} className="resize-none" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setForm({ ...EMPTY })}>
          <RotateCcw className="h-4 w-4 mr-2" /> Reset
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function HotelCard({ hotel, onEdit, onDelete }: { hotel: HotelBlock; onEdit: () => void; onDelete: () => void }) {
  const { copied, copy } = useCopy();
  const cutoff = hotel.cutoffDate ? new Date(hotel.cutoffDate + "T12:00:00") : null;
  const daysLeft = cutoff ? Math.ceil((cutoff.getTime() - Date.now()) / 86400000) : null;

  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Hotel className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{hotel.hotelName || "Unnamed Hotel"}</CardTitle>
              {(hotel.address || hotel.city || hotel.state) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {[hotel.address, [hotel.city, hotel.state, hotel.zip].filter(Boolean).join(", ")].filter(Boolean).join(", ")}
                  {hotel.distanceFromVenue && <span className="ml-1 text-primary font-medium">· {hotel.distanceFromVenue}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {hotel.hotelName || "this hotel"}?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently remove this hotel block.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Rooms bar */}
        <RoomsBar reserved={hotel.roomsReserved} booked={hotel.roomsBooked} />

        {/* Key info chips */}
        <div className="flex flex-wrap gap-2">
          {hotel.pricePerNight != null && (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              <DollarSign className="h-3 w-3" />${hotel.pricePerNight}/night
            </span>
          )}
          {hotel.groupName && (
            <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
              <Tag className="h-3 w-3" />{hotel.groupName}
            </span>
          )}
          {daysLeft !== null && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
              daysLeft < 0 ? "bg-red-50 text-red-700 border-red-200" :
              daysLeft <= 14 ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-sky-50 text-sky-700 border-sky-200"
            }`}>
              <Calendar className="h-3 w-3" />
              {daysLeft < 0 ? "Block expired" : `Cutoff in ${daysLeft}d`}
            </span>
          )}
        </div>

        {/* Discount code */}
        {hotel.discountCode && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">Code:</span>
            <span className="text-sm font-mono font-semibold tracking-wider text-primary">{hotel.discountCode}</span>
            <button
              onClick={() => copy(hotel.discountCode!, "code-" + hotel.id)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              title="Copy code"
            >
              {copied === "code-" + hotel.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}

        {/* Contact + link row */}
        <div className="flex flex-wrap gap-2 pt-1">
          {hotel.phone && (
            <a href={`tel:${hotel.phone}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="h-3.5 w-3.5" />{hotel.phone}
            </a>
          )}
          {hotel.email && (
            <a href={`mailto:${hotel.email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5" />{hotel.email}
            </a>
          )}
          {hotel.bookingLink && (
            <a href={hotel.bookingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto">
              Book Now <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {hotel.notes && (
          <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">{hotel.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Hotels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editHotel, setEditHotel] = useState<HotelBlock | null>(null);

  const { data: hotels = [], isLoading, isError } = useQuery<HotelBlock[]>({
    queryKey: ["hotels"],
    queryFn: () => authFetch(`${API}/api/hotels`).then(r => r.json()),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["hotels"] });

  const addMutation = useMutation({
    mutationFn: (data: Partial<HotelBlock>) =>
      authFetch(`${API}/api/hotels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Hotel block added" }); setIsAdding(false); invalidate(); },
    onError: () => toast({ title: "Failed to add hotel block", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: Partial<HotelBlock>) =>
      authFetch(`${API}/api/hotels/${editHotel?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Hotel block updated" }); setEditHotel(null); invalidate(); },
    onError: () => toast({ title: "Failed to update hotel block", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(`${API}/api/hotels/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Hotel block removed" }); invalidate(); },
    onError: () => toast({ title: "Failed to remove hotel block", variant: "destructive" }),
  });

  const totalRooms = hotels.reduce((sum, h) => sum + (h.roomsReserved ?? 0), 0);
  const bookedRooms = hotels.reduce((sum, h) => sum + h.roomsBooked, 0);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <p className="text-muted-foreground">Failed to load hotel blocks. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <Hotel className="h-8 w-8" /> Hotel Blocks
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage hotel room blocks and discount codes for your guests.
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Add Hotel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">Add Hotel Block</DialogTitle>
            </DialogHeader>
            <HotelForm onSubmit={d => addMutation.mutate(d)} isPending={addMutation.isPending} submitLabel="Add Hotel Block" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary bar */}
      {hotels.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Hotels", value: hotels.length, color: "text-primary" },
            { label: "Rooms Reserved", value: totalRooms, color: "text-sky-600" },
            { label: "Rooms Booked", value: bookedRooms, color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-border/60 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-serif font-bold ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cards */}
      {hotels.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BedDouble className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">No hotel blocks yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              Add hotels where you've negotiated room blocks for your guests. Track discount codes, cutoff dates, and booking progress all in one place.
            </p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Your First Hotel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hotels.map(h => (
            <HotelCard
              key={h.id}
              hotel={h}
              onEdit={() => setEditHotel(h)}
              onDelete={() => deleteMutation.mutate(h.id)}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editHotel} onOpenChange={open => !open && setEditHotel(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">Edit Hotel Block</DialogTitle>
          </DialogHeader>
          {editHotel && (
            <HotelForm
              defaultValues={editHotel}
              onSubmit={d => editMutation.mutate(d)}
              isPending={editMutation.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
