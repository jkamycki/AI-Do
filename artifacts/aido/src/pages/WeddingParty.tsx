import { useState, useRef, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Phone, Mail, Trash2, Edit2, Crown, Heart, RotateCcw, Camera, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HeadshotCropDialog } from "@/components/HeadshotCropDialog";

const API = import.meta.env.VITE_API_URL ?? "";

// ─── Storage helpers ──────────────────────────────────────────────────────────

function objectUrl(objectPath: string) {
  return `/api/storage/objects/${objectPath.replace(/^\/objects\//, "")}`;
}

/**
 * Authenticated image — storage objects require a Bearer token that plain
 * <img> tags cannot send, so we fetch the blob with credentials and render
 * from a local blob URL.
 */
const AuthImage = memo(function AuthImage({
  objectPath,
  alt,
  className,
}: {
  objectPath: string;
  alt: string;
  className?: string;
}) {
  const { getToken } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(objectUrl(objectPath), {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setSrc(url);
      } catch {
        /* silently fail — letter avatar shown instead */
      }
    })();
    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [objectPath, getToken]);

  if (!src) return <div className={`bg-muted animate-pulse ${className ?? ""}`} />;
  return <img src={src} alt={alt} className={className} />;
});

// ─── Types / Constants ────────────────────────────────────────────────────────

