import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useState } from "react";
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
import { Mail, Clock, AlertCircle, CheckCircle2, Eye } from "lucide-react";

export default function OperationsCenterPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
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

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/support-tickets");
      if (!r.ok) throw new Error("Failed to fetch tickets");
      return r.json();
    },
  });

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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Support Center</h1>
        <p className="text-muted-foreground mt-1">Manage customer support tickets and follow-ups</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
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
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">No tickets found</p>
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
                      <h3 className="font-semibold text-foreground truncate">{ticket.subject}</h3>
                      <Badge variant="outline">{ticket.ticketNumber}</Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      From: {ticket.name} ({ticket.email})
                    </p>
                    <p className="text-sm text-foreground line-clamp-2">{ticket.message}</p>
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
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
    </div>
  );
}
