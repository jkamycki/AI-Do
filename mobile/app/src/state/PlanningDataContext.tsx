import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getPlanningData, getRemotePlanningData, mergePlanningData } from '../api/client';
import { samplePlanningData } from '../data/sampleData';
import {
  BudgetExpense,
  ContractItem,
  CoupleProfile,
  DayOfEvent,
  AppSettings,
  DocumentItem,
  Guest,
  GuestPhotoDropSettings,
  GuestPhotoUpload,
  HotelBlock,
  InvitationSuite,
  PlanningData,
  RsvpStatus,
  Task,
  Vendor,
  VendorStatus,
  WebsiteSection,
  WorkspaceInvite,
} from '../types';

type PlanningDataContextValue = {
  data: PlanningData;
  loading: boolean;
  lastSyncedAt: Date | null;
  addBudgetExpense: (expense: Omit<BudgetExpense, 'id' | 'paid' | 'payments'> & Partial<Pick<BudgetExpense, 'paid' | 'payments'>>) => void;
  addDocument: (document: Omit<DocumentItem, 'id' | 'updatedAt'> & Partial<Pick<DocumentItem, 'updatedAt'>>) => void;
  addGuest: (guest: Omit<Guest, 'id'>) => void;
  addTask: (task: Omit<Task, 'id' | 'completed'> & Partial<Pick<Task, 'completed'>>) => void;
  addVendor: (vendor: Omit<Vendor, 'id' | 'remaining' | 'payments'> & Partial<Pick<Vendor, 'payments' | 'remaining'>>) => void;
  addWorkspaceInvite: (invite: Omit<WorkspaceInvite, 'id' | 'status'> & Partial<Pick<WorkspaceInvite, 'status'>>) => void;
  deleteBudgetExpense: (expenseId: string) => void;
  deleteGuest: (guestId: string) => void;
  deleteTask: (taskId: string) => void;
  deleteVendor: (vendorId: string) => void;
  addRsvpResponseEmail: (email: string) => void;
  exportPlanningData: () => void;
  recordBudgetPayment: (expenseId: string, amount: number, note: string, date?: string) => void;
  recordVendorPayment: (vendorId: string, amount: number, note: string, date?: string) => void;
  refresh: () => Promise<void>;
  removeRsvpResponseEmail: (email: string) => void;
  respondAsAria: (prompt: string) => void;
  scheduleVendorPayment: (vendorId: string, date: string) => void;
  sendGuestReminder: (guestId: string) => void;
  toggleDayOfChecklistItem: (itemId: string) => void;
  toggleDayOfEvent: (eventId: string) => void;
  toggleTask: (taskId: string) => void;
  updateBudgetExpense: (expenseId: string, patch: Partial<BudgetExpense>) => void;
  updateContractStatus: (contractId: string, status: ContractItem['status']) => void;
  updateDocumentStatus: (documentId: string, status: DocumentItem['status']) => void;
  updateGuest: (guestId: string, patch: Partial<Guest>) => void;
  updateHotelBlock: (hotelId: string, patch: Partial<HotelBlock>) => void;
  updateInvitationStatus: (invitationId: string, status: InvitationSuite['status']) => void;
  updateProfile: (profile: Partial<CoupleProfile>) => void;
  updateRsvp: (guestId: string, rsvp: RsvpStatus) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  updateVendor: (vendorId: string, patch: Partial<Vendor>) => void;
  updateWebsiteSectionStatus: (sectionId: string, status: WebsiteSection['status']) => void;
  updateGuestPhotoDropSettings: (settings: Partial<GuestPhotoDropSettings>) => void;
  updateGuestPhotoUploadStatus: (uploadId: string, status: GuestPhotoUpload['status']) => void;
};

const PlanningDataContext = createContext<PlanningDataContextValue | null>(null);
const STORAGE_KEY = 'aido-mobile-planning-data-v1';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function nowIso() {
  return new Date().toISOString();
}

function createActivity(action: string, detail: string, tone: 'create' | 'update' | 'delete' | 'sync' = 'update') {
  return {
    id: createId('activity'),
    action,
    detail,
    createdAt: nowIso(),
    tone,
  };
}

function withActivity(data: PlanningData, action: string, detail: string, tone: 'create' | 'update' | 'delete' | 'sync' = 'update'): PlanningData {
  return {
    ...data,
    activityLog: [createActivity(action, detail, tone), ...data.activityLog].slice(0, 40),
  };
}

