import { useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useGetProfile, useSaveProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users, UserPlus, Mail, Shield, Eye, Briefcase, Copy,
  CheckCircle2, Clock, XCircle, Trash2, RefreshCw, ChevronDown,
  Settings as SettingsIcon, Crown, Globe, Check, TriangleAlert,
} from "lucide-react";

type CollabRole = "partner" | "planner" | "vendor";
type CollabStatus = "pending" | "active" | "declined";

interface Collaborator {
  id: number;
  profileId: number;
  inviterUserId?: string | null;
  inviteeEmail?: string | null;
  inviteeUserId?: string | null;
  role: CollabRole;
  status: CollabStatus;
  inviteToken?: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

const ROLE_CONFIG: Record<CollabRole, { label: string; description: string; icon: React.ElementType; color: string }> = {
  partner: {
    label: "Partner",
    description: "Full access to all planning tools",
    icon: Crown,
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  planner: {
    label: "Planner",
    description: "Edit timeline, checklist, emails & budget",
    icon: Briefcase,
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  vendor: {
    label: "Vendor",
    description: "View timeline + download documents",
    icon: Eye,
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

const STATUS_CONFIG: Record<CollabStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  active: { label: "Active", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  declined: { label: "Declined", icon: XCircle, color: "bg-red-100 text-red-700" },
};

function RoleBadge({ role }: { role: CollabRole }) {
  const { t } = useTranslation();
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  const labelKey = `settings.role_${role}` as const;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </span>
  );
}

function StatusBadge({ status }: { status: CollabStatus }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const labelKey = `settings.status_${status}` as const;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </span>
  );
}

function DeleteAccountCard() {
  const { t } = useTranslation();
  const { getToken, signOut } = useAuth();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await authFetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete account");
      }
      try {
        // Wipe any cached workspace so a fresh sign-up in the same browser
        // doesn't inherit the now-deleted account's shared workspace.
        localStorage.removeItem("aido_active_workspace");
      } catch {}
      await signOut({ redirectUrl: "/" });
    } catch (err: unknown) {
      setDeleting(false);
      toast({
        variant: "destructive",
        title: "Could not delete account",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <Card className="border border-destructive/30 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
            <TriangleAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="font-serif text-lg text-destructive">{t("settings.danger_zone")}</CardTitle>
            <CardDescription>{t("settings.danger_desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div>
            <p className="font-medium text-sm">{t("settings.delete_account")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.delete_account_desc")}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t("settings.delete_account_button")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif text-xl text-destructive">
                  {t("settings.delete_account_confirm_title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm space-y-2">
                  <span className="block">{t("settings.delete_account_will_delete")}</span>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>{t("settings.delete_account_item_1")}</li>
                    <li>{t("settings.delete_account_item_2")}</li>
                    <li>{t("settings.delete_account_item_3")}</li>
                    <li>{t("settings.delete_account_item_4")}</li>
                    <li>{t("settings.delete_account_item_5")}</li>
                  </ul>
                  <span className="block font-medium text-foreground mt-2">
                    {t("settings.delete_account_warning")}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("settings.delete_account_keep")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t("settings.deleting") : t("settings.delete_account_yes")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageSwitcherCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useUser();
  const [selected, setSelected] = useState<string | null>(null);

  const storedCode = user?.id ? localStorage.getItem(`aido_language_${user.id}`) : null;
  const storedName = storedCode ? (Object.entries(LANG_NAME_TO_CODE).find(([, c]) => c === storedCode)?.[0] ?? "English") : "English";
  const current = selected ?? storedName;
  const hasChange = selected !== null;

  function save() {
    if (!hasChange) return;
    const code = LANG_NAME_TO_CODE[current] ?? "en";
    i18n.changeLanguage(code);
    // Store under a per-user key so collaborators never overwrite each other.
    const key = user?.id ? `aido_language_${user.id}` : "aido_language";
    localStorage.setItem(key, code);
    setSelected(null);
    toast({ title: "Language updated", description: `Switched to ${current}.` });
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-serif text-lg">{t("settings.language_title")}</CardTitle>
            <CardDescription>{t("settings.language_desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3">
          <LanguagePicker value={current} onChange={setSelected} />
          <Button
            onClick={save}
            disabled={!hasChange}
            size="sm"
            variant={hasChange ? "default" : "outline"}
          >
            {hasChange ? (
              <>{t("settings.save")}</>
            ) : (
              <><Check className="h-3.5 w-3.5 mr-1" /> {t("settings.saved")}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VendorBccEmailCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  const saveProfile = useSaveProfile();
  const [draft, setDraft] = useState<string | null>(null);

  const current = draft ?? (profile as { vendorBccEmail?: string | null } | undefined)?.vendorBccEmail ?? "";
  const original = (profile as { vendorBccEmail?: string | null } | undefined)?.vendorBccEmail ?? "";
  const hasChange = draft !== null && draft.trim() !== original.trim();
  const isValid = !current || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.trim());

  function save() {
    if (!profile || !isValid) return;
    saveProfile.mutate(
      {
        data: {
          partner1Name: profile.partner1Name,
          partner2Name: profile.partner2Name,
          weddingDate: profile.weddingDate,
          ceremonyTime: profile.ceremonyTime,
          receptionTime: profile.receptionTime,
          venue: profile.venue,
          location: profile.location,
          venueCity: profile.venueCity ?? undefined,
          venueState: profile.venueState ?? undefined,
          venueZip: profile.venueZip ?? undefined,
          venueCountry: (profile as { venueCountry?: string | null }).venueCountry ?? undefined,
          ceremonyAtVenue: (profile as { ceremonyAtVenue?: boolean }).ceremonyAtVenue,
          ceremonyVenueName: (profile as { ceremonyVenueName?: string | null }).ceremonyVenueName ?? undefined,
          ceremonyAddress: (profile as { ceremonyAddress?: string | null }).ceremonyAddress ?? undefined,
          ceremonyCity: (profile as { ceremonyCity?: string | null }).ceremonyCity ?? undefined,
          ceremonyState: (profile as { ceremonyState?: string | null }).ceremonyState ?? undefined,
          ceremonyZip: (profile as { ceremonyZip?: string | null }).ceremonyZip ?? undefined,
          guestCount: profile.guestCount,
          totalBudget: profile.totalBudget,
          weddingVibe: profile.weddingVibe,
          preferredLanguage: profile.preferredLanguage ?? "English",
          vendorBccEmail: current.trim() || null,
        } as never,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setDraft(null);
          toast({ title: t("settings.cc_email_saved_toast"), description: current ? t("settings.cc_email_saved_desc", { email: current }) : t("settings.cc_removed") });
        },
        onError: () => toast({ variant: "destructive", title: t("common.error"), description: t("settings.cc_email_invalid") }),
      }
    );
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-serif text-lg">{t("settings.cc_email_title")}</CardTitle>
            <CardDescription>
              {t("settings.cc_email_desc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-10 bg-muted animate-pulse rounded-md" />
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">{t("settings.complete_profile_first")}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Input
                type="email"
                placeholder={t("settings.cc_email_placeholder")}
                value={current}
                onChange={(e) => setDraft(e.target.value)}
                className="max-w-sm bg-background"
              />
              <Button
                onClick={save}
                disabled={!hasChange || !isValid || saveProfile.isPending}
                size="sm"
                variant={hasChange ? "default" : "outline"}
              >
                {saveProfile.isPending ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                ) : hasChange ? (
                  <>{t("settings.cc_email_save")}</>
                ) : (
                  <><Check className="h-3.5 w-3.5 mr-1" /> {t("settings.cc_email_saved")}</>
                )}
              </Button>
            </div>
            {!isValid && current && (
              <p className="text-xs text-destructive">{t("settings.cc_email_invalid")}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("settings.cc_email_hint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"collaborators" | "account">("collaborators");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CollabRole>("planner");
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  const sharedProfileId = activeWorkspace?.profileId ?? null;

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    const apiBase = import.meta.env.VITE_API_URL ?? "";
    const resolved = url.startsWith("/") && apiBase ? `${apiBase}${url}` : url;
    return fetch(resolved, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["collaborators", sharedProfileId],
    queryFn: async () => {
      const url = sharedProfileId
        ? `/api/collaborators?workspaceId=${sharedProfileId}`
        : "/api/collaborators";
      const r = await authedFetch(url);
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json() as Promise<{
        collaborators: Collaborator[];
        workspaceName: string;
        profileId: number;
        myRole: string;
      }>;
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const myRole = data?.myRole ?? (sharedProfileId ? activeWorkspace?.role ?? "viewer" : "owner");
  const canManage = myRole === "owner" || myRole === "partner";

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { email: inviteEmail, role: inviteRole };
      if (sharedProfileId) body.workspaceId = sharedProfileId;
      const r = await authedFetch("/api/collaborators/invite", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to invite");
      }
      return r.json() as Promise<Collaborator>;
    },
    onSuccess: (collab) => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      const link = `${window.location.origin}/invite/${collab.inviteToken ?? ""}`;
      setNewInviteLink(link);

      // Open the user's email client with everything pre-filled
      const workspaceName = data?.workspaceName ?? "our wedding";
      const role = ROLE_CONFIG[inviteRole]?.label ?? inviteRole;
      const subject = encodeURIComponent(`You're invited to collaborate on ${workspaceName}'s wedding planning`);
      const body = encodeURIComponent(
        `Hi there!\n\nYou've been invited to collaborate on ${workspaceName}'s wedding workspace as a ${role} on A.IDO.\n\nAccept your invitation by clicking the link below:\n\n${link}\n\n(If the link doesn't appear clickable, copy and paste it into your browser.)\n\nSee you there!\n${workspaceName}`
      );
      window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;

      setInviteEmail("");
      toast({ title: t("settings.invite_ready"), description: t("settings.invite_ready_desc") });
    },
    onError: (err: Error) => {
      toast({ title: t("settings.invite_failed"), description: err.message, variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: CollabRole }) => {
      const r = await authedFetch(`/api/collaborators/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      if (!r.ok) throw new Error("Failed to update role");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      setEditingRoleId(null);
      toast({ title: t("settings.role_change_saved") });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/collaborators/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to remove");
      }
    },
    onSuccess: () => {
      setConfirmRemoveId(null);
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      toast({ title: t("settings.collab_removed") });
    },
    onError: (err: Error) => {
      setConfirmRemoveId(null);
      toast({ title: t("settings.could_not_remove"), description: err.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/collaborators/${id}/resend`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to resend");
      return r.json() as Promise<Collaborator>;
    },
    onSuccess: (collab) => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      const link = `${window.location.origin}/invite/${collab.inviteToken ?? ""}`;
      setNewInviteLink(link);
      toast({ title: t("settings.new_invite_link") });
    },
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: t("settings.link_copied") });
  };

  const getInviteLink = (token: string | null | undefined) =>
    `${window.location.origin}/invite/${token ?? ""}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          {t("settings.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {([["collaborators", t("settings.collab_tab"), Users], ["account", t("settings.account_tab"), SettingsIcon]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === key ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "collaborators" && (
        <div className="space-y-6">
          {canManage && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {t("settings.invite_collaborator")}
              </CardTitle>
              <CardDescription>
                {t("settings.invite_collaborator_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t("settings.email_address_label")}</label>
                  <Input
                    type="email"
                    placeholder={t("settings.email_placeholder")}
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t("settings.invite_role")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(ROLE_CONFIG) as [CollabRole, typeof ROLE_CONFIG[CollabRole]][]).map(([role, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => setInviteRole(role)}
                          className={`p-2.5 rounded-lg border text-left transition-all text-xs
                            ${inviteRole === role
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/40 text-foreground"
                            }`}
                        >
                          <Icon className="h-4 w-4 mb-1" />
                          <div className="font-semibold">{t(`settings.role_${role}`)}</div>
                          <div className="text-muted-foreground mt-0.5 leading-tight">{t(`settings.role_${role}_desc`)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                {inviteMutation.isPending ? t("settings.creating_invite") : t("settings.create_invite")}
              </Button>

              {newInviteLink && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-primary">{t("settings.invite_link_created_msg")}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <a
                      href={newInviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 font-mono truncate text-foreground underline decoration-primary/60 underline-offset-2 hover:text-primary transition-colors"
                    >
                      {newInviteLink}
                    </a>
                    <Button size="sm" variant="outline" onClick={() => copyLink(newInviteLink)} className="gap-1.5 shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                      {t("settings.copy_btn")}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-primary border-primary/30"
                      onClick={() => {
                        const workspaceName = data?.workspaceName ?? "our wedding";
                        const subject = encodeURIComponent(`You're invited to collaborate on ${workspaceName}'s wedding planning`);
                        const body = encodeURIComponent(
                          `Hi there!\n\nYou've been invited to collaborate on ${workspaceName}'s wedding workspace on A.IDO.\n\nAccept your invitation by clicking the link below:\n\n${newInviteLink}\n\n(If the link doesn't appear clickable, copy and paste it into your browser.)\n\nSee you there!\n${workspaceName}`
                        );
                        window.location.href = `mailto:?subject=${subject}&body=${body}`;
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {t("settings.open_email_again")}
                    </Button>
                    <p className="text-xs text-muted-foreground">{t("settings.email_didnt_open")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t("settings.your_collaborators")}
              </CardTitle>
              <CardDescription>
                {t("settings.collab_section_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !data?.collaborators.length ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-primary/50" />
                  </div>
                  <p className="text-muted-foreground">{t("settings.no_collabs_invite")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.collaborators.map(collab => {
                    const statusCfg = STATUS_CONFIG[collab.status as CollabStatus];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={collab.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors bg-card">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                          {collab.inviteeEmail ? collab.inviteeEmail[0].toUpperCase() : collab.role[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{collab.inviteeEmail ?? `${collab.role} collaborator`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("settings.invited_on", { date: new Date(collab.invitedAt).toLocaleDateString() })}
                            {collab.acceptedAt && t("settings.accepted_on", { date: new Date(collab.acceptedAt).toLocaleDateString() })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <RoleBadge role={collab.role as CollabRole} />
                          <StatusBadge status={collab.status as CollabStatus} />
                        </div>
                        {canManage && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {collab.status !== "declined" && (
                            <div className="relative">
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
                                onClick={() => setEditingRoleId(editingRoleId === collab.id ? null : collab.id)}
                                title={t("settings.change_role")}
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                              {editingRoleId === collab.id && (
                                <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[160px] space-y-1">
                                  {(["partner", "planner", "vendor"] as CollabRole[]).map(r => (
                                    <button
                                      key={r}
                                      onClick={() => roleMutation.mutate({ id: collab.id, role: r })}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors
                                        ${collab.role === r ? "text-primary font-medium" : "text-foreground"}`}
                                    >
                                      {t(`settings.role_${r}`)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {collab.status === "pending" && (
                            <>
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => copyLink(getInviteLink(collab.inviteToken))}
                                title={t("settings.copy_invite_link")}
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => resendMutation.mutate(collab.id)}
                                title={t("settings.regen_invite_link")}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {confirmRemoveId === collab.id ? (
                            <div className="flex items-center gap-1.5 bg-destructive/5 border border-destructive/20 rounded-lg px-2.5 py-1.5">
                              <span className="text-xs text-destructive font-medium whitespace-nowrap">{t("settings.remove_access")}</span>
                              <button
                                className="text-xs font-semibold text-destructive hover:underline"
                                onClick={() => removeMutation.mutate(collab.id)}
                                disabled={removeMutation.isPending}
                              >
                                {removeMutation.isPending ? "…" : t("common.yes")}
                              </button>
                              <span className="text-muted-foreground text-xs">·</span>
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setConfirmRemoveId(null)}
                              >
                                {t("common.no")}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => setConfirmRemoveId(collab.id)}
                              title="Remove this collaborator's access (your wedding data is kept)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">{t("settings.permission_ref")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">{t("settings.col_feature")}</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("settings.role_partner")}</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("settings.role_planner")}</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("settings.role_vendor")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      [t("settings.feat_view_timeline"), true, true, true],
                      [t("settings.feat_download_pdfs"), true, true, true],
                      [t("settings.feat_view_budget"), true, true, false],
                      [t("settings.feat_edit_timeline"), true, true, false],
                      [t("settings.feat_edit_budget"), true, true, false],
                      [t("settings.feat_manage_vendors"), true, true, false],
                      [t("settings.feat_manage_collabs"), true, false, false],
                      [t("settings.feat_delete_workspace"), false, false, false],
                    ].map(([feature, partner, planner, vendor]) => (
                      <tr key={String(feature)}>
                        <td className="py-2.5 pr-4 text-foreground">{feature}</td>
                        {[partner, planner, vendor].map((has, i) => (
                          <td key={i} className="text-center py-2.5 px-3">
                            {has
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "account" && (
        <div className="space-y-4">
          <LanguageSwitcherCard />
          <VendorBccEmailCard />
          <DeleteAccountCard />
          <Card className="border-none shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <SettingsIcon className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="font-serif text-xl text-foreground">{t("settings.account_settings")}</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {t("settings.account_settings_desc")}
              </p>
              <Button variant="outline" onClick={() => window.open("https://accounts.clerk.dev", "_blank")}>
                {t("settings.manage_account")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
