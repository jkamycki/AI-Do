import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import ExcelJS from "exceljs";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetGuests,
  useAddGuest,
  useUpdateGuest,
  useDeleteGuest,
  useAcknowledgeGuest,
  getGetGuestsQueryKey,
  getGetDashboardSummaryQueryKey,
  useGetProfile,
} from "@workspace/api-client-react";
import type { Guest } from "@workspace/api-client-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Plus,
  Search,
  UserCheck,
  UserX,
  Clock,
  Heart,
  Trash2,
  Edit2,
  Download,
  Upload,
  ChevronDown,
  RotateCcw,
  Link2,
  Copy,
  RefreshCw,
  CheckCheck,
  Mail,
  Phone,
  MapPin,
  Send,
  MessageSquare,
  Loader2,
  Sparkles,
  Star,
  X as XIcon,
  AlertTriangle,
} from "lucide-react";
import { InvitationSendModal } from "@/components/GuestList/InvitationSendModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authFetch } from "@/lib/authFetch";
import { useTranslation } from "react-i18next";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { COUNTRIES } from "@/lib/countries";
import { getAddressFormat } from "@/lib/addressFormat";

const RSVP_OPTIONS = [
  {
    value: "attending",
    label: "Attending",
    color:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40",
  },
  {
    value: "declined",
    label: "Declined",
    color:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40",
  },
  {
    value: "maybe",
    label: "Maybe",
    color:
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40",
  },
  {
    value: "pending",
    label: "Pending",
    color:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40",
  },
];

const INVITATION_OPTIONS = [
  {
    value: "pending",
    label: "Not Sent",
    color:
      "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700",
  },
  {
    value: "sent",
    label: "Sent",
    color:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40",
  },
];

// Standard group / category presets so the seating-chart AI and other
// downstream features can group people sensibly. Users can also free-type
// any custom group via the "Other" Input that appears.
const GROUP_OPTIONS = [
  { value: "none", label: "No group" },
  { value: "Bride's Family", label: "Bride's Family" },
  { value: "Bride's Friends", label: "Bride's Friends" },
  { value: "Groom's Family", label: "Groom's Family" },
  { value: "Groom's Friends", label: "Groom's Friends" },
  { value: "Wedding Party", label: "Wedding Party" },
  { value: "Bride's Coworkers", label: "Bride's Coworkers" },
  { value: "Groom's Coworkers", label: "Groom's Coworkers" },
  { value: "Family Friends", label: "Family Friends" },
  { value: "Other", label: "Other (type custom)…" },
];

// Per-group background/text color combos so the badge for each preset is
// instantly recognizable. Custom groups fall through to a neutral slate.
function groupColorClasses(group: string | null | undefined): string {
  switch (group) {
    case "Bride's Family":
      return "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-700";
    case "Bride's Friends":
      return "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-700";
    case "Groom's Family":
      return "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700";
    case "Groom's Friends":
      return "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700";
    case "Wedding Party":
      return "bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-900/40 dark:text-lime-200 dark:border-lime-700";
    case "Bride's Coworkers":
      return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700";
    case "Groom's Coworkers":
      return "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-700";
    case "Family Friends":
      return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700";
    default:
      return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-600";
  }
}

function bookedHotelClasses(guest: Guest): string {
  if ((guest as any).bookedHotelBlockId) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/50";
  }
  if ((guest as any).needsHotel) {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/50";
  }
  return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/50";
}

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "fish", label: "Fish" },
  { value: "beef", label: "Beef" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "kids", label: "Kids Meal" },
  { value: "other", label: "Other" },
];

const WEDDING_PARTY_ROLES = [
  "Bride",
  "Groom",
  "Maid of Honor",
  "Best Man",
  "Bridesmaid",
  "Groomsman",
  "Flower Girl",
  "Ring Bearer",
  "Junior Bridesmaid",
  "Groomslady",
  "Bridesmen",
  "Officiant",
  "Other",
];

const WEDDING_PARTY_SIDES = [
  { value: "bride", label: "Bridal Party" },
  { value: "groom", label: "Groom Side" },
];

interface HotelOption {
  id: number;
  hotelName: string;
}

interface WeddingPartyMemberLite {
  id: number;
  name: string;
  role: string;
  side: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  sortOrder?: number | null;
}

const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  invitationStatus: z.enum(["pending", "sent"]).default("pending"),
  rsvpStatus: z
    .enum(["pending", "attending", "maybe", "declined"])
    .default("pending"),
  mealChoice: z.string().optional(),
  dietaryNotes: z.string().max(500).optional(),
  guestGroup: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
  tableAssignment: z.string().optional(),
  needsHotel: z.boolean().default(false),
  bookedHotelBlockId: z.number().nullable().optional(),
  bookedHotelRoomCount: z.number().min(1).max(2).nullable().optional(),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  aptUnit: z.string().optional().default(""),
  guestCity: z.string().optional().default(""),
  guestState: z.string().optional().default(""),
  guestZip: z.string().optional().default(""),
  guestCountry: z.string().optional().default(""),
  notes: z.string().optional(),
  isWeddingPartyMember: z.boolean().default(false),
  weddingPartyRole: z.string().optional().default("Bridesmaid"),
  weddingPartySide: z.string().optional().default("bride"),
});

type GuestFormValues = z.infer<typeof guestSchema>;

function getGuestApiValues(
  data: GuestFormValues,
): Omit<
  GuestFormValues,
  "isWeddingPartyMember" | "weddingPartyRole" | "weddingPartySide"
> {
  const {
    isWeddingPartyMember: _isWeddingPartyMember,
    weddingPartyRole: _weddingPartyRole,
    weddingPartySide: _weddingPartySide,
    ...guestData
  } = data;
  void _isWeddingPartyMember;
  void _weddingPartyRole;
  void _weddingPartySide;
  return guestData;
}

function getRsvpBadge(status: string) {
  const opt = RSVP_OPTIONS.find((o) => o.value === status);
  // Fall back to "Pending" badge for any legacy/unknown status (e.g. old "sent" rows).
  return opt ?? RSVP_OPTIONS.find((o) => o.value === "pending")!;
}

