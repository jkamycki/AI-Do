import { useState } from "react";
import {
  useGetChecklist,
  useGenerateChecklist,
  useToggleChecklistItem,
  useGetProfile,
  getGetChecklistQueryKey
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Wand2, ClipboardList, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const API = import.meta.env.VITE_API_URL ?? "";

type ChecklistItem = {
  id: number;
  month: string;
  task: string;
  description: string;
  isCompleted: boolean;
  completedAt?: string;
};

export default function Checklist() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: checklist, isLoading: isLoadingChecklist } = useGetChecklist();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const generateChecklist = useGenerateChecklist();
  const toggleItem = useToggleChecklistItem();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTask, setEditTask] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMonth, setEditMonth] = useState("");

  const [addingToMonth, setAddingToMonth] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetChecklistQueryKey() });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ChecklistItem> }) =>
      authFetch(`${API}/api/checklist/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => { invalidate(); toast({ title: "Task updated." }); },
    onError: () => toast({ title: "Could not update task", variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) =>
      authFetch(`${API}/api/checklist/items/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Task removed." }); },
    onError: () => toast({ title: "Could not delete task", variant: "destructive" }),
  });

  const addItem = useMutation({
    mutationFn: (data: { task: string; description: string; month: string }) =>
      authFetch(`${API}/api/checklist/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Task added." });
      setAddingToMonth(null);
      setNewTask("");
      setNewDescription("");
    },
    onError: () => toast({ title: "Could not add task", variant: "destructive" }),
  });

  const handleGenerate = () => {
    if (!profile) {
      toast({ variant: "destructive", title: "Profile Required", description: "Please complete your wedding profile first." });
      return;
    }
    generateChecklist.mutate(
      { data: { weddingDate: profile.weddingDate, weddingVibe: profile.weddingVibe, guestCount: profile.guestCount } },
      {
        onSuccess: () => {
          toast({ title: "Checklist Generated", description: "Your month-by-month plan is ready." });
          invalidate();
        },
        onError: () => toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate checklist." }),
      }
    );
  };

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleItem.mutate(
      { id, data: { isCompleted: !currentStatus } },
      { onSuccess: invalidate }
    );
  };

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id);
    setEditTask(item.task);
    setEditDescription(item.description);
    setEditMonth(item.month);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTask("");
    setEditDescription("");
    setEditMonth("");
  }

  function submitEdit() {
    if (!editingId) return;
    updateItem.mutate({ id: editingId, data: { task: editTask.trim(), description: editDescription.trim(), month: editMonth.trim() } });
    cancelEdit();
  }

  function startAdd(month: string) {
    setAddingToMonth(month);
    setNewTask("");
    setNewDescription("");
  }

  function cancelAdd() {
    setAddingToMonth(null);
    setNewTask("");
    setNewDescription("");
  }

  function submitAdd() {
    if (!addingToMonth || !newTask.trim()) return;
    addItem.mutate({ task: newTask.trim(), description: newDescription.trim(), month: addingToMonth });
  }

  if (isLoadingChecklist || isLoadingProfile) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Card><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasChecklist = checklist && checklist.items && checklist.items.length > 0;
  const groupedItems = (checklist?.items ?? []).reduce((acc, item) => {
    if (!acc[item.month]) acc[item.month] = [];
    acc[item.month].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const totalItems = checklist?.items.length || 0;
  const completedItems = checklist?.items.filter(i => i.isCompleted).length || 0;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <CheckSquare className="h-8 w-8" />
            Planning Checklist
          </h1>
          <p className="text-lg text-muted-foreground mt-2">Bite-sized tasks to keep you on track.</p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generateChecklist.isPending}
          variant={hasChecklist ? "outline" : "default"}
          size="lg"
          data-testid="btn-generate-checklist"
        >
          {generateChecklist.isPending ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              {hasChecklist ? "Regenerate Plan" : "Generate Checklist"}
            </span>
          )}
        </Button>
      </div>

      {!hasChecklist ? (
        <Card className="border-none shadow-md bg-card text-center py-16 px-6">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <ClipboardList className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-serif text-2xl text-primary">Your Master Plan Awaits</h3>
            <p className="text-muted-foreground">
              Let AI create a customized month-by-month checklist based on your wedding date and vibe.
            </p>
            <Button onClick={handleGenerate} disabled={generateChecklist.isPending} size="lg" className="px-8 shadow-md">
              Create My Checklist
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-primary/5">
            <CardContent className="p-6">
              <div className="flex justify-between text-sm font-medium text-primary mb-2">
                <span>Overall Progress</span>
                <span>{completedItems} of {totalItems} tasks completed</span>
              </div>
              <Progress value={progress} className="h-3" />
            </CardContent>
          </Card>

          <div className="space-y-12">
            {Object.entries(groupedItems).map(([month, items], index) => {
              const monthCompleted = items.filter(i => i.isCompleted).length;
              const isAllCompleted = monthCompleted === items.length;

              return (
                <div key={month} className="space-y-4 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-serif text-foreground">{month}</h3>
                    <div className="h-px bg-border flex-1" />
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${isAllCompleted ? 'bg-secondary/50 text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {monthCompleted}/{items.length}
                    </span>
                  </div>

                  <Card className="border-none shadow-sm overflow-hidden bg-card">
                    <div className="divide-y divide-border/50">
                      {items.map((item) => (
                        <div key={item.id}>
                          {editingId === item.id ? (
                            <div className="p-4 md:p-5 space-y-3 bg-muted/20">
                              <Input
                                value={editTask}
                                onChange={e => setEditTask(e.target.value)}
                                placeholder="Task name"
                                className="font-medium"
                                autoFocus
                              />
                              <Textarea
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder="Description (optional)"
                                className="text-sm resize-none min-h-[72px]"
                              />
                              <Input
                                value={editMonth}
                                onChange={e => setEditMonth(e.target.value)}
                                placeholder="Time period (e.g. 6-9 Months Before)"
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={submitEdit} disabled={!editTask.trim()}>
                                  <Check className="h-3.5 w-3.5 mr-1.5" /> Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={`p-4 md:p-6 flex gap-4 transition-colors hover:bg-muted/30 group ${item.isCompleted ? 'bg-muted/10' : ''}`}>
                              <div className="pt-1">
                                <Checkbox
                                  checked={item.isCompleted}
                                  onCheckedChange={() => handleToggle(item.id, item.isCompleted)}
                                  data-testid={`checkbox-item-${item.id}`}
                                  className="h-6 w-6 rounded-full border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                              </div>
                              <div className="flex-1 space-y-1 min-w-0">
                                <h4 className={`text-lg font-medium transition-all ${item.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {item.task}
                                </h4>
                                <p className={`text-sm ${item.isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                  {item.description}
                                </p>
                              </div>
                              <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1">
                                <button
                                  onClick={() => startEdit(item)}
                                  className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                                  title="Edit task"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteItem.mutate(item.id)}
                                  className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                                  title="Delete task"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {addingToMonth === month ? (
                        <div className="p-4 md:p-5 space-y-3 bg-primary/5 border-t border-primary/10">
                          <Input
                            value={newTask}
                            onChange={e => setNewTask(e.target.value)}
                            placeholder="New task name"
                            className="font-medium"
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submitAdd(); if (e.key === "Escape") cancelAdd(); }}
                          />
                          <Textarea
                            value={newDescription}
                            onChange={e => setNewDescription(e.target.value)}
                            placeholder="Description (optional)"
                            className="text-sm resize-none min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={submitAdd} disabled={!newTask.trim() || addItem.isPending}>
                              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Task
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelAdd}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startAdd(month)}
                          className="w-full p-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus className="h-4 w-4" /> Add task to {month}
                        </button>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
