import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetBudget, 
  useSaveBudget, 
  useAddBudgetItem, 
  usePredictBudget, 
  useGetProfile,
  getGetBudgetQueryKey,
  useUpdateBudgetItem,
  useDeleteBudgetItem
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Plus, Wand2, Calculator, Trash2, Edit2, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const itemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  vendor: z.string().min(1, "Vendor is required"),
  estimatedCost: z.coerce.number().min(0, "Must be >= 0"),
  actualCost: z.coerce.number().min(0, "Must be >= 0"),
  isPaid: z.boolean().default(false),
  notes: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function Budget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: budget, isLoading: isLoadingBudget } = useGetBudget();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  
  const saveBudget = useSaveBudget();
  const addBudgetItem = useAddBudgetItem();
  const predictBudget = usePredictBudget();
  const updateItem = useUpdateBudgetItem();
  const deleteItem = useDeleteBudgetItem();

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category: "",
      vendor: "",
      estimatedCost: 0,
      actualCost: 0,
      isPaid: false,
      notes: "",
    },
  });

  const onSubmitItem = (data: ItemFormValues) => {
    addBudgetItem.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Item added", description: "Budget item saved." });
        queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
        setIsAddingItem(false);
        form.reset();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Could not add item." });
      }
    });
  };

  const togglePaid = (id: number, currentPaid: boolean) => {
    updateItem.mutate(
      { id, data: { isPaid: !currentPaid } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Item deleted" });
        queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
      }
    });
  };

  const handlePredict = () => {
    if (!profile) {
      toast({ variant: "destructive", title: "Profile Required", description: "Complete your profile first." });
      return;
    }
    
    setIsPredicting(true);
    predictBudget.mutate(
      { data: { location: profile.location, guestCount: profile.guestCount, weddingVibe: profile.weddingVibe } },
      {
        onSuccess: (data) => {
          toast({ title: "Prediction Complete", description: "AI has estimated your costs." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Prediction failed." });
        },
        onSettled: () => {
          setIsPredicting(false);
        }
      }
    );
  };

  if (isLoadingBudget || isLoadingProfile) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const spentPercentage = budget && budget.totalBudget > 0 ? (budget.spent / budget.totalBudget) * 100 : 0;
  const isOverBudget = budget ? budget.spent > budget.totalBudget : false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <DollarSign className="h-8 w-8" /> 
            Budget Manager
          </h1>
          <p className="text-lg text-muted-foreground mt-2">Track every penny, stress-free.</p>
        </div>
        <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md" data-testid="btn-add-item">
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">New Expense</DialogTitle>
              <DialogDescription>Log a new quote or paid invoice.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitItem)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["Venue", "Catering", "Photography", "Florist", "Attire", "Music", "Decor", "Other"].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Sweet Magnolia Florals" {...field} data-testid="input-vendor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estimatedCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-estimated" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="actualCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-actual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="isPaid"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Fully Paid</FormLabel>
                        <CardDescription>Has this been completely paid off?</CardDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-paid"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full mt-4" disabled={addBudgetItem.isPending} data-testid="btn-submit-item">
                  {addBudgetItem.isPending ? "Saving..." : "Save Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {budget && (
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-primary/5 border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-serif text-primary">${budget.totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-serif">${budget.spent.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className={`${isOverBudget ? 'bg-destructive/10' : 'bg-secondary/20'} border-none shadow-sm`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium uppercase tracking-wider ${isOverBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
                Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-serif ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                ${budget.remaining.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {budget && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{spentPercentage.toFixed(1)}% utilized</span>
            <span>{isOverBudget ? "Over budget" : "On track"}</span>
          </div>
          <Progress value={spentPercentage > 100 ? 100 : spentPercentage} className={`h-3 ${isOverBudget ? '[&>div]:bg-destructive' : ''}`} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="font-serif text-xl">Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {budget && budget.items && budget.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead>Vendor / Category</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                        <TableHead className="text-right">Actual Cost</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budget.items.map((item) => (
                        <TableRow key={item.id} className="group transition-colors">
                          <TableCell>
                            <div className="font-medium text-foreground">{item.vendor}</div>
                            <div className="text-xs text-muted-foreground">{item.category}</div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${item.estimatedCost.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.actualCost.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <button 
                              onClick={() => togglePaid(item.id, item.isPaid)}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${item.isPaid ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              data-testid={`btn-toggle-paid-${item.id}`}
                              title={item.isPaid ? "Mark unpaid" : "Mark paid"}
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDelete(item.id)}
                              data-testid={`btn-delete-item-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No expenses logged yet.</p>
                  <Button variant="link" onClick={() => setIsAddingItem(true)} className="mt-2 text-primary">
                    Add your first expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-secondary/10 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" /> AI Prediction
              </CardTitle>
              <CardDescription>Based on {profile?.location || "your location"} and {profile?.guestCount || "guest"} guests.</CardDescription>
            </CardHeader>
            <CardContent>
              {predictBudget.data ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center p-4 bg-background rounded-xl border border-primary/10 shadow-sm">
                    <p className="text-sm text-muted-foreground mb-1">Estimated Total Need</p>
                    <div className="text-3xl font-serif font-bold text-primary">
                      ${predictBudget.data.totalEstimate.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Predicted Breakdown</h4>
                    {predictBudget.data.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0">
                        <span>{b.category}</span>
                        <span className="font-medium">${b.estimatedCost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-primary/10 rounded-xl text-sm leading-relaxed text-primary-foreground/90 text-foreground">
                    <p className="italic text-muted-foreground">"{predictBudget.data.aiSuggestions}"</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Wand2 className="h-8 w-8 text-primary opacity-50" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">Let AI analyze market rates for your specific wedding vibe and location to predict realistic costs.</p>
                  <Button 
                    onClick={handlePredict} 
                    disabled={isPredicting || predictBudget.isPending} 
                    className="w-full"
                    data-testid="btn-predict-budget"
                  >
                    {isPredicting || predictBudget.isPending ? "Analyzing market..." : "Predict Costs"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
