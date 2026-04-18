import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGenerateVendorEmail, useGetProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Copy, CheckCircle2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const emailSchema = z.object({
  vendorType: z.string().min(1, "Required"),
  emailType: z.string().min(1, "Required"),
  vendorName: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export default function VendorEmailPage() {
  const { toast } = useToast();
  const { data: profile, isLoading: isLoadingProfile, isError: isProfileError } = useGetProfile();
  const generateEmail = useGenerateVendorEmail();
  
  const [copied, setCopied] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{subject: string, body: string} | null>(null);

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      vendorType: "",
      emailType: "",
      vendorName: "",
      additionalNotes: "",
    },
  });

  const onSubmit = (data: EmailFormValues) => {
    if (!profile) {
      toast({ variant: "destructive", title: "Profile Required", description: "Please complete your profile first." });
      return;
    }

    generateEmail.mutate(
      {
        data: {
          vendorType: data.vendorType,
          emailType: data.emailType,
          vendorName: data.vendorName,
          weddingDate: profile.weddingDate,
          venue: profile.venue,
          guestCount: profile.guestCount,
          additionalNotes: data.additionalNotes,
        }
      },
      {
        onSuccess: (result) => {
          setGeneratedResult(result);
          setCopied(false);
          toast({ title: "Draft Ready", description: "Email generated successfully." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Could not generate email." });
        }
      }
    );
  };

  const copyToClipboard = () => {
    if (!generatedResult) return;
    const textToCopy = `Subject: ${generatedResult.subject}\n\n${generatedResult.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 3000);
  };

  if (isLoadingProfile && !isProfileError) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <Mail className="h-8 w-8" /> 
          Vendor Emails
        </h1>
        <p className="text-lg text-muted-foreground mt-2">Perfectly crafted, professional communication.</p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-5">
          <Card className="border-none shadow-md bg-card">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
              <CardTitle className="font-serif text-2xl text-primary">Compose</CardTitle>
              <CardDescription>Tell AI what you need.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <FormField
                    control={form.control}
                    name="vendorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor-type" className="bg-background">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["Venue", "Photographer", "Videographer", "Florist", "Caterer", "DJ/Band", "Hair & Makeup", "Planner/Coordinator"].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose of Email</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-email-type" className="bg-background">
                              <SelectValue placeholder="What do you need?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Initial Inquiry / Availability">Initial Inquiry / Availability</SelectItem>
                            <SelectItem value="Quote Request">Request a Quote</SelectItem>
                            <SelectItem value="Follow-up">Follow-up on Previous Email</SelectItem>
                            <SelectItem value="Negotiation / Budget Discussion">Negotiate Budget/Package</SelectItem>
                            <SelectItem value="Contract Confirmation">Confirming Contract/Booking</SelectItem>
                            <SelectItem value="Polite Decline">Polite Decline</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vendorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Lumina Photography" {...field} className="bg-background" data-testid="input-vendor-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="additionalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specific Details <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="E.g. We love your dark and moody style, and want a 8-hour package..." 
                            className="resize-none bg-background h-24"
                            {...field} 
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full shadow-md" 
                    disabled={generateEmail.isPending}
                    data-testid="btn-generate-email"
                  >
                    {generateEmail.isPending ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        Drafting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate Email
                      </span>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-7">
          <Card className="border-none shadow-md h-full flex flex-col overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-xl">Draft</CardTitle>
              {generatedResult && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyToClipboard}
                  className="gap-2"
                  data-testid="btn-copy-email"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy All"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 relative min-h-[400px]">
              {generateEmail.isPending ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 space-y-4">
                  <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-primary font-medium">Composing the perfect words...</p>
                </div>
              ) : generatedResult ? (
                <div className="p-6 space-y-6 animate-in fade-in">
                  <div className="space-y-1 border-b pb-4">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Subject</p>
                    <p className="font-medium text-foreground text-lg">{generatedResult.subject}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Message</p>
                    <div className="whitespace-pre-wrap text-foreground leading-relaxed font-serif text-[1.05rem]">
                      {generatedResult.body}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Mail className="h-16 w-16 mb-4 opacity-20" />
                  <p className="text-lg font-serif">Your draft will appear here.</p>
                  <p className="text-sm mt-2 max-w-sm">Fill out the form to let our AI write a polished, professional email using your profile details.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