function GuestForm({
  defaultValues,
  hotels = [],
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<GuestFormValues>;
  hotels?: HotelOption[];
  onSubmit: (data: GuestFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const form = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: "",
      email: "",
      invitationStatus: "pending",
      rsvpStatus: "pending",
      mealChoice: "",
      dietaryNotes: "",
      guestGroup: "",
      plusOne: false,
      plusOneFirstName: "",
      plusOneLastName: "",
      tableAssignment: "",
      needsHotel: false,
      bookedHotelBlockId: null,
      bookedHotelRoomCount: null,
      phone: "",
      address: "",
      aptUnit: "",
      guestCity: "",
      guestState: "",
      guestZip: "",
      guestCountry: "",
      notes: "",
      isWeddingPartyMember: false,
      weddingPartyRole: "Bridesmaid",
      weddingPartySide: "bride",
      ...defaultValues,
    },
  });

  const plusOne = form.watch("plusOne");
  const meal = form.watch("mealChoice");
  const needsHotel = form.watch("needsHotel");
  const bookedHotelBlockId = form.watch("bookedHotelBlockId");
  const isWeddingPartyMember = form.watch("isWeddingPartyMember");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.full_name")} *</FormLabel>
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
                <FormLabel>{t("guests.email_optional")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="jane@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="invitationStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.invitation_status")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INVITATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(`guests.invitation_${o.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rsvpStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.rsvp_status")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {RSVP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(`guests.rsvp_${o.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Group / category — bride's friends, groom's family, etc. Used
            by the seating-chart AI and dashboard breakdowns. Users can
            type any custom value by picking "Other". */}
        <FormField
          control={form.control}
          name="guestGroup"
          render={({ field }) => {
            const presetValues = GROUP_OPTIONS.map((o) => o.value);
            const current = field.value ?? "";
            const isPreset = current === "" || presetValues.includes(current);
            const selectValue =
              current === "" ? "none" : isPreset ? current : "Other";
            return (
              <FormItem>
                <FormLabel>
                  {t("guests.group_label", {
                    defaultValue: "Group / Category",
                  })}
                </FormLabel>
                <Select
                  onValueChange={(v) => {
                    if (v === "none") field.onChange("");
                    else if (v === "Other")
                      field.onChange(
                        current && !presetValues.includes(current)
                          ? current
                          : "",
                      );
                    else field.onChange(v);
                  }}
                  value={selectValue}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("guests.group_placeholder", {
                          defaultValue: "Pick a group",
                        })}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GROUP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectValue === "Other" && (
                  <Input
                    className="mt-2"
                    placeholder={t("guests.group_custom_placeholder", {
                      defaultValue: "Type a custom group name",
                    })}
                    value={isPreset ? "" : current}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mealChoice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.meal_choice")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("guests.select_meal")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("guests.none_selected")}
                    </SelectItem>
                    {MEAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {t(`guests.meal_${o.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tableAssignment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.table_assignment")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("guests.table_placeholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="bookedHotelBlockId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Booked Hotel</FormLabel>
              <Select
                value={field.value ? String(field.value) : needsHotel ? "pending" : "na"}
                onValueChange={(value) => {
                  if (value === "na") {
                    form.setValue("needsHotel", false, { shouldDirty: true });
                    form.setValue("bookedHotelRoomCount", null, { shouldDirty: true });
                    field.onChange(null);
                    return;
                  }
                  if (value === "pending") {
                    form.setValue("needsHotel", true, { shouldDirty: true });
                    form.setValue("bookedHotelRoomCount", null, { shouldDirty: true });
                    field.onChange(null);
                    return;
                  }
                  form.setValue("needsHotel", true, { shouldDirty: true });
                  if (!form.getValues("bookedHotelRoomCount")) {
                    form.setValue("bookedHotelRoomCount", 1, { shouldDirty: true });
                  }
                  field.onChange(Number(value));
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hotel status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="na">N/A</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  {hotels.map((hotel) => (
                    <SelectItem key={hotel.id} value={String(hotel.id)}>
                      {hotel.hotelName || "Unnamed Hotel"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {bookedHotelBlockId && (
          <FormField
            control={form.control}
            name="bookedHotelRoomCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hotel rooms</FormLabel>
                <Select
                  value={field.value ? String(field.value) : "1"}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room count" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 room</SelectItem>
                    <SelectItem value="2">2 rooms</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="isWeddingPartyMember"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3 shadow-sm">
              <FormControl>
                <Checkbox
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel>Wedding party member</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Sync this guest to the Wedding Party tab.
                </p>
              </div>
            </FormItem>
          )}
        />

        {isWeddingPartyMember && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <FormField
              control={form.control}
              name="weddingPartyRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wedding party role</FormLabel>
                  <Select
                    value={field.value || "Bridesmaid"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WEDDING_PARTY_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weddingPartySide"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wedding party side</FormLabel>
                  <Select
                    value={field.value || "bride"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select side" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WEDDING_PARTY_SIDES.map((side) => (
                        <SelectItem key={side.value} value={side.value}>
                          {side.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {meal === "other" && (
          <FormField
            control={form.control}
            name="dietaryNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.dietary_notes")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("guests.dietary_placeholder")}
                    rows={2}
                    maxLength={500}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("guests.phone_label")}</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="(555) 000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestCountry"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>{t("guests.country")}</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={(v) =>
                    field.onChange(v === "__none__" ? "" : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("guests.country_placeholder")}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none__">
                      {t("guests.country_none")}
                    </SelectItem>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>{t("guests.street_address")}</FormLabel>
                <FormControl>
                  <AddressAutocomplete
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onSelect={(s) => {
                      field.onChange(s.street);
                      form.setValue("guestCity", s.city, { shouldDirty: true });
                      form.setValue("guestState", s.state, {
                        shouldDirty: true,
                      });
                      form.setValue("guestZip", s.zip, { shouldDirty: true });
                    }}
                    placeholder="123 Main St"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="aptUnit"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>{t("guests.apt_unit")}</FormLabel>
                <FormControl>
                  <Input placeholder="Apt 4B" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {(() => {
            const fmt = getAddressFormat(form.watch("guestCountry"));
            return (
              <>
                {fmt.showState && (
                  <FormField
                    control={form.control}
                    name="guestState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fmt.stateLabel}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={fmt.statePlaceholder}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="guestCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fmt.cityLabel}</FormLabel>
                      <FormControl>
                        <Input placeholder={fmt.cityPlaceholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fmt.showZip && (
                  <FormField
                    control={form.control}
                    name="guestZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fmt.zipLabel}</FormLabel>
                        <FormControl>
                          <Input placeholder={fmt.zipPlaceholder} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            );
          })()}
        </div>

        <FormField
          control={form.control}
          name="plusOne"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>{t("guests.plus_one")}</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
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
                  <FormLabel>{t("guests.plus_one_first")}</FormLabel>
                  <FormControl>
                    <Input placeholder="Alex" {...field} />
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
                  <FormLabel>{t("guests.plus_one_last")}</FormLabel>
                  <FormControl>
                    <Input placeholder="Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guests.notes_label")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("guests.notes_placeholder")}
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 mt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() =>
              form.reset({
                name: "",
                email: "",
                invitationStatus: "pending",
                rsvpStatus: "pending",
                mealChoice: "",
                guestGroup: "",
                plusOne: false,
                plusOneFirstName: "",
                plusOneLastName: "",
                tableAssignment: "",
                needsHotel: false,
                bookedHotelBlockId: null,
                bookedHotelRoomCount: null,
                phone: "",
                address: "",
                aptUnit: "",
                guestCity: "",
                guestState: "",
                guestZip: "",
                guestCountry: "",
                notes: "",
                isWeddingPartyMember: false,
                weddingPartyRole: "Bridesmaid",
                weddingPartySide: "bride",
              })
            }
          >
            <RotateCcw className="h-4 w-4 mr-2" /> {t("guests.reset")}
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? t("guests.saving") : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function exportCSV(guestList: Guest[], hotels: HotelOption[] = []) {
  const hotelNames = new Map(hotels.map((hotel) => [hotel.id, hotel.hotelName || "Unnamed Hotel"]));
  const headers = [
    "Name",
    "Email",
    "Invitation Sent",
    "RSVP",
    "Meal",
    "Plus One",
    "Plus One Name",
    "Table",
    "Booked Hotel",
    "Hotel Rooms",
    "Street Address",
    "Apt/Unit",
    "City",
    "State",
    "ZIP",
    "Country",
    "Notes",
  ];
  const rows = guestList.map((g) => [
    g.name,
    g.email ?? "",
    g.invitationStatus === "sent" ? "Sent" : "Not Sent",
    g.rsvpStatus,
    g.mealChoice ?? "",
    g.plusOne ? "Yes" : "No",
    g.plusOneName ?? "",
    g.tableAssignment ?? "",
    (g as any).bookedHotelBlockId
      ? hotelNames.get((g as any).bookedHotelBlockId) ?? "Booked"
      : (g as any).needsHotel ? "Pending" : "N/A",
    (g as any).bookedHotelBlockId ? String((g as any).bookedHotelRoomCount || 1) : "",
    (g as any).address ?? "",
    (g as any).aptUnit ?? "",
    (g as any).guestCity ?? "",
    (g as any).guestState ?? "",
    (g as any).guestZip ?? "",
    (g as any).guestCountry ?? "",
    g.notes ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "guest-list.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const GUEST_IMPORT_TEMPLATE_HEADERS = [
  "Full Name",
  "Street Address",
  "Plus One",
  "Plus One Name (Optional)",
  "Category",
];

const GUEST_IMPORT_SAMPLE_ROW = [
  "Jane Doe",
  "123 Rose Garden Lane, Clayton, NC 27520",
  "Yes",
  "John Doe",
  "Bride's Family",
];

const GUEST_IMPORT_PLUS_ONE_OPTIONS = ["Yes", "No"] as const;
const GUEST_IMPORT_CATEGORY_OPTIONS = GROUP_OPTIONS
  .filter((option) => option.value !== "none" && option.value !== "Other")
  .map((option) => option.value);

function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeImportStatus(
  value: unknown,
  allowed: readonly string[],
  fallback: string,
) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!raw) return fallback;
  if (raw === "yes" || raw === "attending") return allowed.includes("attending") ? "attending" : fallback;
  if (raw === "no" || raw === "not_sent" || raw === "notsent") return allowed.includes("pending") ? "pending" : fallback;
  if (raw === "sent") return allowed.includes("sent") ? "sent" : fallback;
  return allowed.includes(raw) ? raw : fallback;
}

function parseImportBoolean(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  return ["yes", "y", "true", "1", "x"].includes(raw);
}

function getImportCell(
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const column = headerMap.get(normalizeImportHeader(alias));
    if (!column) continue;
    const value = row.getCell(column).value;
    if (value && typeof value === "object" && "text" in value) {
      return String((value as { text?: string }).text ?? "").trim();
    }
    if (value && typeof value === "object" && "result" in value) {
      return String((value as { result?: unknown }).result ?? "").trim();
    }
    return String(value ?? "").trim();
  }
  return "";
}

function importRowHasAnyValue(row: ExcelJS.Row) {
  let hasAnyValue = false;
  row.eachCell((cell) => {
    if (String(cell.value ?? "").trim().length > 0) {
      hasAnyValue = true;
    }
  });
  return hasAnyValue;
}

async function downloadGuestImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Guest Import");
  const instructions = workbook.addWorksheet("Instructions");
  const example = workbook.addWorksheet("Example");

  sheet.addRow(GUEST_IMPORT_TEMPLATE_HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3E6B1" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column) => {
    column.width = 26;
  });

  for (let rowNumber = 2; rowNumber <= 500; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= GUEST_IMPORT_TEMPLATE_HEADERS.length; columnNumber += 1) {
      sheet.getCell(rowNumber, columnNumber).protection = { locked: false };
    }
    sheet.getCell(rowNumber, 3).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${GUEST_IMPORT_PLUS_ONE_OPTIONS.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Choose Yes or No",
      error: "Plus One must be Yes or No.",
    };
    sheet.getCell(rowNumber, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${GUEST_IMPORT_CATEGORY_OPTIONS.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Choose a category",
      error: "Choose one of the guest categories from the dropdown.",
    };
  }

  instructions.addRows([
    ["A.IDO Guest Import Template"],
    [""],
    ["Type guest information on the Guest Import tab, starting on row 2."],
    ["Required fields: Full Name and Street Address."],
    ["Plus One must be Yes or No. Plus One Name (Optional) can be left blank."],
    ["Category uses the dropdown choices like Bride's Family, Groom's Family, Wedding Party, Friends, and Other."],
    ["When guests RSVP digitally, their RSVP status and details will update automatically on your guest list."],
  ]);
  instructions.getCell("A1").font = { bold: true, size: 14 };
  instructions.getColumn(1).width = 110;

  example.addRow(GUEST_IMPORT_TEMPLATE_HEADERS);
  example.addRow(GUEST_IMPORT_SAMPLE_ROW);
  example.getRow(1).font = { bold: true };
  example.columns.forEach((column) => {
    column.width = 26;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aido-guest-import-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

async function parseGuestImportWorkbook(file: File) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("No worksheet found in this Excel file.");

  const headerMap = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizeImportHeader(cell.value);
    if (header) headerMap.set(header, columnNumber);
  });

  const guestsToImport: Array<GuestFormValues & { plusOneName?: string }> = [];
  const skipped: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = getImportCell(row, headerMap, ["Full Name", "Name", "Guest Name"]);
    const normalizedName = name.toLowerCase();
    const isInstructionRow =
      normalizedName.startsWith("required:") ||
      normalizedName.startsWith("note:") ||
      normalizedName.startsWith("save this file");
    const hasAnyValue = importRowHasAnyValue(row);
    if (!hasAnyValue || isInstructionRow) return;
    if (!name) {
      skipped.push(`Row ${rowNumber}: missing Full Name`);
      return;
    }
    const address = getImportCell(row, headerMap, ["Street Address", "Address"]);
    if (!address) {
      skipped.push(`Row ${rowNumber}: missing Street Address`);
      return;
    }

    const plusOneName = getImportCell(row, headerMap, ["Plus One Name (Optional)", "Plus One Name", "Plus 1 Name", "Guest Plus One"]);
    guestsToImport.push({
      name,
      email: getImportCell(row, headerMap, ["Email", "Email Address"]),
      phone: getImportCell(row, headerMap, ["Phone", "Phone Number", "Mobile"]),
      rsvpStatus: normalizeImportStatus(
        getImportCell(row, headerMap, ["RSVP Status", "RSVP"]),
        ["pending", "attending", "maybe", "declined"],
        "pending",
      ) as GuestFormValues["rsvpStatus"],
      invitationStatus: normalizeImportStatus(
        getImportCell(row, headerMap, ["Invitation Status", "Invite Status", "Invitation Sent"]),
        ["pending", "sent"],
        "pending",
      ) as GuestFormValues["invitationStatus"],
      mealChoice: getImportCell(row, headerMap, ["Meal Choice", "Meal"]),
      dietaryNotes: getImportCell(row, headerMap, ["Dietary Notes", "Dietary Restrictions", "Allergies"]),
      guestGroup: getImportCell(row, headerMap, ["Category", "Guest Group", "Group"]),
      plusOne: parseImportBoolean(getImportCell(row, headerMap, ["Plus One", "Plus 1", "PlusOne"])),
      plusOneFirstName: "",
      plusOneLastName: "",
      plusOneName,
      tableAssignment: getImportCell(row, headerMap, ["Table", "Table Assignment"]),
      needsHotel: parseImportBoolean(getImportCell(row, headerMap, ["Needs Hotel", "Hotel Needed"])),
      bookedHotelBlockId: null,
      address,
      aptUnit: getImportCell(row, headerMap, ["Apt/Unit", "Apartment", "Unit", "Apt"]),
      guestCity: getImportCell(row, headerMap, ["City", "Town"]),
      guestState: getImportCell(row, headerMap, ["State", "Province"]),
      guestZip: getImportCell(row, headerMap, ["ZIP", "Zip Code", "Postal Code"]),
      guestCountry: getImportCell(row, headerMap, ["Country"]),
      notes: getImportCell(row, headerMap, ["Notes", "Note"]),
    });
  });

  return { guestsToImport, skipped };
}

function GuestCollectorCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: profile } = useGetProfile();

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const formUrl = token
    ? `${window.location.origin}${base}/collect/${token}`
    : null;
  const collectorUrl = token
    ? `${window.location.origin}/api/guest-collect/${token}/preview`
    : null;

  const coupleNames = profile
    ? `${profile.partner2Name ?? "Bride"} & ${profile.partner1Name ?? "Groom"}`
    : "Your names";

  const generate = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/guest-collect/generate", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate link");
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => setToken(data.token),
    onError: () =>
      toast({
        title: t("guests.error"),
        description: t("guests.could_not_generate"),
        variant: "destructive",
      }),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/guest-collect/regenerate", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to regenerate link");
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => {
      setToken(data.token);
      toast({
        title: t("guests.new_link_generated"),
        description: t("guests.old_link_inactive"),
      });
    },
    onError: () =>
      toast({
        title: t("guests.error"),
        description: t("guests.could_not_regenerate"),
        variant: "destructive",
      }),
  });

  const copyLink = () => {
    if (!collectorUrl) return;
    navigator.clipboard.writeText(collectorUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const smsSeparator =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
      ? "&"
      : "?";
  const smsShareHref = collectorUrl
    ? `sms:${smsSeparator}body=${encodeURIComponent(collectorUrl)}`
    : undefined;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="h-4 w-4 text-primary" />
          {t("guests.collector_title")}
        </CardTitle>
        <CardDescription>{t("guests.collector_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />{" "}
                {t("guests.generating")}
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" /> {t("guests.generate_link")}
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Link display + copy */}
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={collectorUrl ?? ""}
                className="text-xs font-mono bg-background/50 border-primary/20 text-primary"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                className="shrink-0 border-primary/20 hover:bg-primary/10"
                title={t("guests.copy_link_title")}
              >
                {copied ? (
                  <CheckCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Link preview — shows guests what they'll see before clicking */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">
                {t("guests.link_preview_label")}
              </p>
              <div className="rounded-xl border border-primary/20 bg-background/60 overflow-hidden shadow-sm">
                <div
                  className="h-1 w-full"
                  style={{
                    background: "linear-gradient(90deg, #E91E8C, #7B2FBE)",
                  }}
                />
                <div className="flex items-start gap-3 p-3">
                  <div className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center bg-primary/15 ring-1 ring-primary/30">
                    <Heart className="h-5 w-5 fill-primary text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5 text-primary">
                      {t("guests.contact_info_request")}
                    </p>
                    <p
                      className="text-sm font-bold text-foreground leading-tight truncate"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {coupleNames}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("guests.collecting_addresses")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">
                      {formUrl}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex flex-wrap gap-2">
              {smsShareHref && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="sm:hidden border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  <a href={smsShareHref}>
                    <MessageSquare className="h-3.5 w-3.5" /> Text guest
                  </a>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="border-primary/20 hover:bg-primary/10 text-primary gap-2"
                onClick={() => {
                  const subject = encodeURIComponent(
                    t("guests.email_subject_line") ||
                      "Please share your contact info with us!",
                  );
                  const body = encodeURIComponent(
                    `Hi!\n\nWe'd love to have your contact details for our wedding guest list. Please take a moment to fill out this quick form below:\n\n${collectorUrl}\n\nThank you!`,
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
              >
                <Mail className="h-3.5 w-3.5" /> {t("guests.email_link")}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-primary gap-1 ml-auto"
                  >
                    <RefreshCw className="h-3 w-3" /> {t("guests.regenerate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("guests.regenerate_title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("guests.regenerate_desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("guests.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => regenerate.mutate()}
                    >
                      {t("guests.yes_regenerate")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("guests.link_auto_appears")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Guests({
  sendDefaultInvitation = "saveTheDate",
}: {
  sendDefaultInvitation?: "saveTheDate" | "digitalInvitation";
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportingGuests, setIsImportingGuests] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    added: number;
    skipped: string[];
    error?: string;
  } | null>(null);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);

  const [duplicateGuestIds, setDuplicateGuestIds] = useState<Set<number>>(
    new Set(),
  );
  const [pendingGuestData, setPendingGuestData] =
    useState<GuestFormValues | null>(null);

  const [sendModalGuest, setSendModalGuest] = useState<Guest | null>(null);
  const [sendModalDefaultTab, setSendModalDefaultTab] = useState<
    "saveTheDate" | "digitalInvitation"
  >(sendDefaultInvitation);
  const [sendModalReminderOnly, setSendModalReminderOnly] = useState(false);
  const [bulkPreviewMode, setBulkPreviewMode] = useState<null | "saveTheDate" | "invitation">(null);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<number>>(new Set());
  const initializedGuestSelectionRef = useRef(false);

  const { data: weddingProfile, isLoading: profileLoading } = useGetProfile();
  const { data, isLoading, isError } = useGetGuests();
  const { data: hotels = [] } = useQuery<HotelOption[]>({
    queryKey: ["hotels"],
    queryFn: async () => {
      const res = await authFetch("/api/hotels");
      if (!res.ok) throw new Error("Failed to load hotels");
      return res.json();
    },
  });
  const { data: weddingPartyMembers = [] } = useQuery<WeddingPartyMemberLite[]>(
    {
      queryKey: ["wedding-party"],
      queryFn: async () => {
        const res = await authFetch("/api/wedding-party");
        if (!res.ok) return [];
        return res.json();
      },
    },
  );
  const addGuest = useAddGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const acknowledgeGuest = useAcknowledgeGuest();

  useEffect(() => {
    setSendModalDefaultTab(sendDefaultInvitation);
  }, [sendDefaultInvitation]);

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
    }, 15000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const sendSaveTheDate = useMutation({
    mutationFn: async (guestId: number) => {
      const res = await authFetch(`/api/guests/${guestId}/send-save-the-date`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(
          err.details ?? err.error ?? "Failed to send save-the-date",
        );
      }
      return res.json();
    },
    onSuccess: (
      data: {
        emailSent?: boolean;
        saveTheDateUrl?: string;
        previewUrl?: string;
      },
      guestId,
    ) => {
      optimisticUpdate(guestId, { saveTheDateStatus: "sent" } as any);
      invalidate();
      setSendModalGuest(null);
      if (data?.emailSent) {
        toast({
          title: "Save the Date sent!",
          description: "Email delivered to guest.",
        });
      } else {
        toast({
          title: "Save the Date marked as sent.",
          description: "No email on file — status updated.",
        });
      }
    },
    onError: (err) =>
      toast({
        title: "Failed to send Save the Date",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const sendRsvpReminder = useMutation({
    mutationFn: async (guestId: number) => {
      const res = await authFetch(`/api/guests/${guestId}/send-rsvp-reminder`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(
          err.details ?? err.error ?? "Failed to send RSVP reminder",
        );
      }
      return res.json() as Promise<{ rsvpUrl: string; emailSent: boolean }>;
    },
    onSuccess: (data: {
      rsvpUrl: string;
      previewUrl?: string;
      emailSent: boolean;
    }) => {
      invalidate();
      setSendModalGuest(null);
      if (data?.emailSent) {
        toast({
          title: "Reminder sent",
          description: "RSVP reminder email delivered.",
        });
      } else {
        toast({
          title: "No email on file",
          description: "Use the guest row's text-message button to share the RSVP link.",
        });
      }
    },
    onError: (err) =>
      toast({
        title: "Failed to send reminder",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const sendRsvp = useMutation({
    mutationFn: async (guestId: number) => {
      const res = await authFetch(`/api/guests/${guestId}/send-rsvp`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(err.details ?? err.error ?? "Failed to send RSVP");
      }
      return res.json() as Promise<{ rsvpUrl: string; emailSent: boolean }>;
    },
    onSuccess: (data, guestId) => {
      // Track "sent" on invitationStatus, not rsvpStatus — rsvpStatus is reserved
      // for the guest's actual response (attending / maybe / declined / pending).
      optimisticUpdate(guestId, { invitationStatus: "sent" });
      invalidate();
      setSendModalGuest(null);
      if (data.emailSent) {
        toast({
          title: "RSVP Invitation sent!",
          description: "Email delivered to guest.",
        });
      } else {
        toast({
          title: "RSVP Invitation marked as sent.",
          description: "No email on file — status updated.",
        });
      }
    },
    onError: (err) =>
      toast({
        title: "Failed to send RSVP Invitation",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const sendReminder = useMutation({
    mutationFn: async (guestId: number) => {
      const res = await authFetch(
        `/api/guests/${guestId}/send-rsvp?reminder=true`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(err.details ?? err.error ?? "Failed to send reminder");
      }
      return res.json() as Promise<{ rsvpUrl: string; emailSent: boolean }>;
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        toast({
          title: "Reminder sent!",
          description: "RSVP reminder email delivered.",
        });
      } else {
        toast({
          title: "No email on file",
          description: "Guest has no email address to send the reminder to.",
        });
      }
    },
    onError: (err) =>
      toast({
        title: "Failed to send reminder",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingSaveTheDates, setSendingSaveTheDates] = useState(false);
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [bulkLinksMode, setBulkLinksMode] = useState<
    null | "saveTheDate" | "invitation" | "reminder"
  >(null);
  const [bulkMobileChoiceMode, setBulkMobileChoiceMode] = useState<
    null | "saveTheDate" | "invitation" | "reminder"
  >(null);
  const [bulkShareIntent, setBulkShareIntent] = useState<"copy" | "text">("copy");
  const [bulkLinksLoading, setBulkLinksLoading] = useState(false);
  const [bulkLinks, setBulkLinks] = useState<
    Array<{ guestId: number; name: string; phone?: string | null; url: string }>
  >([]);
  const [confirmBulkSend, setConfirmBulkSend] = useState<
    null | "saveTheDate" | "invitation" | "reminder"
  >(null);

  const handleSendAllReminders = async (targetGuests = reminderEligible) => {
    if (!targetGuests.length) return;
    setSendingReminders(true);
    let sent = 0;
    for (const g of targetGuests) {
      try {
        const res = await authFetch(
          `/api/guests/${g.id}/send-rsvp?reminder=true`,
          { method: "POST" },
        );
        if (res.ok) sent++;
      } catch {
        /* continue */
      }
    }
    setSendingReminders(false);
    invalidate();
    toast({
      title: `Reminders sent`,
      description: `${sent} of ${targetGuests.length} reminder email${targetGuests.length !== 1 ? "s" : ""} delivered.`,
    });
  };

  const handleSendAllSaveTheDates = async (targetGuests = saveTheDateEligible) => {
    if (!targetGuests.length) return;
    setSendingSaveTheDates(true);
    let sent = 0;
    for (const g of targetGuests) {
      try {
        const res = await authFetch(`/api/guests/${g.id}/send-save-the-date`, {
          method: "POST",
        });
        if (res.ok) sent++;
      } catch {
        /* continue */
      }
    }
    setSendingSaveTheDates(false);
    invalidate();
    toast({
      title: "Save-the-Dates sent",
      description: `${sent} of ${targetGuests.length} save-the-date${targetGuests.length !== 1 ? "s" : ""} sent.`,
    });
  };

  const handleSendAllInvitations = async (targetGuests = invitationEligible) => {
    if (!targetGuests.length) return;
    setSendingInvitations(true);
    let sent = 0;
    for (const g of targetGuests) {
      try {
        const res = await authFetch(`/api/guests/${g.id}/send-rsvp`, {
          method: "POST",
        });
        if (res.ok) sent++;
      } catch {
        /* continue */
      }
    }
    setSendingInvitations(false);
    invalidate();
    toast({
      title: "RSVP Invitations sent",
      description: `${sent} of ${targetGuests.length} RSVP invitation${targetGuests.length !== 1 ? "s" : ""} sent.`,
    });
  };

  const allGuests = (data?.guests ?? []) as Guest[];
  const { data: invitationShareLinks } = useQuery({
    queryKey: ["invitation-share-links"],
    queryFn: async () => {
      const res = await authFetch("/api/invitation-shares/links");
      if (!res.ok) throw new Error("Failed to load shared invitation links");
      return res.json() as Promise<{
        rsvpUrl: string;
        reminderUrl: string;
        saveTheDateUrl: string;
      }>;
    },
    retry: false,
  });
  const saveTheDateEligible = allGuests.filter(
    (g) => ((g as any).saveTheDateStatus ?? "not_sent") === "not_sent",
  );
  const invitationEligible = allGuests.filter(
    (g) => (g.invitationStatus ?? "pending") === "pending",
  );
  const reminderEligible = allGuests.filter(
    (g) =>
      g.invitationStatus === "sent" &&
      g.rsvpStatus === "pending" &&
      ((g as any).rsvpReminderStatus ?? "not_sent") !== "sent",
  );
  useEffect(() => {
    setSelectedGuestIds((current) => {
      const liveIds = new Set(allGuests.map((guest) => guest.id));
      const next = new Set<number>();
      for (const id of current) {
        if (liveIds.has(id)) next.add(id);
      }
      if (!initializedGuestSelectionRef.current && allGuests.length > 0) {
        initializedGuestSelectionRef.current = true;
        return new Set(allGuests.map((guest) => guest.id));
      }
      return next;
    });
  }, [allGuests]);
  const selectedSaveTheDateEligible = saveTheDateEligible.filter((guest) => selectedGuestIds.has(guest.id));
  const selectedInvitationEligible = invitationEligible.filter((guest) => selectedGuestIds.has(guest.id));
  const selectedReminderEligible = reminderEligible.filter((guest) => selectedGuestIds.has(guest.id));
  const selectedGuests = allGuests.filter((guest) => selectedGuestIds.has(guest.id));
  const readyBulkButtonClass =
    "h-12 w-full justify-between gap-4 whitespace-nowrap bg-primary px-4 text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground";
  const readyBulkBadgeClass = "bg-white/20 text-white border-white/30";
  const toggleGuestSelected = (guestId: number, checked: boolean) => {
    setSelectedGuestIds((current) => {
      const next = new Set(current);
      if (checked) next.add(guestId);
      else next.delete(guestId);
      return next;
    });
  };
  const openBulkPreview = (mode: "saveTheDate" | "invitation") => {
    const targetGuests = mode === "saveTheDate" ? selectedSaveTheDateEligible : selectedInvitationEligible;
    if (!targetGuests.length) {
      toast({
        title: "No selected guests ready",
        description: mode === "saveTheDate"
          ? "Select at least one guest who has not received a save-the-date yet."
          : "Select at least one guest who has not received an RSVP invitation yet.",
      });
      return;
    }
    setBulkPreviewMode(mode);
    setSendModalDefaultTab(mode === "saveTheDate" ? "saveTheDate" : "digitalInvitation");
    setSendModalReminderOnly(false);
    setSendModalGuest(targetGuests[0]);
  };
  const getBulkLinkGuests = (mode: "saveTheDate" | "invitation" | "reminder") =>
    mode === "saveTheDate"
      ? selectedSaveTheDateEligible
      : mode === "invitation"
        ? selectedInvitationEligible
        : selectedReminderEligible;
  const hasGuestsForBulkSend = (mode: "saveTheDate" | "invitation" | "reminder") =>
    getBulkLinkGuests(mode).length > 0;
  const getBulkLinksTitle = (mode: "saveTheDate" | "invitation" | "reminder") =>
    mode === "saveTheDate"
      ? "Shared Save-the-Date Link"
      : mode === "invitation"
        ? "Shared RSVP Invitation Link"
        : "Shared RSVP Reminder Link";
  const getBulkLinksDescription = (mode: "saveTheDate" | "invitation" | "reminder") =>
    mode === "saveTheDate"
      ? "One save-the-date link can be sent to any guest."
      : mode === "invitation"
        ? "One RSVP link lets guests find their name and reply."
        : "One reminder link lets guests find their name and reply.";
  const getBulkShareTitle = (mode: "saveTheDate" | "invitation" | "reminder" | null) =>
    mode === "saveTheDate"
      ? "Share Save-the-Date"
      : mode === "invitation"
        ? "Share RSVP Invitation"
        : mode === "reminder"
          ? "Share RSVP Reminder"
          : "Share Link";
  const getCoupleName = () => {
    const profile = weddingProfile as
      | { partner1Name?: string | null; partner2Name?: string | null }
      | null
      | undefined;
    return [profile?.partner2Name, profile?.partner1Name]
      .filter(Boolean)
      .join(" & ");
  };
  const buildBulkTextMessage = (
    mode: "saveTheDate" | "invitation" | "reminder",
    url: string,
  ) => {
    const couple = getCoupleName();
    const couplePart = couple ? `${couple}'s wedding` : "our wedding";
    if (mode === "saveTheDate") {
      return `Save the date for ${couplePart}! View it here: ${url}`;
    }
    if (mode === "reminder") {
      return `Quick reminder to RSVP for ${couplePart}. Please enter your name exactly as it appears on your invitation: ${url}`;
    }
    return `You're invited to ${couplePart}. Please RSVP here and enter your name exactly as it appears on your invitation: ${url}`;
  };
  const buildSmsHref = (phone: string, message: string) => {
    const isAppleDevice =
      typeof navigator !== "undefined" &&
      /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
    if (!phone) return `sms:?body=${encodeURIComponent(message)}`;
    const separator = isAppleDevice ? "&" : "?";
    return `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
  };
  const isMobileViewport = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches;
  const handleBulkPrimaryAction = (mode: "saveTheDate" | "invitation" | "reminder") => {
    if (isMobileViewport()) {
      if (!hasGuestsForBulkSend(mode)) {
        toast({
          title: "No selected guests ready",
          description:
            mode === "saveTheDate"
              ? "Select at least one guest who has not received a save-the-date yet."
              : mode === "invitation"
                ? "Select at least one guest who has not received an RSVP invitation yet."
                : "Select at least one guest who still needs an RSVP reminder.",
        });
        return;
      }
      setBulkMobileChoiceMode(mode);
      return;
    }

    if (mode === "saveTheDate") openBulkPreview("saveTheDate");
    if (mode === "invitation") openBulkPreview("invitation");
    if (mode === "reminder") setConfirmBulkSend("reminder");
  };
  const openBulkLinks = async (
    mode: "saveTheDate" | "invitation" | "reminder",
    intent: "copy" | "text" = "copy",
  ) => {
    setBulkShareIntent(intent);
    setBulkLinksMode(mode);
    setBulkLinks([]);
    setBulkLinksLoading(true);
    try {
      if (!invitationShareLinks) {
        throw new Error("Shared invitation links are still loading. Please try again.");
      }
      const url =
        mode === "saveTheDate"
          ? invitationShareLinks.saveTheDateUrl
          : mode === "reminder"
            ? invitationShareLinks.reminderUrl
            : invitationShareLinks.rsvpUrl;
      setBulkLinks([{ guestId: 0, name: "Shared guest link", url }]);
    } catch (err) {
      toast({
        title: "Could not create shared link",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      setBulkLinksMode(null);
    } finally {
      setBulkLinksLoading(false);
    }
  };
  const copyBulkLinks = async () => {
    if (!bulkLinks.length) return;
    const text = bulkLinks[0].url;
    await navigator.clipboard.writeText(text);
    toast({
      title: "Shared link copied",
      description: "Paste this one link anywhere you want guests to open it.",
    });
  };
  const bulkSendGuests =
    confirmBulkSend === "saveTheDate"
      ? selectedSaveTheDateEligible
      : confirmBulkSend === "invitation"
        ? selectedInvitationEligible
        : confirmBulkSend === "reminder"
          ? selectedReminderEligible
          : [];
  const summary = data?.summary ?? {
    total: 0,
    attending: 0,
    declined: 0,
    pending: 0,
    plusOnes: 0,
  };

  const collectorNewGuests = allGuests.filter(
    (g) => (g as any).source === "self_collect" && !(g as any).acknowledgedAt,
  );
  const rsvpReviewGuests = allGuests.filter(
    (g) => (g as any).source === "rsvp_self_add" && !(g as any).acknowledgedAt,
  );
  const newGuests = [...collectorNewGuests, ...rsvpReviewGuests];
  const newGuestIds = new Set(newGuests.map((g) => g.id));

  const handleAcknowledge = (guestId: number) => {
    if (!newGuestIds.has(guestId)) return;
    queryClient.setQueryData(getGetGuestsQueryKey(), (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        guests: old.guests.map((g: Guest) =>
          g.id === guestId
            ? ({ ...g, acknowledgedAt: new Date().toISOString() } as Guest)
            : g,
        ),
      };
    });
    acknowledgeGuest.mutate(
      { id: guestId },
      {
        onError: () =>
          queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() }),
      },
    );
  };

  const handleAcknowledgeMany = (ids: number[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    queryClient.setQueryData(getGetGuestsQueryKey(), (old: typeof data) => {
      if (!old) return old;
      const now = new Date().toISOString();
      return {
        ...old,
        guests: old.guests.map((g: Guest) =>
          idSet.has(g.id) ? ({ ...g, acknowledgedAt: now } as Guest) : g,
        ),
      };
    });
    ids.forEach((id) => {
      acknowledgeGuest.mutate(
        { id },
        {
          onError: () =>
            queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() }),
        },
      );
    });
  };

  const filtered = allGuests
    .filter((g) => {
      const matchesSearch =
        !search ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.email ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesRsvp = rsvpFilter === "all" || g.rsvpStatus === rsvpFilter;
      return matchesSearch && matchesRsvp;
    })
    .slice()
    .sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      }),
    );
  const setAllFilteredSelected = (checked: boolean) => {
    setSelectedGuestIds((current) => {
      const next = new Set(current);
      for (const guest of filtered) {
        if (checked) next.add(guest.id);
        else next.delete(guest.id);
      }
      return next;
    });
  };
  const filteredSelectedCount = filtered.filter((guest) => selectedGuestIds.has(guest.id)).length;
  const allFilteredSelected = filtered.length > 0 && filteredSelectedCount === filtered.length;
  const someFilteredSelected = filteredSelectedCount > 0 && !allFilteredSelected;

  const queryKey = getGetGuestsQueryKey();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({
      queryKey: getGetDashboardSummaryQueryKey(),
    });
  };

  function findWeddingPartyMemberForGuest(
    guest: { name?: string | null; email?: string | null },
    members = weddingPartyMembers,
  ) {
    const name = (guest.name ?? "").trim().toLowerCase();
    const email = (guest.email ?? "").trim().toLowerCase();
    return members.find((member) => {
      const memberEmail = (member.email ?? "").trim().toLowerCase();
      const memberName = (member.name ?? "").trim().toLowerCase();
      return (email && memberEmail === email) || (!!name && memberName === name);
    });
  }

  async function syncGuestToWeddingParty(
    data: GuestFormValues,
    previousMember?: WeddingPartyMemberLite,
  ) {
    if (!data.isWeddingPartyMember) {
      if (!previousMember) return;
      const deleteRes = await authFetch(`/api/wedding-party/${previousMember.id}`, {
        method: "DELETE",
      });
      if (!deleteRes.ok) {
        throw new Error("Failed to remove wedding party member");
      }
      queryClient.invalidateQueries({ queryKey: ["wedding-party"] });
      return;
    }

    const name = data.name.trim();
    if (!name) return;

    const res = await authFetch("/api/wedding-party");
    if (!res.ok) throw new Error("Failed to load wedding party");

    const members = (await res.json()) as WeddingPartyMemberLite[];
    const existing =
      previousMember ??
      findWeddingPartyMemberForGuest({ name, email: data.email ?? "" }, members);
    const payload = {
      name,
      role: data.weddingPartyRole || "Bridesmaid",
      side: data.weddingPartySide || "bride",
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      notes: existing?.notes ?? null,
      sortOrder: existing?.sortOrder ?? 0,
    };

    const saveRes = await authFetch(
      existing ? `/api/wedding-party/${existing.id}` : "/api/wedding-party",
      {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!saveRes.ok) throw new Error("Failed to sync wedding party member");

    queryClient.invalidateQueries({ queryKey: ["wedding-party"] });
  }

  function optimisticUpdate(guestId: number, patch: Partial<Guest>) {
    queryClient.setQueryData(queryKey, (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        guests: old.guests.map((g: Guest) =>
          g.id === guestId ? { ...g, ...patch } : g,
        ),
      };
    });
  }

  function handleGroupChange(guest: Guest, raw: string) {
    // "none" comes from the Select sentinel for "remove this guest's group".
    const next = raw === "none" || raw === "" ? null : raw;
    optimisticUpdate(guest.id, { guestGroup: next });
    updateGuest.mutate(
      {
        id: guest.id,
        data: {
          name: guest.name,
          email: guest.email ?? undefined,
          invitationStatus: guest.invitationStatus ?? "pending",
          rsvpStatus: (guest.rsvpStatus ?? "pending") as
            | "pending"
            | "attending"
            | "maybe"
            | "declined",
          mealChoice: guest.mealChoice ?? undefined,
          guestGroup: next ?? undefined,
          plusOne: guest.plusOne,
          plusOneName: guest.plusOneName ?? undefined,
          tableAssignment: guest.tableAssignment ?? undefined,
          notes: guest.notes ?? undefined,
        },
      },
      {
        onSuccess: () => invalidate(),
        onError: () => {
          optimisticUpdate(guest.id, { guestGroup: guest.guestGroup });
          toast({ title: "Failed to update group", variant: "destructive" });
        },
      },
    );
  }

  function handleBookedHotelChange(guest: Guest, raw: string) {
    const prevNeedsHotel = !!(guest as any).needsHotel;
    const prevHotelId = (guest as any).bookedHotelBlockId ?? null;
    const prevRoomCount = (guest as any).bookedHotelRoomCount ?? null;
    const next =
      raw === "na"
        ? { needsHotel: false, bookedHotelBlockId: null, bookedHotelRoomCount: null }
        : raw === "pending"
          ? { needsHotel: true, bookedHotelBlockId: null, bookedHotelRoomCount: null }
          : { needsHotel: true, bookedHotelBlockId: Number(raw), bookedHotelRoomCount: (guest as any).bookedHotelRoomCount || 1 };

    optimisticUpdate(guest.id, next as Partial<Guest>);
    updateGuest.mutate(
      {
        id: guest.id,
        data: next as Parameters<typeof updateGuest.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          invalidate();
          queryClient.invalidateQueries({ queryKey: ["hotels"] });
        },
        onError: () => {
          optimisticUpdate(guest.id, {
            needsHotel: prevNeedsHotel,
            bookedHotelBlockId: prevHotelId,
            bookedHotelRoomCount: prevRoomCount,
          } as Partial<Guest>);
          toast({ title: "Failed to update booked hotel", variant: "destructive" });
        },
      },
    );
  }

  function handleBookedHotelRoomCountChange(guest: Guest, raw: string) {
    const nextRoomCount = raw === "2" ? 2 : 1;
    const prevRoomCount = (guest as any).bookedHotelRoomCount ?? null;
    optimisticUpdate(guest.id, { bookedHotelRoomCount: nextRoomCount } as Partial<Guest>);
    updateGuest.mutate(
      {
        id: guest.id,
        data: { bookedHotelRoomCount: nextRoomCount } as Parameters<typeof updateGuest.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          invalidate();
          queryClient.invalidateQueries({ queryKey: ["hotels"] });
        },
        onError: () => {
          optimisticUpdate(guest.id, { bookedHotelRoomCount: prevRoomCount } as Partial<Guest>);
          toast({ title: "Failed to update hotel room count", variant: "destructive" });
        },
      },
    );
  }

  function handleRsvpChange(guest: Guest, newStatus: string) {
    optimisticUpdate(guest.id, { rsvpStatus: newStatus });
    updateGuest.mutate(
      {
        id: guest.id,
        data: {
          name: guest.name,
          email: guest.email ?? undefined,
          invitationStatus: guest.invitationStatus ?? "pending",
          rsvpStatus: newStatus as
            | "pending"
            | "attending"
            | "maybe"
            | "declined",
          mealChoice: guest.mealChoice ?? undefined,
          guestGroup: guest.guestGroup ?? undefined,
          plusOne: guest.plusOne,
          plusOneName: guest.plusOneName ?? undefined,
          tableAssignment: guest.tableAssignment ?? undefined,
          notes: guest.notes ?? undefined,
        },
      },
      {
        onSuccess: () => invalidate(),
        onError: () => {
          optimisticUpdate(guest.id, { rsvpStatus: guest.rsvpStatus });
          toast({ title: "Failed to update RSVP", variant: "destructive" });
        },
      },
    );
  }

  function handleInvitationChange(guest: Guest, newStatus: string) {
    optimisticUpdate(guest.id, { invitationStatus: newStatus });
    updateGuest.mutate(
      {
        id: guest.id,
        data: {
          name: guest.name,
          email: guest.email ?? undefined,
          invitationStatus: newStatus,
          rsvpStatus: guest.rsvpStatus as
            | "pending"
            | "attending"
            | "maybe"
            | "declined",
          mealChoice: guest.mealChoice ?? undefined,
          guestGroup: guest.guestGroup ?? undefined,
          plusOne: guest.plusOne,
          plusOneName: guest.plusOneName ?? undefined,
          tableAssignment: guest.tableAssignment ?? undefined,
          notes: guest.notes ?? undefined,
        },
      },
      {
        onSuccess: () => invalidate(),
        onError: () => {
          optimisticUpdate(guest.id, {
            invitationStatus: guest.invitationStatus ?? "pending",
          });
          toast({
            title: "Failed to update invitation status",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleSaveDateChange(guest: Guest, newStatus: string) {
    const prev = (guest as any).saveTheDateStatus ?? "not_sent";
    optimisticUpdate(guest.id, { saveTheDateStatus: newStatus } as any);
    authFetch(`/api/guests/${guest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveTheDateStatus: newStatus }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        invalidate();
      })
      .catch(() => {
        optimisticUpdate(guest.id, { saveTheDateStatus: prev } as any);
        toast({
          title: "Failed to update save-the-date status",
          variant: "destructive",
        });
      });
  }

  function handleReminderChange(guest: Guest, newStatus: string) {
    const prev = (guest as any).rsvpReminderStatus ?? "not_sent";
    optimisticUpdate(guest.id, { rsvpReminderStatus: newStatus } as any);
    authFetch(`/api/guests/${guest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvpReminderStatus: newStatus }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        invalidate();
      })
      .catch(() => {
        optimisticUpdate(guest.id, { rsvpReminderStatus: prev } as any);
        toast({
          title: "Failed to update reminder status",
          variant: "destructive",
        });
      });
  }

  function handleMealChange(guest: Guest, newMeal: string) {
    const val = newMeal === "none" ? null : newMeal;
    optimisticUpdate(guest.id, { mealChoice: val });
    updateGuest.mutate(
      {
        id: guest.id,
        data: {
          name: guest.name,
          email: guest.email ?? undefined,
          invitationStatus: guest.invitationStatus ?? "pending",
          rsvpStatus: guest.rsvpStatus as
            | "pending"
            | "attending"
            | "maybe"
            | "declined",
          // Send empty string when clearing — the server converts "" -> NULL.
          // Sending `undefined` would be dropped by JSON.stringify and the
          // server's `if (mealChoice !== undefined)` guard would skip the update.
          mealChoice: val ?? "",
          guestGroup: guest.guestGroup ?? undefined,
          plusOne: guest.plusOne,
          plusOneName: guest.plusOneName ?? undefined,
          tableAssignment: guest.tableAssignment ?? undefined,
          notes: guest.notes ?? undefined,
        },
      },
      {
        onSuccess: () => invalidate(),
        onError: () => {
          optimisticUpdate(guest.id, { mealChoice: guest.mealChoice });
          toast({
            title: "Failed to update meal choice",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleAdd(data: GuestFormValues) {
    const guestData = getGuestApiValues(data);
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()]
          .filter(Boolean)
          .join(" ") || undefined
      : undefined;
    addGuest.mutate(
      {
        data: {
          ...guestData,
          plusOneName,
          email: data.email || undefined,
          mealChoice:
            data.mealChoice === "none"
              ? undefined
              : data.mealChoice || undefined,
          guestGroup:
            data.guestGroup === "none"
              ? undefined
              : data.guestGroup || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Guest added" });
          setIsAdding(false);
          setDuplicateGuestIds(new Set());
          invalidate();
          void syncGuestToWeddingParty(data).catch(() => {
            toast({
              title: "Guest added, but wedding party sync failed",
              variant: "destructive",
            });
          });
        },
        onError: (err: unknown) => {
          const status = (err as { status?: number })?.status;
          if (status === 409) {
            const ids =
              (err as { data?: { duplicateIds?: number[] } })?.data
                ?.duplicateIds ?? [];
            setDuplicateGuestIds(new Set(ids));
            setPendingGuestData(data);
            setIsAdding(false);
          } else {
            toast({
              title:
                status === 401
                  ? "Session refreshing — try again in a moment"
                  : "Failed to add guest",
              variant: "destructive",
            });
          }
        },
      },
    );
  }

  async function handleForceAdd() {
    if (!pendingGuestData) return;
    const data = pendingGuestData;
    const guestData = getGuestApiValues(data);
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()]
          .filter(Boolean)
          .join(" ") || undefined
      : undefined;
    const payload = {
      ...guestData,
      plusOneName,
      email: data.email || undefined,
      mealChoice:
        data.mealChoice === "none" ? undefined : data.mealChoice || undefined,
      guestGroup:
        data.guestGroup === "none" ? undefined : data.guestGroup || undefined,
    };
    try {
      const res = await authFetch("/api/guests?force=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add guest");
      toast({ title: "Guest added" });
      setPendingGuestData(null);
      setDuplicateGuestIds(new Set());
      invalidate();
      void syncGuestToWeddingParty(data).catch(() => {
        toast({
          title: "Guest added, but wedding party sync failed",
          variant: "destructive",
        });
      });
    } catch {
      toast({ title: "Failed to add guest", variant: "destructive" });
    }
  }

  async function handleGuestImport(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setImportSummary({
        added: 0,
        skipped: ["Save your guest list as an Excel workbook (.xlsx), then upload it again."],
        error: "Use an Excel .xlsx file",
      });
      toast({
        title: "Use an Excel .xlsx file",
        description: "Download the template if you want the easiest format.",
        variant: "destructive",
      });
      return;
    }

    setIsImportingGuests(true);
    setImportSummary(null);
    try {
      const { guestsToImport, skipped } = await parseGuestImportWorkbook(file);
      if (guestsToImport.length === 0) {
        setImportSummary({
          added: 0,
          skipped: skipped.length ? skipped : ["No guests found to import."],
          error: "No guests were imported",
        });
        return;
      }

      let added = 0;
      const importSkipped = [...skipped];
      for (const guest of guestsToImport) {
        const payload = {
          name: guest.name,
          email: guest.email || undefined,
          invitationStatus: guest.invitationStatus,
          rsvpStatus: guest.rsvpStatus,
          mealChoice: guest.mealChoice || undefined,
          dietaryNotes: guest.dietaryNotes || undefined,
          guestGroup: guest.guestGroup || undefined,
          plusOne: guest.plusOne || !!guest.plusOneName,
          plusOneName: guest.plusOneName || undefined,
          tableAssignment: guest.tableAssignment || undefined,
          needsHotel: guest.needsHotel,
          bookedHotelBlockId: null,
          notes: guest.notes || undefined,
          phone: guest.phone || undefined,
          address: guest.address || undefined,
          aptUnit: guest.aptUnit || undefined,
          guestCity: guest.guestCity || undefined,
          guestState: guest.guestState || undefined,
          guestZip: guest.guestZip || undefined,
          guestCountry: guest.guestCountry || undefined,
        };
        const res = await authFetch("/api/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          added += 1;
          continue;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        importSkipped.push(`${guest.name}: ${body.error ?? "could not be imported"}`);
      }

      invalidate();
      setImportSummary({
        added,
        skipped: importSkipped,
        error: importSkipped.length ? "Some rows could not be imported" : undefined,
      });
      toast({
        title: "Guest import complete",
        description: `${added} guest${added === 1 ? "" : "s"} added${importSkipped.length ? `, ${importSkipped.length} skipped` : ""}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please check the file and try again.";
      setImportSummary({
        added: 0,
        skipped: [message],
        error: "Could not import guest list",
      });
      toast({
        title: "Could not import guest list",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsImportingGuests(false);
    }
  }

  function handleEdit(data: GuestFormValues) {
    if (!editGuest) return;
    const previousWeddingPartyMember = editWeddingPartyMember;
    const plusOneName = data.plusOne
      ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()]
          .filter(Boolean)
          .join(" ")
      : "";
    updateGuest.mutate(
      {
        id: editGuest.id,
        data: {
          name: data.name,
          email: data.email || null,
          invitationStatus: data.invitationStatus,
          rsvpStatus: data.rsvpStatus,
          plusOne: data.plusOne,
          plusOneName: plusOneName,
          mealChoice:
            data.mealChoice === "none" || !data.mealChoice
              ? null
              : data.mealChoice,
          dietaryNotes:
            data.mealChoice === "other"
              ? data.dietaryNotes?.trim() || null
              : null,
          guestGroup:
            data.guestGroup === "none" || !data.guestGroup
              ? null
              : data.guestGroup,
          tableAssignment: data.tableAssignment || null,
          needsHotel: data.needsHotel || data.bookedHotelBlockId != null,
          bookedHotelBlockId: data.bookedHotelBlockId ?? null,
          notes: data.notes || null,
          phone: data.phone || null,
          address: data.address || null,
          aptUnit: data.aptUnit || null,
          guestCity: data.guestCity || null,
          guestState: data.guestState || null,
          guestZip: data.guestZip || null,
          guestCountry: data.guestCountry || null,
        } as Parameters<typeof updateGuest.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          toast({ title: "Guest updated" });
          setEditGuest(null);
          invalidate();
          void syncGuestToWeddingParty(data, previousWeddingPartyMember).catch(() => {
            toast({
              title: "Guest updated, but wedding party sync failed",
              variant: "destructive",
            });
          });
        },
        onError: (err: unknown) => {
          const status = (err as { status?: number })?.status;
          toast({
            title:
              status === 409
                ? "Duplicate guest detected"
                : "Failed to update guest",
            description:
              status === 409
                ? "A guest with this name or email already exists."
                : undefined,
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleDelete(id: number) {
    deleteGuest.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Guest removed" });
          invalidate();
        },
        onError: () =>
          toast({ title: "Failed to remove guest", variant: "destructive" }),
      },
    );
  }

  const editWeddingPartyMember = editGuest
    ? findWeddingPartyMemberForGuest(editGuest)
    : undefined;
  const weddingPartyGuestIds = new Set(
    allGuests
      .filter((guest) => findWeddingPartyMemberForGuest(guest))
      .map((guest) => guest.id),
  );

  if (!profileLoading && !weddingProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 max-w-md mx-auto px-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-semibold">
            Complete Your Wedding Profile
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            You need to set up your wedding profile before you can manage guests
            and invitations.
          </p>
        </div>
        <Link href="/profile">
          <Button>Set Up Wedding Profile</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <p className="text-muted-foreground">
          Failed to load guest list. Please refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-3 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-serif text-primary flex items-center gap-3 leading-tight break-words">
            <Users className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" /> {t("guests.title")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2">
            {t("guests.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
          {allGuests.length > 0 && (
            <Button variant="outline" className="w-full sm:w-auto justify-center whitespace-normal sm:whitespace-nowrap" onClick={() => exportCSV(allGuests, hotels)}>
              <Download className="h-4 w-4 mr-2" /> {t("guests.export_csv")}
            </Button>
          )}
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-center whitespace-normal sm:whitespace-nowrap">
                <Upload className="h-4 w-4 mr-2" /> Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl text-primary">
                  Import Guest List
                </DialogTitle>
                <DialogDescription>
                  Upload an Excel .xlsx file and A.IDO will add each row as a guest.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm space-y-2">
                  <p className="font-medium">Template columns</p>
                  <p className="text-muted-foreground">
                    Save the completed template as an Excel workbook (.xlsx) before uploading.
                    Required fields: <span className="font-medium text-foreground">Full Name</span> and{" "}
                    <span className="font-medium text-foreground">Street Address</span>. Use the
                    dropdowns for <span className="font-medium text-foreground">Plus One</span>{" "}
                    and <span className="font-medium text-foreground">Category</span>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Plus One Name is optional. When guests RSVP digitally, their RSVP status and
                    details will update automatically on this guest list.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    className="flex-1 border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    onClick={() => {
                      downloadGuestImportTemplate().catch((err) => {
                        toast({
                          title: "Could not create template",
                          description: err instanceof Error ? err.message : undefined,
                          variant: "destructive",
                        });
                      });
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download Template
                  </Button>
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      disabled={isImportingGuests}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        handleGuestImport(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    <span className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                      {isImportingGuests ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Excel
                    </span>
                  </label>
                </div>
                {importSummary && (
                  <div
                    className={`rounded-lg border p-4 text-sm ${
                      importSummary.error
                        ? "border-red-300 bg-red-50/80 dark:border-red-800/60 dark:bg-red-950/20"
                        : "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                    }`}
                  >
                    <p
                      className={`font-semibold ${
                        importSummary.error
                          ? "text-red-700 dark:text-red-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {importSummary.error ?? "Guest list imported successfully"}
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {importSummary.added} guest{importSummary.added === 1 ? "" : "s"} added
                    </p>
                    {importSummary.skipped.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        <p>{importSummary.skipped.length} row{importSummary.skipped.length === 1 ? "" : "s"} skipped:</p>
                        <ul className="max-h-32 overflow-y-auto list-disc pl-4">
                          {importSummary.skipped.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {allGuests.length > 0 && (
            <>
              <Dialog
                open={bulkMobileChoiceMode !== null}
                onOpenChange={(open) => {
                  if (!open) setBulkMobileChoiceMode(null);
                }}
              >
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm p-4 sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="break-words pr-8 font-serif text-2xl leading-tight text-primary">
                      {getBulkShareTitle(bulkMobileChoiceMode)}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">
                      One shared link works for every selected guest. Copy it, or open a text message with the link included.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <Button
                      type="button"
                      className="min-h-12 justify-start gap-3 whitespace-normal text-left"
                      disabled={!bulkMobileChoiceMode}
                      onClick={() => {
                        if (!bulkMobileChoiceMode) return;
                        const mode = bulkMobileChoiceMode;
                        setBulkMobileChoiceMode(null);
                        openBulkLinks(mode, "copy");
                      }}
                    >
                      <Copy className="h-4 w-4 shrink-0" />
                      <span className="leading-tight">Copy shared link</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 justify-start gap-3 whitespace-normal border-primary/20 text-left text-primary"
                      disabled={!bulkMobileChoiceMode}
                      onClick={() => {
                        if (!bulkMobileChoiceMode) return;
                        const mode = bulkMobileChoiceMode;
                        setBulkMobileChoiceMode(null);
                        openBulkLinks(mode, "text");
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Text message directly
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog
                open={bulkLinksMode !== null}
                onOpenChange={(open) => {
                  if (!open) {
                    setBulkLinksMode(null);
                    setBulkLinks([]);
                  }
                }}
              >
                <DialogContent className="left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="max-w-full break-words pr-8 font-serif text-xl leading-tight text-primary sm:text-2xl">
                      {bulkShareIntent === "text"
                        ? "Text Shared Link"
                        : bulkLinksMode
                          ? getBulkLinksTitle(bulkLinksMode)
                          : "Shared Link"}
                    </DialogTitle>
                    <DialogDescription className="max-w-full break-words text-sm leading-relaxed">
                      {bulkShareIntent === "text"
                        ? "Open a prefilled text message with the shared link."
                        : bulkLinksMode
                          ? getBulkLinksDescription(bulkLinksMode)
                          : "One shared link works for every guest."}
                    </DialogDescription>
                  </DialogHeader>
                  {bulkLinksLoading ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/15 bg-muted/20 p-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Generating shared link...
                    </div>
                  ) : (
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {bulkShareIntent === "text"
                            ? "Use your phone's Messages app to send the shared link."
                            : "One shared link is ready to copy."}
                        </p>
                        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center">
                          <Button
                            type="button"
                            size="sm"
                            className="w-full gap-2 sm:w-auto"
                            disabled={bulkLinks.length === 0}
                            onClick={copyBulkLinks}
                          >
                            <Copy className="h-4 w-4" />
                            {bulkShareIntent === "text" ? "Copy instead" : "Copy link"}
                          </Button>
                          {bulkLinks[0] && bulkLinksMode && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2 border-primary/20 text-primary sm:hidden"
                              onClick={() => {
                                window.location.href = buildSmsHref(
                                  "",
                                  buildBulkTextMessage(bulkLinksMode, bulkLinks[0].url),
                                );
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                              Text message
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[52vh] min-w-0 space-y-2 overflow-y-auto pr-1">
                        {bulkLinks.map((item) => (
                          <div
                            key={item.guestId}
                            className="min-w-0 rounded-lg border border-primary/15 bg-[#FFF8F1] p-3 text-sm"
                          >
                            <p className="min-w-0 break-words font-semibold text-foreground">
                              {bulkLinksMode === "saveTheDate"
                                ? "Save-the-Date shared link"
                                : "RSVP shared link"}
                            </p>
                            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                              <p className="min-w-0 flex-1 overflow-hidden text-ellipsis break-all rounded-md bg-white/50 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground sm:line-clamp-2">
                                {item.url}
                              </p>
                              {bulkShareIntent === "text" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-full shrink-0 gap-1.5 sm:w-auto"
                                  disabled={!bulkLinksMode}
                                  onClick={() => {
                                    if (!bulkLinksMode) return;
                                    window.location.href = buildSmsHref(
                                      "",
                                      buildBulkTextMessage(bulkLinksMode, item.url),
                                    );
                                  }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Open text
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-full shrink-0 gap-1.5 sm:w-auto"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(item.url);
                                    toast({
                                      title: "Link copied",
                                      description: "The shared link is ready to paste.",
                                    });
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <AlertDialog
                open={confirmBulkSend !== null}
                onOpenChange={(open) => {
                  if (!open) setConfirmBulkSend(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {confirmBulkSend === "saveTheDate" &&
                        "Send Selected Save-the-Dates?"}
                      {confirmBulkSend === "invitation" &&
                        "Send Selected RSVP Invitations?"}
                      {confirmBulkSend === "reminder" &&
                        "Send Selected RSVP Reminders?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will send emails to{" "}
                      <strong>{bulkSendGuests.length}</strong> eligible guest
                      {bulkSendGuests.length !== 1 ? "s" : ""}
                      . This action cannot be undone.
                    </AlertDialogDescription>
                    {bulkSendGuests.length > 0 && (
                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                        <p className="font-medium text-foreground">
                          Guests receiving this:
                        </p>
                        <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-muted-foreground">
                          {bulkSendGuests.map((guest) => (
                            <li key={guest.id} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span className="break-words">{guest.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        const mode = confirmBulkSend;
                        setConfirmBulkSend(null);
                        if (mode === "saveTheDate") handleSendAllSaveTheDates(selectedSaveTheDateEligible);
                        if (mode === "invitation") handleSendAllInvitations(selectedInvitationEligible);
                        if (mode === "reminder") handleSendAllReminders(selectedReminderEligible);
                      }}
                    >
                      Confirm & Send
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full sm:w-auto justify-center shadow-md whitespace-normal sm:whitespace-nowrap">
                <Plus className="mr-2 h-4 w-4" /> {t("guests.add_guest")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl text-primary">
                  {t("guests.new_guest")}
                </DialogTitle>
                <DialogDescription>
                  {t("guests.new_guest_desc")}
                </DialogDescription>
              </DialogHeader>
              <GuestForm
                hotels={hotels}
                onSubmit={handleAdd}
                isPending={addGuest.isPending}
                submitLabel={t("guests.add_guest")}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Guest Collector */}
      <GuestCollectorCard />

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/50">
            <Star className="h-4 w-4 fill-current" />
          </span>
          <p>
            Guests with a star are part of the Wedding Party and automatically sync to the Wedding Party tab.
          </p>
        </CardContent>
      </Card>

      {allGuests.length > 0 && (
        <div className="rounded-xl border border-primary/15 bg-[#FFF8F1]/85 p-3 shadow-sm dark:border-primary/25 dark:bg-card/80">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Badge
                variant="secondary"
                className="w-fit border-primary/15 bg-primary/10 px-3 py-1 text-primary"
              >
                {selectedGuestIds.size} selected
              </Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-primary/15 bg-white/55 p-2 shadow-sm">
                <Button
                  size="sm"
                  className={readyBulkButtonClass}
                  disabled={
                    sendingSaveTheDates || selectedSaveTheDateEligible.length === 0
                  }
                  onClick={() => handleBulkPrimaryAction("saveTheDate")}
                >
                  <span className="inline-flex items-center">
                    {sendingSaveTheDates ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Send Save-the-Dates
                  </span>
                  <Badge variant="secondary" className={readyBulkBadgeClass}>
                    {selectedSaveTheDateEligible.length}
                  </Badge>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-8 w-full justify-center gap-2 whitespace-normal px-2 py-1.5 text-center text-xs leading-tight text-primary hover:bg-primary/10"
                  disabled={bulkLinksLoading}
                  onClick={() => openBulkLinks("saveTheDate")}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                    Copy shared link
                  </span>
                </Button>
              </div>
              <div className="rounded-lg border border-primary/15 bg-white/55 p-2 shadow-sm">
                <Button
                  size="sm"
                  className={readyBulkButtonClass}
                  disabled={sendingInvitations || selectedInvitationEligible.length === 0}
                  onClick={() => handleBulkPrimaryAction("invitation")}
                >
                  <span className="inline-flex items-center">
                    {sendingInvitations ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send RSVP Invitations
                  </span>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {selectedInvitationEligible.length}
                  </Badge>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-8 w-full justify-center gap-2 whitespace-normal px-2 py-1.5 text-center text-xs leading-tight text-primary hover:bg-primary/10"
                  disabled={bulkLinksLoading}
                  onClick={() => openBulkLinks("invitation")}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                    Copy shared link
                  </span>
                </Button>
              </div>
              <div className="rounded-lg border border-primary/15 bg-white/55 p-2 shadow-sm">
                <Button
                  size="sm"
                  className={readyBulkButtonClass}
                  disabled={sendingReminders || selectedReminderEligible.length === 0}
                  onClick={() => handleBulkPrimaryAction("reminder")}
                >
                  <span className="inline-flex items-center">
                    {sendingReminders ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4 mr-2" />
                    )}
                    Send RSVP Reminders
                  </span>
                  <Badge variant="secondary" className={readyBulkBadgeClass}>
                    {selectedReminderEligible.length}
                  </Badge>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-8 w-full justify-center gap-2 whitespace-normal px-2 py-1.5 text-center text-xs leading-tight text-primary hover:bg-primary/10"
                  disabled={bulkLinksLoading}
                  onClick={() => openBulkLinks("reminder")}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                    Copy shared link
                  </span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                onClick={() => setSelectedGuestIds(new Set(allGuests.map((guest) => guest.id)))}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={() => setSelectedGuestIds(new Set())}
              >
                Deselect all
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Response Rate Bar */}
      {summary.total > 0 && (
        <div className="bg-card border border-border/60 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {t("guests.rsvp_response_rate")}
            </span>
            <span className="text-muted-foreground">
              {summary.attending + summary.declined} {t("guests.responded")}{" "}
              {summary.total}
              {summary.total > 0 && (
                <span className="ml-1 text-primary font-semibold">
                  (
                  {Math.round(
                    ((summary.attending + summary.declined) / summary.total) *
                      100,
                  )}
                  %)
                </span>
              )}
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            {summary.attending > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${(summary.attending / summary.total) * 100}%`,
                }}
              />
            )}
            {summary.declined > 0 && (
              <div
                className="h-full bg-red-400 transition-all duration-500"
                style={{
                  width: `${(summary.declined / summary.total) * 100}%`,
                }}
              />
            )}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{" "}
                {t("guests.stat_attending")} ({summary.attending})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />{" "}
                {t("guests.stat_declined")} ({summary.declined})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" />{" "}
                {t("guests.stat_pending")} ({summary.pending})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            icon: Users,
            labelKey: "stat_total",
            value: summary.total,
            color: "text-primary",
          },
          {
            icon: UserCheck,
            labelKey: "stat_attending",
            value: summary.attending,
            color: "text-emerald-600",
          },
          {
            icon: UserX,
            labelKey: "stat_declined",
            value: summary.declined,
            color: "text-red-500",
          },
          {
            icon: Clock,
            labelKey: "stat_pending",
            value: summary.pending,
            color: "text-amber-600",
          },
          {
            icon: Heart,
            labelKey: "stat_plus_ones",
            value: summary.plusOnes,
            color: "text-violet-500",
          },
        ].map(({ icon: Icon, labelKey, value, color }) => (
          <Card key={labelKey} className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Icon className={`h-5 w-5 mb-1 ${color}`} />
              <div className={`text-2xl font-serif font-bold ${color}`}>
                {value}
              </div>
              <div className="text-xs text-muted-foreground">
                {t(`guests.${labelKey}`)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New guests alert — recently self-added via collector link */}
      {rsvpReviewGuests.length > 0 && (
        <Card className="border-orange-300/70 bg-orange-50/80 dark:bg-orange-900/15 dark:border-orange-700/50 shadow-sm">
          <CardContent className="py-3 px-4 flex items-start sm:items-center gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full bg-orange-200/80 dark:bg-orange-800/40 flex items-center justify-center ring-1 ring-orange-300/60 dark:ring-orange-700/60">
              <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                {rsvpReviewGuests.length === 1
                  ? t("guests.rsvp_self_add_alert_one", {
                      name: rsvpReviewGuests[0].name,
                      defaultValue: "{{name}} RSVPed but was not on your guest list",
                    })
                  : t("guests.rsvp_self_add_alert_other", {
                      count: rsvpReviewGuests.length,
                      defaultValue: "{{count}} guests RSVPed but were not on your guest list",
                    })}
              </p>
              <p className="text-xs text-orange-800/80 dark:text-orange-300/70 mt-0.5">
                {t("guests.rsvp_self_add_alert_desc", {
                  defaultValue: "They used RSVP anyway after they could not find themselves. They were added to your guest list so you can review and confirm them.",
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-orange-900 dark:text-orange-200 hover:bg-orange-200/60 dark:hover:bg-orange-800/30"
              onClick={() => handleAcknowledgeMany(rsvpReviewGuests.map((g) => g.id))}
              data-testid="button-acknowledge-rsvp-self-added"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              {t("guests.dismiss_new_alert")}
            </Button>
          </CardContent>
        </Card>
      )}

      {collectorNewGuests.length > 0 && (
        <Card className="border-amber-300/60 bg-amber-50/70 dark:bg-amber-900/15 dark:border-amber-700/50 shadow-sm">
          <CardContent className="py-3 px-4 flex items-start sm:items-center gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full bg-amber-200/80 dark:bg-amber-800/40 flex items-center justify-center ring-1 ring-amber-300/60 dark:ring-amber-700/60">
              <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {collectorNewGuests.length === 1
                  ? t("guests.new_guest_alert_one", { name: collectorNewGuests[0].name })
                  : t("guests.new_guest_alert_other", {
                      count: collectorNewGuests.length,
                    })}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-0.5">
                {t("guests.new_guest_alert_desc")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-amber-900 dark:text-amber-200 hover:bg-amber-200/60 dark:hover:bg-amber-800/30"
              onClick={() => handleAcknowledgeMany(collectorNewGuests.map((g) => g.id))}
              data-testid="button-acknowledge-all-new"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              {t("guests.dismiss_new_alert")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Duplicate confirmation dialog */}
      <AlertDialog
        open={!!pendingGuestData}
        onOpenChange={(open) => {
          if (!open) {
            setPendingGuestData(null);
            setDuplicateGuestIds(new Set());
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Duplicate guest detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              A guest with this name or email already exists — the matching{" "}
              {duplicateGuestIds.size === 1 ? "entry is" : "entries are"}{" "}
              highlighted in the list below. Do you still want to add this
              guest?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingGuestData(null);
                setDuplicateGuestIds(new Set());
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleForceAdd}
            >
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate highlight banner (shown after dismissing the dialog) */}
      {duplicateGuestIds.size > 0 && !pendingGuestData && (
        <Card className="border-orange-300/60 bg-orange-50/70 dark:bg-orange-900/15 dark:border-orange-700/50 shadow-sm">
          <CardContent className="py-3 px-4 flex items-start sm:items-center gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full bg-orange-200/80 dark:bg-orange-800/40 flex items-center justify-center ring-1 ring-orange-300/60 dark:ring-orange-700/60">
              <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                Existing {duplicateGuestIds.size === 1 ? "guest" : "guests"}{" "}
                highlighted below
              </p>
              <p className="text-xs text-orange-800/80 dark:text-orange-300/70 mt-0.5">
                {duplicateGuestIds.size === 1
                  ? "This entry matches"
                  : "These entries match"}{" "}
                the name or email you tried to add.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-orange-900 dark:text-orange-200 hover:bg-orange-200/60 dark:hover:bg-orange-800/30"
              onClick={() => setDuplicateGuestIds(new Set())}
            >
              <XIcon className="h-3.5 w-3.5 mr-1.5" />
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("guests.search_placeholder")}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={rsvpFilter} onValueChange={setRsvpFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("guests.all_rsvps")}</SelectItem>
            {RSVP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {t(`guests.rsvp_${o.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {allGuests.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">
              {t("guests.empty_title")}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {t("guests.empty_desc")}
            </p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> {t("guests.add_first_guest")}
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("guests.no_match")}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-[#FFF8F1]/70 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-primary">
                Guest list
              </CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex w-fit items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                    title="View selected guests"
                  >
                    {selectedGuests.length} selected
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-2xl text-primary">
                      Selected Guests
                    </DialogTitle>
                    <DialogDescription>
                      {selectedGuests.length} guest{selectedGuests.length !== 1 ? "s" : ""} currently selected.
                    </DialogDescription>
                  </DialogHeader>
                  {selectedGuests.length > 0 ? (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {selectedGuests.map((guest) => (
                        <div
                          key={guest.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-primary/15 bg-[#FFF8F1] px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                            {guest.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-xs text-primary hover:bg-primary/10"
                            onClick={() => toggleGuestSelected(guest.id, false)}
                          >
                            Deselect
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-primary/10 bg-[#FFF8F1] p-4 text-sm text-muted-foreground">
                      No guests selected. Select guests from the list before sending.
                    </p>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="sm:hidden space-y-3 p-3">
              {filtered.map((g) => {
                const badge = getRsvpBadge(g.rsvpStatus);
                const isNew = newGuestIds.has(g.id);
                const isRsvpSelfAdded = (g as any).source === "rsvp_self_add";
                const isDuplicate = duplicateGuestIds.has(g.id);
                const isWeddingPartyGuest = weddingPartyGuestIds.has(g.id);
                return (
                  <div
                    key={`mobile-${g.id}`}
                    className={`rounded-lg border p-3 space-y-3 ${isDuplicate ? "bg-orange-50/60 dark:bg-orange-900/15 border-orange-300 dark:border-orange-700" : isNew ? (isRsvpSelfAdded ? "bg-orange-50/60 dark:bg-orange-900/15 border-orange-300 dark:border-orange-700" : "bg-amber-50/40 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700") : "bg-background"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <label className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                          <Checkbox
                            checked={selectedGuestIds.has(g.id)}
                            onCheckedChange={(checked) => toggleGuestSelected(g.id, checked === true)}
                            aria-label={`Select or deselect ${g.name}`}
                          />
                          <span>Select / Deselect</span>
                        </label>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium leading-tight break-words">
                            {isWeddingPartyGuest && (
                              <Star
                                className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500"
                                aria-label="Wedding party member"
                              />
                            )}
                            {g.name}
                          </p>
                        {isNew && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(g.id)}
                            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border hover:opacity-80 transition-opacity ${
                              isRsvpSelfAdded
                                ? "bg-orange-200 dark:bg-orange-700/60 text-orange-950 dark:text-orange-100 border-orange-300 dark:border-orange-600"
                                : "bg-amber-200 dark:bg-amber-700/60 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-600"
                            }`}
                            title={t("guests.dismiss_new_badge")}
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            {isRsvpSelfAdded
                              ? t("guests.rsvp_self_add_badge", { defaultValue: "Review RSVP" })
                              : t("guests.new_guest_badge")}
                            <XIcon className="h-2.5 w-2.5 opacity-70" />
                          </button>
                        )}
                        {g.email && (
                          <p className="text-xs text-muted-foreground break-all mt-0.5">
                            {g.email}
                          </p>
                        )}
                          {(g as any).phone && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(g as any).phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}
                          >
                            {t(`guests.rsvp_${g.rsvpStatus}`)}
                            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          {RSVP_OPTIONS.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              className={`text-xs font-medium cursor-pointer ${g.rsvpStatus === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                              onClick={() => handleRsvpChange(g, opt.value)}
                            >
                              {t(`guests.rsvp_${opt.value}`)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Invite</p>
                        <p className="font-medium">
                          {g.invitationStatus === "sent" ? "Sent" : "Not sent"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Table</p>
                        <p className="font-medium truncate">
                          {g.tableAssignment || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground mb-1">Booked Hotel</p>
                      <Select
                        value={(g as any).bookedHotelBlockId ? String((g as any).bookedHotelBlockId) : (g as any).needsHotel ? "pending" : "na"}
                        onValueChange={(value) => handleBookedHotelChange(g, value)}
                      >
                        <SelectTrigger className={`h-8 text-xs font-medium border ${bookedHotelClasses(g)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="na">N/A</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          {hotels.map((hotel) => (
                            <SelectItem key={hotel.id} value={String(hotel.id)}>
                              {hotel.hotelName || "Unnamed Hotel"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(g as any).bookedHotelBlockId && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">Rooms</p>
                          <Select
                            value={String((g as any).bookedHotelRoomCount || 1)}
                            onValueChange={(value) => handleBookedHotelRoomCountChange(g, value)}
                          >
                            <SelectTrigger className="h-8 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 room</SelectItem>
                              <SelectItem value="2">2 rooms</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 pt-1 border-t">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          handleAcknowledge(g.id);
                          setEditGuest(g);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("guests.remove_title", { name: g.name })}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("guests.remove_desc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("guests.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(g.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              {t("guests.remove_btn")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block">
                <Table wrapperClassName="overflow-visible" className="w-full table-fixed text-xs lg:text-sm">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[13%]" />
                  <col className="w-[7%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="px-0 text-primary">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => setAllFilteredSelected(checked === true)}
                          aria-label="Select or deselect all visible guests"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-primary">
                      Name
                    </TableHead>
                    <TableHead className="hidden sm:table-cell text-primary">
                      {t("guests.col_einvite_status")}
                    </TableHead>
                    <TableHead className="text-primary">
                      {t("guests.col_rsvp")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-primary">
                      {t("guests.col_meal")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-primary">
                      {t("guests.col_table")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-primary">
                      Booked Hotel
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-primary">
                      {t("guests.col_group", { defaultValue: "Group" })}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-primary">
                      {t("guests.col_plus_one")}
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => {
                    const badge = getRsvpBadge(g.rsvpStatus);
                    const isNew = newGuestIds.has(g.id);
                    const isRsvpSelfAdded = (g as any).source === "rsvp_self_add";
                    const isDuplicate = duplicateGuestIds.has(g.id);
                    const isWeddingPartyGuest = weddingPartyGuestIds.has(g.id);
                    return (
                      <TableRow
                        key={g.id}
                        className={`group ${isDuplicate ? "bg-orange-50/60 dark:bg-orange-900/15 border-l-4 border-l-orange-500 dark:border-l-orange-400" : isNew ? "bg-amber-50/40 dark:bg-amber-900/10 border-l-4 border-l-amber-400 dark:border-l-amber-500" : ""}`}
                      >
                        <TableCell className="px-0 align-top">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={selectedGuestIds.has(g.id)}
                              onCheckedChange={(checked) => toggleGuestSelected(g.id, checked === true)}
                              aria-label={`Select ${g.name}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                              {isWeddingPartyGuest && (
                                <Star
                                  className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500"
                                  aria-label="Wedding party member"
                                />
                              )}
                              <span className="truncate">{g.name}</span>
                            </span>
                            {isNew && (
                              <button
                                type="button"
                                onClick={() => handleAcknowledge(g.id)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border hover:opacity-80 transition-opacity ${
                                  isRsvpSelfAdded
                                    ? "bg-orange-200 dark:bg-orange-700/60 text-orange-950 dark:text-orange-100 border-orange-300 dark:border-orange-600"
                                    : "bg-amber-200 dark:bg-amber-700/60 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-600"
                                }`}
                                title={t("guests.dismiss_new_badge")}
                                data-testid={`button-dismiss-new-${g.id}`}
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                {isRsvpSelfAdded
                                  ? t("guests.rsvp_self_add_badge", { defaultValue: "Review RSVP" })
                                  : t("guests.new_guest_badge")}
                                <XIcon className="h-2.5 w-2.5 opacity-70" />
                              </button>
                            )}
                          </div>
                          {g.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-full">
                                {g.email}
                              </span>
                            </div>
                          )}
                          {(g as any).phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{(g as any).phone}</span>
                            </div>
                          )}
                          {((g as any).address ||
                            (g as any).guestCity ||
                            (g as any).guestState ||
                            (g as any).guestZip ||
                            (g as any).guestCountry) && (
                            <div className="flex items-start gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="leading-snug">
                                {(g as any).address && (
                                  <>
                                    {(g as any).address}
                                    {(g as any).aptUnit && (
                                      <>, {(g as any).aptUnit}</>
                                    )}
                                  </>
                                )}
                                {((g as any).guestCity ||
                                  (g as any).guestState ||
                                  (g as any).guestZip) && (
                                  <>
                                    {(g as any).address && <br />}
                                    {[
                                      (g as any).guestCity,
                                      (g as any).guestState,
                                      (g as any).guestZip,
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </>
                                )}
                                {(g as any).guestCountry && (
                                  <>
                                    {((g as any).address ||
                                      (g as any).guestCity ||
                                      (g as any).guestState ||
                                      (g as any).guestZip) && <br />}
                                    {(g as any).guestCountry}
                                  </>
                                )}
                              </span>
                            </div>
                          )}
                          {g.notes && (
                            <div
                              className="text-xs text-muted-foreground italic truncate max-w-full mt-0.5"
                              title={g.notes}
                            >
                              {g.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell align-top text-xs lg:text-sm">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-col xl:flex-row xl:items-center gap-1">
                              <span className="text-[10px] lg:text-[11px] text-muted-foreground xl:w-[82px] shrink-0 leading-tight">
                                Save the Date
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80 transition-opacity cursor-pointer ${(g as any).saveTheDateStatus === "sent" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40" : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700"}`}
                                  >
                                    {(g as any).saveTheDateStatus === "sent"
                                      ? "Sent"
                                      : "Not Sent"}
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-32">
                                  {[
                                    { value: "not_sent", label: "Not Sent" },
                                    { value: "sent", label: "Sent" },
                                  ].map((opt) => {
                                    const current = (g as any).saveTheDateStatus ?? "not_sent";
                                    return (
                                      <DropdownMenuItem
                                        key={opt.value}
                                        className={`text-xs font-medium cursor-pointer ${current === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                        onClick={() => handleSaveDateChange(g, opt.value)}
                                      >
                                        <span className={`w-2 h-2 rounded-full mr-2 ${opt.value === "sent" ? "bg-emerald-500" : "bg-gray-400"}`} />
                                        {opt.label}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex flex-col xl:flex-row xl:items-center gap-1">
                              <span className="text-[10px] lg:text-[11px] text-muted-foreground xl:w-[82px] shrink-0 leading-tight">
                                RSVP Invitation
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80 transition-opacity cursor-pointer ${g.invitationStatus === "sent" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40" : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700"}`}
                                  >
                                    {g.invitationStatus === "sent"
                                      ? "Sent"
                                      : "Not Sent"}
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-32">
                                  {INVITATION_OPTIONS.map((opt) => (
                                    <DropdownMenuItem
                                      key={opt.value}
                                      className={`text-xs font-medium cursor-pointer ${g.invitationStatus === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                      onClick={() => handleInvitationChange(g, opt.value)}
                                    >
                                      <span className={`w-2 h-2 rounded-full mr-2 ${opt.value === "sent" ? "bg-emerald-500" : "bg-gray-400"}`} />
                                      {opt.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color} hover:opacity-80 transition-opacity cursor-pointer`}
                              >
                                {t(`guests.rsvp_${g.rsvpStatus}`)}
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                              {RSVP_OPTIONS.map((opt) => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={`text-xs font-medium cursor-pointer ${g.rsvpStatus === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                  onClick={() => handleRsvpChange(g, opt.value)}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full mr-2 ${opt.value === "attending" ? "bg-emerald-500" : opt.value === "declined" ? "bg-red-400" : opt.value === "maybe" ? "bg-sky-400" : "bg-amber-400"}`}
                                  />
                                  {t(`guests.rsvp_${opt.value}`)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {g.rsvpMessage && (
                            <p
                              className="mt-1.5 text-xs italic text-muted-foreground whitespace-pre-wrap break-words max-w-full"
                              title={g.rsvpMessage}
                            >
                              “{g.rsvpMessage}”
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell align-top">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-border/50 text-muted-foreground hover:opacity-80 transition-opacity cursor-pointer capitalize">
                                {g.mealChoice
                                  ? g.mealChoice.replace(/_/g, " ")
                                  : "—"}
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                              <DropdownMenuItem
                                className={`text-xs cursor-pointer ${!g.mealChoice ? "opacity-50 pointer-events-none" : ""}`}
                                onClick={() => handleMealChange(g, "none")}
                              >
                                <span className="text-muted-foreground">
                                  — No meal
                                </span>
                              </DropdownMenuItem>
                              {MEAL_OPTIONS.map((opt) => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={`text-xs font-medium cursor-pointer ${g.mealChoice === opt.value ? "opacity-50 pointer-events-none" : ""}`}
                                  onClick={() => handleMealChange(g, opt.value)}
                                >
                                  {t(`guests.meal_${opt.value}`, opt.label)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {/* Plus-one meal — read-only chip below the main meal,
                              shown only when a plus-one exists and they picked
                              one. The Guest type from api-client-react doesn't
                              know about this column yet, so we cast narrowly. */}
                          {g.plusOne &&
                            (g as Guest & { plusOneMealChoice?: string | null })
                              .plusOneMealChoice && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/40 text-muted-foreground capitalize">
                                <span className="opacity-60">+1:</span>
                                {(
                                  g as Guest & {
                                    plusOneMealChoice?: string | null;
                                  }
                                ).plusOneMealChoice!.replace(/_/g, " ")}
                              </div>
                            )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell align-top text-xs lg:text-sm text-muted-foreground break-words">
                          {g.tableAssignment || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell align-top text-xs lg:text-sm">
                          <Select
                            value={(g as any).bookedHotelBlockId ? String((g as any).bookedHotelBlockId) : (g as any).needsHotel ? "pending" : "na"}
                            onValueChange={(value) => handleBookedHotelChange(g, value)}
                          >
                            <SelectTrigger
                              className={`h-7 w-full px-2 text-xs font-medium border whitespace-nowrap [&>svg]:opacity-60 ${bookedHotelClasses(g)}`}
                            >
                              <SelectValue placeholder="N/A" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="na">N/A</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              {hotels.map((hotel) => (
                                <SelectItem key={hotel.id} value={String(hotel.id)}>
                                  {hotel.hotelName || "Unnamed Hotel"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(g as any).bookedHotelBlockId && (
                            <Select
                              value={String((g as any).bookedHotelRoomCount || 1)}
                              onValueChange={(value) => handleBookedHotelRoomCountChange(g, value)}
                            >
                              <SelectTrigger className="mt-1 h-7 w-full px-2 text-xs font-medium">
                                <SelectValue placeholder="Rooms" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 room</SelectItem>
                                <SelectItem value="2">2 rooms</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell align-top text-xs lg:text-sm">
                          <Select
                            value={g.guestGroup ?? "none"}
                            onValueChange={(v) => handleGroupChange(g, v)}
                          >
                            <SelectTrigger
                              title={g.guestGroup || "No group"}
                              className={`h-auto min-h-8 w-full items-start gap-1 px-2 py-1 text-left text-xs font-medium leading-tight border whitespace-normal [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words [&>span]:overflow-visible [&>span]:text-left [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:opacity-60 ${groupColorClasses(g.guestGroup)}`}
                            >
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {GROUP_OPTIONS.filter(
                                (o) => o.value !== "Other",
                              ).map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                              {/* If the guest has a custom non-preset value, surface it as
                                  its own option so the Select stays in sync. */}
                              {g.guestGroup &&
                                !GROUP_OPTIONS.some(
                                  (o) => o.value === g.guestGroup,
                                ) && (
                                  <SelectItem value={g.guestGroup}>
                                    {g.guestGroup}
                                  </SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell align-top text-xs lg:text-sm break-words">
                          {g.plusOne ? (
                            <span className="font-bold text-primary">
                              ♥ {g.plusOneName || t("guests.plus_one_yes")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {t("guests.plus_one_no")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                handleAcknowledge(g.id);
                                setEditGuest(g);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("guests.remove_title", { name: g.name })}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("guests.remove_desc")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t("guests.cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(g.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    {t("guests.remove_btn")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editGuest}
        onOpenChange={(open) => !open && setEditGuest(null)}
      >
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              Edit Guest
            </DialogTitle>
            <DialogDescription>
              Update {editGuest?.name}'s details.
            </DialogDescription>
          </DialogHeader>
          {editGuest && (
            <GuestForm
              defaultValues={{
                name: editGuest.name,
                email: editGuest.email ?? "",
                rsvpStatus:
                  (editGuest.rsvpStatus as
                    | "pending"
                    | "attending"
                    | "maybe"
                    | "declined") ?? "pending",
                mealChoice: editGuest.mealChoice ?? "",
                dietaryNotes: (editGuest as any).dietaryNotes ?? "",
                guestGroup: editGuest.guestGroup ?? "",
                plusOne: editGuest.plusOne,
                plusOneFirstName:
                  editGuest.plusOneName?.split(" ").slice(0, 1).join("") ?? "",
                plusOneLastName:
                  editGuest.plusOneName?.split(" ").slice(1).join(" ") ?? "",
                tableAssignment: editGuest.tableAssignment ?? "",
                needsHotel: !!(editGuest as any).needsHotel,
                bookedHotelBlockId: (editGuest as any).bookedHotelBlockId ?? null,
                bookedHotelRoomCount: (editGuest as any).bookedHotelRoomCount ?? null,
                phone: (editGuest as any).phone ?? "",
                address: (editGuest as any).address ?? "",
                aptUnit: (editGuest as any).aptUnit ?? "",
                guestCity: (editGuest as any).guestCity ?? "",
                guestState: (editGuest as any).guestState ?? "",
                guestZip: (editGuest as any).guestZip ?? "",
                guestCountry: (editGuest as any).guestCountry ?? "",
                notes: editGuest.notes ?? "",
                isWeddingPartyMember: !!editWeddingPartyMember,
                weddingPartyRole:
                  editWeddingPartyMember?.role ?? "Bridesmaid",
                weddingPartySide: editWeddingPartyMember?.side ?? "bride",
              }}
              hotels={hotels}
              onSubmit={handleEdit}
              isPending={updateGuest.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Invitation Preview & Send Modal */}
      <InvitationSendModal
        guest={sendModalGuest}
        profile={weddingProfile ?? null}
        onClose={() => {
          setSendModalGuest(null);
          setBulkPreviewMode(null);
        }}
        onSendSaveTheDate={(guestId) => {
          if (bulkPreviewMode === "saveTheDate") {
            void handleSendAllSaveTheDates(selectedSaveTheDateEligible);
            setSendModalGuest(null);
            setBulkPreviewMode(null);
            return;
          }
          sendSaveTheDate.mutate(guestId);
        }}
        onSendDigitalInvitation={(guestId) => {
          if (bulkPreviewMode === "invitation") {
            void handleSendAllInvitations(selectedInvitationEligible);
            setSendModalGuest(null);
            setBulkPreviewMode(null);
            return;
          }
          sendRsvp.mutate(guestId);
        }}
        onSendRsvpReminder={(guestId) => sendRsvpReminder.mutate(guestId)}
        isSendingSaveTheDate={bulkPreviewMode === "saveTheDate" ? sendingSaveTheDates : sendSaveTheDate.isPending}
        isSendingDigital={bulkPreviewMode === "invitation" ? sendingInvitations : sendRsvp.isPending}
        isSendingRsvpReminder={sendRsvpReminder.isPending}
        defaultTab={sendModalDefaultTab}
        reminderOnly={sendModalReminderOnly}
        bulkRecipientCount={bulkPreviewMode === "saveTheDate" ? selectedSaveTheDateEligible.length : bulkPreviewMode === "invitation" ? selectedInvitationEligible.length : undefined}
        bulkRecipientNames={bulkPreviewMode === "saveTheDate" ? selectedSaveTheDateEligible.map((guest) => guest.name) : bulkPreviewMode === "invitation" ? selectedInvitationEligible.map((guest) => guest.name) : undefined}
      />
    </div>
  );
}
