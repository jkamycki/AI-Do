import { useState } from "react";
import { useGetTimeline, useGenerateTimeline, useGetProfile, getGetTimelineQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Wand2, Clock, FileDown, Sparkles } from "lucide-react";

const VISION_STORAGE_KEY = "aido_timeline_day_vision";

export default function Timeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: timeline, isLoading: isLoadingTimeline } = useGetTimeline();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const generateTimeline = useGenerateTimeline();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [dayVision, setDayVision] = useState<string>(
    () => localStorage.getItem(VISION_STORAGE_KEY) ?? ""
  );

  const handleVisionChange = (val: string) => {
    setDayVision(val);
    localStorage.setItem(VISION_STORAGE_KEY, val);
  };

  const handleGenerate = () => {
    if (!profile?.id) {
      toast({
        variant: "destructive",
        title: "Profile Required",
        description: "Please complete your wedding profile first.",
      });
      return;
    }

    generateTimeline.mutate(
      { data: { profileId: profile.id, dayVision: dayVision.trim() || undefined } },
      {
        onSuccess: () => {
          toast({
            title: "Timeline Generated",
            description: "Your personalized wedding day timeline is ready.",
          });
          queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Generation Failed",
            description: "Could not generate timeline. Please try again.",
          });
        }
      }
    );
  };

  const handleDownloadPdf = async () => {
    if (!timeline?.events?.length) return;
    setIsDownloadingPdf(true);
    try {
      const coupleName = profile
        ? `${profile.partner1Name} & ${profile.partner2Name}`
        : undefined;
      const response = await fetch("/api/pdf/timeline", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: timeline.events,
          coupleName,
          weddingDate: profile?.weddingDate,
          venue: profile?.venue,
        }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aido-timeline.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded", description: "Your timeline has been saved as a PDF." });
    } catch {
      toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF. Please try again." });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoadingTimeline || isLoadingProfile) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const hasTimeline = timeline && timeline.events && timeline.events.length > 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <CalendarClock className="h-8 w-8" /> 
            Day-Of Timeline
          </h1>
          <p className="text-lg text-muted-foreground mt-2">A beautiful orchestration of your special day.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasTimeline && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              data-testid="btn-download-timeline-pdf"
              className="gap-2"
            >
              {isDownloadingPdf ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          )}
          <Button 
            onClick={handleGenerate} 
            disabled={generateTimeline.isPending}
            variant={hasTimeline ? "outline" : "default"}
            size="lg"
            data-testid="btn-generate-timeline"
          >
            {generateTimeline.isPending ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Crafting Magic...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                {hasTimeline ? "Regenerate Timeline" : "Generate with AI"}
              </span>
            )}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-serif text-primary flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Your Vision for the Day
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Describe the feel, tone, and moments that matter most — the AI will use this to craft a timeline that truly reflects your day.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. We want a relaxed, intimate morning with just close family before the ceremony. The afternoon should feel celebratory and high-energy with lots of dancing. We'd love a golden-hour portrait session and a sparkler exit. Our guests tend to party late so we want the bar open until midnight..."
            value={dayVision}
            onChange={e => handleVisionChange(e.target.value)}
            className="min-h-[120px] resize-none text-sm leading-relaxed"
            data-testid="input-day-vision"
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {dayVision.length > 0 ? `${dayVision.length} characters · saved automatically` : "Saved automatically as you type"}
          </p>
        </CardContent>
      </Card>

      {!hasTimeline ? (
        <Card className="border-none shadow-md bg-card text-center py-16 px-6">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Clock className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-serif text-2xl text-primary">No Timeline Yet</h3>
            <p className="text-muted-foreground">
              Fill in your vision above, then let our AI craft a seamless flow for your wedding day.
            </p>
            <Button onClick={handleGenerate} disabled={generateTimeline.isPending} size="lg" className="px-8 shadow-md">
              Generate Timeline Now
            </Button>
          </div>
        </Card>
      ) : (
        <div className="relative mt-12 pb-12">
          <div className="absolute left-[27px] md:left-1/2 top-4 bottom-0 w-0.5 bg-primary/20 transform md:-translate-x-1/2" />
          
          <div className="space-y-8">
            {timeline.events.map((event, index) => {
              const isEven = index % 2 === 0;
              const categoryColor = 
                event.category.toLowerCase().includes('ceremony') ? 'text-primary bg-primary/10 border-primary/20' :
                event.category.toLowerCase().includes('reception') ? 'text-secondary-foreground bg-secondary/50 border-secondary/50' :
                event.category.toLowerCase().includes('prep') ? 'text-accent-foreground bg-accent border-accent/50' :
                'text-muted-foreground bg-muted border-muted-foreground/20';

              return (
                <div key={index} className="relative flex flex-col md:flex-row items-start md:items-center gap-6 group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms` }}>
                  
                  <div className="absolute left-[28px] md:left-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary transform -translate-x-1/2 mt-6 md:mt-0 z-10 group-hover:scale-125 group-hover:bg-primary transition-transform duration-300" />

                  <div className={`w-full md:w-1/2 ${isEven ? 'md:text-right md:pr-12' : 'md:order-last md:pl-12'} pl-16 md:pl-0`}>
                    <div className={`hidden md:block text-2xl font-serif text-primary font-medium tracking-tight ${!isEven && 'md:text-left'}`}>
                      {event.time}
                    </div>
                  </div>

                  <div className={`w-full md:w-1/2 ${isEven ? 'md:order-last md:pl-12' : 'md:text-right md:pr-12'} pl-16 md:pl-0`}>
                    <Card className="hover-elevate transition-all border-none shadow-sm group-hover:shadow-md">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between gap-4 mb-2 md:hidden">
                          <span className="text-xl font-serif text-primary font-medium">{event.time}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${categoryColor}`}>
                            {event.category}
                          </span>
                        </div>
                        <div className="hidden md:flex justify-between items-start mb-1">
                          <span className={`text-xs px-2 py-1 rounded-full border ${categoryColor} ${isEven ? '' : 'ml-auto'}`}>
                            {event.category}
                          </span>
                        </div>
                        <h4 className="text-lg font-medium text-foreground">{event.title}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
