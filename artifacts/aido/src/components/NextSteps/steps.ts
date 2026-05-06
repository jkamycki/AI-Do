/**
 * Static definition of the wedding-planning Next Steps in their natural order.
 * Each step is auto-completable from existing app data, manually skippable,
 * or manually markable as done. Some steps require prerequisites to unlock.
 */

import type { LucideIcon } from "lucide-react";
import {
  User,
  Users,
  DollarSign,
  Briefcase,
  FileText,
  CheckSquare,
  Clock,
  Hotel,
  LayoutGrid,
  Calendar,
} from "lucide-react";

export type StepId =
  | "profile"
  | "guests"
  | "budget"
  | "vendors"
  | "contracts"
  | "checklist"
  | "timeline"
  | "hotels"
  | "seating"
  | "day_of";

export interface StepDefinition {
  id: StepId;
  title: string;
  description: string;
  /** Path to navigate to when "Start" is clicked. */
  route: string;
  /** Icon displayed alongside the step. */
  icon: LucideIcon;
  /** Steps that must be done before this one is shown. */
  dependsOn?: StepId[];
  /** Optional steps are clearly labelled and never deprioritized for being unfinished. */
  optional?: boolean;
  /** Auto-detection from app data. Returns true when the step is considered complete. */
  isAutoComplete?: (data: NextStepsData) => boolean;
}

export interface NextStepsData {
  hasProfile: boolean;
  guestCount: number;
  budgetTotal: number;
  vendorCount: number;
  contractCount: number;
  hasChecklist: boolean;
  checklistTotal: number;
  hasTimeline: boolean;
  timelineEventCount: number;
  hotelCount: number;
  seatingTableCount: number;
  hasDayOfPlan: boolean;
}

export const STEPS: StepDefinition[] = [
  {
    id: "profile",
    title: "Complete Your Wedding Profile",
    description: "Add your names, wedding date, and venue so everything else can build around it.",
    route: "/profile",
    icon: User,
    isAutoComplete: (d) => d.hasProfile,
  },
  {
    id: "guests",
    title: "Add Your Guest List",
    description: "Start with the people who matter most — you can always add more later.",
    route: "/guests",
    icon: Users,
    isAutoComplete: (d) => d.guestCount > 0,
  },
  {
    id: "budget",
    title: "Set Your Budget",
    description: "A clear budget keeps decisions simple and stress low.",
    route: "/budget",
    icon: DollarSign,
    isAutoComplete: (d) => d.budgetTotal > 0,
  },
  {
    id: "vendors",
    title: "Add Your Vendors",
    description: "Track who's helping make your day happen — photographers, caterers, florists, and more.",
    route: "/vendors",
    icon: Briefcase,
    isAutoComplete: (d) => d.vendorCount > 0,
  },
  {
    id: "contracts",
    title: "Upload Vendor Contracts",
    description: "Keep all your agreements in one place. We'll help you spot the important terms.",
    route: "/contracts",
    icon: FileText,
    dependsOn: ["vendors"],
    isAutoComplete: (d) => d.contractCount > 0,
  },
  {
    id: "checklist",
    title: "Generate Your Checklist",
    description: "We'll suggest tasks tailored to your timeline so nothing slips through the cracks.",
    route: "/checklist",
    icon: CheckSquare,
    isAutoComplete: (d) => d.hasChecklist && d.checklistTotal > 0,
  },
  {
    id: "timeline",
    title: "Create Your Wedding Day Timeline",
    description: "Map out the flow of your day from getting ready to last dance.",
    route: "/timeline",
    icon: Clock,
    isAutoComplete: (d) => d.hasTimeline && d.timelineEventCount > 0,
  },
  {
    id: "hotels",
    title: "Add Your Hotel Block",
    description: "Make travel easy for out-of-town guests with reserved room blocks.",
    route: "/hotels",
    icon: Hotel,
    optional: true,
    isAutoComplete: (d) => d.hotelCount > 0,
  },
  {
    id: "seating",
    title: "Start Your Seating Chart",
    description: "Once you've got a guest list, we'll help you arrange tables thoughtfully.",
    route: "/seating-chart",
    icon: LayoutGrid,
    dependsOn: ["guests"],
    isAutoComplete: (d) => d.seatingTableCount > 0,
  },
  {
    id: "day_of",
    title: "Prepare for the Day-Of Coordinator",
    description: "Pull together everything your coordinator needs so you can fully relax on the day.",
    route: "/day-of",
    icon: Calendar,
    dependsOn: ["timeline"],
    isAutoComplete: (d) => d.hasDayOfPlan,
  },
];

export const STEP_BY_ID: Record<StepId, StepDefinition> = STEPS.reduce(
  (acc, step) => {
    acc[step.id] = step;
    return acc;
  },
  {} as Record<StepId, StepDefinition>,
);