function formatPaymentAmount(amount: number) {
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function statusForBalance(currentStatus: VendorStatus, remaining: number): VendorStatus {
  if (remaining <= 0) {
    return currentStatus === 'Signed' ? 'Signed' : 'Completed';
  }

  return currentStatus === 'Completed' ? 'Ongoing' : currentStatus;
}

function rebalanceVendor(vendor: Vendor): Vendor {
  const paid = Math.min(vendor.paid, vendor.committed);
  const remaining = Math.max(vendor.committed - paid, 0);
  return {
    ...vendor,
    paid,
    remaining,
    status: statusForBalance(vendor.status, remaining),
  };
}

function rebalanceBudgetExpense(expense: BudgetExpense): BudgetExpense {
  const paid = Math.min(expense.paid, expense.total);
  const remaining = Math.max(expense.total - paid, 0);
  return {
    ...expense,
    paid,
    nextPayment: remaining > 0 ? expense.nextPayment : undefined,
  };
}

export function PlanningDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PlanningData>(samplePlanningData);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const remoteData = await getRemotePlanningData();
    if (remoteData) {
      setData((current) =>
        withActivity(
          mergePlanningData({
            ...current,
            ...remoteData,
            profile: {
              ...current.profile,
              ...remoteData.profile,
              priorities: {
                ...current.profile.priorities,
                ...remoteData.profile?.priorities,
              },
            },
            settings: {
              ...current.settings,
              ...remoteData.settings,
            },
          }),
          'Synced website data',
          'The app refreshed the latest available planning data from the website API.',
          'sync',
        ),
      );
    }
    setLastSyncedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      setLoading(true);
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) {
          return;
        }

        if (stored) {
          setData(mergePlanningData(JSON.parse(stored) as Partial<PlanningData>));
        } else {
          setData(await getPlanningData());
          setLastSyncedAt(new Date());
        }
      } catch {
        if (mounted) {
          setData(samplePlanningData);
        }
      } finally {
        if (mounted) {
          setHydrated(true);
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const toggleTask = useCallback((taskId: string) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)),
    }));
  }, []);

  const updateProfile = useCallback((profile: Partial<CoupleProfile>) => {
    setData((current) =>
      withActivity(
        {
          ...current,
          profile: {
            ...current.profile,
            ...profile,
          },
        },
        'Updated wedding profile',
        'Couple details, date, venue, or planning preferences changed.',
      ),
    );
  }, []);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    setData((current) =>
      withActivity(
        {
          ...current,
          settings: {
            ...current.settings,
            ...settings,
          },
        },
        'Updated settings',
        'Notification, RSVP, Aria, or privacy preferences changed.',
      ),
    );
  }, []);

  const addRsvpResponseEmail = useCallback((email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return;
    }

    setData((current) => {
      if (current.settings.rsvpResponseEmails.includes(cleanEmail)) {
        return current;
      }

      return withActivity(
        {
          ...current,
          settings: {
            ...current.settings,
            rsvpResponseEmails: [...current.settings.rsvpResponseEmails, cleanEmail],
          },
        },
        'Added RSVP email',
        `${cleanEmail} will receive RSVP response copies.`,
        'create',
      );
    });
  }, []);

  const removeRsvpResponseEmail = useCallback((email: string) => {
    setData((current) =>
      withActivity(
        {
          ...current,
          settings: {
            ...current.settings,
            rsvpResponseEmails: current.settings.rsvpResponseEmails.filter((item) => item !== email),
          },
        },
        'Removed RSVP email',
        `${email} no longer receives RSVP response copies.`,
        'delete',
      ),
    );
  }, []);

  const exportPlanningData = useCallback(() => {
    setData((current) =>
      withActivity(
        {
          ...current,
          settings: {
            ...current.settings,
            dataExportRequestedAt: nowIso(),
          },
        },
        'Downloaded data backup',
        'A complete wedding planning data export was requested from the mobile app.',
        'sync',
      ),
    );
  }, []);

  const addVendor = useCallback((vendor: Omit<Vendor, 'id' | 'remaining' | 'payments'> & Partial<Pick<Vendor, 'payments' | 'remaining'>>) => {
    setData((current) => {
      const nextVendor = rebalanceVendor({
        id: createId('vendor'),
        payments: vendor.payments ?? [],
        remaining: Math.max(vendor.committed - vendor.paid, 0),
        ...vendor,
      });

      return withActivity(
        {
          ...current,
          vendors: [nextVendor, ...current.vendors],
        },
        'Created vendor',
        `${nextVendor.name} was added to My Vendors.`,
        'create',
      );
    });
  }, []);

  const updateVendor = useCallback((vendorId: string, patch: Partial<Vendor>) => {
    setData((current) => {
      const vendor = current.vendors.find((item) => item.id === vendorId);
      return withActivity(
        {
          ...current,
          vendors: current.vendors.map((item) => (item.id === vendorId ? rebalanceVendor({ ...item, ...patch }) : item)),
        },
        'Updated vendor',
        `${vendor?.name ?? 'Vendor'} details changed.`,
      );
    });
  }, []);

  const deleteVendor = useCallback((vendorId: string) => {
    setData((current) => {
      const vendor = current.vendors.find((item) => item.id === vendorId);
      return withActivity(
        {
          ...current,
          vendors: current.vendors.filter((item) => item.id !== vendorId),
        },
        'Deleted vendor',
        `${vendor?.name ?? 'Vendor'} was removed.`,
        'delete',
      );
    });
  }, []);

  const recordVendorPayment = useCallback((vendorId: string, amount: number, note: string, date?: string) => {
    setData((current) => ({
      ...current,
      vendors: current.vendors.map((vendor) => {
        if (vendor.id !== vendorId) {
          return vendor;
        }

        return rebalanceVendor({
          ...vendor,
          paid: vendor.paid + amount,
          payments: [
            ...vendor.payments,
            {
              id: createId('payment'),
              amount,
              date: date || today(),
              note: note || 'Mobile payment entry',
            },
          ],
        });
      }),
      activityLog: [
        createActivity('Recorded vendor payment', `${formatPaymentAmount(amount)} was recorded for vendor tracking.`),
        ...current.activityLog,
      ].slice(0, 40),
    }));
  }, []);

  const scheduleVendorPayment = useCallback((vendorId: string, date: string) => {
    setData((current) => ({
      ...current,
      vendors: current.vendors.map((vendor) => (vendor.id === vendorId ? { ...vendor, nextPaymentDate: date } : vendor)),
    }));
  }, []);

  const addBudgetExpense = useCallback((expense: Omit<BudgetExpense, 'id' | 'paid' | 'payments'> & Partial<Pick<BudgetExpense, 'paid' | 'payments'>>) => {
    setData((current) => {
      const nextExpense = rebalanceBudgetExpense({
        id: createId('budget'),
        paid: 0,
        payments: [],
        ...expense,
      });

      return withActivity(
        {
          ...current,
          budget: [nextExpense, ...current.budget],
        },
        'Created expense',
        `${nextExpense.title} was added to the budget.`,
        'create',
      );
    });
  }, []);

  const updateBudgetExpense = useCallback((expenseId: string, patch: Partial<BudgetExpense>) => {
    setData((current) => ({
      ...current,
      budget: current.budget.map((expense) => (expense.id === expenseId ? rebalanceBudgetExpense({ ...expense, ...patch }) : expense)),
    }));
  }, []);

  const deleteBudgetExpense = useCallback((expenseId: string) => {
    setData((current) => ({
      ...current,
      budget: current.budget.filter((expense) => expense.id !== expenseId),
    }));
  }, []);

  const recordBudgetPayment = useCallback((expenseId: string, amount: number, note: string, date?: string) => {
    setData((current) => ({
      ...current,
      budget: current.budget.map((expense) => {
        if (expense.id !== expenseId) {
          return expense;
        }

        return rebalanceBudgetExpense({
          ...expense,
          paid: expense.paid + amount,
          payments: [
            ...expense.payments,
            {
              id: createId('budget-payment'),
              amount,
              date: date || today(),
              note: note || 'Mobile payment entry',
            },
          ],
        });
      }),
      activityLog: [
        createActivity('Recorded budget payment', `${formatPaymentAmount(amount)} was added to the budget summary.`),
        ...current.activityLog,
      ].slice(0, 40),
    }));
  }, []);

  const addGuest = useCallback((guest: Omit<Guest, 'id'>) => {
    setData((current) => ({
      ...current,
      guests: [{ id: createId('guest'), ...guest }, ...current.guests],
    }));
  }, []);

  const updateGuest = useCallback((guestId: string, patch: Partial<Guest>) => {
    setData((current) => ({
      ...current,
      guests: current.guests.map((guest) => (guest.id === guestId ? { ...guest, ...patch } : guest)),
    }));
  }, []);

  const deleteGuest = useCallback((guestId: string) => {
    setData((current) => ({
      ...current,
      guests: current.guests.filter((guest) => guest.id !== guestId),
    }));
  }, []);

  const sendGuestReminder = useCallback((guestId: string) => {
    setData((current) => {
      const guest = current.guests.find((item) => item.id === guestId);
      if (!guest) {
        return current;
      }

      return {
        ...current,
        tasks: [
          {
            id: createId('task'),
            category: 'Guests',
            completed: false,
            detail: `Follow up with ${guest.name} about RSVP, meal choice, and table assignment.`,
            dueDate: today(),
            title: `Reminder sent to ${guest.name}`,
          },
          ...current.tasks,
        ],
      };
    });
  }, []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'completed'> & Partial<Pick<Task, 'completed'>>) => {
    setData((current) => ({
      ...current,
      tasks: [{ id: createId('task'), completed: false, ...task }, ...current.tasks],
    }));
  }, []);

  const updateTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    }));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  }, []);

  const updateRsvp = useCallback((guestId: string, rsvp: RsvpStatus) => {
    setData((current) => ({
      ...current,
      guests: current.guests.map((guest) => (guest.id === guestId ? { ...guest, rsvp } : guest)),
    }));
  }, []);

  const addDocument = useCallback((document: Omit<DocumentItem, 'id' | 'updatedAt'> & Partial<Pick<DocumentItem, 'updatedAt'>>) => {
    setData((current) => ({
      ...current,
      documents: [{ id: createId('document'), updatedAt: today(), ...document }, ...current.documents],
    }));
  }, []);

  const updateDocumentStatus = useCallback((documentId: string, status: DocumentItem['status']) => {
    setData((current) => ({
      ...current,
      documents: current.documents.map((document) => (document.id === documentId ? { ...document, status, updatedAt: today() } : document)),
    }));
  }, []);

  const updateContractStatus = useCallback((contractId: string, status: ContractItem['status']) => {
    setData((current) => ({
      ...current,
      contracts: current.contracts.map((contract) => (contract.id === contractId ? { ...contract, status } : contract)),
    }));
  }, []);

  const toggleDayOfEvent = useCallback((eventId: string) => {
    setData((current) => ({
      ...current,
      dayOf: current.dayOf.map((event) => (event.id === eventId ? { ...event, completed: !event.completed } : event)),
    }));
  }, []);

  const toggleDayOfChecklistItem = useCallback((itemId: string) => {
    setData((current) => ({
      ...current,
      dayOfChecklist: current.dayOfChecklist.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item)),
    }));
  }, []);

  const updateHotelBlock = useCallback((hotelId: string, patch: Partial<HotelBlock>) => {
    setData((current) => ({
      ...current,
      hotels: current.hotels.map((hotel) => (hotel.id === hotelId ? { ...hotel, ...patch } : hotel)),
    }));
  }, []);

  const updateWebsiteSectionStatus = useCallback((sectionId: string, status: WebsiteSection['status']) => {
    setData((current) => ({
      ...current,
      websiteSections: current.websiteSections.map((section) => (section.id === sectionId ? { ...section, status } : section)),
    }));
  }, []);

  const updateGuestPhotoDropSettings = useCallback((settings: Partial<GuestPhotoDropSettings>) => {
    setData((current) =>
      withActivity(
        {
          ...current,
          guestPhotoDrop: {
            ...current.guestPhotoDrop,
            ...settings,
          },
        },
        'Updated guest photo drop',
        'Guest upload QR settings, instructions, or photo destination changed.',
      ),
    );
  }, []);

  const updateGuestPhotoUploadStatus = useCallback((uploadId: string, status: GuestPhotoUpload['status']) => {
    setData((current) => {
      const upload = current.guestPhotoUploads.find((item) => item.id === uploadId);
      return withActivity(
        {
          ...current,
          guestPhotoUploads: current.guestPhotoUploads.map((item) => (item.id === uploadId ? { ...item, status } : item)),
        },
        `${status} guest photos`,
        `${upload?.guestName ?? 'A guest'} photo upload was marked ${status.toLowerCase()}.`,
        status === 'Hidden' ? 'delete' : 'update',
      );
    });
  }, []);

  const updateInvitationStatus = useCallback((invitationId: string, status: InvitationSuite['status']) => {
    setData((current) => ({
      ...current,
      invitations: current.invitations.map((invitation) => {
        if (invitation.id !== invitationId) {
          return invitation;
        }

        if (status === 'Sent') {
          const sent = Math.max(invitation.sent, current.profile.guestTarget);
          return {
            ...invitation,
            status,
            sent,
            opened: Math.max(invitation.opened, Math.round(sent * 0.72)),
          };
        }

        return { ...invitation, status };
      }),
    }));
  }, []);

  const addWorkspaceInvite = useCallback((invite: Omit<WorkspaceInvite, 'id' | 'status'> & Partial<Pick<WorkspaceInvite, 'status'>>) => {
    setData((current) => ({
      ...current,
      workspaceInvites: [{ id: createId('invite'), status: 'Pending', ...invite }, ...current.workspaceInvites],
    }));
  }, []);

  const respondAsAria = useCallback((prompt: string) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      return;
    }

    setData((current) => {
      const openTasks = current.tasks.filter((task) => !task.completed).slice(0, 2);
      const pendingGuests = current.guests.filter((guest) => guest.rsvp === 'Pending').length;
      const reviewContracts = current.contracts.filter((contract) => contract.status !== 'Signed').length;

      return {
        ...current,
        ariaMessages: [
          ...current.ariaMessages,
          { id: createId('aria-user'), role: 'user', text: cleanPrompt },
          {
            id: createId('aria-assistant'),
            role: 'assistant',
            text: `I would prioritize ${openTasks.map((task) => task.title.toLowerCase()).join(' and ') || "today's planning list"}. You also have ${pendingGuests} pending RSVP guests and ${reviewContracts} contracts needing attention.`,
          },
        ],
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      addBudgetExpense,
      addDocument,
      addGuest,
      addRsvpResponseEmail,
      addTask,
      addVendor,
      addWorkspaceInvite,
      data,
      deleteBudgetExpense,
      deleteGuest,
      deleteTask,
      deleteVendor,
      exportPlanningData,
      loading,
      lastSyncedAt,
      recordBudgetPayment,
      recordVendorPayment,
      refresh,
      removeRsvpResponseEmail,
      respondAsAria,
      scheduleVendorPayment,
      sendGuestReminder,
      toggleDayOfChecklistItem,
      toggleDayOfEvent,
      toggleTask,
      updateBudgetExpense,
      updateContractStatus,
      updateDocumentStatus,
      updateGuest,
      updateGuestPhotoDropSettings,
      updateGuestPhotoUploadStatus,
      updateHotelBlock,
      updateInvitationStatus,
      updateProfile,
      updateRsvp,
      updateSettings,
      updateTask,
      updateVendor,
      updateWebsiteSectionStatus,
    }),
    [
      addBudgetExpense,
      addDocument,
      addGuest,
      addRsvpResponseEmail,
      addTask,
      addVendor,
      addWorkspaceInvite,
      data,
      deleteBudgetExpense,
      deleteGuest,
      deleteTask,
      deleteVendor,
      exportPlanningData,
      lastSyncedAt,
      loading,
      recordBudgetPayment,
      recordVendorPayment,
      refresh,
      removeRsvpResponseEmail,
      respondAsAria,
      scheduleVendorPayment,
      sendGuestReminder,
      toggleDayOfChecklistItem,
      toggleDayOfEvent,
      toggleTask,
      updateBudgetExpense,
      updateContractStatus,
      updateDocumentStatus,
      updateGuest,
      updateGuestPhotoDropSettings,
      updateGuestPhotoUploadStatus,
      updateHotelBlock,
      updateInvitationStatus,
      updateProfile,
      updateRsvp,
      updateSettings,
      updateTask,
      updateVendor,
      updateWebsiteSectionStatus,
    ],
  );

  return <PlanningDataContext.Provider value={value}>{children}</PlanningDataContext.Provider>;
}

export function usePlanningData() {
  const value = useContext(PlanningDataContext);
  if (!value) {
    throw new Error('usePlanningData must be used inside PlanningDataProvider');
  }
  return value;
}
