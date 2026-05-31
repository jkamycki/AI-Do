import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { createMobileBudgetExpense, createMobileBudgetPayment, deleteMobileBudgetExpense, updateMobileBudgetExpense } from '../api/budget';
import { createMobileTask, deleteMobileTask, syncDayOfChecklistCompletion, syncTaskCompletion, updateMobileTask } from '../api/checklist';
import { getPlanningData, getRemotePlanningData, mergePlanningData } from '../api/client';
import { inviteMobileCollaborator, workspaceRoleFromApi } from '../api/collaboration';
import { updateMobileContractStatus } from '../api/contracts';
import { syncDayOfEventCompletion } from '../api/dayOf';
import { updateMobileDocumentStatus } from '../api/documents';
import { createMobileGuest, deleteMobileGuest, updateMobileGuest } from '../api/guests';
import { sendSingleRsvpReminder } from '../api/guestMessaging';
import { updateMobileHotel } from '../api/hotels';
import { saveMobileGuestPhotoDropSettings, updateMobileGuestPhotoUploadStatus } from '../api/photoDrop';
import { saveMobileProfile, saveMobileSettings } from '../api/profile';
import { createMobileVendor, createMobileVendorPayment, deleteMobileVendor, updateMobileVendor } from '../api/vendors';
import { publishMobileWebsite, saveMobileWebsiteQuickUpdate } from '../api/website';
import { createMobileWeddingPartyMember, deleteMobileWeddingPartyMember, updateMobileWeddingPartyMember } from '../api/weddingParty';
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
  WeddingPartyMember,
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
  addWeddingPartyMember: (member: Omit<WeddingPartyMember, 'id'>) => void;
  addWorkspaceInvite: (invite: Omit<WorkspaceInvite, 'id' | 'status'> & Partial<Pick<WorkspaceInvite, 'status'>>) => void;
  deleteBudgetExpense: (expenseId: string) => void;
  deleteGuest: (guestId: string) => void;
  deleteTask: (taskId: string) => void;
  deleteVendor: (vendorId: string) => void;
  deleteWeddingPartyMember: (memberId: string) => void;
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
  updateWeddingPartyMember: (memberId: string, patch: Partial<WeddingPartyMember>) => void;
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