interface Member {
  id: number;
  name: string;
  role: string;
  side: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
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

const AVATAR_BG: Record<string, string> = {
  bride: "bg-rose-100 text-rose-700",
  groom: "bg-sky-100 text-sky-700",
};

const EMPTY: Partial<Member> = {
  name: "", role: "Bridesmaid", side: "bride",
  phone: "", email: "", notes: "", sortOrder: 0,
};

// ─── MemberForm ───────────────────────────────────────────────────────────────

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
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<Member>>({ ...EMPTY, ...defaultValues });
  const set = (k: keyof Member, v: string | number | null) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4 py-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("party.full_name")}</Label>
          <Input placeholder="Jane Smith" value={form.name ?? ""} onChange={e => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("party.role_label")}</Label>
          <Select value={form.role ?? "Bridesmaid"} onValueChange={v => set("role", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("party.side_label")}</Label>
          <Select value={form.side ?? "bride"} onValueChange={v => set("side", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bride">{t("party.side_bridal")}</SelectItem>
              <SelectItem value="groom">{t("party.side_groomsmen")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("party.phone_label")}</Label>
          <Input type="tel" placeholder="(555) 000-0000" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("party.email_label")}</Label>
          <Input type="email" placeholder="jane@email.com" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("party.notes_label")}</Label>
          <Textarea placeholder={t("party.notes_placeholder")} rows={2} className="resize-none" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setForm({ ...EMPTY })}>
          <RotateCcw className="h-4 w-4 mr-2" /> {t("party.reset")}
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending || !form.name || !form.role}>
          {isPending ? t("party.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────

function MemberCard({
  member,
  onEdit,
  onDelete,
  onPhotoChange,
}: {
  member: Member;
  onEdit: () => void;
  onDelete: () => void;
  onPhotoChange: (memberId: number, photoUrl: string | null) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("headshot");

  const sideColor = SIDE_COLORS[member.side] ?? SIDE_COLORS.bride;
  const sideLabel = member.side === "bride" ? t("party.side_bridal") : member.side === "groom" ? t("party.side_groomsmen") : member.side;
  const avatarBg = AVATAR_BG[member.side] ?? "bg-violet-100 text-violet-700";

  const { uploadFile, isUploading } = useUpload({
    getToken,
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const photoMutation = useMutation({
    mutationFn: async (photoUrl: string | null) => {
      const res = await authFetch(`${API}/api/wedding-party/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...member, photoUrl }),
      });
      if (!res.ok) throw new Error("Failed to save photo");
      return res.json() as Promise<Member>;
    },
    onSuccess: (updated) => {
      onPhotoChange(member.id, updated.photoUrl ?? null);
    },
    onError: () => toast({ title: "Could not save photo", variant: "destructive" }),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFileName(file.name);
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleCropConfirm(croppedFile: File) {
    setCropSrc(null);
    const result = await uploadFile(croppedFile);
    if (result) {
      photoMutation.mutate(result.objectPath);
    }
  }

  const isBusy = isUploading || photoMutation.isPending;

  return (
    <>
      <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              {/* Avatar — click to upload/change headshot */}
              <div
                className="relative group w-11 h-11 rounded-full shrink-0 cursor-pointer overflow-hidden"
                onClick={() => !isBusy && fileInputRef.current?.click()}
                title={member.photoUrl ? "Change headshot" : "Add headshot"}
              >
                {member.photoUrl ? (
                  <AuthImage
                    objectPath={member.photoUrl}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-bold text-sm ${avatarBg}`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* hover / busy overlay */}
                <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-opacity ${
                  isBusy ? "opacity-100 bg-black/50" : "opacity-0 group-hover:opacity-100 bg-black/40"
                }`}>
                  {isBusy
                    ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                    : <Camera className="h-4 w-4 text-white" />
                  }
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileSelect}
              />

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
                    <AlertDialogTitle>{t("party.remove_member_title", { name: member.name })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("party.remove_member_desc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">{t("party.remove_btn")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Contact / notes */}
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

      {cropSrc && (
        <HeadshotCropDialog
          imageSrc={cropSrc}
          originalFileName={cropFileName}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  );
}

// ─── PartyGroup ───────────────────────────────────────────────────────────────

function PartyGroup({ title, members, icon: Icon, color, onEdit, onDelete, onPhotoChange }: {
  title: string;
  members: Member[];
  icon: React.ElementType;
  color: string;
  onEdit: (m: Member) => void;
  onDelete: (id: number) => void;
  onPhotoChange: (id: number, photoUrl: string | null) => void;
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
          <MemberCard
            key={m.id}
            member={m}
            onEdit={() => onEdit(m)}
            onDelete={() => onDelete(m.id)}
            onPhotoChange={onPhotoChange}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeddingParty() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const { data: members = [], isLoading, isError } = useQuery<Member[]>({
    queryKey: ["wedding-party"],
    queryFn: async () => {
      const r = await authFetch(`${API}/api/wedding-party`);
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["wedding-party"] });

  const addMutation = useMutation({
    mutationFn: (data: Partial<Member>) =>
      authFetch(`${API}/api/wedding-party`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: t("party.member_added") }); setIsAdding(false); invalidate(); },
    onError: () => toast({ title: t("party.member_add_failed"), variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: Partial<Member>) =>
      authFetch(`${API}/api/wedding-party/${editMember?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: t("party.member_updated") }); setEditMember(null); invalidate(); },
    onError: () => toast({ title: t("party.member_update_failed"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(`${API}/api/wedding-party/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: t("party.member_removed") }); invalidate(); },
    onError: () => toast({ title: t("party.member_remove_failed"), variant: "destructive" }),
  });

  /** Optimistically update the photo in the cache without a full refetch. */
  function handlePhotoChange(id: number, photoUrl: string | null) {
    queryClient.setQueryData<Member[]>(["wedding-party"], old =>
      old ? old.map(m => m.id === id ? { ...m, photoUrl } : m) : old,
    );
  }

  const bridesSide = members.filter(m => m.side === "bride");
  const groomsSide = members.filter(m => m.side === "groom");

  const stats = [
    { label: t("party.stat_total"), value: members.length, color: "text-primary" },
    { label: t("party.stat_bridal"), value: bridesSide.length, color: "text-rose-600" },
    { label: t("party.stat_groomsmen"), value: groomsSide.length, color: "text-sky-600" },
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
        <p className="text-muted-foreground">{t("party.load_error")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <Users className="h-8 w-8" /> {t("party.title")}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            {t("party.subtitle")}
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md shrink-0">
              <Plus className="mr-2 h-4 w-4" /> {t("party.add_member")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">{t("party.add_party_member")}</DialogTitle>
            </DialogHeader>
            <MemberForm onSubmit={d => addMutation.mutate(d)} isPending={addMutation.isPending} submitLabel={t("party.add_member")} />
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
            <h3 className="text-xl font-serif text-foreground mb-2">{t("party.empty_title")}</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              {t("party.empty_desc")}
            </p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> {t("party.add_first_member")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <PartyGroup
            title={t("party.bridal_party")}
            members={bridesSide}
            icon={Heart}
            color="bg-rose-50 text-rose-700 border-rose-200"
            onEdit={setEditMember}
            onDelete={id => deleteMutation.mutate(id)}
            onPhotoChange={handlePhotoChange}
          />
          <PartyGroup
            title={t("party.groomsmen")}
            members={groomsSide}
            icon={Users}
            color="bg-sky-50 text-sky-700 border-sky-200"
            onEdit={setEditMember}
            onDelete={id => deleteMutation.mutate(id)}
            onPhotoChange={handlePhotoChange}
          />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={open => !open && setEditMember(null)}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">{t("party.edit_member")}</DialogTitle>
          </DialogHeader>
          {editMember && (
            <MemberForm
              defaultValues={editMember}
              onSubmit={d => editMutation.mutate(d)}
              isPending={editMutation.isPending}
              submitLabel={t("party.save_changes")}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
