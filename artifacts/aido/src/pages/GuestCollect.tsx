import { useState } from "react";
import { apiFetch } from "@/lib/authFetch";
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
import { MaintenanceNotice } from "@/components/MaintenanceNotice";
import { usePublicMaintenance } from "@/hooks/usePublicMaintenance";

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

const palette = {
  cream: "#FFF7F2",
  blush: "#F9ECE8",
  card: "#FFFDFB",
  burgundy: "#8D294D",
  burgundyDark: "#76223F",
  ink: "#3B1C2B",
  muted: "#6F3E54",
  border: "#E6C7D0",
};

const pageStyle = {
  backgroundColor: palette.cream,
  backgroundImage:
    "radial-gradient(rgba(141,41,77,0.12) 0.8px, transparent 0.8px), linear-gradient(180deg, #FFF7F2 0%, #F8ECE4 100%)",
  backgroundSize: "22px 22px, 100% 100%",
};

const inputClass =
  "h-11 rounded-xl border-[#E6C7D0] bg-white/90 text-[#3B1C2B] placeholder:text-[#9A7B88] shadow-sm focus-visible:border-[#8D294D] focus-visible:ring-[#8D294D]/20";

const AIDO_MARKETING_URL = "https://aidowedding.net?theme=light";

function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="A.IDO - AI Wedding Planning OS"
      className={className ?? "h-16 w-auto object-contain"}
    />
  );
}

export default function GuestCollect() {
  const [, params] = useRoute("/collect/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const maintenance = usePublicMaintenance("guest-collector");

  const { data: wedding, isLoading, isError } = useQuery({
    queryKey: ["guest-collect", token],
    queryFn: async () => {
      const res = await apiFetch(`/api/guest-collect/${token}`);
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
      plusOneFirstName: "",
      plusOneLastName: "",
    },
  });

  const plusOne = form.watch("plusOne");

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiFetch(`/api/guest-collect/${token}`, {
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

  if (maintenance.data?.active) {
    return <MaintenanceNotice message={maintenance.data.message} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={pageStyle}>
        <Loader2 className="h-8 w-8 animate-spin text-[#8D294D]" />
      </div>
    );
  }

  if (isError || !wedding) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" style={pageStyle}>
        <Logo className="mb-6 h-20 w-auto object-contain" />
        <Card className="w-full max-w-md border-[#E6C7D0] bg-[#FFFDFB]/95 text-center shadow-xl">
          <CardContent className="space-y-4 px-7 pb-8 pt-10">
            <AlertCircle className="mx-auto h-12 w-12 text-[#8D294D]" />
            <h2 className="text-xl font-semibold text-[#3B1C2B]">This link is no longer valid</h2>
            <p className="text-sm text-[#6F3E54]">The couple may have regenerated or disabled their link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" style={pageStyle}>
        <Logo className="mb-8 h-20 w-auto object-contain" />
        <Card className="w-full max-w-md overflow-hidden border-[#E6C7D0] bg-[#FFFDFB]/95 text-center shadow-2xl">
          <div className="h-1.5 w-full bg-[#8D294D]" />
          <CardContent className="space-y-5 px-8 pb-10 pt-10">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F8E4E9] ring-1 ring-[#D9A9B7]">
                <CheckCircle2 className="h-10 w-10 text-[#8D294D]" />
              </div>
            </div>
            <div>
              <h2 className="mb-2 font-serif text-2xl font-bold text-[#3B1C2B]">
                Got it, thank you!
              </h2>
              <p className="text-sm leading-relaxed text-[#6F3E54]">
                <span className="font-semibold text-[#3B1C2B]">{wedding.partner2Name} & {wedding.partner1Name}</span>{" "}
                now have your info and will be in touch.
              </p>
            </div>
          </CardContent>
        </Card>
        <a
          href={AIDO_MARKETING_URL}
          className="mt-6 text-xs text-[#6F3E54] underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by <span className="font-semibold text-[#8D294D]">A.IDO</span> - AI Wedding Planning OS
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={pageStyle}>
      <div className="flex w-full items-center justify-center border-b border-[#E6C7D0] bg-[#FFFDFB]/80 px-6 py-3 backdrop-blur-sm">
        <Logo className="h-20 w-auto object-contain sm:h-24" />
      </div>

      <div className="flex flex-1 flex-col items-center px-4 py-7 sm:py-10">
        <div className="w-full max-w-lg space-y-5 sm:space-y-6">
          <div className="space-y-4 py-3 text-center sm:py-5">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F8E4E9] shadow-sm ring-1 ring-[#D9A9B7] sm:h-16 sm:w-16">
                <MapPin className="h-7 w-7 text-[#8D294D] sm:h-8 sm:w-8" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#8D294D] sm:text-sm">
                Contact Info Request
              </p>
              <h1 className="font-serif text-3xl font-bold leading-tight text-[#3B1C2B] sm:text-4xl">
                {wedding.partner2Name} & {wedding.partner1Name}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-base leading-relaxed text-[#6F3E54]">
                are collecting addresses for their wedding invitations
              </p>
            </div>
          </div>

          <Card className="overflow-hidden border-[#E6C7D0] bg-[#FFFDFB]/95 shadow-2xl">
            <div className="h-1.5 w-full bg-[#8D294D]" />
            <CardContent className="space-y-5 px-5 pb-7 pt-6 sm:px-8 sm:pb-8">
              <p className="text-sm leading-relaxed text-[#6F3E54]">
                Please share your mailing address and contact details so{" "}
                <span className="font-semibold text-[#3B1C2B]">{wedding.partner2Name} & {wedding.partner1Name}</span>{" "}
                can send you an invitation.
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-[#6F3E54]">
                          Full Name <span className="text-[#8D294D]">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Smith" className={inputClass} {...field} />
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
                        <FormLabel className="font-semibold text-[#6F3E54]">Mailing Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St, City, State, ZIP" className={inputClass} {...field} />
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
                        <FormLabel className="font-semibold text-[#6F3E54]">Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="jane@example.com" className={inputClass} {...field} />
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
                        <FormLabel className="font-semibold text-[#6F3E54]">Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 000-0000" className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4 rounded-2xl border border-[#D9A9B7] bg-[#FFF7F2] p-4 shadow-sm">
                    <FormField
                      control={form.control}
                      name="plusOne"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                          <div>
                            <FormLabel className="text-sm font-semibold text-[#3B1C2B]">Will you have a Plus One?</FormLabel>
                            <p className="mt-0.5 text-xs text-[#6F3E54]">Let them know if someone will be joining you</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="data-[state=checked]:bg-[#8D294D] data-[state=unchecked]:bg-[#D9A9B7]"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {plusOne && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="plusOneFirstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-semibold text-[#6F3E54]">First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Alex" className={inputClass} {...field} />
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
                              <FormLabel className="font-semibold text-[#6F3E54]">Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Smith" className={inputClass} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {submit.isError && (
                    <p className="text-center text-sm font-medium text-red-700">
                      {submit.error instanceof Error ? submit.error.message : "Something went wrong."}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full rounded-xl bg-[#8D294D] py-5 font-semibold text-white shadow-sm hover:bg-[#76223F]"
                    disabled={submit.isPending}
                    size="lg"
                  >
                    {submit.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      <><Heart className="mr-2 h-4 w-4" /> Send My Info</>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <a
            href={AIDO_MARKETING_URL}
            className="block pb-6 text-center text-xs text-[#6F3E54] underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by <span className="font-semibold text-[#8D294D]">A.IDO</span> - AI Wedding Planning OS
          </a>
        </div>
      </div>
    </div>
  );
}
