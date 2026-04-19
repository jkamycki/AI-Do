import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Mail, Shield, Eye, Briefcase, Copy,
  CheckCircle2, Clock, XCircle, Trash2, RefreshCw, ChevronDown,
  Settings as SettingsIcon, Crown,
} from "lucide-react";

type CollabRole = "partner" | "planner" | "vendor";
type CollabStatus = "pending" | "active" | "declined";

interface Collaborator {
  id: number;
  profileId: number;
  inviterUserId: string;
  inviteeEmail: string;
  inviteeUserId: string | null;
  role: CollabRole;
  status: CollabStatus;
  inviteToken: string;
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
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: CollabStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function SettingsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"collaborators" | "account">("collaborators");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CollabRole>("planner");
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  const sharedProfileId = activeWorkspace?.profileId ?? null;

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
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
      const link = `${window.location.origin}/invite/${collab.inviteToken}`;
      setNewInviteLink(link);
      setInviteEmail("");
      toast({ title: "Invite created!", description: "Copy the link below and share it with them." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
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
      toast({ title: "Role updated" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/collaborators/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      toast({ title: "Collaborator removed" });
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
      const link = `${window.location.origin}/invite/${collab.inviteToken}`;
      setNewInviteLink(link);
      toast({ title: "New invite link generated" });
    },
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied to clipboard!" });
  };

  const getInviteLink = (token: string) =>
    `${window.location.origin}/invite/${token}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-lg text-muted-foreground mt-1">Manage your workspace and collaborators.</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {([["collaborators", "Collaborators", Users], ["account", "Account", SettingsIcon]] as const).map(([key, label, Icon]) => (
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
                Invite a Collaborator
              </CardTitle>
              <CardDescription>
                Invite your partner, wedding planner, or vendors to collaborate on your wedding workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address</label>
                  <Input
                    type="email"
                    placeholder="collaborator@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Role</label>
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
                          <div className="font-semibold">{cfg.label}</div>
                          <div className="text-muted-foreground mt-0.5 leading-tight">{cfg.description}</div>
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
                {inviteMutation.isPending ? "Creating Invite…" : "Create Invite Link"}
              </Button>

              {newInviteLink && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                  <p className="text-sm font-medium text-primary">Share this invite link:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-background border rounded-lg px-3 py-2 font-mono truncate">
                      {newInviteLink}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyLink(newInviteLink)} className="gap-1.5 shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Send this link to your collaborator. They'll be able to accept the invite after signing in.</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Your Collaborators
              </CardTitle>
              <CardDescription>
                People who have been invited to your wedding workspace.
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
                  <p className="text-muted-foreground">No collaborators yet. Invite someone above to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.collaborators.map(collab => {
                    const statusCfg = STATUS_CONFIG[collab.status as CollabStatus];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={collab.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors bg-card">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                          {collab.inviteeEmail[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{collab.inviteeEmail}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Invited {new Date(collab.invitedAt).toLocaleDateString()}
                            {collab.acceptedAt && ` · Accepted ${new Date(collab.acceptedAt).toLocaleDateString()}`}
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
                                title="Change role"
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
                                      {ROLE_CONFIG[r].label}
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
                                title="Copy invite link"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => resendMutation.mutate(collab.id)}
                                title="Regenerate invite link"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => {
                              if (confirm("Remove this collaborator?")) removeMutation.mutate(collab.id);
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
              <CardTitle className="font-serif text-lg">Permission Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Feature</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Partner</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Planner</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Vendor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      ["View Timeline", true, true, true],
                      ["Download PDFs", true, true, true],
                      ["View Budget & Checklist", true, true, false],
                      ["Edit Timeline & Checklist", true, true, false],
                      ["Edit Budget", true, true, false],
                      ["Manage Vendors & Emails", true, true, false],
                      ["Manage Collaborators", false, false, false],
                      ["Delete Workspace", false, false, false],
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
        <Card className="border-none shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <SettingsIcon className="h-8 w-8 text-primary/60" />
            </div>
            <h3 className="font-serif text-xl text-foreground">Account Settings</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Manage your name, email, password, and connected accounts through your Clerk profile.
            </p>
            <Button variant="outline" onClick={() => window.open("https://accounts.clerk.dev", "_blank")}>
              Manage Account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
