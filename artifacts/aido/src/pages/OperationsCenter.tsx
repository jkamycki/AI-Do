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
import {
  Mail,
  Clock,
  AlertCircle,
  CheckCircle2,
  Eye,
  Trash2,
  Inbox,
  Ticket,
  FlaskConical,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
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

type LaunchPlanItem = {
  id: string;
  title: string;
  category: string;
  notes: string;
  assigneeEmail: string;
  priority: "low" | "medium" | "high";
  dueDate: string;
  completed: boolean;
};

const LAUNCH_PLAN_STORAGE_KEY = "aido_operations_launch_plan_v1";
const LAUNCH_PLAN_ASSIGNEES = [
  { name: "Joseph", email: "kamyckijoseph@gmail.com" },
  { name: "Michael", email: "michaelgang31@gmail.com" },
] as const;
const LAUNCH_PLAN_ASSIGNEE_EMAILS = LAUNCH_PLAN_ASSIGNEES.map(assignee => assignee.email);

const getLaunchPlanAssigneeName = (email: string) =>
  LAUNCH_PLAN_ASSIGNEES.find(assignee => assignee.email === email)?.name ?? "Unassigned";

const buildLaunchPlanTaskEmail = (item: LaunchPlanItem) => {
  const assigneeName = getLaunchPlanAssigneeName(item.assigneeEmail);
  const priority = item.priority.charAt(0).toUpperCase() + item.priority.slice(1);
  return {
    subject: `A.IDO Launch Task: ${item.title || "Launch task"}`,
    body: [
      "A.IDO Launch Plan Task",
      "",
      `Task: ${item.title || "Untitled task"}`,
      `Category: ${item.category || "Launch"}`,
      `Assigned to: ${assigneeName}`,
      `Priority: ${priority}`,
      `Due date: ${item.dueDate || "Not set"}`,
      `Status: ${item.completed ? "Completed" : "Open"}`,
      "",
      "Notes:",
      item.notes || "No notes added.",
      "",
      "Open the A.IDO Operations Center to update this task.",
    ].join("\n"),
  };
};

const fallbackLaunchPlanItems: LaunchPlanItem[] = [
  {
    id: "launch-positioning",
    title: "Finalize A.IDO launch positioning",
    category: "Brand",
    notes: "Confirm the primary promise, launch audience, and short description used across the website, previews, and outreach.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "high",
    dueDate: "",
    completed: false,
  },
  {
    id: "launch-onboarding",
    title: "Test signup and onboarding from a fresh account",
    category: "Product",
    notes: "Walk through profile setup, guest list, budget, vendors, contracts, website editor, and Aria from mobile and desktop.",
    assigneeEmail: "michaelgang31@gmail.com",
    priority: "high",
    dueDate: "",
    completed: false,
  },
  {
    id: "launch-support",
    title: "Prepare support and feedback workflow",
    category: "Operations",
    notes: "Make sure support messages, feedback prompts, and Operations Center tickets are being received and reviewed daily.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "medium",
    dueDate: "",
    completed: false,
  },
];

const normalizeLaunchPlanItem = (item: Partial<LaunchPlanItem>, index = 0): LaunchPlanItem => {
  const priority = String(item.priority ?? "medium").toLowerCase();
  const assigneeEmail = String(item.assigneeEmail ?? "").toLowerCase();
  return {
    id: String(item.id ?? makeLaunchPlanId()),
    title: String(item.title ?? `Launch task ${index + 1}`),
    category: String(item.category ?? "Launch"),
    notes: String(item.notes ?? ""),
    assigneeEmail: LAUNCH_PLAN_ASSIGNEE_EMAILS.includes(assigneeEmail as typeof LAUNCH_PLAN_ASSIGNEE_EMAILS[number]) ? assigneeEmail : "",
    priority: priority === "low" || priority === "high" ? priority : "medium",
    dueDate: String(item.dueDate ?? ""),
    completed: Boolean(item.completed),
  };
};

const appendNewLaunchPlanItems = (currentItems: LaunchPlanItem[], generatedItems: LaunchPlanItem[]) => {
  const existingTitles = new Set(currentItems.map(item => item.title.trim().toLowerCase()).filter(Boolean));
  const uniqueGenerated = generatedItems.filter(item => {
    const title = item.title.trim().toLowerCase();
    if (!title || existingTitles.has(title)) return false;
    existingTitles.add(title);
    return true;
  });
  return [...currentItems, ...uniqueGenerated];
};

const makeLaunchPlanId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `launch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function OperationsCenterPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"tickets" | "messages" | "testActivity" | "launchPlan">("tickets");
  const [testSessionFilter, setTestSessionFilter] = useState<"test" | "all" | "real">("test");
  const [launchPlanPrompt, setLaunchPlanPrompt] = useState("");
  const [hasLoadedLaunchPlan, setHasLoadedLaunchPlan] = useState(false);
  const [launchPlanEmailRecipients, setLaunchPlanEmailRecipients] = useState<Record<string, string>>({});
  const [launchPlanItems, setLaunchPlanItems] = useState<LaunchPlanItem[]>(() => {
    if (typeof window === "undefined") return fallbackLaunchPlanItems;
    try {
      const stored = window.localStorage.getItem(LAUNCH_PLAN_STORAGE_KEY);
      if (!stored) return fallbackLaunchPlanItems;
      const parsed = JSON.parse(stored) as LaunchPlanItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return fallbackLaunchPlanItems;
      return parsed.map(normalizeLaunchPlanItem);
    } catch {
      return fallbackLaunchPlanItems;
    }
  });
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

  const { data: launchPlanData, isLoading: isLoadingLaunchPlan } = useQuery<{
    items: Array<Partial<LaunchPlanItem>>;
    assignees: string[];
  }>({
    queryKey: ["admin-launch-plan"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/launch-plan");
      if (!r.ok) throw new Error("Failed to load launch plan");
      return r.json();
    },
    enabled: activeTab === "launchPlan",
  });

  useEffect(() => {
    window.localStorage.setItem(LAUNCH_PLAN_STORAGE_KEY, JSON.stringify(launchPlanItems));
  }, [launchPlanItems]);

  useEffect(() => {
    if (!launchPlanData?.items) return;
    setLaunchPlanItems(launchPlanData.items.map(normalizeLaunchPlanItem));
    setHasLoadedLaunchPlan(true);
  }, [launchPlanData]);

  const launchPlanCompletedCount = launchPlanItems.filter(item => item.completed).length;
  const launchPlanProgress = launchPlanItems.length > 0
    ? Math.round((launchPlanCompletedCount / launchPlanItems.length) * 100)
    : 0;
  const launchPlanOpenCount = launchPlanItems.length - launchPlanCompletedCount;
  const openLaunchPlanItems = launchPlanItems.filter(item => !item.completed);
  const completedLaunchPlanItems = launchPlanItems.filter(item => item.completed);
  const launchPlanAssigneeStats = LAUNCH_PLAN_ASSIGNEES.map(assignee => ({
    ...assignee,
    total: launchPlanItems.filter(item => item.assigneeEmail === assignee.email).length,
    open: launchPlanItems.filter(item => item.assigneeEmail === assignee.email && !item.completed).length,
  }));

  const updateLaunchPlanItem = (id: string, patch: Partial<LaunchPlanItem>) => {
    setLaunchPlanItems(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const addLaunchPlanItem = () => {
    setLaunchPlanItems(items => [
      ...items,
      {
        id: makeLaunchPlanId(),
        title: "New launch task",
        category: "Launch",
        notes: "",
        assigneeEmail: "",
        priority: "medium",
        dueDate: "",
        completed: false,
      },
    ]);
  };

  const saveLaunchPlanMutation = useMutation({
    mutationFn: async (items: LaunchPlanItem[]) => {
      const r = await authedFetch("/api/admin/launch-plan", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      if (!r.ok) throw new Error("Failed to save launch plan");
      return r.json();
    },
    onError: () => {
      toast({ title: "Launch plan could not be saved", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!hasLoadedLaunchPlan) return;
    const timeout = window.setTimeout(() => {
      saveLaunchPlanMutation.mutate(launchPlanItems);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [hasLoadedLaunchPlan, launchPlanItems]);

  const generateLaunchPlanMutation = useMutation({
    mutationFn: async () => {
      const r = await authedFetch("/api/admin/launch-plan/generate", {
        method: "POST",
        body: JSON.stringify({
          focus: launchPlanPrompt,
          currentItems: launchPlanItems.map(({ title, category, notes, assigneeEmail, priority, dueDate, completed }) => ({
            title,
            category,
            notes,
            assigneeEmail,
            priority,
            dueDate,
            completed,
          })),
        }),
      });
      if (!r.ok) throw new Error("Failed to generate launch plan");
      return r.json() as Promise<{ items: Array<Partial<LaunchPlanItem>>; source?: string }>;
    },
    onSuccess: (data) => {
      const generatedItems = (data.items ?? [])
        .filter(item => String(item.title ?? "").trim().length > 0)
        .map((item, index) => normalizeLaunchPlanItem({
          id: makeLaunchPlanId(),
          title: String(item.title ?? "").trim(),
          category: String(item.category ?? "Launch").trim() || "Launch",
          notes: String(item.notes ?? "").trim(),
          assigneeEmail: String(item.assigneeEmail ?? ""),
          priority: item.priority as LaunchPlanItem["priority"],
          dueDate: String(item.dueDate ?? ""),
          completed: Boolean(item.completed),
        }, index));

      if (generatedItems.length === 0) {
        toast({ title: "No checklist items generated", variant: "destructive" });
        return;
      }

      setHasLoadedLaunchPlan(true);
      setLaunchPlanItems(current => appendNewLaunchPlanItems(current, generatedItems));
      toast({
        title: data.source === "fallback" ? "Launch plan starter added" : "Launch plan items added",
        description: "Existing tasks and completed items were kept in place.",
      });
    },
    onError: () => {
      toast({ title: "Could not generate launch plan", variant: "destructive" });
    },
  });

  const sendLaunchPlanTaskMutation = useMutation({
    mutationFn: async ({ item, recipientEmail }: { item: LaunchPlanItem; recipientEmail: string }) => {
      const taskEmail = buildLaunchPlanTaskEmail(item);
      const r = await authedFetch("/api/admin/launch-plan/send-task", {
        method: "POST",
        body: JSON.stringify({ task: item, recipientEmail }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const fallback = await authedFetch("/api/admin/marketing/send", {
          method: "POST",
          body: JSON.stringify({
            emails: [recipientEmail],
            subject: taskEmail.subject,
            body: taskEmail.body,
          }),
        });
        const fallbackBody = await fallback.json().catch(() => ({}));
        if (!fallback.ok || fallbackBody?.failed > 0) {
          const firstError = Array.isArray(fallbackBody?.results)
            ? fallbackBody.results.find((result: { ok?: boolean; error?: string }) => !result.ok)?.error
            : undefined;
          throw new Error(firstError ?? fallbackBody?.error ?? body?.error ?? "Failed to email launch task");
        }
        return fallbackBody;
      }
      return body;
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Task emailed",
        description: `Sent to ${getLaunchPlanAssigneeName(variables.recipientEmail)}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Could not email task",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

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

  const renderLaunchPlanTaskCard = (item: LaunchPlanItem) => {
    const recipientEmail = launchPlanEmailRecipients[item.id] || item.assigneeEmail || LAUNCH_PLAN_ASSIGNEES[0].email;
    return (
      <Card key={item.id} className={item.completed ? "border-emerald-200 bg-emerald-50/40" : ""}>
        <CardContent className="py-4">
          <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-start">
            <button
              type="button"
              onClick={() => updateLaunchPlanItem(item.id, { completed: !item.completed })}
              className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                item.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-[#E7C7D3] bg-white text-[#9A2E5C] hover:border-[#9A2E5C]"
              }`}
              aria-label={item.completed ? "Mark launch task incomplete" : "Mark launch task complete"}
            >
              <CheckCircle2 className="h-5 w-5" />
            </button>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_1fr_220px_130px_150px]">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Category</label>
                <Input
                  value={item.category}
                  onChange={(event) => updateLaunchPlanItem(item.id, { category: event.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-1 xl:col-span-1">
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Task</label>
                <Input
                  value={item.title}
                  onChange={(event) => updateLaunchPlanItem(item.id, { title: event.target.value })}
                  className={`mt-1 font-semibold ${item.completed ? "line-through decoration-2" : ""}`}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Assigned To</label>
                <Select
                  value={item.assigneeEmail || "unassigned"}
                  onValueChange={assigneeEmail => updateLaunchPlanItem(item.id, {
                    assigneeEmail: assigneeEmail === "unassigned" ? "" : assigneeEmail,
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {LAUNCH_PLAN_ASSIGNEES.map(assignee => (
                      <SelectItem key={assignee.email} value={assignee.email}>{assignee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Priority</label>
                <Select
                  value={item.priority}
                  onValueChange={priority => updateLaunchPlanItem(item.id, { priority: priority as LaunchPlanItem["priority"] })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Due Date</label>
                <Input
                  type="date"
                  value={item.dueDate}
                  onChange={(event) => updateLaunchPlanItem(item.id, { dueDate: event.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2 xl:col-span-5">
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Notes</label>
                <Textarea
                  value={item.notes}
                  onChange={(event) => updateLaunchPlanItem(item.id, { notes: event.target.value })}
                  placeholder="Add launch notes, owner, blockers, links, or next action."
                  className="mt-1 min-h-[82px]"
                />
              </div>
              <div className="rounded-lg border border-[#F0D7E0] bg-[#FFF8FA] p-3 md:col-span-2 xl:col-span-5">
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Email this task</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={recipientEmail}
                    onValueChange={email => setLaunchPlanEmailRecipients(current => ({ ...current, [item.id]: email }))}
                  >
                    <SelectTrigger className="min-h-10 flex-1 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAUNCH_PLAN_ASSIGNEES.map(assignee => (
                        <SelectItem key={assignee.email} value={assignee.email}>
                          {assignee.name} ({assignee.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={sendLaunchPlanTaskMutation.isPending}
                    onClick={() => sendLaunchPlanTaskMutation.mutate({ item, recipientEmail })}
                  >
                    {sendLaunchPlanTaskMutation.isPending ? <Clock className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send Task
                  </Button>
                </div>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setLaunchPlanItems(items => items.filter(current => current.id !== item.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-[#24171D]">
      <div>
        <h1 className="text-3xl font-serif font-bold text-[#24171D]">Operations Center</h1>
        <p className="mt-1 text-sm font-medium text-[#4A3941]">Support tickets, contact messages, and feedback in one place</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
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
        <button
          onClick={() => setActiveTab("launchPlan")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "launchPlan" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <ListChecks className="h-4 w-4" />
          A.IDO Launch Plan
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

      {activeTab === "launchPlan" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">A.IDO Launch Plan</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Generate a launch checklist, edit each task, add working notes, and check off what is finished.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addLaunchPlanItem}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
              <Button
                type="button"
                onClick={() => generateLaunchPlanMutation.mutate()}
                disabled={generateLaunchPlanMutation.isPending}
                className="gap-2 bg-[#9A2E5C] hover:bg-[#7B2148]"
              >
                <Sparkles className="h-4 w-4" />
                {generateLaunchPlanMutation.isPending ? "Generating..." : "Generate Checklist"}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="py-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-end">
                <div>
                  <label className="text-sm font-semibold text-[#24171D]">AI focus</label>
                  <Textarea
                    value={launchPlanPrompt}
                    onChange={(event) => setLaunchPlanPrompt(event.target.value)}
                    placeholder="Example: launch public beta, prep social posts, test payments, confirm privacy/security, and plan first users."
                    className="mt-2 min-h-[86px]"
                  />
                </div>
                <div className="rounded-lg border border-[#F0D7E0] bg-[#FFF8FA] p-4">
                  <p className="text-sm font-semibold text-[#4A3941]">Progress</p>
                  <p className="mt-1 text-3xl font-bold text-[#9A2E5C]">{launchPlanProgress}%</p>
                  <p className="mt-1 text-xs font-medium text-[#4A3941]">
                    {launchPlanCompletedCount} complete, {launchPlanOpenCount} open
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F4DDE5]">
                    <div
                      className="h-full rounded-full bg-[#9A2E5C] transition-all"
                      style={{ width: `${launchPlanProgress}%` }}
                    />
                  </div>
                  <div className="mt-3 space-y-1 text-xs font-medium text-[#4A3941]">
                    {launchPlanAssigneeStats.map(stat => (
                      <div key={stat.email} className="flex justify-between gap-3">
                        <span className="truncate">{stat.name}</span>
                        <span className="shrink-0">{stat.open} open</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-[#7A5062]">
                    {saveLaunchPlanMutation.isPending ? "Saving..." : hasLoadedLaunchPlan ? "Shared plan saved automatically" : "Loading shared plan"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoadingLaunchPlan ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
            </div>
          ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#7A5062]">Open Tasks</h3>
              {openLaunchPlanItems.length > 0 ? openLaunchPlanItems.map(renderLaunchPlanTaskCard) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm font-medium text-[#4A3941]">No open launch tasks.</CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700">Completed</h3>
              {completedLaunchPlanItems.length > 0 ? completedLaunchPlanItems.map(renderLaunchPlanTaskCard) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm font-medium text-[#4A3941]">Completed launch tasks will move here.</CardContent>
                </Card>
              )}
            </div>
          </div>
          )}

          {launchPlanItems.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <ListChecks className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="font-medium text-[#4A3941]">No launch tasks yet. Generate a checklist or add an item.</p>
              </CardContent>
            </Card>
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
