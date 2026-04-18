import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Phone, Mail, Trash2, Edit2, Crown, Heart } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

interface Member {
  id: number;
  name: string;
  role: string;
  side: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  sortOrder: number;
  createdAt: string;
}

const ROLES = [
  "Maid of Honor",
  "Best Man",
  "Bridesmaid",
  "Groomsman",
  "Flower Girl",
  "Ring Bearer",
  "Junior Bridesmaid",
  "Groomslady",
  "Bridesmen",
  "Officiant",
  "Other",
];

const SIDES = [
  { value: "bride", label: "Bridal Party" },
  { value: "groom", label: "Groomsmen" },
];

const SIDE_COLORS: Record<string, string> = {
  bride: "bg-rose-100 text-rose-700 border-rose-200",
  groom: "bg-sky-100 text-sky-700 border-sky-200",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  "Maid of Honor": Crown,
  "Best Man": Crown,
};

const EMPTY: Partial<Member> = {
  name: "", role: "Bridesmaid", side: "bride",
  phone: "", email: "", notes: "", sortOrder: 0,
};

function MemberForm({
  defaultValues = {},
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<Member>;
  onSubmit: (data: Partial<Member>) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<Partial<Member>>({ ...EMPTY, ...defaultValues });
  const set = (k: keyof Member, v: string | number | null) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4 py-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Full Name *</Label>
          <Input placeholder="Jane Smith" value={form.name ?? ""} onChange={e => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Role *</Label>
          <Select value={form.role ?? "Bridesmaid"} onValueChange={v => set("role", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Side</Label>
          <Select value={form.side ?? "bride"} onValueChange={v => set("side", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SIDES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input type="tel" placeholder="(555) 000-0000" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="jane@email.com" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea placeholder="Allergies, accessibility needs, hotel info…" rows={2} className="resize-none" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending || !form.name || !form.role}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function MemberCard({ member, onEdit, onDelete }: { member: Member; onEdit: () => void; onDelete: () => void }) {
  const sideColor = SIDE_COLORS[member.side] ?? SIDE_COLORS.bride;
  const sideLabel = SIDES.find(s => s.value === member.side)?.label ?? member.side;

  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
              member.side === "bride" ? "bg-rose-100 text-rose-700" :
              member.side === "groom" ? "bg-sky-100 text-sky-700" :
              "bg-violet-100 text-violet-700"
            }`}>
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground">{member.name}</p>
                {(member.role === "Maid of Honor" || member.role === "Best Man") && (
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">{member.role}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sideColor}`}>
                  {sideLabel}
                </span>
              </div>
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
                  <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently remove them from your wedding party.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Details */}
        <div className="mt-3 space-y-1.5">
          {(member.phone || member.email) && (
            <div className="flex flex-wrap gap-3">
              {member.phone && (
                <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="h-3.5 w-3.5" />{member.phone}
                </a>
              )}
              {member.email && (
                <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5" />{member.email}
                </a>
              )}
            </div>
          )}
          {member.notes && (
            <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2 mt-2">{member.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PartyGroup({ title, members, icon: Icon, color, onEdit, onDelete }: {
  title: string;
  members: Member[];
  icon: React.ElementType;
  color: string;
  onEdit: (m: Member) => void;
  onDelete: (id: number) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit text-sm font-semibold border ${color}`}>
        <Icon className="h-4 w-4" />
        {title} · {members.length}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {members.map(m => (
          <MemberCard key={m.id} member={m} onEdit={() => onEdit(m)} onDelete={() => onDelete(m.id)} />
        ))}
      </div>
    </div>
  );
}

export default function WeddingParty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const { data: members = [], isLoading, isError } = useQuery<Member[]>({
    queryKey: ["wedding-party"],
    queryFn: () => authFetch(`${API}/api/wedding-party`).then(r => r.json()),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["wedding-party"] });

  const addMutation = useMutation({
    mutationFn: (data: Partial<Member>) =>
      authFetch(`${API}/api/wedding-party`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Member added" }); setIsAdding(false); invalidate(); },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: Partial<Member>) =>
      authFetch(`${API}/api/wedding-party/${editMember?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Member updated" }); setEditMember(null); invalidate(); },
    onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(`${API}/api/wedding-party/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Member removed" }); invalidate(); },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const bridesSide = members.filter(m => m.side === "bride");
  const groomsSide = members.filter(m => m.side === "groom");

  const stats = [
    { label: "Total Members", value: members.length, color: "text-primary" },
    { label: "Bridal Party", value: bridesSide.length, color: "text-rose-600" },
    { label: "Groomsmen", value: groomsSide.length, color: "text-sky-600" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <p className="text-muted-foreground">Failed to load wedding party. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <Users className="h-8 w-8" /> Wedding Party
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Bridesmaids, groomsmen, and your entire wedding party — all in one place.
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">Add Wedding Party Member</DialogTitle>
            </DialogHeader>
            <MemberForm onSubmit={d => addMutation.mutate(d)} isPending={addMutation.isPending} submitLabel="Add Member" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {members.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ label, value, color }) => (
            <Card key={label} className="border-border/60 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-serif font-bold ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">No wedding party yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              Add your bridesmaids, groomsmen, flower girls, and more. Keep all their contact info and notes in one place.
            </p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add First Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <PartyGroup
            title="Bridal Party"
            members={bridesSide}
            icon={Heart}
            color="bg-rose-50 text-rose-700 border-rose-200"
            onEdit={setEditMember}
            onDelete={id => deleteMutation.mutate(id)}
          />
          <PartyGroup
            title="Groomsmen"
            members={groomsSide}
            icon={Users}
            color="bg-sky-50 text-sky-700 border-sky-200"
            onEdit={setEditMember}
            onDelete={id => deleteMutation.mutate(id)}
          />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={open => !open && setEditMember(null)}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">Edit Member</DialogTitle>
          </DialogHeader>
          {editMember && (
            <MemberForm
              defaultValues={editMember}
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