function invitationMetrics(invitation: InvitationSuite, guests: Guest[]) {
  const responses = guests.filter((guest) => guest.rsvp === 'Confirmed' || guest.rsvp === 'Declined').length;
  const sent =
    invitation.type === 'Save the Date'
      ? guests.filter((guest) => guest.saveTheDateStatus === 'sent').length
      : guests.filter((guest) => guest.invitationStatus === 'sent').length;

  return {
    opened: invitation.type === 'Save the Date' ? sent : responses,
    responses,
    sent,
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

function syncQuietly(action: Promise<unknown>) {
  void action.catch(() => undefined);
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
    setData((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      const nextCompleted = !task?.completed;
      if (task) {
        syncQuietly(syncTaskCompletion(task.id, nextCompleted));
      }

      return withActivity(
        {
          ...current,
          tasks: current.tasks.map((item) => (item.id === taskId ? { ...item, completed: !item.completed } : item)),
        },
        nextCompleted ? 'Completed checklist task' : 'Reopened checklist task',
        `${task?.title ?? 'A checklist item'} was ${nextCompleted ? 'marked complete' : 'reopened'}.`,
        'update',
      );
    });
  }, []);

  const updateProfile = useCallback((profile: Partial<CoupleProfile>) => {
    setData((current) =>
      {
        const nextProfile = {
          ...current.profile,
          ...profile,
        };

        syncQuietly(saveMobileProfile(nextProfile, current.settings));

        return withActivity(
          {
            ...current,
            profile: nextProfile,
          },
        'Updated wedding profile',
        'Couple details, date, venue, or planning preferences changed.',
        );
      },
    );
  }, []);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    setData((current) => {
      const nextSettings = {
        ...current.settings,
        ...settings,
      };

      syncQuietly(saveMobileSettings(current.profile, nextSettings));

      return withActivity(
        {
          ...current,
          settings: nextSettings,
        },
        'Updated settings',
        'Notification, RSVP, Aria, or privacy preferences changed.',
      );
    });
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

      const nextSettings = {
        ...current.settings,
        rsvpResponseEmails: [...current.settings.rsvpResponseEmails, cleanEmail],
      };

      syncQuietly(saveMobileSettings(current.profile, nextSettings));

      return withActivity(
        {
          ...current,
          settings: nextSettings,
        },
        'Added RSVP email',
        `${cleanEmail} will receive RSVP response copies.`,
        'create',
      );
    });
  }, []);

  const removeRsvpResponseEmail = useCallback((email: string) => {
    setData((current) => {
      const nextSettings = {
        ...current.settings,
        rsvpResponseEmails: current.settings.rsvpResponseEmails.filter((item) => item !== email),
      };

      syncQuietly(saveMobileSettings(current.profile, nextSettings));

      return withActivity(
        {
          ...current,
          settings: nextSettings,
        },
        'Removed RSVP email',
        `${email} no longer receives RSVP response copies.`,
        'delete',
      );
    });
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

      const nextData = withActivity(
        {
          ...current,
          vendors: [nextVendor, ...current.vendors],
        },
        'Created vendor',
        `${nextVendor.name} was added to My Vendors.`,
        'create',
      );

      syncQuietly(
        createMobileVendor(nextVendor).then((result) => {
          if (!result.vendor) return;
          setData((latest) => ({
            ...latest,
            vendors: latest.vendors.map((item) => (item.id === nextVendor.id ? result.vendor! : item)),
          }));
        }),
      );

      return nextData;
    });
  }, []);

  const updateVendor = useCallback((vendorId: string, patch: Partial<Vendor>) => {
    setData((current) => {
      const vendor = current.vendors.find((item) => item.id === vendorId);
      const nextVendor = vendor ? rebalanceVendor({ ...vendor, ...patch }) : null;
      if (nextVendor) {
        syncQuietly(updateMobileVendor(nextVendor));
      }

      return withActivity(
        {
          ...current,
          vendors: current.vendors.map((item) => (item.id === vendorId && nextVendor ? nextVendor : item)),
        },
        'Updated vendor',
        `${vendor?.name ?? 'Vendor'} details changed.`,
      );
    });
  }, []);

  const deleteVendor = useCallback((vendorId: string) => {
    setData((current) => {
      const vendor = current.vendors.find((item) => item.id === vendorId);
      syncQuietly(deleteMobileVendor(vendorId));
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
    const cleanDate = date?.trim();
    if (!cleanDate) {
      return;
    }

    setData((current) => {
      const localPayment = {
        id: createId('payment'),
        amount,
        date: cleanDate,
        isPaid: true,
        note: note || 'Mobile payment entry',
      };

      syncQuietly(
        createMobileVendorPayment(vendorId, { amount, date: cleanDate, isPaid: true, note }).then((result) => {
          if (!result.payment) return;
          setData((latest) => ({
            ...latest,
            vendors: latest.vendors.map((vendor) =>
              vendor.id === vendorId
                ? {
                    ...vendor,
                    payments: vendor.payments.map((payment) => (payment.id === localPayment.id ? result.payment! : payment)),
                  }
                : vendor,
            ),
          }));
        }),
      );

      return {
        ...current,
        vendors: current.vendors.map((vendor) => {
          if (vendor.id !== vendorId) {
            return vendor;
          }

          return rebalanceVendor({
            ...vendor,
            paid: vendor.paid + amount,
            payments: [...vendor.payments, localPayment],
          });
        }),
        activityLog: [
          createActivity('Recorded vendor payment', `${formatPaymentAmount(amount)} was recorded for vendor tracking.`),
          ...current.activityLog,
        ].slice(0, 40),
      };
    });
  }, []);

  const scheduleVendorPayment = useCallback((vendorId: string, date: string) => {
    setData((current) => {
      const vendor = current.vendors.find((item) => item.id === vendorId);
      if (vendor) {
        syncQuietly(updateMobileVendor({ ...vendor, nextPaymentDate: date }));
      }
      return withActivity(
        {
          ...current,
          vendors: current.vendors.map((item) => (item.id === vendorId ? { ...item, nextPaymentDate: date } : item)),
        },
        'Scheduled vendor payment',
        `${vendor?.name ?? 'Vendor'} next payment date was updated.`,
      );
    });
  }, []);

  const addBudgetExpense = useCallback((expense: Omit<BudgetExpense, 'id' | 'paid' | 'payments'> & Partial<Pick<BudgetExpense, 'paid' | 'payments'>>) => {
    setData((current) => {
      const nextExpense = rebalanceBudgetExpense({
        id: createId('budget'),
        paid: 0,
        payments: [],
        ...expense,
      });

      syncQuietly(
        createMobileBudgetExpense(nextExpense).then((result) => {
          if (!result.expense) return;
          setData((latest) => ({
            ...latest,
            budget: latest.budget.map((item) => (item.id === nextExpense.id ? result.expense! : item)),
          }));
        }),
      );

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
    setData((current) => {
      const expense = current.budget.find((item) => item.id === expenseId);
      const nextExpense = expense ? rebalanceBudgetExpense({ ...expense, ...patch }) : null;
      if (nextExpense) {
        syncQuietly(updateMobileBudgetExpense(nextExpense));
      }

      return {
        ...current,
        budget: current.budget.map((expense) => (expense.id === expenseId && nextExpense ? nextExpense : expense)),
      };
    });
  }, []);

  const deleteBudgetExpense = useCallback((expenseId: string) => {
    syncQuietly(deleteMobileBudgetExpense(expenseId));
    setData((current) => ({
      ...current,
      budget: current.budget.filter((expense) => expense.id !== expenseId),
    }));
  }, []);

  const recordBudgetPayment = useCallback((expenseId: string, amount: number, note: string, date?: string) => {
    const cleanDate = date?.trim();
    if (!cleanDate) {
      return;
    }

    setData((current) => {
      const localPayment = {
        id: createId('budget-payment'),
        amount,
        date: cleanDate,
        isPaid: true,
        note: note || 'Mobile payment entry',
      };

      syncQuietly(
        createMobileBudgetPayment(expenseId, { amount, date: cleanDate, note }).then((result) => {
          if (!result.payment && result.newAmountPaid == null) return;
          setData((latest) => ({
            ...latest,
            budget: latest.budget.map((expense) => {
              if (expense.id !== expenseId) return expense;
              return rebalanceBudgetExpense({
                ...expense,
                paid: result.newAmountPaid ?? expense.paid,
                payments: result.payment
                  ? expense.payments.map((payment) => (payment.id === localPayment.id ? result.payment! : payment))
                  : expense.payments,
              });
            }),
          }));
        }),
      );

      return {
        ...current,
        budget: current.budget.map((expense) => {
          if (expense.id !== expenseId) {
            return expense;
          }

          return rebalanceBudgetExpense({
            ...expense,
            paid: expense.paid + amount,
            payments: [...expense.payments, localPayment],
          });
        }),
        activityLog: [
          createActivity('Recorded budget payment', `${formatPaymentAmount(amount)} was added to the budget summary.`),
          ...current.activityLog,
        ].slice(0, 40),
      };
    });
  }, []);

  const addGuest = useCallback((guest: Omit<Guest, 'id'>) => {
    setData((current) => {
      const nextGuest = { id: createId('guest'), ...guest };

      syncQuietly(
        createMobileGuest(nextGuest).then((result) => {
          if (!result.guest) return;
          setData((latest) => ({
            ...latest,
            guests: latest.guests.map((item) => (item.id === nextGuest.id ? result.guest! : item)),
          }));
        }),
      );

      return {
        ...current,
        guests: [nextGuest, ...current.guests],
      };
    });
  }, []);

  const updateGuest = useCallback((guestId: string, patch: Partial<Guest>) => {
    setData((current) => {
      const guest = current.guests.find((item) => item.id === guestId);
      const nextGuest = guest ? { ...guest, ...patch } : null;
      if (nextGuest) {
        syncQuietly(updateMobileGuest(nextGuest));
      }

      return {
        ...current,
        guests: current.guests.map((guest) => (guest.id === guestId && nextGuest ? nextGuest : guest)),
      };
    });
  }, []);

  const deleteGuest = useCallback((guestId: string) => {
    syncQuietly(deleteMobileGuest(guestId));
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

      if (/^\d+$/.test(guest.id)) {
        syncQuietly(sendSingleRsvpReminder(Number(guest.id)));
      }

      return {
        ...current,
        guests: current.guests.map((item) => (item.id === guestId ? { ...item, rsvpReminderStatus: 'sent' } : item)),
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
    setData((current) => {
      const nextTask = { id: createId('task'), completed: false, ...task };

      syncQuietly(
        createMobileTask(nextTask).then((result) => {
          if (!result.task) return;
          setData((latest) => ({
            ...latest,
            tasks: latest.tasks.map((item) => (item.id === nextTask.id ? result.task! : item)),
          }));
        }),
      );

      return withActivity(
        {
          ...current,
          tasks: [nextTask, ...current.tasks],
        },
        'Created checklist task',
        `${task.title} was added to the mobile checklist.`,
        'create',
      );
    });
  }, []);

  const updateTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setData((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      const nextTask = task ? { ...task, ...patch } : null;
      if (nextTask) {
        syncQuietly(updateMobileTask(nextTask));
      }

      return withActivity(
        {
          ...current,
          tasks: current.tasks.map((item) => (item.id === taskId && nextTask ? nextTask : item)),
        },
        'Updated checklist task',
        `${patch.title ?? task?.title ?? 'A checklist item'} was edited.`,
      );
    });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setData((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      syncQuietly(deleteMobileTask(taskId));
      return withActivity(
        {
          ...current,
          tasks: current.tasks.filter((item) => item.id !== taskId),
        },
        'Deleted checklist task',
        `${task?.title ?? 'A checklist item'} was removed.`,
        'delete',
      );
    });
  }, []);

  const updateRsvp = useCallback((guestId: string, rsvp: RsvpStatus) => {
    setData((current) => {
      const guest = current.guests.find((item) => item.id === guestId);
      const nextGuest = guest ? { ...guest, rsvp } : null;
      if (nextGuest) {
        syncQuietly(updateMobileGuest(nextGuest));
      }

      return {
        ...current,
        guests: current.guests.map((guest) => (guest.id === guestId && nextGuest ? nextGuest : guest)),
      };
    });
  }, []);

  const addDocument = useCallback((document: Omit<DocumentItem, 'id' | 'updatedAt'> & Partial<Pick<DocumentItem, 'updatedAt'>>) => {
    setData((current) => ({
      ...current,
      documents: [{ id: createId('document'), updatedAt: today(), ...document }, ...current.documents],
    }));
  }, []);

  const addWeddingPartyMember = useCallback((member: Omit<WeddingPartyMember, 'id'>) => {
    setData((current) => {
      const nextMember = { id: createId('party'), ...member };

      syncQuietly(
        createMobileWeddingPartyMember(nextMember).then((result) => {
          if (!result.member) return;
          setData((latest) => ({
            ...latest,
            weddingParty: latest.weddingParty.map((item) => (item.id === nextMember.id ? result.member! : item)),
          }));
        }),
      );

      return withActivity(
        {
          ...current,
          weddingParty: [nextMember, ...current.weddingParty],
        },
        'Added wedding party member',
        `${nextMember.name} was added to the wedding party.`,
        'create',
      );
    });
  }, []);

  const updateWeddingPartyMember = useCallback((memberId: string, patch: Partial<WeddingPartyMember>) => {
    setData((current) => {
      const member = current.weddingParty.find((item) => item.id === memberId);
      const nextMember = member ? { ...member, ...patch } : null;
      if (nextMember) {
        syncQuietly(updateMobileWeddingPartyMember(nextMember));
      }

      return withActivity(
        {
          ...current,
          weddingParty: current.weddingParty.map((item) => (item.id === memberId && nextMember ? nextMember : item)),
        },
        'Updated wedding party member',
        `${nextMember?.name ?? member?.name ?? 'A wedding party member'} was updated.`,
      );
    });
  }, []);

  const deleteWeddingPartyMember = useCallback((memberId: string) => {
    setData((current) => {
      const member = current.weddingParty.find((item) => item.id === memberId);
      syncQuietly(deleteMobileWeddingPartyMember(memberId));

      return withActivity(
        {
          ...current,
          weddingParty: current.weddingParty.filter((item) => item.id !== memberId),
        },
        'Removed wedding party member',
        `${member?.name ?? 'A wedding party member'} was removed.`,
        'delete',
      );
    });
  }, []);

  const updateDocumentStatus = useCallback((documentId: string, status: DocumentItem['status']) => {
    syncQuietly(updateMobileDocumentStatus(documentId, status));
    setData((current) => ({
      ...current,
      documents: current.documents.map((document) => (document.id === documentId ? { ...document, status, updatedAt: today() } : document)),
    }));
  }, []);

  const updateContractStatus = useCallback((contractId: string, status: ContractItem['status']) => {
    syncQuietly(updateMobileContractStatus(contractId, status));
    setData((current) => ({
      ...current,
      contracts: current.contracts.map((contract) => (contract.id === contractId ? { ...contract, status } : contract)),
    }));
  }, []);

  const toggleDayOfEvent = useCallback((eventId: string) => {
    setData((current) => {
      const event = current.dayOf.find((item) => item.id === eventId);
      const nextCompleted = !event?.completed;
      if (event) {
        syncQuietly(syncDayOfEventCompletion(event, nextCompleted));
      }

      return {
        ...current,
        dayOf: current.dayOf.map((event) => (event.id === eventId ? { ...event, completed: nextCompleted } : event)),
      };
    });
  }, []);

  const toggleDayOfChecklistItem = useCallback((itemId: string) => {
    setData((current) => {
      const item = current.dayOfChecklist.find((entry) => entry.id === itemId);
      const nextCompleted = !item?.completed;
      if (item) {
        syncQuietly(syncDayOfChecklistCompletion(item, nextCompleted, current.profile.weddingDate));
      }

      return {
        ...current,
        dayOfChecklist: current.dayOfChecklist.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item)),
      };
    });
  }, []);

  const updateHotelBlock = useCallback((hotelId: string, patch: Partial<HotelBlock>) => {
    setData((current) => {
      const hotel = current.hotels.find((item) => item.id === hotelId);
      const nextHotel = hotel ? { ...hotel, ...patch } : null;
      if (nextHotel) {
        syncQuietly(updateMobileHotel(nextHotel));
      }

      return {
        ...current,
        hotels: current.hotels.map((hotel) => (hotel.id === hotelId && nextHotel ? nextHotel : hotel)),
      };
    });
  }, []);

  const updateWebsiteSectionStatus = useCallback((sectionId: string, status: WebsiteSection['status']) => {
    setData((current) => {
      const nextSections = current.websiteSections.map((section) => (section.id === sectionId ? { ...section, status } : section));
      const sectionsEnabled = Object.fromEntries(nextSections.map((section) => [section.id, section.status !== 'Draft']));

      syncQuietly(saveMobileWebsiteQuickUpdate({ sectionsEnabled }));
      if (status === 'Published') {
        syncQuietly(publishMobileWebsite(true));
      }

      return {
        ...current,
        websiteSections: nextSections,
      };
    });
  }, []);

  const updateGuestPhotoDropSettings = useCallback((settings: Partial<GuestPhotoDropSettings>) => {
    setData((current) => {
      const nextSettings = {
        ...current.guestPhotoDrop,
        ...settings,
      };

      syncQuietly(saveMobileGuestPhotoDropSettings(nextSettings));

      return withActivity(
        {
          ...current,
          guestPhotoDrop: nextSettings,
        },
        'Updated guest photo drop',
        'Guest upload QR settings, instructions, or photo destination changed.',
      );
    });
  }, []);

  const updateGuestPhotoUploadStatus = useCallback((uploadId: string, status: GuestPhotoUpload['status']) => {
    setData((current) => {
      const upload = current.guestPhotoUploads.find((item) => item.id === uploadId);
      syncQuietly(
        updateMobileGuestPhotoUploadStatus(uploadId, status).then((result) => {
          setData((latest) => ({
            ...latest,
            guestPhotoUploads: latest.guestPhotoUploads.map((item) => (item.id === uploadId ? result : item)),
          }));
        }),
      );

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
          return {
            ...invitation,
            status,
            ...invitationMetrics(invitation, current.guests),
          };
        }

        return { ...invitation, status };
      }),
    }));
  }, []);

  const addWorkspaceInvite = useCallback((invite: Omit<WorkspaceInvite, 'id' | 'status'> & Partial<Pick<WorkspaceInvite, 'status'>>) => {
    setData((current) => {
      const nextInvite = { id: createId('invite'), status: 'Pending' as const, ...invite };

      syncQuietly(
        inviteMobileCollaborator({ email: nextInvite.email, role: nextInvite.role }).then((result) => {
          setData((latest) => ({
            ...latest,
            workspaceInvites: latest.workspaceInvites.map((item) =>
              item.id === nextInvite.id
                ? {
                    email: result.inviteeEmail ?? nextInvite.email,
                    id: String(result.id ?? nextInvite.id),
                    role: workspaceRoleFromApi(result.role) as WorkspaceInvite['role'],
                    status: result.status === 'active' ? 'Accepted' : 'Pending',
                  }
                : item,
            ),
          }));
        }),
      );

      return {
        ...current,
        workspaceInvites: [nextInvite, ...current.workspaceInvites],
      };
    });
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
      addWeddingPartyMember,
      addWorkspaceInvite,
      data,
      deleteBudgetExpense,
      deleteGuest,
      deleteTask,
      deleteVendor,
      deleteWeddingPartyMember,
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
      updateWeddingPartyMember,
      updateWebsiteSectionStatus,
    }),
    [
      addBudgetExpense,
      addDocument,
      addGuest,
      addRsvpResponseEmail,
      addTask,
      addVendor,
      addWeddingPartyMember,
      addWorkspaceInvite,
      data,
      deleteBudgetExpense,
      deleteGuest,
      deleteTask,
      deleteVendor,
      deleteWeddingPartyMember,
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
      updateWeddingPartyMember,
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
