import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetProfile, useSaveProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Save, RotateCcw } from "lucide-react";

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
  ceremonyAtVenue: z.boolean().default(true),
  ceremonyVenueName: z.string().optional().default(""),
  ceremonyAddress: z.string().optional().default(""),
  ceremonyCity: z.string().optional().default(""),
  ceremonyState: z.string().optional().default(""),
  ceremonyZip: z.string().optional().default(""),
  guestCount: z.coerce.number().min(1, "Must be at least 1"),
  totalBudget: z.coerce.number().min(1, "Must be at least 1"),
  weddingVibe: z.string().min(1, "Vibe is required"),
  preferredLanguage: z.string().default("English"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
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
      ceremonyAtVenue: true,
      ceremonyVenueName: "",
      ceremonyAddress: "",
      ceremonyCity: "",
      ceremonyState: "",
      ceremonyZip: "",
      guestCount: 100,
      totalBudget: 30000,
      weddingVibe: "Romantic & Elegant",
      preferredLanguage: "English",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        partner1Name: profile.partner1Name,
        partner2Name: profile.partner2Name,
        weddingDate: profile.weddingDate.split('T')[0],
        ceremonyTime: profile.ceremonyTime,
        receptionTime: profile.receptionTime,
        venue: profile.venue,
        location: profile.location,
        venueCity: profile.venueCity ?? "",
        venueState: profile.venueState ?? "",
        venueZip: (profile as any).venueZip ?? "",
        ceremonyAtVenue: (profile as any).ceremonyAtVenue ?? true,
        ceremonyVenueName: (profile as any).ceremonyVenueName ?? "",
        ceremonyAddress: (profile as any).ceremonyAddress ?? "",
        ceremonyCity: (profile as any).ceremonyCity ?? "",
        ceremonyState: (profile as any).ceremonyState ?? "",
        ceremonyZip: (profile as any).ceremonyZip ?? "",
        guestCount: profile.guestCount,
        totalBudget: profile.totalBudget,
        weddingVibe: profile.weddingVibe,
        preferredLanguage: profile.preferredLanguage ?? "English",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: ProfileFormValues) => {
    saveProfile.mutate({ data }, {
      onSuccess: () => {
        toast({
          title: "Profile saved",
          description: "Your wedding details have been updated.",
        });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save profile. Please try again.",
        });
      }
    });
  };

  if (isLoading) {
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
        <h1 className="text-4xl font-serif text-primary">Wedding Profile</h1>
        <p className="text-lg text-muted-foreground mt-2">The foundation of your planning journey.</p>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
          <CardTitle className="font-serif text-2xl text-primary">Your Details</CardTitle>
          <CardDescription>Tell us about your dream day.</CardDescription>
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
                      <FormLabel>Groom's Name</FormLabel>
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
                      <FormLabel>Bride's Name</FormLabel>
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
                      <FormLabel>Wedding Date</FormLabel>
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
                      <FormLabel>Ceremony Time</FormLabel>
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
                      <FormLabel>Reception Time</FormLabel>
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
                    <FormLabel>Venue Name</FormLabel>
                    <FormControl>
                      <Input placeholder="The Historic Magnolia Estate" {...field} data-testid="input-venue" className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Magnolia Lane" {...field} data-testid="input-location" className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="venueCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Charleston" {...field} data-testid="input-venue-city" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="venueState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="SC" {...field} data-testid="input-venue-state" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="venueZip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="29401" {...field} data-testid="input-venue-zip" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        <FormLabel className="cursor-pointer">Check this box if the ceremony won't be held at the venue</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Check this if your ceremony is at a separate location (church, garden, etc.).
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
                          <FormLabel>Ceremony Location Name</FormLabel>
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
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="200 Broad Street" {...field} data-testid="input-ceremony-address" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="ceremonyCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Charleston" {...field} data-testid="input-ceremony-city" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ceremonyState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="SC" {...field} data-testid="input-ceremony-state" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ceremonyZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input placeholder="29401" {...field} data-testid="input-ceremony-zip" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Guest Count</FormLabel>
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
                      <FormLabel>Total Budget</FormLabel>
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

              <FormField
                control={form.control}
                name="weddingVibe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wedding Vibe / Style</FormLabel>
                    <Select
                      key={field.value || "empty"}
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background" data-testid="select-vibe">
                          <SelectValue placeholder="Select a vibe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Romantic & Elegant">Romantic & Elegant</SelectItem>
                        <SelectItem value="Modern & Minimalist">Modern & Minimalist</SelectItem>
                        <SelectItem value="Rustic & Boho">Rustic & Boho</SelectItem>
                        <SelectItem value="Vintage & Classic">Vintage & Classic</SelectItem>
                        <SelectItem value="Glamorous & Luxurious">Glamorous & Luxurious</SelectItem>
                        <SelectItem value="Casual & Intimate">Casual & Intimate</SelectItem>
                        <SelectItem value="Whimsical & Playful">Whimsical & Playful</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    ceremonyAtVenue: true,
                    ceremonyVenueName: "",
                    ceremonyAddress: "",
                    ceremonyCity: "",
                    ceremonyState: "",
                    ceremonyZip: "",
                    guestCount: 0,
                    totalBudget: 0,
                    weddingVibe: "",
                    preferredLanguage: "English",
                  })}
                  className="px-6"
                  data-testid="btn-reset-profile"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Reset
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
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Details
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
