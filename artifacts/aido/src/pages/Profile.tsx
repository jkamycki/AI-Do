import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetProfile, useSaveProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Save, RotateCcw, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/lib/countries";
import { getAddressFormat } from "@/lib/addressFormat";

const NO_COUNTRY = "__none__";

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish",
];

const profileSchema = z.object({
  partner1Name: z.string().min(1, "Name is required"),
  partner2Name: z.string().min(1, "Name is required"),
  weddingDate: z.string().min(1, "Date is required"),
  ceremonyTime: z.string().min(1, "Time is required"),
  receptionTime: z.string().min(1, "Time is required"),
  venue: z.string().min(1, "Venue is required"),
  location: z.string().optional().default(""),
  venueCity: z.string().optional().default(""),
  venueState: z.string().optional().default(""),
  venueZip: z.string().optional().default(""),
  venueCountry: z.string().optional().default(""),
  ceremonyAtVenue: z.boolean().default(true),
  ceremonyVenueName: z.string().optional().default(""),
  ceremonyAddress: z.string().optional().default(""),
  ceremonyCity: z.string().optional().default(""),
  ceremonyState: z.string().optional().default(""),
  ceremonyZip: z.string().optional().default(""),
  guestCount: z.coerce.number().min(1, "Must be at least 1"),
  totalBudget: z.coerce.number().min(1, "Must be at least 1"),
  weddingVibe: z.string().optional().default(""),
  preferredLanguage: z.string().default("English"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: profile, isLoading, isFetching, isError, error, refetch } = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: isLoaded && !!isSignedIn,
      // Don't retry 404 — that just means "no profile yet, render the empty form".
      retry: (failureCount, err) => {
        if ((err as { status?: number } | null | undefined)?.status === 404) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    }
  });
  // True 404 = brand-new user without a profile yet. We render the empty form
  // so they can fill it in (POST /api/profile creates the row on save).
  const isNoProfileYet = isError && (error as { status?: number } | null)?.status === 404;
  const saveProfile = useSaveProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      partner1Name: "",
      partner2Name: "",
      weddingDate: "",
      ceremonyTime: "16:00",
      receptionTime: "18:00",
      venue: "",
      location: "",
      venueCity: "",
      venueState: "",
      venueZip: "",
      venueCountry: "",
      ceremonyAtVenue: true,
      ceremonyVenueName: "",
      ceremonyAddress: "",
      ceremonyCity: "",
      ceremonyState: "",
      ceremonyZip: "",
      guestCount: 100,
      totalBudget: 30000,
      preferredLanguage: "English",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        partner1Name: profile.partner1Name,
        partner2Name: profile.partner2Name,
        weddingDate: (profile.weddingDate ?? "").split('T')[0],
        ceremonyTime: profile.ceremonyTime,
        receptionTime: profile.receptionTime,
        venue: profile.venue,
        location: profile.location,
        venueCity: profile.venueCity ?? "",
        venueState: profile.venueState ?? "",
        venueZip: profile.venueZip ?? "",
        venueCountry: (profile as { venueCountry?: string | null }).venueCountry ?? "",
        ceremonyAtVenue: profile.ceremonyAtVenue ?? true,
        ceremonyVenueName: profile.ceremonyVenueName ?? "",
        ceremonyAddress: profile.ceremonyAddress ?? "",
        ceremonyCity: profile.ceremonyCity ?? "",
        ceremonyState: profile.ceremonyState ?? "",
        ceremonyZip: profile.ceremonyZip ?? "",
        guestCount: profile.guestCount,
        totalBudget: profile.totalBudget,
        preferredLanguage: profile.preferredLanguage ?? "English",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: ProfileFormValues) => {
    saveProfile.mutate({ data }, {
      onSuccess: () => {
        toast({
          title: t("profile.saved_toast"),
          description: t("profile.saved_toast_desc"),
        });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("profile.save_error"),
        });
      }
    });
  };

  // Only show the error screen for real errors (network/500). A 404 is the
  // expected "first-time user" state — fall through to render the empty form.
  if (isError && !profile && !isFetching && !isNoProfileYet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <p className="text-muted-foreground text-sm">
          Could not load your profile. The server may be starting up — please try again.
        </p>
        <Button variant="outline" onClick={() => void refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (isLoading || (!profile && !isError)) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-primary">
          {isNoProfileYet ? "Set up your wedding profile" : t("profile.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          {isNoProfileYet
            ? "Tell us a few quick details so Aria can personalize your planning experience."
            : t("profile.subtitle")}
        </p>
      </div>

      {isNoProfileYet && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="font-medium text-primary">Welcome!</span>{" "}
          Fill in your wedding details below and tap <span className="font-medium">Save</span> at the bottom to get started.
        </div>
      )}

      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
          <CardTitle className="font-serif text-2xl text-primary">{t("profile.your_details")}</CardTitle>
          <CardDescription>{t("profile.your_details_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="partner1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.groom_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder="James" {...field} data-testid="input-partner1" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="partner2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.bride_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Sophia" {...field} data-testid="input-partner2" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="weddingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.wedding_date")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="date" {...field} data-testid="input-date" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ceremonyTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.ceremony_time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-ceremony-time" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receptionTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.reception_time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-reception-time" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="venue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.venue_name")}</FormLabel>
                    <FormControl>
                      <Input placeholder="The Historic Magnolia Estate" {...field} data-testid="input-venue" className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="venueCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("guests.country")}</FormLabel>
                    <Select
                      key={field.value || NO_COUNTRY}
                      value={field.value ? field.value : NO_COUNTRY}
                      onValueChange={(v) => field.onChange(v === NO_COUNTRY ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background" data-testid="select-venue-country">
                          <SelectValue placeholder={t("guests.country_placeholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-72">
                        <SelectItem value={NO_COUNTRY}>{t("guests.country_none")}</SelectItem>
                        {COUNTRIES.map((c) => (
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.street_address")}</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Magnolia Lane" {...field} data-testid="input-location" className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(() => {
                const fmt = getAddressFormat(form.watch("venueCountry"));
                const visible = 1 + (fmt.showState ? 1 : 0) + (fmt.showZip ? 1 : 0);
                const gridCls = visible >= 3 ? "grid md:grid-cols-3 gap-6" : visible === 2 ? "grid md:grid-cols-2 gap-6" : "grid gap-6";
                return (
                  <div className={gridCls}>
                    {fmt.showState && (
                      <FormField
                        control={form.control}
                        name="venueState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{fmt.stateLabel}</FormLabel>
                            <FormControl>
                              <Input placeholder={fmt.statePlaceholder} {...field} data-testid="input-venue-state" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="venueCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{fmt.cityLabel}</FormLabel>
                          <FormControl>
                            <Input placeholder={fmt.cityPlaceholder} {...field} data-testid="input-venue-city" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fmt.showZip && (
                      <FormField
                        control={form.control}
                        name="venueZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{fmt.zipLabel}</FormLabel>
                            <FormControl>
                              <Input placeholder={fmt.zipPlaceholder} {...field} data-testid="input-venue-zip" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                );
              })()}

              <div className="rounded-lg border border-primary/10 bg-primary/5 p-5 space-y-5">
                <FormField
                  control={form.control}
                  name="ceremonyAtVenue"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={!field.value}
                          onCheckedChange={(checked) => field.onChange(!checked)}
                          data-testid="checkbox-ceremony-at-venue"
                          className="mt-0.5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-tight">
                        <FormLabel className="cursor-pointer">{t("profile.ceremony_at_venue")}</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("profile.ceremony_at_venue_desc")}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {!form.watch("ceremonyAtVenue") && (
                  <div className="space-y-4 pt-2 border-t border-primary/10">
                    <FormField
                      control={form.control}
                      name="ceremonyVenueName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.ceremony_venue_name")}</FormLabel>
                          <FormControl>
                            <Input placeholder="St. Mary's Cathedral" {...field} data-testid="input-ceremony-venue-name" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ceremonyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.ceremony_street_address")}</FormLabel>
                          <FormControl>
                            <Input placeholder="200 Broad Street" {...field} data-testid="input-ceremony-address" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {(() => {
                      const fmt = getAddressFormat(form.watch("venueCountry"));
                      const visible = 1 + (fmt.showState ? 1 : 0) + (fmt.showZip ? 1 : 0);
                      const gridCls = visible >= 3 ? "grid md:grid-cols-3 gap-4" : visible === 2 ? "grid md:grid-cols-2 gap-4" : "grid gap-4";
                      return (
                        <div className={gridCls}>
                          {fmt.showState && (
                            <FormField
                              control={form.control}
                              name="ceremonyState"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{fmt.stateLabel}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={fmt.statePlaceholder} {...field} data-testid="input-ceremony-state" className="bg-background" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name="ceremonyCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{fmt.cityLabel}</FormLabel>
                                <FormControl>
                                  <Input placeholder={fmt.cityPlaceholder} {...field} data-testid="input-ceremony-city" className="bg-background" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {fmt.showZip && (
                            <FormField
                              control={form.control}
                              name="ceremonyZip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{fmt.zipLabel}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={fmt.zipPlaceholder} {...field} data-testid="input-ceremony-zip" className="bg-background" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.guest_count")}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-guests" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.total_budget")}</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          data-testid="input-budget"
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => form.reset({
                    partner1Name: "",
                    partner2Name: "",
                    weddingDate: "",
                    ceremonyTime: "",
                    receptionTime: "",
                    venue: "",
                    location: "",
                    venueCity: "",
                    venueState: "",
                    venueZip: "",
                    venueCountry: "",
                    ceremonyAtVenue: true,
                    ceremonyVenueName: "",
                    ceremonyAddress: "",
                    ceremonyCity: "",
                    ceremonyState: "",
                    ceremonyZip: "",
                    guestCount: 0,
                    totalBudget: 0,
                    preferredLanguage: "English",
                  })}
                  className="px-6"
                  data-testid="btn-reset-profile"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t("profile.reset")}
                  </span>
                </Button>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={saveProfile.isPending}
                  className="px-8 shadow-md"
                  data-testid="btn-save-profile"
                >
                  {saveProfile.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      {t("profile.saving")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {t("profile.save_details")}
                    </span>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  );
}

