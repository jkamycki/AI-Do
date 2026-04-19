import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGenerateVendorEmail, useGetProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Copy, CheckCircle2, Sparkles, FileDown, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const emailSchema = z.object({
  vendorType: z.string().min(1, "Required"),
  otherVendorType: z.string().optional(),
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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{subject: string, body: string, vendorType?: string, emailType?: string, vendorName?: string} | null>(null);

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      vendorType: "",
      otherVendorType: "",
      emailType: "",
      vendorName: "",
      additionalNotes: "",
    },
  });

  const watchedVendorType = form.watch("vendorType");

  const onSubmit = (data: EmailFormValues) => {
    const resolvedVendorType =
      data.vendorType === "Other"
        ? (data.otherVendorType?.trim() || "Other")
        : data.vendorType;

    generateEmail.mutate(
      {
        data: {
          vendorType: resolvedVendorType,
          emailType: data.emailType,
          vendorName: data.vendorName,
          weddingDate: profile?.weddingDate ?? "",
          venue: profile?.venue ?? "",
          guestCount: profile?.guestCount ?? 0,
          additionalNotes: data.additionalNotes,
          preferredLanguage: profile?.preferredLanguage ?? "English",
        }
      },
      {
        onSuccess: (result) => {
          setGeneratedResult({ ...result, vendorName: data.vendorName });
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

  const handleDownloadPdf = async () => {
    if (!generatedResult) return;
    setIsDownloadingPdf(true);
    try {
      const response = await fetch("/api/pdf/vendor-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: generatedResult.subject,
          body: generatedResult.body,
          vendorType: generatedResult.vendorType,
          emailType: generatedResult.emailType,
          vendorName: generatedResult.vendorName,
        }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aido-vendor-email.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded", description: "Your email draft has been saved as a PDF." });
    } catch {
      toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF. Please try again." });
    } finally {
      setIsDownloadingPdf(false);
    }
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
                            {["Venue", "Hotel", "Photographer", "Videographer", "Florist", "Caterer", "DJ/Band", "Hair & Makeup", "Planner/Coordinator", "Other"].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedVendorType === "Other" && (
                    <FormField
                      control={form.control}
                      name="otherVendorType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor Type Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Officiant, Transportation, Photo Booth…"
                              {...field}
                              className="bg-background"
                              data-testid="input-other-vendor-type"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

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

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => { form.reset(); setGeneratedResult(null); }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Clear
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 shadow-md" 
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
                          Generate
                        </span>
                      )}
                    </Button>
                  </div>
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
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                    className="gap-2"
                    data-testid="btn-download-email-pdf"
                  >
                    {isDownloadingPdf ? (
                      <>
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Exporting…
                      </>
                    ) : (
                      <>
                        <FileDown className="h-3.5 w-3.5" />
                        PDF
                      </>
                    )}
                  </Button>
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
                </div>
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
