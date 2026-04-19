import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Heart, CheckCircle2, AlertCircle, Loader2, UserPlus } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Your full name is required"),
  email: z.string().email("Please enter a valid email").or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

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
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      plusOne: false,
      plusOneName: "",
    },
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-purple-50">
        <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
      </div>
    );
  }

  if (isError || !wedding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-purple-50 p-4">
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardContent className="pt-10 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-rose-400 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-800">This link is no longer valid</h2>
            <p className="text-muted-foreground">The couple may have regenerated or disabled their guest registration link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-purple-50 p-4">
        <Card className="max-w-md w-full text-center shadow-lg border-rose-100">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-rose-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
              You're on the list!
            </h2>
            <p className="text-muted-foreground">
              Thank you! {wedding.partner1Name} & {wedding.partner2Name} can't wait to celebrate with you.
            </p>
            <div className="flex items-center justify-center gap-2 text-rose-400 text-sm font-medium pt-2">
              <Heart className="h-4 w-4 fill-rose-400" />
              <span>{formatDate(wedding.weddingDate)}</span>
              <Heart className="h-4 w-4 fill-rose-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center">
              <Heart className="h-7 w-7 text-rose-500 fill-rose-200" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
            {wedding.partner1Name} & {wedding.partner2Name}
          </h1>
          <p className="text-muted-foreground">{formatDate(wedding.weddingDate)}</p>
          {wedding.venue && (
            <p className="text-sm text-muted-foreground">{wedding.venue}</p>
          )}
        </div>

        <Card className="shadow-lg border-rose-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-rose-400" />
              Register as a Guest
            </CardTitle>
            <CardDescription>
              Fill out your info so the couple can add you to their guest list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name <span className="text-rose-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Smith" {...field} />
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
                        <Input type="email" placeholder="jane@example.com" {...field} />
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
                        <Input type="tel" placeholder="(555) 000-0000" {...field} />
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
                      <FormLabel>Mailing Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, City, State, ZIP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border rounded-lg p-4 space-y-4 bg-rose-50/40">
                  <FormField
                    control={form.control}
                    name="plusOne"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel className="text-base font-medium">Bringing a Plus One?</FormLabel>
                          <p className="text-xs text-muted-foreground mt-0.5">Let the couple know if you'll have a guest</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {plusOne && (
                    <FormField
                      control={form.control}
                      name="plusOneName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plus One's Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Alex Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {submit.isError && (
                  <p className="text-sm text-red-500 text-center">
                    {submit.error instanceof Error ? submit.error.message : "Something went wrong."}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                  disabled={submit.isPending}
                  size="lg"
                >
                  {submit.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4 mr-2" />
                      Submit My Info
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by A.IDO — AI Wedding Planning OS
        </p>
      </div>
    </div>
  );
}
