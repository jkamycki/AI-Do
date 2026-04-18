import { useState } from "react";
import { useGetTimeline, useEmergencyAdvice, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, Smartphone, ChevronRight, CheckCircle2, Siren } from "lucide-react";
import { format } from "date-fns";

export default function DayOf() {
  const { data: timeline, isLoading: isLoadingTimeline } = useGetTimeline();
  const { data: profile } = useGetProfile();
  const getAdvice = useEmergencyAdvice();
  
  const [emergencyText, setEmergencyText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);

  const handleEmergencySubmit = () => {
    if (!emergencyText.trim()) return;
    
    getAdvice.mutate({ data: { situation: emergencyText } });
  };

  const resetEmergency = () => {
    setEmergencyText("");
    getAdvice.reset();
  };

  if (isLoadingTimeline) {
    return (
      <div className="space-y-4 max-w-md mx-auto p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const events = timeline?.events || [];
  const today = profile?.weddingDate ? new Date(profile.weddingDate) : new Date();
  const dateStr = format(today, "EEEE, MMMM do");

  return (
    <div className="max-w-md mx-auto pb-24 animate-in fade-in">
      {/* Mobile-optimized Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b px-4 py-4 mb-6 text-center shadow-sm">
        <h1 className="font-serif text-2xl text-primary font-bold">The Big Day</h1>
        <p className="text-sm text-muted-foreground font-medium">{dateStr}</p>
      </div>

      <div className="px-4 space-y-6">
        {events.length === 0 ? (
          <Card className="border-none shadow-sm text-center py-12">
            <CardContent className="space-y-4">
              <Clock className="h-12 w-12 text-primary/40 mx-auto" />
              <p className="text-muted-foreground">No timeline generated yet.</p>
              <Button variant="outline" onClick={() => window.location.href='/timeline'}>Go to Timeline</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => {
              const isActive = activeEventId === i;
              return (
                <Card 
                  key={i} 
                  className={`border-none shadow-sm overflow-hidden transition-all duration-300 cursor-pointer
                    ${isActive ? 'ring-2 ring-primary bg-primary/5 scale-[1.02]' : 'hover:bg-muted/30'}
                  `}
                  onClick={() => setActiveEventId(isActive ? null : i)}
                >
                  <CardContent className="p-0 flex">
                    <div className={`w-24 p-4 flex flex-col justify-center items-center text-center border-r ${isActive ? 'bg-primary/10 text-primary font-bold' : 'bg-muted/30 text-muted-foreground font-medium'}`}>
                      <span className="text-xl font-serif">{event.time.replace(/ AM| PM/i, '')}</span>
                      <span className="text-[10px] uppercase tracking-widest mt-1">{event.time.includes('AM') ? 'AM' : 'PM'}</span>
                    </div>
                    <div className="p-4 flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className={`font-serif text-lg leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>{event.title}</h4>
                      </div>
                      <p className={`text-sm mt-2 line-clamp-2 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {event.description}
                      </p>
                      {isActive && (
                        <div className="mt-4 pt-4 border-t flex justify-end animate-in fade-in">
                          <Button size="sm" variant="ghost" className="text-primary hover:text-primary gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Mark Done
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Emergency Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-30 pointer-events-none flex justify-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setTimeout(resetEmergency, 300);
        }}>
          <DialogTrigger asChild>
            <Button 
              size="lg" 
              className="pointer-events-auto w-full max-w-sm rounded-full h-16 shadow-xl bg-destructive hover:bg-destructive/90 text-white font-bold text-lg gap-3 animate-bounce shadow-destructive/20 border-2 border-white/20"
              data-testid="btn-emergency-trigger"
            >
              <Siren className="h-6 w-6" />
              EMERGENCY HELP
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive font-serif text-2xl flex items-center gap-2">
                <AlertCircle className="h-6 w-6" /> Stay Calm
              </DialogTitle>
              <DialogDescription className="text-base">
                What's going wrong right now? Be specific.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-4">
              {!getAdvice.data ? (
                <>
                  <Textarea 
                    placeholder="e.g. The florist forgot the bridal bouquet, ceremony is in 45 mins!"
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    className="min-h-[120px] text-lg p-4 resize-none bg-muted/50 border-destructive/20 focus-visible:ring-destructive"
                    data-testid="textarea-emergency"
                  />
                  <Button 
                    onClick={handleEmergencySubmit} 
                    disabled={!emergencyText.trim() || getAdvice.isPending}
                    className="w-full h-14 text-lg bg-destructive hover:bg-destructive/90"
                    data-testid="btn-emergency-submit"
                  >
                    {getAdvice.isPending ? "Analyzing crisis..." : "Get Immediate Advice"}
                  </Button>
                </>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="bg-secondary/20 p-4 rounded-xl border border-secondary/30">
                    <h4 className="font-serif text-lg font-medium text-foreground mb-2">Instant Advice:</h4>
                    <p className="text-foreground leading-relaxed">{getAdvice.data.advice}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-serif text-lg font-medium text-destructive mb-3">Action Steps:</h4>
                    <ul className="space-y-3">
                      {getAdvice.data.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-3 bg-muted p-3 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button variant="outline" className="w-full h-12" onClick={resetEmergency}>
                    Ask another question
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
