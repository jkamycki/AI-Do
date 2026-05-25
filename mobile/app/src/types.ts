export type VendorStatus = 'Paid' | 'Pending' | 'Due Soon' | 'Completed' | 'Signed' | 'Ongoing';
export type RsvpStatus = 'Confirmed' | 'Pending' | 'Declined';
export type TaskCategory = 'Guests' | 'Budget' | 'Files' | 'Vendors' | 'Checklist' | 'Timeline' | 'Day Of' | 'Website';
export type VenueStatus = 'Booked' | 'Looking' | 'Non-traditional';

export type Payment = {
  id: string;
  date: string;
  amount: number;
  note: string;
  receiptUrl?: string;
};

export type Vendor = {
  id: string;
  name: string;
  category: string;
  committed: number;
  paid: number;
  remaining: number;
  nextPaymentDate?: string;
  status: VendorStatus;
  payments: Payment[];
};

export type BudgetExpense = {
  id: string;
  category: string;
  title: string;
  total: number;
  paid: number;
  nextPayment?: {
    date: string;
    amount: number;
  };
  payments: Payment[];
};

export type Guest = {
  id: string;
  name: string;
  rsvp: RsvpStatus;
  mealPreference: string;
  table: string;
  role: string;
  invitationStyle: 'cream' | 'floral' | 'brown';
};

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  category: TaskCategory;
  completed: boolean;
  detail: string;
};

export type CoupleProfile = {
  coupleName: string;
  partnerOne: string;
  partnerTwo: string;
  weddingDate: string;
  venue: string;
  venueStatus: VenueStatus;
  location: string;
  totalBudget: number;
  guestTarget: number;
  photoInitials: string;
  notificationsEnabled: boolean;
  priorities: {
    mustHave: string[];
    niceToHave: string[];
    mustAvoid: string[];
  };
};

export type DocumentItem = {
  id: string;
  title: string;
  type: 'Contract' | 'Receipt' | 'Timeline' | 'Mood Board' | 'Other';
  linkedTo: string;
  status: 'Needs Review' | 'Approved' | 'Signed' | 'Shared';
  updatedAt: string;
  summary: string;
};

export type ContractItem = {
  id: string;
  vendorName: string;
  title: string;
  value: number;
  status: 'Draft' | 'Needs Review' | 'Negotiating' | 'Signed';
  nextAction: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  clauses: string[];
};

export type WeddingPartyMember = {
  id: string;
  name: string;
  role: string;
  side: 'Bride' | 'Groom' | 'Shared';
  phone: string;
  attireStatus: 'Not Started' | 'In Progress' | 'Complete';
  tasks: string[];
};

export type HotelBlock = {
  id: string;
  name: string;
  address: string;
  roomsBooked: number;
  roomsTotal: number;
  rate: number;
  deadline: string;
  shuttle: boolean;
  contact: string;
};

export type SeatingTable = {
  id: string;
  name: string;
  capacity: number;
  assigned: number;
  notes: string;
};

export type DayOfEvent = {
  id: string;
  time: string;
  title: string;
  owner: string;
  location: string;
  completed: boolean;
};

export type DayOfChecklistItem = {
  id: string;
  category: 'Ceremony' | 'Music' | 'Speeches' | 'Setup' | 'Attire' | 'Vendors' | 'Packing';
  title: string;
  note: string;
  completed: boolean;
};

export type WebsiteSection = {
  id: string;
  title: string;
  status: 'Draft' | 'Ready' | 'Published';
  description: string;
};

export type InvitationSuite = {
  id: string;
  type: 'Save the Date' | 'RSVP' | 'Digital Invitation';
  status: 'Draft' | 'Scheduled' | 'Sent';
  sent: number;
  opened: number;
  responses: number;
};

export type AriaMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: 'Planner' | 'Partner' | 'Family' | 'Vendor';
  status: 'Pending' | 'Accepted';
};

export type HelpResource = {
  id: string;
  title: string;
  detail: string;
  status: 'New' | 'Updated' | 'Guide';
};

export type AppSettings = {
  emailRemindersEnabled: boolean;
  deadlineReminderDays: number;
  pushNotificationsEnabled: boolean;
  rsvpEmailForwardingEnabled: boolean;
  rsvpResponseEmails: string[];
  ariaMemory: string;
  dataExportRequestedAt?: string;
};

export type ActivityLogEntry = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  tone: 'create' | 'update' | 'delete' | 'sync';
};

export type PlanningData = {
  profile: CoupleProfile;
  vendors: Vendor[];
  budget: BudgetExpense[];
  guests: Guest[];
  tasks: Task[];
  documents: DocumentItem[];
  contracts: ContractItem[];
  weddingParty: WeddingPartyMember[];
  hotels: HotelBlock[];
  seating: SeatingTable[];
  dayOf: DayOfEvent[];
  dayOfChecklist: DayOfChecklistItem[];
  websiteSections: WebsiteSection[];
  invitations: InvitationSuite[];
  ariaMessages: AriaMessage[];
  workspaceInvites: WorkspaceInvite[];
  helpResources: HelpResource[];
  settings: AppSettings;
  activityLog: ActivityLogEntry[];
};
