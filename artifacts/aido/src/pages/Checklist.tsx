import { useState } from "react";
import { 
  useGetChecklist, 
  useGenerateChecklist, 
  useToggleChecklistItem,
  useGetProfile,
  getGetChecklistQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Wand2, ClipboardList } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Checklist() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: checklist, isLoading: isLoadingChecklist } = useGetChecklist();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const generateChecklist = useGenerateChecklist();
  const toggleItem = useToggleChecklistItem();

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
          queryClient.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate checklist." });
        }
      }
    );
  };

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleItem.mutate(
      { id, data: { isCompleted: !currentStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
        }
      }
    );
  };

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
  
  // Group by month
  const groupedItems = checklist?.items.reduce((acc, item) => {
    if (!acc[item.month]) acc[item.month] = [];
    acc[item.month].push(item);
    return acc;
  }, {} as Record<string, typeof checklist.items>) || {};

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
                        <div 
                          key={item.id} 
                          className={`p-4 md:p-6 flex gap-4 transition-colors hover:bg-muted/30 ${item.isCompleted ? 'bg-muted/10' : ''}`}
                        >
                          <div className="pt-1">
                            <Checkbox 
                              checked={item.isCompleted} 
                              onCheckedChange={() => handleToggle(item.id, item.isCompleted)}
                              data-testid={`checkbox-item-${item.id}`}
                              className="h-6 w-6 rounded-full border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className={`text-lg font-medium transition-all ${item.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {item.task}
                            </h4>
                            <p className={`text-sm ${item.isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
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
