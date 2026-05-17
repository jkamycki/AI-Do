import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, AlertCircle, CheckCircle2, Eye, Trash2, Inbox, Ticket, FlaskConical } from "lucide-react";
import MessagesSection from "@/components/admin/MessagesSection";

type TestSessionRow = {
  sessionId: string;
  testMode: boolean;
  createdAt: string;
  lastActiveAt: string;
  totalEvents: number;
  workflowProgress: {
    pageViews: number;
    profileVisits: number;
    guestListVisits: number;
    invitationStudioVisits: number;
    websiteEditorVisits: number;
  };
  pagesVisited: string[];
  wizardsUsed: string[];
  errorsEncountered: number;
};

export default function OperationsCenterPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"tickets" | "messages" | "testActivity">("tickets");
  const [testSessionFilter, setTestSessionFilter] = useState<"test" | "all" | "real">("test");
  const [followUpForm, setFollowUpForm] = useState({
    followUpEmail: "",
    followUpNotes: "",
  });

  const authedFetch = async (url: string, init: any = {}) => {
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

  const { data: ticketsData, isLoading, error: ticketsError } = useQuery<{ tickets: unknown[] }, Error>({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/support-tickets");
      if (!r.ok) {
        // Surface the real error so the page can explain why no tickets show.
        // 403 = signed-in user isn't on OWNER_EMAILS; anything else is server.
        let serverMessage = "";
        try { serverMessage = (await r.json())?.error ?? ""; } catch { /* ignore */ }
        throw new Error(
          r.status === 403
            ? `Access denied (403): only emails on the OWNER list can view tickets. Signed in as the right account?`
            : `Failed to fetch tickets (${r.status})${serverMessage ? `: ${serverMessage}` : ""}`,
        );
      }
      return r.json();
    },
  });

  const { data: messagesData } = useQuery<{ contacts: { isRead: boolean; isResolved: boolean }[]; unreadCount: number }>({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/messages");
      if (!r.ok) throw new Error("Failed to fetch messages");
      return r.json();
    },
    refetchInterval: 30000,
  });
  const unreadMessageCount = messagesData?.unreadCount ?? 0;

  const { data: testSessionsData, isLoading: isLoadingTestSessions } = useQuery<{ sessions: TestSessionRow[] }>({
    queryKey: ["admin-test-sessions", testSessionFilter],
    queryFn: async () => {
      const r = await authedFetch(`/api/admin/test-sessions?mode=${testSessionFilter}`);
      if (!r.ok) throw new Error("Failed to fetch test sessions");
      return r.json();
    },
    enabled: activeTab === "testActivity",
    refetchInterval: activeTab === "testActivity" ? 30000 : false,
  });
  const testSessions = testSessionsData?.sessions ?? [];

  const lastSeenUnread = useRef<number | null>(null);
  useEffect(() => {
    if (lastSeenUnread.current === null) {
      lastSeenUnread.current = unreadMessageCount;
      return;
    }
    if (unreadMessageCount > lastSeenUnread.current) {
      const delta = unreadMessageCount - lastSeenUnread.current;
      toast({
        title: delta === 1 ? "New message" : `${delta} new messages`,
        description: "Operations Center → Messages & Feedback",
      });
    }
    lastSeenUnread.current = unreadMessageCount;
  }, [unreadMessageCount, toast]);

  const followUpMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const r = await authedFetch(`/api/help/support-tickets/${ticketId}/follow-up`, {
        method: "PATCH",
        body: JSON.stringify(followUpForm),
      });
      if (!r.ok) throw new Error("Failed to send follow-up");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Follow-up sent successfully!" });
      setSelectedTicket(null);
      setFollowUpForm({ followUpEmail: "", followUpNotes: "" });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: () => {
      toast({ title: "Failed to send follow-up", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const r = await authedFetch(`/api/help/support-tickets/${ticketId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete ticket");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket deleted." });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: () => {
      toast({ title: "Failed to delete ticket", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      const r = await authedFetch(`/api/help/support-tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed to update status");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated!" });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const tickets = ticketsData?.tickets ?? [];
  const filteredTickets = filterStatus === "all"
    ? tickets
    : tickets.filter((t: any) => t.status === filterStatus);

  const stats = {
    total: tickets.length,
    open: tickets.filter((t: any) => t.status === "open").length,
    inProgress: tickets.filter((t: any) => t.status === "in_progress").length,
    resolved: tickets.filter((t: any) => t.status === "resolved").length,
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: "bg-red-100 text-red-800",
      high: "bg-orange-100 text-orange-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };
    return colors[priority] || colors.medium;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-[#24171D]">
      <div>
        <h1 className="text-3xl font-serif font-bold text-[#24171D]">Operations Center</h1>
        <p className="mt-1 text-sm font-medium text-[#4A3941]">Support tickets, contact messages, and feedback in one place</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "tickets" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Ticket className="h-4 w-4" />
          Support Tickets
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "messages" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Inbox className="h-4 w-4" />
          Messages & Feedback
          {unreadMessageCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
              {unreadMessageCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("testActivity")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "testActivity" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <FlaskConical className="h-4 w-4" />
          Free Test Account Activity
        </button>
      </div>

      {activeTab === "messages" && (
        <MessagesSection
          title="Messages & Feedback"
          description="Contact requests (including emails to support@aidowedding.net) and user feedback."
        />
      )}

      {activeTab === "testActivity" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">Free Test Account Activity</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Anonymous test sessions are separated from real user analytics.
              </p>
            </div>
            <div className="flex gap-2">
              {[
                { value: "test", label: "Show only testMode sessions" },
                { value: "all", label: "Show all sessions" },
                { value: "real", label: "Show real users only" },
              ].map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={testSessionFilter === option.value ? "default" : "outline"}
                  onClick={() => setTestSessionFilter(option.value as "test" | "all" | "real")}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingTestSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : testSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="font-medium text-[#4A3941]">No sessions found for this filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {testSessions.map((session) => (
                <Card key={session.sessionId}>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-mono text-sm font-semibold text-[#24171D] break-all">{session.sessionId}</h3>
                          <Badge className={session.testMode ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"}>
                            testMode = {String(session.testMode)}
                          </Badge>
                          {session.errorsEncountered > 0 && (
                            <Badge className="bg-red-100 text-red-800">{session.errorsEncountered} errors</Badge>
                          )}
                        </div>
                        <div className="grid gap-2 text-xs font-medium text-[#4A3941] sm:grid-cols-2 lg:grid-cols-4">
                          <span>Created: {new Date(session.createdAt).toLocaleString()}</span>
                          <span>Last active: {new Date(session.lastActiveAt).toLocaleString()}</span>
                          <span>Total events: {session.totalEvents}</span>
                          <span>Pages visited: {session.pagesVisited.length}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                          <span className="rounded-md bg-muted px-2 py-1">Page views: {session.workflowProgress.pageViews}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Profile: {session.workflowProgress.profileVisits}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Guests: {session.workflowProgress.guestListVisits}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Invites: {session.workflowProgress.invitationStudioVisits}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Website: {session.workflowProgress.websiteEditorVisits}</span>
                        </div>
                        {session.pagesVisited.length > 0 && (
                          <p className="mt-3 text-xs font-medium text-[#4A3941]">
                            <span className="font-semibold text-[#24171D]">Pages:</span>{" "}
                            {session.pagesVisited.slice(0, 10).join(", ")}
                            {session.pagesVisited.length > 10 ? ` +${session.pagesVisited.length - 10} more` : ""}
                          </p>
                        )}
                        {session.wizardsUsed.length > 0 && (
                          <p className="mt-1 text-xs font-medium text-[#4A3941]">
                            <span className="font-semibold text-[#24171D]">Wizards used:</span>{" "}
                            {session.wizardsUsed.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "tickets" && (<>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1D4E89]">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8A5200]">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#217244]">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "open", "in_progress", "resolved"].map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            onClick={() => setFilterStatus(status)}
            className="capitalize"
          >
            {status.replace("_", " ")}
          </Button>
        ))}
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : ticketsError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive/60 mx-auto mb-4" />
            <p className="text-destructive font-medium mb-1">Couldn't load tickets</p>
            <p className="text-sm font-medium text-[#4A3941]">{ticketsError.message}</p>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-[#4A3941]">No tickets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket: any) => (
            <Card key={ticket.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(ticket.status)}
                      <h3 className="font-semibold text-[#24171D] truncate">{ticket.subject}</h3>
                      <Badge variant="outline">{ticket.ticketNumber}</Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="mb-2 text-sm font-medium text-[#4A3941]">
                      From: {ticket.name} ({ticket.email})
                    </p>
                    <p className="text-sm font-medium text-[#24171D] line-clamp-2">{ticket.message}</p>
                    <div className="flex gap-4 mt-3 text-xs font-medium text-[#4A3941]">
                      <span>Category: {ticket.category}</span>
                      <span>
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                      {ticket.followUpSentAt && (
                        <span className="text-green-600">
                          Follow-up sent
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Delete this ticket? This cannot be undone.")) {
                          deleteMutation.mutate(ticket.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Send Follow-up</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Follow-up Email</label>
                            <Input
                              type="email"
                              placeholder="recipient@example.com"
                              value={followUpForm.followUpEmail}
                              onChange={e =>
                                setFollowUpForm(prev => ({
                                  ...prev,
                                  followUpEmail: e.target.value,
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Message</label>
                            <Textarea
                              placeholder="Type your follow-up message..."
                              value={followUpForm.followUpNotes}
                              onChange={e =>
                                setFollowUpForm(prev => ({
                                  ...prev,
                                  followUpNotes: e.target.value,
                                }))
                              }
                              className="mt-1 h-32"
                            />
                          </div>
                          <Button
                            onClick={() => selectedTicket && followUpMutation.mutate(selectedTicket.id)}
                            disabled={
                              followUpMutation.isPending ||
                              !followUpForm.followUpEmail ||
                              !followUpForm.followUpNotes
                            }
                            className="w-full"
                          >
                            Send Follow-up
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Select
                      value={ticket.status}
                      onValueChange={status =>
                        statusMutation.mutate({ ticketId: ticket.id, status })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      </>)}
    </div>
  );
}
