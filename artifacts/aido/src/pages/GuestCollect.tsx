import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Heart, CheckCircle2, AlertCircle, Loader2, MapPin } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Your full name is required"),
  email: z.string().email("Please enter a valid email").or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;


export default function GuestCollect() {
  const [, params] = useRoute("/collect/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);

  const { data: wedding, isLoading, isError } = useQuery({
    queryKey: ["guest-collect", token],
    queryFn: async () => {
      const res = await fetch(`/api/guest-collect/${token}`);
      if (!res.ok) throw new Error("Invalid link");
      return res.json() as Promise<{
        partner1Name: string;
        partner2Name: string;
        weddingDate: string;
        venue: string;
      }>;
    },
    enabled: !!token,
    retry: false,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", address: "", plusOne: false, plusOneFirstName: "", plusOneLastName: "" },
  });

  const plusOne = form.watch("plusOne");

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/guest-collect/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Something went wrong. Please try again.");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #fdf4ff 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
      </div>
    );
  }

  if (isError || !wedding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #fdf4ff 100%)" }}>
        <div className="mb-6">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#7c3d52", fontFamily: "Georgia, serif" }}>A.IDO</span>
        </div>
        <Card className="max-w-md w-full text-center shadow-xl border-0">
          <CardContent className="pt-10 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-rose-300 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-800">This link is no longer valid</h2>
            <p className="text-muted-foreground text-sm">The couple may have regenerated or disabled their link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #fdf4ff 100%)" }}>
        <div className="mb-8">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#7c3d52", fontFamily: "Georgia, serif" }}>A.IDO</span>
        </div>
        <Card className="max-w-md w-full text-center shadow-xl border-0 overflow-hidden">
          <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #f43f5e, #a855f7)" }} />
          <CardContent className="pt-10 pb-10 space-y-5 px-8">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fecdd3, #f9a8d4)" }}>
                <CheckCircle2 className="h-10 w-10 text-rose-500" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: "Georgia, serif" }}>
                Got it, thank you!
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                <span className="font-semibold text-gray-700">{wedding.partner1Name} & {wedding.partner2Name}</span>{" "}
                now have your info and will be in touch!
              </p>
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-xs text-muted-foreground">Powered by A.IDO — AI Wedding Planning OS</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #fdf4ff 100%)" }}>
      {/* Top brand bar */}
      <div className="w-full py-4 px-6 flex items-center justify-center border-b border-rose-100/60 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 fill-rose-400 text-rose-400" />
          <span className="text-lg font-bold tracking-tight" style={{ color: "#7c3d52", fontFamily: "Georgia, serif" }}>A.IDO</span>
          <span className="text-xs text-muted-foreground ml-1">AI Wedding Planning OS</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center py-10 px-4">
        <div className="max-w-lg w-full space-y-6">

          {/* Hero */}
          <div className="text-center space-y-4 py-6">
            <div className="flex justify-center mb-2">
              <div className="h-16 w-16 rounded-full flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #fecdd3, #f9a8d4)" }}>
                <MapPin className="h-8 w-8 text-rose-500" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-widest mb-2" style={{ color: "#a855f7" }}>
                Contact Info Request
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight" style={{ fontFamily: "Georgia, serif" }}>
                {wedding.partner1Name} & {wedding.partner2Name}
              </h1>
              <p className="text-base text-gray-500 mt-1">
                are collecting addresses for their wedding invitations
              </p>
            </div>
          </div>

          {/* Form card */}
          <Card className="shadow-xl border-0 overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #f43f5e, #a855f7)" }} />
            <CardContent className="pt-7 pb-8 px-6 sm:px-8 space-y-5">
              <p className="text-xs text-muted-foreground">
                Please share your mailing address and contact details so{" "}
                {wedding.partner1Name} & {wedding.partner2Name} can send you an invitation.
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name <span className="text-rose-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Smith" className="bg-gray-50 border-gray-200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mailing Address <span className="text-rose-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St, City, State, ZIP" className="bg-gray-50 border-gray-200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="jane@example.com" className="bg-gray-50 border-gray-200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 000-0000" className="bg-gray-50 border-gray-200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Plus One */}
                  <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="plusOne"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                          <div>
                            <FormLabel className="text-sm font-medium">Will you have a Plus One?</FormLabel>
                            <p className="text-xs text-muted-foreground mt-0.5">Let them know if someone will be joining you</p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {plusOne && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="plusOneFirstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Alex" className="bg-white border-rose-200" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="plusOneLastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Smith" className="bg-white border-rose-200" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {submit.isError && (
                    <p className="text-sm text-red-500 text-center">
                      {submit.error instanceof Error ? submit.error.message : "Something went wrong."}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full text-white font-semibold py-5 rounded-xl"
                    style={{ background: "linear-gradient(90deg, #f43f5e, #a855f7)" }}
                    disabled={submit.isPending}
                    size="lg"
                  >
                    {submit.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><Heart className="h-4 w-4 mr-2" /> Send My Info</>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground pb-6">
            Powered by <span className="font-medium" style={{ color: "#7c3d52" }}>A.IDO</span> — AI Wedding Planning OS
          </p>
        </div>
      </div>
    </div>
  );
}
