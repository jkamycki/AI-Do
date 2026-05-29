import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ClerkProvider, useAuth, useSSO, useSignIn, useSignUp, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { getPlanningData, mergePlanningData } from './src/api/client';
import { sendMobileAriaMessage } from './src/api/aria';
import { syncDayOfChecklistCompletion, syncTaskCompletion } from './src/api/checklist';
import { inviteMobileCollaborator, listMobileCollaborators } from './src/api/collaboration';
import { listMobileContracts, type MobileContractRecord } from './src/api/contracts';
import { listMobileDocuments, type MobileDocumentRecord } from './src/api/documents';
import { createMobileGuest, deleteMobileGuest, updateMobileGuest } from './src/api/guests';
import { sendPendingRsvpReminders, sendRsvpInvitations, sendSaveTheDates } from './src/api/guestMessaging';
import { createMobileHotel, deleteMobileHotel, updateMobileHotel } from './src/api/hotels';
import { saveMobileInvitationStudio } from './src/api/invitationStudio';
import { getMobileAuthToken, hasMobileApiBase, mobileAuthFetch, saveMobileAuthToken, setMobileAuthTokenGetter } from './src/api/mobileAuth';
import { saveMobileGuestPhotoDropSettings } from './src/api/photoDrop';
import { saveMobileProfile } from './src/api/profile';
import { applySeatingChart, generateSeatingChart, saveSeatingChart, updateSeatingChart, type SeatingGuestPayload } from './src/api/seating';
import { createMobileVendor, deleteMobileVendor, updateMobileVendor } from './src/api/vendors';
import { getOrCreateMobileVendorConversation, listMobileVendorMessages, sendMobileVendorMessage } from './src/api/vendorMessaging';
import { createMobileWebsite, getMobileWebsite, publishMobileWebsite, saveMobileWebsiteQuickUpdate, saveMobileWebsiteSlug, type MobileWebsiteRecord } from './src/api/website';
import { createMobileWeddingPartyMember, deleteMobileWeddingPartyMember, updateMobileWeddingPartyMember } from './src/api/weddingParty';
import { samplePlanningData } from './src/data/sampleData';
import type { Guest, GuestPhotoDropSettings } from './src/types';
import { daysFromToday, formatCurrency, formatDeadlineLabel, formatShortDate, parseDate } from './src/utils/format';

const logo = require('./assets/aido-logo.png');
const ariaAvatar = require('./assets/aria-avatar.png');
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
const couplePhotoUri =
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=640&q=90';
const userAvatarUri =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=180&q=80';

type TabId = 'today' | 'website' | 'plan' | 'guests' | 'vendors' | 'money' | 'more';
type BottomTabId = TabId | 'aria';
type GuestHubView = 'guests' | 'seating' | 'invites' | 'travel' | 'website';

type MobileSeatingTable = {
  guests: string[];
  tableName: string;
  tableNumber: number;
  theme?: string;
};

type MobileSeatingResult = {
  insights: string[];
  tables: MobileSeatingTable[];
  totalSeated: number;
  warnings: string[];
};

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: 'wedding' | 'task' | 'payment' | 'vendor' | 'hotel' | 'dayof' | 'custom';
  detail: string;
  link?: string;
  time?: string;
};

type MockAction = {
  title: string;
  detail: string;
  primaryLabel?: string;
};

type AuthUser = {
  email: string;
  firstName: string;
  isNewUser: boolean;
};

type ClerkSessionBridge = {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  user: {
    emailAddresses?: Array<{ emailAddress?: string | null }>;
    firstName?: string | null;
    primaryEmailAddress?: { emailAddress?: string | null } | null;
  } | null | undefined;
};

type VendorRecord = (typeof samplePlanningData.vendors)[number];
type BudgetRecord = (typeof samplePlanningData.budget)[number];
type ScheduledPayment = {
  id: string;
  amount: number;
  date: string;
  label: string;
};
type LocalBudgetRecord = BudgetRecord & {
  manualExpenseId?: number;
  notes?: string;
  receiptName?: string;
  scheduledPayments: ScheduledPayment[];
  source?: 'vendor' | 'misc';
  vendorId?: number;
};

type ApiVendor = {
  category: string;
  contractSigned?: boolean;
  depositAmount?: number;
  email?: string | null;
  id: number;
  name: string;
  nextPaymentDue?: string | null;
  payments?: Array<{ amount: number; dueDate: string; id: number; isPaid: boolean; label: string; paidAt?: string | null }>;
  phone?: string | null;
  totalCost?: number;
};

type ApiVendorFinancials = {
  totalCommitted: number;
  totalPaid: number;
  vendors: Array<{
    category: string;
    id: number;
    isPaidOff: boolean;
    name: string;
    nextPaymentAmount: number | null;
    nextPaymentDue: string | null;
    nextPaymentId: number | null;
    nextPaymentLabel: string | null;
    totalCost: number;
    totalPaid: number;
  }>;
};

type ApiManualExpense = {
  amountPaid: number;
  category: string;
  cost: number;
  id: number;
  name: string;
  nextPaymentAmount?: number | null;
  nextPaymentId?: number | null;
  nextPaymentDue?: string | null;
  payments?: Array<{
    amount: number;
    description?: string | null;
    dueDate?: string | null;
    id: number;
    isPaid?: boolean;
  }>;
  notes?: string | null;
  receiptName?: string | null;
};

const storageKeys = {
  authUser: 'aido.mobile.authUser',
  budgetItems: 'aido.mobile.budgetItems',
  completedAgendaIds: 'aido.mobile.completedAgendaIds',
  calendarEvents: 'aido.mobile.calendarEvents',
  needsOnboarding: 'aido.mobile.needsOnboarding',
  planningData: 'aido.mobile.planningData',
  registryConnected: 'aido.mobile.registryConnected',
  registryUrl: 'aido.mobile.registryUrl',
};

const colors = {
  bg: '#FFF8F4',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF2EA',
  ink: '#271B22',
  muted: '#765D67',
  faint: '#EFE1E5',
  rose: '#A93D5B',
  roseSoft: '#F8DDE5',
  gold: '#B98343',
  goldSoft: '#F4DEBE',
  green: '#637B59',
  blue: '#496D89',
};

const tabs: Array<{ id: BottomTabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'today', label: 'Home', icon: 'home-outline' },
  { id: 'plan', label: 'Planner', icon: 'calendar-clear-outline' },
  { id: 'website', label: 'Guest Hub', icon: 'globe-outline' },
  { id: 'money', label: 'Finance', icon: 'wallet-outline' },
  { id: 'aria', label: 'Aria', icon: 'sparkles-outline' },
  { id: 'more', label: 'More', icon: 'grid-outline' },
];

const featureGroups = [
  {
    title: 'Account',
    items: [
      ['Account settings', 'Profile photo, name, email, and sign-in details.', 'person-circle-outline'],
      ['Notifications', 'Deadline alerts, RSVP updates, and reminder preferences.', 'notifications-outline'],
      ['Privacy & data', 'Aria memory, data export, and privacy controls.', 'shield-checkmark-outline'],
    ],
  },
  {
    title: 'Collaboration',
    items: [
      ['Workspace', 'Partner, planner, family, and vendor collaboration.', 'business-outline'],
      ['Wedding party', 'Roles, attire, duties, and contact sheet.', 'person-add-outline'],
    ],
  },
];

export default function App() {
  if (!clerkPublishableKey || Platform.OS === 'web') {
    return <MobileAppContent />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkBackedMobileApp />
    </ClerkProvider>
  );
}

function ClerkBackedMobileApp() {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  return (
    <MobileAppContent
      clerkSession={{
        getToken,
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        signOut,
        user,
      }}
    />
  );
}

function MobileAppContent({ clerkSession }: { clerkSession?: ClerkSessionBridge }) {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [guestHubView, setGuestHubView] = useState<GuestHubView>('guests');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [data, setData] = useState<typeof samplePlanningData>(samplePlanningData);
  const [planningDataLoaded, setPlanningDataLoaded] = useState(false);
  const [ariaOpen, setAriaOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mockAction, setMockAction] = useState<MockAction | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const { height, width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('./assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('./assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('./assets/fonts/Inter_700Bold.ttf'),
    GreatVibes_400Regular: require('./assets/fonts/GreatVibes-Regular.ttf'),
    PlayfairDisplay_600SemiBold: require('./assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
    PlayfairDisplay_700Bold: require('./assets/fonts/PlayfairDisplay_700Bold.ttf'),
  });

  const stats = useMemo(() => {
    const completeTasks = data.tasks.filter((task) => task.completed).length;
    const progress = data.tasks.length ? Math.round((completeTasks / data.tasks.length) * 100) : 0;
    const confirmed = data.guests.filter((guest) => guest.rsvp === 'Confirmed').length;
    const pending = data.guests.filter((guest) => guest.rsvp === 'Pending').length;
    const paid = data.budget.reduce((sum, item) => sum + item.paid, 0);
    const total = data.budget.reduce((sum, item) => sum + item.total, 0);
    const reviewContracts = data.contracts.filter((contract) => contract.status !== 'Signed').length;
    const websiteDrafts = data.websiteSections.filter((section) => section.status !== 'Published').length;
    return { progress, confirmed, pending, paid, total, reviewContracts, websiteDrafts };
  }, [data]);

  const showPhonePreview = Platform.OS === 'web' && width >= 520;
  const maxWidth = showPhonePreview ? 390 : Math.min(width, 560);
  const previewHeight = Math.min(Math.max(height - 56, 700), 820);
  const updateTaskCompletion = (taskId: string, completed: boolean) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, completed } : task)),
    }));
    void syncTaskCompletion(taskId, completed).catch(() => {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, completed: !completed } : task)),
      }));
    });
  };
  const updateDayOfChecklistCompletion = (itemId: string, completed: boolean) => {
    const item = data.dayOfChecklist.find((entry) => entry.id === itemId);
    setData((current) => ({
      ...current,
      dayOfChecklist: current.dayOfChecklist.map((item) => (item.id === itemId ? { ...item, completed } : item)),
    }));
    if (!item) return;
    void syncDayOfChecklistCompletion(item, completed, data.profile.weddingDate).catch(() => {
      setData((current) => ({
        ...current,
        dayOfChecklist: current.dayOfChecklist.map((entry) => (entry.id === itemId ? { ...entry, completed: !completed } : entry)),
      }));
    });
  };
  const addWorkspaceInvite = (invite: (typeof samplePlanningData.workspaceInvites)[number]) => {
    setData((current) => ({
      ...current,
      workspaceInvites: [invite, ...current.workspaceInvites.filter((item) => item.email.toLowerCase() !== invite.email.toLowerCase())],
    }));
  };
  const addGuest = (guest: Guest) => {
    const localGuest = { ...guest, id: guest.id.startsWith('mobile-new-') ? `mobile-${Date.now()}` : guest.id };
    setData((current) => ({ ...current, guests: [localGuest, ...current.guests] }));
    void createMobileGuest(localGuest)
      .then((result) => {
        if (!result.synced || !result.guest) return;
        setData((current) => ({
          ...current,
          guests: current.guests.map((item) => (item.id === localGuest.id ? result.guest! : item)),
        }));
      })
      .catch((error) => {
        setData((current) => ({ ...current, guests: current.guests.filter((item) => item.id !== localGuest.id) }));
        setMockAction({
          title: 'Guest not saved',
          detail: error instanceof Error ? error.message : 'The guest could not be saved. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const updateGuest = (guest: Guest) => {
    const previous = data.guests.find((item) => item.id === guest.id);
    setData((current) => ({
      ...current,
      guests: current.guests.map((item) => (item.id === guest.id ? guest : item)),
    }));
    void updateMobileGuest(guest)
      .then((result) => {
        if (!result.synced || !result.guest) return;
        setData((current) => ({
          ...current,
          guests: current.guests.map((item) => (item.id === guest.id ? result.guest! : item)),
        }));
      })
      .catch((error) => {
        if (previous) {
          setData((current) => ({
            ...current,
            guests: current.guests.map((item) => (item.id === guest.id ? previous : item)),
          }));
        }
        setMockAction({
          title: 'Guest not updated',
          detail: error instanceof Error ? error.message : 'The guest could not be updated. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const removeGuest = (guestId: string) => {
    const previous = data.guests.find((item) => item.id === guestId);
    setData((current) => ({ ...current, guests: current.guests.filter((item) => item.id !== guestId) }));
    void deleteMobileGuest(guestId).catch((error) => {
      if (previous) {
        setData((current) => ({ ...current, guests: [previous, ...current.guests] }));
      }
      setMockAction({
        title: 'Guest not deleted',
        detail: error instanceof Error ? error.message : 'The guest could not be deleted. Please try again.',
        primaryLabel: 'Close',
      });
    });
  };
  const addVendor = (vendor: VendorRecord) => {
    const localVendor = { ...vendor, id: `vendor-new-${Date.now()}`, remaining: Math.max(0, vendor.committed - vendor.paid) };
    setData((current) => ({ ...current, vendors: [localVendor, ...current.vendors] }));
    void createMobileVendor(localVendor)
      .then((result) => {
        if (!result.synced || !result.vendor) return;
        setData((current) => ({
          ...current,
          vendors: current.vendors.map((item) => (item.id === localVendor.id ? result.vendor! : item)),
        }));
      })
      .catch((error) => {
        setData((current) => ({ ...current, vendors: current.vendors.filter((item) => item.id !== localVendor.id) }));
        setMockAction({
          title: 'Vendor not saved',
          detail: error instanceof Error ? error.message : 'The vendor could not be saved. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const updateVendor = (vendor: VendorRecord) => {
    const previous = data.vendors.find((item) => item.id === vendor.id);
    setData((current) => ({ ...current, vendors: current.vendors.map((item) => (item.id === vendor.id ? vendor : item)) }));
    setSelectedVendor(vendor);
    void updateMobileVendor(vendor)
      .then((result) => {
        if (!result.synced || !result.vendor) return;
        setData((current) => ({
          ...current,
          vendors: current.vendors.map((item) => (item.id === vendor.id ? result.vendor! : item)),
        }));
        setSelectedVendor(result.vendor);
      })
      .catch((error) => {
        if (previous) {
          setData((current) => ({ ...current, vendors: current.vendors.map((item) => (item.id === vendor.id ? previous : item)) }));
          setSelectedVendor(previous);
        }
        setMockAction({
          title: 'Vendor not updated',
          detail: error instanceof Error ? error.message : 'The vendor could not be updated. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const removeVendor = (vendorId: string) => {
    const previous = data.vendors.find((item) => item.id === vendorId);
    setData((current) => ({ ...current, vendors: current.vendors.filter((item) => item.id !== vendorId) }));
    setSelectedVendor(null);
    void deleteMobileVendor(vendorId).catch((error) => {
      if (previous) {
        setData((current) => ({ ...current, vendors: [previous, ...current.vendors] }));
      }
      setMockAction({
        title: 'Vendor not deleted',
        detail: error instanceof Error ? error.message : 'The vendor could not be deleted. Please try again.',
        primaryLabel: 'Close',
      });
    });
  };
  const addHotel = (hotel: (typeof samplePlanningData.hotels)[number]) => {
    const localHotel = { ...hotel, id: `hotel-new-${Date.now()}` };
    setData((current) => ({ ...current, hotels: [localHotel, ...current.hotels] }));
    void createMobileHotel(localHotel)
      .then((result) => {
        if (!result.synced || !result.hotel) return;
        setData((current) => ({
          ...current,
          hotels: current.hotels.map((item) => (item.id === localHotel.id ? result.hotel! : item)),
        }));
      })
      .catch((error) => {
        setData((current) => ({ ...current, hotels: current.hotels.filter((item) => item.id !== localHotel.id) }));
        setMockAction({
          title: 'Hotel not saved',
          detail: error instanceof Error ? error.message : 'The hotel block could not be saved. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const updateHotel = (hotel: (typeof samplePlanningData.hotels)[number]) => {
    const previous = data.hotels.find((item) => item.id === hotel.id);
    setData((current) => ({ ...current, hotels: current.hotels.map((item) => (item.id === hotel.id ? hotel : item)) }));
    void updateMobileHotel(hotel)
      .then((result) => {
        if (!result.synced || !result.hotel) return;
        setData((current) => ({
          ...current,
          hotels: current.hotels.map((item) => (item.id === hotel.id ? result.hotel! : item)),
        }));
      })
      .catch((error) => {
        if (previous) {
          setData((current) => ({ ...current, hotels: current.hotels.map((item) => (item.id === hotel.id ? previous : item)) }));
        }
        setMockAction({
          title: 'Hotel not updated',
          detail: error instanceof Error ? error.message : 'The hotel block could not be updated. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const removeHotel = (hotelId: string) => {
    const previous = data.hotels.find((item) => item.id === hotelId);
    setData((current) => ({ ...current, hotels: current.hotels.filter((item) => item.id !== hotelId) }));
    void deleteMobileHotel(hotelId).catch((error) => {
      if (previous) {
        setData((current) => ({ ...current, hotels: [previous, ...current.hotels] }));
      }
      setMockAction({
        title: 'Hotel not deleted',
        detail: error instanceof Error ? error.message : 'The hotel block could not be deleted. Please try again.',
        primaryLabel: 'Close',
      });
    });
  };
  const updateGuestPhotoDropSettings = (patch: Partial<GuestPhotoDropSettings>) => {
    const previous = data.guestPhotoDrop;
    const nextSettings = { ...previous, ...patch };
    setData((current) => ({ ...current, guestPhotoDrop: nextSettings }));
    void saveMobileGuestPhotoDropSettings(patch)
      .then((settings) => {
        setData((current) => ({ ...current, guestPhotoDrop: { ...current.guestPhotoDrop, ...settings } }));
      })
      .catch((error) => {
        setData((current) => ({ ...current, guestPhotoDrop: previous }));
        setMockAction({
          title: 'Photo Drop settings not saved',
          detail: error instanceof Error ? error.message : 'The Photo Drop settings could not be saved. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const addWeddingPartyMember = (member: (typeof samplePlanningData.weddingParty)[number]) => {
    const localMember = { ...member, id: `party-new-${Date.now()}` };
    setData((current) => ({ ...current, weddingParty: [localMember, ...current.weddingParty] }));
    void createMobileWeddingPartyMember(localMember)
      .then((result) => {
        if (!result.synced || !result.member) return;
        setData((current) => ({
          ...current,
          weddingParty: current.weddingParty.map((item) => (item.id === localMember.id ? result.member! : item)),
        }));
      })
      .catch((error) => {
        setData((current) => ({ ...current, weddingParty: current.weddingParty.filter((item) => item.id !== localMember.id) }));
        setMockAction({
          title: 'Wedding party member not saved',
          detail: error instanceof Error ? error.message : 'The wedding party member could not be saved. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const updateWeddingPartyMember = (member: (typeof samplePlanningData.weddingParty)[number]) => {
    const previous = data.weddingParty.find((item) => item.id === member.id);
    setData((current) => ({
      ...current,
      weddingParty: current.weddingParty.map((item) => (item.id === member.id ? member : item)),
    }));
    void updateMobileWeddingPartyMember(member)
      .then((result) => {
        if (!result.synced || !result.member) return;
        setData((current) => ({
          ...current,
          weddingParty: current.weddingParty.map((item) => (item.id === member.id ? result.member! : item)),
        }));
      })
      .catch((error) => {
        if (previous) {
          setData((current) => ({
            ...current,
            weddingParty: current.weddingParty.map((item) => (item.id === member.id ? previous : item)),
          }));
        }
        setMockAction({
          title: 'Wedding party member not updated',
          detail: error instanceof Error ? error.message : 'The wedding party member could not be updated. Please try again.',
          primaryLabel: 'Close',
        });
      });
  };
  const removeWeddingPartyMember = (memberId: string) => {
    const previous = data.weddingParty.find((item) => item.id === memberId);
    setData((current) => ({ ...current, weddingParty: current.weddingParty.filter((item) => item.id !== memberId) }));
    void deleteMobileWeddingPartyMember(memberId).catch((error) => {
      if (previous) {
        setData((current) => ({ ...current, weddingParty: [previous, ...current.weddingParty] }));
      }
      setMockAction({
        title: 'Wedding party member not deleted',
        detail: error instanceof Error ? error.message : 'The wedding party member could not be deleted. Please try again.',
        primaryLabel: 'Close',
      });
    });
  };

  useEffect(() => {
    let alive = true;

    async function hydrateSession() {
      if (clerkSession) {
        if (!clerkSession.isLoaded) return;
        setMobileAuthTokenGetter(clerkSession.isSignedIn ? clerkSession.getToken : null);
        if (!clerkSession.isSignedIn) {
          await saveMobileAuthToken(null);
          if (!alive) return;
          setAuthUser(null);
          setAuthLoaded(true);
          return;
        }
        const email =
          clerkSession.user?.primaryEmailAddress?.emailAddress ||
          clerkSession.user?.emailAddresses?.find((item) => item.emailAddress)?.emailAddress ||
          'signed-in@aidowedding.net';
        if (!alive) return;
        setAuthUser({
          email,
          firstName: clerkSession.user?.firstName || email.split('@')[0] || 'there',
          isNewUser: false,
        });
        setNeedsOnboarding(false);
        setAuthLoaded(true);
        return;
      }

      const [storedUser, storedOnboarding] = await Promise.all([
        readStoredJson<AuthUser>(storageKeys.authUser),
        AsyncStorage.getItem(storageKeys.needsOnboarding),
      ]);
      if (!alive) return;
      setAuthUser(storedUser);
      setNeedsOnboarding(storedOnboarding === 'true');
      setAuthLoaded(true);
    }

    hydrateSession();
    return () => {
      alive = false;
      if (clerkSession) setMobileAuthTokenGetter(null);
    };
  }, [clerkSession?.isLoaded, clerkSession?.isSignedIn, clerkSession?.user?.primaryEmailAddress?.emailAddress, clerkSession?.user?.firstName]);

  useEffect(() => {
    if (clerkSession) return;
    if (!authLoaded) return;
    if (authUser) {
      void AsyncStorage.setItem(storageKeys.authUser, JSON.stringify(authUser));
      return;
    }
    void AsyncStorage.removeItem(storageKeys.authUser);
  }, [authLoaded, authUser, clerkSession]);

  useEffect(() => {
    if (clerkSession) return;
    if (!authLoaded) return;
    void AsyncStorage.setItem(storageKeys.needsOnboarding, String(needsOnboarding));
  }, [authLoaded, needsOnboarding, clerkSession]);

  useEffect(() => {
    if (!authLoaded) return;
    let alive = true;
    setPlanningDataLoaded(false);

    async function hydratePlanningData() {
      try {
        if (authUser && hasMobileApiBase()) {
          setData(await getPlanningData());
        } else {
          const stored = await AsyncStorage.getItem(storageKeys.planningData);
          if (!alive) return;
          if (stored) {
            setData(mergePlanningData(JSON.parse(stored)));
          } else {
            setData(authUser ? await getPlanningData() : samplePlanningData);
          }
        }
      } catch {
        if (alive) setData(samplePlanningData);
      } finally {
        if (alive) setPlanningDataLoaded(true);
      }
    }

    void hydratePlanningData();
    return () => {
      alive = false;
    };
  }, [authLoaded, authUser?.email]);

  useEffect(() => {
    if (!planningDataLoaded) return;
    if (clerkSession && hasMobileApiBase()) return;
    void AsyncStorage.setItem(storageKeys.planningData, JSON.stringify(data));
  }, [data, planningDataLoaded, clerkSession]);

  if (!fontsLoaded || !authLoaded || !planningDataLoaded) {
    return (
      <BrowserPhoneFrame enabled={showPhonePreview} height={previewHeight}>
        <View style={styles.loading}>
          <Image resizeMode="contain" source={logo} style={styles.loadingLogo} />
        </View>
      </BrowserPhoneFrame>
    );
  }

  if (!authUser) {
    return (
      <BrowserPhoneFrame enabled={showPhonePreview} height={previewHeight}>
        {clerkSession ? (
          <ClerkAuthScreen />
        ) : (
          <AuthScreen
            onSignIn={(email) => {
              setAuthUser({ email, firstName: 'Stacy', isNewUser: false });
              setNeedsOnboarding(false);
            }}
            onSignUp={(email, firstName) => {
              setAuthUser({ email, firstName, isNewUser: true });
              setNeedsOnboarding(true);
            }}
          />
        )}
      </BrowserPhoneFrame>
    );
  }

  if (needsOnboarding || authUser.isNewUser) {
    return (
      <BrowserPhoneFrame enabled={showPhonePreview} height={previewHeight}>
        <OnboardingWizard
          data={data}
          firstName={authUser.firstName}
          onComplete={async () => {
            await saveMobileProfile(data.profile);
            const refreshed = await getPlanningData();
            setData(refreshed);
            setAuthUser((current) => (current ? { ...current, isNewUser: false } : current));
            setNeedsOnboarding(false);
          }}
        />
      </BrowserPhoneFrame>
    );
  }

  return (
    <BrowserPhoneFrame enabled={showPhonePreview} height={previewHeight}>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth }]} showsVerticalScrollIndicator={false}>
          <Header
            firstName={authUser.firstName}
            onOpenAccount={() => setAccountOpen(true)}
          />
          {activeTab === 'today' ? (
            <>
              <Hero
                confirmed={stats.confirmed}
                onContinue={() => setActiveTab('plan')}
                onOpenAria={() => setAriaOpen(true)}
                onOpenFinance={() => setActiveTab('money')}
                onOpenGuestHub={(view) => {
                  setGuestHubView(view);
                  setActiveTab('website');
                }}
                onOpenVendors={() => setActiveTab('vendors')}
                openMockAction={setMockAction}
                data={data}
                progress={stats.progress}
              />
            </>
          ) : null}
          {activeTab === 'website' ? (
            <WebsiteSection
              activeView={guestHubView}
              data={data}
              onAddHotel={addHotel}
              onAddGuest={addGuest}
              onChangeView={setGuestHubView}
              onDeleteGuest={removeGuest}
              onDeleteHotel={removeHotel}
              onUpdateHotel={updateHotel}
              onUpdateGuest={updateGuest}
              onUpdateGuestPhotoDropSettings={updateGuestPhotoDropSettings}
              openMockAction={setMockAction}
            />
          ) : null}
          {activeTab === 'plan' ? (
            <PlanSection
              onOpenFinance={() => setActiveTab('money')}
              onOpenGuestHub={(view) => {
                setGuestHubView(view);
                setActiveTab('website');
              }}
              onOpenGuidedSetup={() => setNeedsOnboarding(true)}
              onOpenVendors={() => setActiveTab('vendors')}
              openMockAction={setMockAction}
              data={data}
              onAddWeddingPartyMember={addWeddingPartyMember}
              onDeleteWeddingPartyMember={removeWeddingPartyMember}
              onUpdateWeddingPartyMember={updateWeddingPartyMember}
              onToggleDayOfChecklist={updateDayOfChecklistCompletion}
              onToggleTask={updateTaskCompletion}
              progress={stats.progress}
            />
          ) : null}
          {activeTab === 'vendors' ? <VendorsSection data={data} onAddVendor={addVendor} openMockAction={setMockAction} openVendor={setSelectedVendor} /> : null}
          {activeTab === 'money' ? <MoneySection data={data} openMockAction={setMockAction} paid={stats.paid} total={stats.total} /> : null}
          {activeTab === 'more' ? (
            <FeatureHub
              data={data}
              onAddWorkspaceInvite={addWorkspaceInvite}
              onOpenAccount={() => setAccountOpen(true)}
              openMockAction={setMockAction}
              openTab={setActiveTab}
            />
          ) : null}
        </ScrollView>
        <BottomTabs activeTab={activeTab} ariaOpen={ariaOpen} onOpenAria={() => setAriaOpen(true)} setActiveTab={setActiveTab} />
        <AriaModal contained={showPhonePreview} data={data} open={ariaOpen} onClose={() => setAriaOpen(false)} />
        <AccountModal
          clerkConnected={Boolean(clerkSession)}
          onClose={() => setAccountOpen(false)}
          onSignOut={() => {
            setAccountOpen(false);
            setActiveTab('today');
            if (clerkSession) {
              void clerkSession.signOut();
              return;
            }
            setAuthUser(null);
            setNeedsOnboarding(false);
            void AsyncStorage.multiRemove([storageKeys.authUser, storageKeys.needsOnboarding]);
          }}
          open={accountOpen}
          user={authUser}
        />
        <MockActionModal action={mockAction} data={data} onClose={() => setMockAction(null)} />
        <VendorDetailModal data={data} onClose={() => setSelectedVendor(null)} onDelete={removeVendor} onUpdate={updateVendor} vendor={selectedVendor} />
      </View>
    </BrowserPhoneFrame>
  );
}

function BrowserPhoneFrame({ children, enabled, height }: { children: ReactNode; enabled: boolean; height: number }) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.browserPreviewRoot}>
      <View style={[styles.phoneShadow, { height }]}>
        <View style={styles.phoneFrame}>
          <View style={styles.phoneSpeaker} />
          <View style={styles.phoneScreen}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

function authErrorMessage(error: unknown, fallback: string) {
  const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
  return clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || clerkError.message || fallback;
}

function Header({ firstName, onOpenAccount }: { firstName: string; onOpenAccount: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerGreeting}>
        <Image resizeMode="contain" source={logo} style={styles.headerMark} />
        <View>
          <Text style={styles.headerHello}>Hi, {firstName}</Text>
          <Text style={styles.headerSubtext}>Ready to plan today?</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Pressable onPress={onOpenAccount} style={styles.userAvatarButton}>
          <Image resizeMode="cover" source={{ uri: userAvatarUri }} style={styles.userAvatarImage} />
        </Pressable>
      </View>
    </View>
  );
}

function ClerkAuthScreen() {
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [code, setCode] = useState('');
  const [pendingMode, setPendingMode] = useState<'signin' | 'signup' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSignUp = authMode === 'signup';
  const ready = signInLoaded && signUpLoaded;

  async function requestEmailCode() {
    if (!ready || !signIn || !signUp) return;
    setError('');
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Enter your email address.');
      if (isSignUp) {
        await signUp.create({
          emailAddress: normalizedEmail,
          firstName: firstName.trim() || undefined,
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingMode('signup');
      } else {
        const attempt = await signIn.create({ identifier: normalizedEmail });
        const factors = (attempt as unknown as { supportedFirstFactors?: Array<{ strategy?: string; emailAddressId?: string }> }).supportedFirstFactors ?? [];
        const emailFactor = factors.find((factor) => factor.strategy === 'email_code');
        if (!emailFactor?.emailAddressId) {
          throw new Error('Email code sign-in is not available for this account.');
        }
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor.emailAddressId,
        });
        setPendingMode('signin');
      }
    } catch (err) {
      setError(authErrorMessage(err, 'Could not send a verification code.'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailCode() {
    if (!ready || !setActive || !signIn || !signUp || !pendingMode) return;
    setError('');
    setLoading(true);
    try {
      const trimmedCode = code.trim();
      if (!trimmedCode) throw new Error('Enter the verification code.');
      const result =
        pendingMode === 'signup'
          ? await signUp.attemptEmailAddressVerification({ code: trimmedCode })
          : await signIn.attemptFirstFactor({ strategy: 'email_code', code: trimmedCode });
      const sessionId = result.createdSessionId;
      if (!sessionId) throw new Error('Sign-in did not complete. Try again.');
      await setActive({ session: sessionId });
    } catch (err) {
      setError(authErrorMessage(err, 'Could not verify that code.'));
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setError('');
    setLoading(true);
    try {
      const { createdSessionId, setActive: activateSession } = await startSSOFlow({ strategy: 'oauth_google' });
      if (createdSessionId && activateSession) {
        await activateSession({ session: createdSessionId });
      }
    } catch (err) {
      setError(authErrorMessage(err, 'Could not continue with Google.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.authRoot}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.authContent} showsVerticalScrollIndicator={false}>
        <Image resizeMode="contain" source={logo} style={styles.authLogo} />
        <LinearGradient colors={['#FFF8F4', '#FFE8DE']} style={styles.authCard}>
          <Text style={styles.kicker}>{pendingMode ? 'Check your email' : isSignUp ? 'Create account' : 'Welcome back'}</Text>
          <Text style={styles.authTitle}>{pendingMode ? 'Enter your verification code' : isSignUp ? 'Start planning with A.IDO' : 'Sign in to your wedding hub'}</Text>
          <Text style={styles.authSubtitle}>
            {pendingMode
              ? `We sent a sign-in code to ${email.trim() || 'your email'}.`
              : 'Use the same A.IDO account as the website so the app syncs your real wedding workspace.'}
          </Text>

          {!pendingMode ? (
            <>
              <View style={styles.authSwitch}>
                {[
                  ['signin', 'Sign in'],
                  ['signup', 'Sign up'],
                ].map(([id, label]) => {
                  const active = authMode === id;
                  return (
                    <Pressable key={id} onPress={() => setAuthMode(id as 'signin' | 'signup')} style={[styles.authSwitchButton, active && styles.authSwitchButtonActive]}>
                      <Text style={[styles.authSwitchText, active && styles.authSwitchTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formStack}>
                {isSignUp ? (
                  <View>
                    <Text style={styles.formLabel}>First name</Text>
                    <TextInput onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.muted} style={styles.formInput} value={firstName} />
                  </View>
                ) : null}
                <View>
                  <Text style={styles.formLabel}>Email</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.muted}
                    style={styles.formInput}
                    value={email}
                  />
                </View>
              </View>

              <Pressable disabled={!ready || loading} onPress={requestEmailCode} style={[styles.primaryActionButton, styles.authPrimaryButton, loading && styles.disabledButton]}>
                <Ionicons color={colors.surface} name={isSignUp ? 'person-add-outline' : 'log-in-outline'} size={18} />
                <Text style={styles.primaryActionText}>{loading ? 'Sending...' : isSignUp ? 'Create account' : 'Send code'}</Text>
              </Pressable>

              <Pressable disabled={!ready || loading} onPress={continueWithGoogle} style={[styles.authProviderButton, loading && styles.disabledButton]}>
                <Ionicons color={colors.rose} name="logo-google" size={18} />
                <Text style={styles.secondaryActionText}>Continue with Google</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.formStack}>
                <View>
                  <Text style={styles.formLabel}>Verification code</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor={colors.muted}
                    style={styles.formInput}
                    value={code}
                  />
                </View>
              </View>
              <Pressable disabled={loading} onPress={verifyEmailCode} style={[styles.primaryActionButton, styles.authPrimaryButton, loading && styles.disabledButton]}>
                <Ionicons color={colors.surface} name="checkmark-circle-outline" size={18} />
                <Text style={styles.primaryActionText}>{loading ? 'Verifying...' : 'Verify and sign in'}</Text>
              </Pressable>
              <Pressable disabled={loading} onPress={() => { setPendingMode(null); setCode(''); }} style={styles.authProviderButton}>
                <Ionicons color={colors.rose} name="arrow-back-outline" size={18} />
                <Text style={styles.secondaryActionText}>Use a different email</Text>
              </Pressable>
            </>
          )}

          <View style={styles.authNote}>
            <Ionicons color={error ? colors.rose : colors.green} name={error ? 'alert-circle-outline' : 'shield-checkmark-outline'} size={17} />
            <Text style={styles.hubDetail}>{error || 'Secure Clerk sign-in keeps the mobile app connected to the website backend.'}</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

function AuthScreen({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string) => void;
  onSignUp: (email: string, firstName: string) => void;
}) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('stacy@example.com');
  const [firstName, setFirstName] = useState('Stacy');
  const isSignUp = authMode === 'signup';

  return (
    <View style={styles.authRoot}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.authContent} showsVerticalScrollIndicator={false}>
        <Image resizeMode="contain" source={logo} style={styles.authLogo} />
        <LinearGradient colors={['#FFF8F4', '#FFE8DE']} style={styles.authCard}>
          <Text style={styles.kicker}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>
          <Text style={styles.authTitle}>{isSignUp ? 'Start planning with A.IDO' : 'Sign in to your wedding hub'}</Text>
          <Text style={styles.authSubtitle}>
            {isSignUp
              ? 'New couples go through setup first so the planner, vendors, guest hub, and Aria start with the right details.'
              : 'Use your A.IDO account to return to your planner, guest hub, vendors, budget, and Aria.'}
          </Text>

          <View style={styles.authSwitch}>
            {[
              ['signin', 'Sign in'],
              ['signup', 'Sign up'],
            ].map(([id, label]) => {
              const active = authMode === id;
              return (
                <Pressable key={id} onPress={() => setAuthMode(id as 'signin' | 'signup')} style={[styles.authSwitchButton, active && styles.authSwitchButtonActive]}>
                  <Text style={[styles.authSwitchText, active && styles.authSwitchTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.formStack}>
            {isSignUp ? (
              <View>
                <Text style={styles.formLabel}>First name</Text>
                <TextInput onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.muted} style={styles.formInput} value={firstName} />
              </View>
            ) : null}
            <View>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                style={styles.formInput}
                value={email}
              />
            </View>
          </View>

          <Pressable
            onPress={() => (isSignUp ? onSignUp(email.trim() || 'stacy@example.com', firstName.trim() || 'Stacy') : onSignIn(email.trim() || 'stacy@example.com'))}
            style={[styles.primaryActionButton, styles.authPrimaryButton]}
          >
            <Ionicons color={colors.surface} name={isSignUp ? 'person-add-outline' : 'log-in-outline'} size={18} />
            <Text style={styles.primaryActionText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              isSignUp
                ? onSignUp('google.user@example.com', firstName.trim() || 'Stacy')
                : onSignIn('google.user@example.com')
            }
            style={styles.authProviderButton}
          >
            <Ionicons color={colors.rose} name="logo-google" size={18} />
            <Text style={styles.secondaryActionText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.authNote}>
            <Ionicons color={colors.green} name="shield-checkmark-outline" size={17} />
            <Text style={styles.hubDetail}>{isSignUp ? 'After sign-up, the onboarding wizard opens automatically.' : 'Sign out is available from your profile avatar.'}</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

function OnboardingWizard({ data, firstName, onComplete }: { data: typeof samplePlanningData; firstName: string; onComplete: () => Promise<void> | void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const steps = [
    {
      title: 'Tell us about the wedding',
      subtitle: 'Start with the details Aria needs to shape the plan.',
      icon: 'heart-outline',
      items: [
        ['Couple', data.profile.coupleName],
        ['Wedding date', formatShortDate(data.profile.weddingDate)],
        ['Venue', data.profile.venue],
      ],
    },
    {
      title: 'Set priorities',
      subtitle: 'Choose what matters most so the checklist feels personal.',
      icon: 'sparkles-outline',
      items: [
        ['Must have', data.profile.priorities.mustHave[0]],
        ['Nice to have', data.profile.priorities.niceToHave[0]],
        ['Avoid', data.profile.priorities.mustAvoid[0]],
      ],
    },
    {
      title: 'Launch your planning hub',
      subtitle: 'Aria will create your planner, guest hub, calendar, and first tasks.',
      icon: 'rocket-outline',
      items: [
        ['Planner', 'Calendar, tasks, timeline, and day-of tools'],
        ['Guest Hub', 'Website, invitations, registry, and photo drop'],
        ['Aria', 'Priorities and next-step guidance'],
      ],
    },
  ];
  const current = steps[step];
  const lastStep = step === steps.length - 1;
  const finishSetup = async () => {
    if (!lastStep) {
      setStep((value) => value + 1);
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await onComplete();
    } catch (err) {
      setSaveError((err as Error)?.message || 'Setup could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.onboardingRoot}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
        <Image resizeMode="contain" source={logo} style={styles.onboardingLogo} />
        <View style={styles.onboardingCard}>
          <View style={styles.onboardingIconWrap}>
            <Ionicons color={colors.rose} name={current.icon as keyof typeof Ionicons.glyphMap} size={26} />
          </View>
          <Text style={styles.onboardingTitle}>{step === 0 ? `Welcome, ${firstName}` : current.title}</Text>
          <Text style={styles.onboardingSubtitle}>{current.subtitle}</Text>

          <View style={styles.onboardingFields}>
            {current.items.map(([label, value]) => (
              <View key={label} style={styles.onboardingField}>
                <Text style={styles.onboardingFieldLabel}>{label}</Text>
                <Text style={styles.onboardingFieldValue}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.onboardingAria}>
            <View style={styles.ariaPanelAvatar}>
              <Image resizeMode="cover" source={ariaAvatar} style={styles.actionAvatar} />
            </View>
            <View style={styles.hubCopy}>
              <Text style={styles.overline}>Aria setup</Text>
              <Text style={styles.hubDetail}>I’ll turn these answers into a practical first-week plan.</Text>
            </View>
          </View>
          {saveError ? <SavedStrip label={saveError} /> : null}

          <View style={styles.onboardingDots}>
            {steps.map((item, index) => (
              <View key={item.title} style={[styles.onboardingDot, index === step && styles.onboardingDotActive]} />
            ))}
          </View>

          <View style={styles.onboardingActions}>
            {step > 0 ? (
              <Pressable onPress={() => setStep((value) => value - 1)} style={styles.onboardingBackButton}>
                <Text style={styles.secondaryActionText}>Back</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={saving}
              onPress={finishSetup}
              style={[styles.primaryActionButton, styles.onboardingNextButton, saving && styles.disabledButton]}
            >
              <Text style={styles.primaryActionText}>{saving ? 'Saving...' : lastStep ? 'Finish setup' : 'Continue'}</Text>
              <Ionicons color={colors.surface} name="arrow-forward" size={18} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Hero({
  confirmed,
  data,
  onContinue,
  onOpenAria,
  onOpenFinance,
  onOpenGuestHub,
  onOpenVendors,
  openMockAction,
  progress,
}: {
  confirmed: number;
  data: typeof samplePlanningData;
  onContinue: () => void;
  onOpenAria: () => void;
  onOpenFinance: () => void;
  onOpenGuestHub: (view: GuestHubView) => void;
  onOpenVendors: () => void;
  openMockAction: (action: MockAction) => void;
  progress: number;
}) {
  const profile = data.profile;
  const openTasks = data.tasks.filter((task) => !task.completed).length;
  const inviteTotals = data.invitations.reduce(
    (totals, invitation) => ({
      responses: totals.responses + invitation.responses,
      sent: totals.sent + invitation.sent,
    }),
    { responses: 0, sent: 0 },
  );
  const budgetPaid = data.budget.reduce((sum, item) => sum + item.paid, 0);
  const budgetTotal = data.budget.reduce((sum, item) => sum + item.total, 0);
  const budgetPercent = budgetTotal ? Math.round((budgetPaid / budgetTotal) * 100) : 0;

  return (
    <LinearGradient colors={['#FFF8F4', '#FFE8DE']} style={styles.hero}>
      <View style={styles.homeHeroTop}>
        <Image resizeMode="cover" source={{ uri: couplePhotoUri }} style={styles.homeHeroPhoto} />
        <LinearGradient
          colors={['rgba(255,248,244,0.98)', 'rgba(255,248,244,0.78)', 'rgba(255,248,244,0.08)']}
          end={{ x: 0.78, y: 0.56 }}
          start={{ x: 0, y: 0 }}
          style={styles.homeHeroPhotoWash}
        />
        <View style={styles.homeHeroCopy}>
          <Text style={styles.homeHeroTitle}>{profile.partnerOne} + {profile.partnerTwo}</Text>
          <Text style={styles.homeHeroMeta}>{formatShortDate(profile.weddingDate)}</Text>
          <Text style={styles.homeHeroVenue}>Chateau Lumiere</Text>
          <Text style={styles.homeHeroLocation}>{profile.location}</Text>
        </View>
      </View>
      <View style={styles.heroStats}>
        <CountdownStat />
        <StatCard label="Planned" value={`${progress}%`} />
        <StatCard label="Guests" value={`${profile.guestTarget}`} />
      </View>

      <View style={styles.homeProgressCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.homeProgressLabel}>Wedding Progress</Text>
          <Text style={styles.homeProgressValue}>{progress}%</Text>
        </View>
        <Progress value={progress} />
      </View>

      <View style={styles.homeTileGrid}>
        <HomeTile color="#A93D5B" icon="people-outline" label="Guests" tint="#FBE7ED" value={`${confirmed}/${profile.guestTarget}`} onPress={() => onOpenGuestHub('guests')} />
        <HomeTile color="#496D89" icon="mail-open-outline" label="Invites" tint="#E7F0F7" value={`${inviteTotals.responses}/${inviteTotals.sent} replies`} onPress={() => onOpenGuestHub('invites')} />
        <HomeTile color="#2F7F7A" icon="calendar-clear-outline" label="Planner" tint="#E0F2EF" value={`${openTasks} tasks`} onPress={onContinue} />
        <HomeTile color="#B98343" icon="storefront-outline" label="Vendors" tint="#F7EBD8" value={`${data.vendors.length} booked`} onPress={onOpenVendors} />
        <HomeTile color="#637B59" icon="wallet-outline" label="Finance" tint="#E9F0E3" value={`${budgetPercent}% paid`} onPress={onOpenFinance} />
        <HomeTile color="#7D5BA6" icon="globe-outline" label="Website" tint="#EFE7F7" value="Editor" onPress={() => onOpenGuestHub('website')} />
      </View>

    </LinearGradient>
  );
}

function CountdownStat() {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>3712</Text>
      <Text style={styles.statLabel}>DAYS UNTIL I DO</Text>
    </View>
  );
}

function HomeTile({
  color,
  icon,
  label,
  onPress,
  tint,
  value,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint: string;
  value: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.homeTile}>
      <View style={[styles.homeTileIcon, { backgroundColor: tint, borderColor: tint }]}>
        <Ionicons color={color} name={icon} size={23} />
      </View>
      <Text style={styles.homeTileLabel}>{label}</Text>
      <Text style={styles.homeTileValue}>{value}</Text>
    </Pressable>
  );
}

function CalendarSection({
  data,
  onOpenFinance,
  onOpenGuestHub,
  onOpenVendors,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  onOpenFinance: () => void;
  onOpenGuestHub: (view: GuestHubView) => void;
  onOpenVendors: () => void;
  openMockAction: (action: MockAction) => void;
}) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [agendaEvent, setAgendaEvent] = useState<CalendarEvent | null>(null);
  const [completedAgendaIds, setCompletedAgendaIds] = useState<string[]>([]);
  const [newEvent, setNewEvent] = useState({
    date: dateKey(new Date()),
    detail: '',
    link: '',
    time: '',
    title: '',
    type: 'custom' as CalendarEvent['type'],
  });
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [customEventsLoaded, setCustomEventsLoaded] = useState(false);
  const events = useMemo(() => [...buildCalendarEvents(data), ...customEvents].sort(sortCalendarEvents), [customEvents, data]);
  const completedAgendaSet = useMemo(() => new Set(completedAgendaIds), [completedAgendaIds]);
  const visibleDays = useMemo(() => buildCalendarDays(month), [month]);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      if (completedAgendaSet.has(event.id)) return;
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    });
    return grouped;
  }, [completedAgendaSet, events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  useEffect(() => {
    let alive = true;
    Promise.all([
      readStoredJson<CalendarEvent[]>(storageKeys.calendarEvents),
      readStoredJson<string[]>(storageKeys.completedAgendaIds),
    ]).then(([storedEvents, storedCompletedIds]) => {
      if (!alive) return;
      setCustomEvents(storedEvents ?? []);
      setCompletedAgendaIds(storedCompletedIds ?? []);
      setCustomEventsLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!customEventsLoaded) return;
    void AsyncStorage.setItem(storageKeys.calendarEvents, JSON.stringify(customEvents));
  }, [customEvents, customEventsLoaded]);

  useEffect(() => {
    if (!customEventsLoaded) return;
    void AsyncStorage.setItem(storageKeys.completedAgendaIds, JSON.stringify(completedAgendaIds));
  }, [completedAgendaIds, customEventsLoaded]);

  const upcomingEvents = events
    .filter((event) => (daysFromToday(event.date) ?? -1) >= 0 && !completedAgendaSet.has(event.id))
    .sort((a, b) => (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0))
    .slice(0, 4);
  const openRelatedCalendarEvent = (event: CalendarEvent) => {
    const detail = event.detail.toLowerCase();
    const title = event.title.toLowerCase();

    if (event.type === 'hotel') {
      onOpenGuestHub('travel');
      return;
    }

    if (title.includes('mailing addresses') || detail.includes('guests')) {
      onOpenGuestHub('guests');
      return;
    }

    if (event.type === 'vendor' || title.includes('contract') || detail.includes('contract')) {
      onOpenVendors();
      return;
    }

    if (event.type === 'payment' || title.includes('payment') || title.includes('balance')) {
      onOpenFinance();
      return;
    }

    openMockAction({
      title: event.title,
      detail: `${formatShortDate(event.date)}. ${event.detail}${event.link ? ` Link: ${event.link}.` : ''} Opens the full appointment, reminder, or calendar details.`,
      primaryLabel: 'Open item',
    });
  };
  const markAgendaComplete = (event: CalendarEvent) => {
    setCompletedAgendaIds((current) => (current.includes(event.id) ? current : [...current, event.id]));
    setAgendaEvent(null);
  };
  const monthEventCount = events.filter((event) => event.date.startsWith(monthKey) && !completedAgendaSet.has(event.id)).length;

  const goToToday = () => {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
  };

  return (
    <Section title="Calendar" subtitle="Deadlines, payments, appointments, hotel dates, and day-of timing together.">
      <Card style={styles.ariaCalendarCard}>
        <View style={styles.actionCopy}>
          <Text style={styles.overline}>Planner calendar</Text>
          <Text style={styles.actionText}>
            Add appointments, vendor meetings, reminders, and personal planning dates.
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setNewEvent((current) => ({ ...current, date: selectedDate }));
            setAddEventOpen(true);
          }}
          style={styles.addEventButton}
        >
          <Ionicons color={colors.surface} name="add" size={18} />
          <Text style={styles.addEventButtonText}>Add event</Text>
        </Pressable>
      </Card>

      <Card>
        <View style={styles.calendarHeader}>
          <View>
            <Text style={styles.cardTitle}>{formatCalendarMonth(month)}</Text>
            <Text style={styles.mutedText}>{monthEventCount} item{monthEventCount === 1 ? '' : 's'} this month</Text>
          </View>
          <View style={styles.calendarControls}>
            <Pressable
              accessibilityLabel="Previous month"
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              style={styles.iconControl}
            >
              <Ionicons color={colors.rose} name="chevron-back" size={20} />
            </Pressable>
            <Pressable accessibilityLabel="Today" onPress={goToToday} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Next month"
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              style={styles.iconControl}
            >
              <Ionicons color={colors.rose} name="chevron-forward" size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekHeader}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekLabel}>{day}</Text>
          ))}
        </View>

        <View style={styles.monthGrid}>
          {visibleDays.map((day) => {
            const key = dateKey(day);
            const eventCount = eventsByDate.get(key)?.length ?? 0;
            const inMonth = day.getMonth() === month.getMonth();
            const isSelected = key === selectedDate;
            const isToday = key === dateKey(new Date());
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDate(key)}
                style={[
                  styles.dayCell,
                  !inMonth && styles.dayCellMuted,
                  isToday && styles.dayCellToday,
                  isSelected && styles.dayCellSelected,
                ]}
              >
                <Text style={[styles.dayNumber, !inMonth && styles.dayNumberMuted, isSelected && styles.dayNumberSelected]}>
                  {day.getDate()}
                </Text>
                {eventCount ? (
                  <View style={styles.eventDots}>
                    {Array.from({ length: Math.min(eventCount, 3) }, (_, index) => (
                      <View key={index} style={[styles.eventDot, isSelected && styles.eventDotSelected]} />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{formatShortDate(selectedDate)}</Text>
        <View style={styles.calendarList}>
          {selectedEvents.length ? (
            selectedEvents.map((event) => (
              <CalendarEventRow
                key={event.id}
                event={event}
                onPress={() => setAgendaEvent(event)}
              />
            ))
          ) : (
            <Text style={styles.mutedText}>Nothing scheduled for this date.</Text>
          )}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Upcoming Agenda</Text>
        <View style={styles.calendarList}>
          {upcomingEvents.map((event) => (
            <CalendarEventRow
              key={event.id}
              event={event}
              onPress={() => setAgendaEvent(event)}
            />
          ))}
          {upcomingEvents.length === 0 ? (
            <Text style={styles.mutedText}>All upcoming agenda items are complete.</Text>
          ) : null}
        </View>
      </Card>

      <AddEventModal
        event={newEvent}
        onChange={setNewEvent}
        onClose={() => setAddEventOpen(false)}
        onSave={() => {
          if (!newEvent.title.trim() || !newEvent.date.trim()) return;
          const event: CalendarEvent = {
            id: `custom-${Date.now()}`,
            date: newEvent.date.trim(),
            detail: newEvent.detail.trim() || 'Custom calendar event',
            link: newEvent.link.trim() || undefined,
            time: newEvent.time.trim() || undefined,
            title: newEvent.title.trim(),
            type: newEvent.type,
          };
          setCustomEvents((current) => [...current, event]);
          setSelectedDate(event.date);
          const parsed = parseDate(event.date);
          if (parsed) setMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
          setNewEvent({ date: dateKey(new Date()), detail: '', link: '', time: '', title: '', type: 'custom' });
          setAddEventOpen(false);
        }}
        open={addEventOpen}
      />
      <AgendaItemModal
        event={agendaEvent}
        onClose={() => setAgendaEvent(null)}
        onMarkComplete={markAgendaComplete}
        onOpenRelated={(event) => {
          setAgendaEvent(null);
          openRelatedCalendarEvent(event);
        }}
      />
    </Section>
  );
}

function AgendaItemModal({
  event,
  onClose,
  onMarkComplete,
  onOpenRelated,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onMarkComplete: (event: CalendarEvent) => void;
  onOpenRelated: (event: CalendarEvent) => void;
}) {
  if (!event) return null;

  const routeLabel =
    event.type === 'payment'
      ? 'Open Finance'
      : event.type === 'vendor'
        ? 'Open Vendors'
        : event.type === 'hotel' || event.detail.toLowerCase().includes('guests')
          ? 'Open Guest Hub'
          : 'Open details';

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(event)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.accountHeader}>
              <View style={[styles.calendarEventIcon, calendarTypeStyle(event.type)]}>
                <Ionicons color={colors.rose} name={calendarTypeIcon(event.type)} size={20} />
              </View>
              <View style={styles.hubCopy}>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.hubDetail}>{formatShortDate(event.date)}{event.time ? ` at ${event.time}` : ''}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.actionWorkspace}>
            <VendorInfoRow icon="information-circle-outline" label="Details" value={event.detail} />
            <VendorInfoRow icon="calendar-outline" label="Agenda type" value={event.type} />
            {event.link ? <VendorInfoRow icon="link-outline" label="Link" value={event.link} /> : null}
          </View>

          <View style={styles.websiteActions}>
            <Pressable onPress={() => onMarkComplete(event)} style={styles.primaryActionButton}>
              <Ionicons color={colors.surface} name="checkmark-circle-outline" size={18} />
              <Text style={styles.primaryActionText}>Mark complete</Text>
            </Pressable>
            <Pressable onPress={() => onOpenRelated(event)} style={styles.secondaryActionButton}>
              <Text style={styles.secondaryActionText}>{routeLabel}</Text>
              <Ionicons color={colors.rose} name="arrow-forward" size={17} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function buildMobileSeatingChart({
  additionalNotes,
  data,
  seatsPerTable,
  tableCount,
}: {
  additionalNotes: string;
  data: typeof samplePlanningData;
  seatsPerTable: number;
  tableCount: number;
}): MobileSeatingResult {
  const confirmedGuests = data.guests.filter((guest) => guest.rsvp !== 'Declined');
  const groupedGuests = [
    ...confirmedGuests.filter((guest) => guest.role === 'VIP'),
    ...confirmedGuests.filter((guest) => guest.role !== 'VIP' && guest.rsvp === 'Confirmed'),
    ...confirmedGuests.filter((guest) => guest.rsvp === 'Pending'),
  ];
  const tables: MobileSeatingTable[] = Array.from({ length: tableCount }, (_, index) => ({
    guests: [],
    tableName: index === 0 ? 'Family & VIPs' : index === 1 ? 'Friends & Plus-Ones' : `Table ${index + 1}`,
    tableNumber: index + 1,
    theme: index === 0 ? 'Immediate family and honored guests' : index === 1 ? 'Guests who know the couple socially' : 'Balanced meal preferences and RSVP status',
  }));

  groupedGuests.forEach((guest, index) => {
    const table = tables[index % tables.length];
    if (table && table.guests.length < seatsPerTable) {
      table.guests.push(guest.name);
    }
  });

  const overflowGuests = groupedGuests.slice(tableCount * seatsPerTable).map((guest) => guest.name);
  const totalSeated = tables.reduce((sum, table) => sum + table.guests.length, 0);
  const warnings = [
    ...(overflowGuests.length ? [`${overflowGuests.length} guest${overflowGuests.length === 1 ? '' : 's'} need more seats: ${overflowGuests.join(', ')}.`] : []),
    ...(additionalNotes.trim().length ? [`Applied note: ${additionalNotes.trim()}`] : []),
  ];

  return {
    insights: [
      'VIPs and confirmed guests were prioritized before pending RSVPs.',
      'Meal preferences were spread across tables to keep service simple.',
      'Use Adjust before applying if family dynamics need a manual override.',
    ],
    tables,
    totalSeated,
    warnings,
  };
}

function mobileSeatingGuests(data: typeof samplePlanningData): SeatingGuestPayload[] {
  return data.guests
    .filter((guest) => guest.rsvp !== 'Declined')
    .map((guest) => ({
      group: guest.role || 'Guest',
      id: guest.id,
      name: guest.name,
      notes: `${guest.rsvp} RSVP. Meal preference: ${guest.mealPreference}. Current table: ${guest.table}.`,
      plusOne: false,
    }));
}

function normalizeMobileSeatingResult(result: Partial<MobileSeatingResult>): MobileSeatingResult {
  const tables = Array.isArray(result.tables)
    ? result.tables.map((table, index) => ({
      guests: Array.isArray(table.guests) ? table.guests.filter(Boolean) : [],
      tableName: table.tableName || `Table ${table.tableNumber || index + 1}`,
      tableNumber: Number(table.tableNumber) || index + 1,
      theme: table.theme,
    }))
    : [];

  return {
    insights: Array.isArray(result.insights) ? result.insights.filter(Boolean) : [],
    tables,
    totalSeated: Number(result.totalSeated) || tables.reduce((sum, table) => sum + table.guests.length, 0),
    warnings: Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [],
  };
}

function WebsiteSection({
  activeView,
  data,
  onAddHotel,
  onAddGuest,
  onChangeView,
  onDeleteGuest,
  onDeleteHotel,
  onUpdateHotel,
  onUpdateGuest,
  onUpdateGuestPhotoDropSettings,
  openMockAction,
}: {
  activeView: GuestHubView;
  data: typeof samplePlanningData;
  onAddHotel: (hotel: (typeof samplePlanningData.hotels)[number]) => void;
  onAddGuest: (guest: Guest) => void;
  onChangeView: (view: GuestHubView) => void;
  onDeleteGuest: (guestId: string) => void;
  onDeleteHotel: (hotelId: string) => void;
  onUpdateHotel: (hotel: (typeof samplePlanningData.hotels)[number]) => void;
  onUpdateGuest: (guest: Guest) => void;
  onUpdateGuestPhotoDropSettings: (patch: Partial<GuestPhotoDropSettings>) => void;
  openMockAction: (action: MockAction) => void;
}) {
  const [registryConnected, setRegistryConnected] = useState(false);
  const [registryUrl, setRegistryUrl] = useState('');
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [invitationStudioOpen, setInvitationStudioOpen] = useState(false);
  const [guestCampaignMessage, setGuestCampaignMessage] = useState<string | null>(null);
  const [guestCampaignSending, setGuestCampaignSending] = useState<'rsvp-reminders' | 'save-the-dates' | 'rsvp-invites' | null>(null);
  const [photoDropTab, setPhotoDropTab] = useState<'share' | 'queue' | 'settings'>('share');
  const [selectedGuest, setSelectedGuest] = useState<(typeof samplePlanningData.guests)[number] | null>(null);
  const [seatingTableCount, setSeatingTableCount] = useState(Math.max(1, data.seating.length || 3));
  const [seatingSeatsPerTable, setSeatingSeatsPerTable] = useState(8);
  const [seatingNotes, setSeatingNotes] = useState('');
  const [seatingResult, setSeatingResult] = useState<MobileSeatingResult | null>(null);
  const [seatingApplied, setSeatingApplied] = useState(false);
  const [seatingChartId, setSeatingChartId] = useState<number | null>(null);
  const [seatingGenerating, setSeatingGenerating] = useState(false);
  const [seatingSaving, setSeatingSaving] = useState(false);
  const [seatingSyncMessage, setSeatingSyncMessage] = useState<string | null>(null);
  const viewCopy: Record<GuestHubView, { subtitle: string; title: string }> = {
    guests: {
      title: 'Guests',
      subtitle: 'Guest list, RSVPs, meals, tables, and reminders.',
    },
    seating: {
      title: 'Seating',
      subtitle: 'AI table assignments, seating notes, capacity, and apply-ready plans.',
    },
    invites: {
      title: 'Invitations',
      subtitle: 'Design, send, and track invitations without opening website settings.',
    },
    travel: {
      title: 'Travel',
      subtitle: 'Hotel blocks, booking links, shuttle notes, and travel details.',
    },
    website: {
      title: 'Website',
      subtitle: 'Website pages, registry, photo drop, preview, and publishing.',
    },
  };
  const published = data.websiteSections.filter((section) => section.status === 'Published').length;
  const ready = data.websiteSections.filter((section) => section.status === 'Ready').length;
  const drafts = data.websiteSections.filter((section) => section.status === 'Draft').length;
  const inviteTotals = data.invitations.reduce(
    (totals, invitation) => ({
      opened: totals.opened + invitation.opened,
      responses: totals.responses + invitation.responses,
      sent: totals.sent + invitation.sent,
    }),
    { opened: 0, responses: 0, sent: 0 },
  );
  const confirmedGuests = data.guests.filter((guest) => guest.rsvp === 'Confirmed').length;
  const pendingGuests = data.guests.filter((guest) => guest.rsvp === 'Pending').length;
  const declinedGuests = data.guests.filter((guest) => guest.rsvp === 'Declined').length;
  const seatingEligibleGuests = data.guests.filter((guest) => guest.rsvp !== 'Declined').length;
  const seatingCapacity = seatingTableCount * seatingSeatsPerTable;
  const hotelRoomsBooked = data.hotels.reduce((sum, hotel) => sum + hotel.roomsBooked, 0);
  const hotelRoomsTotal = data.hotels.reduce((sum, hotel) => sum + hotel.roomsTotal, 0);
  const hotelShuttleCount = data.hotels.filter((hotel) => hotel.shuttle).length;
  const openNewGuestEditor = () => {
    setSelectedGuest({
      id: `mobile-new-${Date.now()}`,
      invitationStyle: 'cream',
      mealPreference: '',
      name: '',
      role: 'Guest',
      rsvp: 'Pending',
      table: 'No table',
    });
  };

  const runGuestCampaign = async (
    campaign: 'rsvp-reminders' | 'save-the-dates' | 'rsvp-invites',
    action: () => Promise<{ attempted: number; delivered: number; markedSent: number }>,
  ) => {
    if (guestCampaignSending) return;
    setGuestCampaignSending(campaign);
    setGuestCampaignMessage(null);
    try {
      const result = await action();
      const campaignLabel =
        campaign === 'rsvp-reminders'
          ? 'RSVP reminders'
          : campaign === 'save-the-dates'
            ? 'Save-the-Dates'
            : 'RSVP invitations';
      if (result.attempted === 0) {
        setGuestCampaignMessage(`No eligible guests for ${campaignLabel.toLowerCase()} right now.`);
        return;
      }
      setGuestCampaignMessage(
        `${campaignLabel}: ${result.delivered} emailed, ${result.markedSent} marked sent, ${result.attempted} total processed.`,
      );
    } catch (error) {
      setGuestCampaignMessage(error instanceof Error ? `${error.message} Nothing was sent from the app.` : 'Could not send from the app.');
    } finally {
      setGuestCampaignSending(null);
    }
  };

  const generateMobileSeating = async () => {
    setSeatingGenerating(true);
    setSeatingSyncMessage(null);
    const guests = mobileSeatingGuests(data);
    try {
      const generated = await generateSeatingChart({
        additionalNotes: seatingNotes.trim() || undefined,
        guests,
        seatsPerTable: seatingSeatsPerTable,
        tableCount: seatingTableCount,
      });
      const normalized = normalizeMobileSeatingResult(generated);
      const saved = await saveSeatingChart({
        guests,
        name: `Mobile Seating Chart ${new Date().toLocaleDateString()}`,
        seatsPerTable: seatingSeatsPerTable,
        tableCount: seatingTableCount,
        tables: normalized.tables,
      });
      setSeatingResult(normalized);
      setSeatingChartId(saved.id);
      setSeatingApplied(false);
      setSeatingSyncMessage('Generated and saved to your account.');
    } catch (error) {
      setSeatingResult(buildMobileSeatingChart({
        additionalNotes: seatingNotes,
        data,
        seatsPerTable: seatingSeatsPerTable,
        tableCount: seatingTableCount,
      }));
      setSeatingChartId(null);
      setSeatingApplied(false);
      setSeatingSyncMessage(error instanceof Error ? `${error.message} Showing preview seating instead.` : 'Showing preview seating instead.');
    } finally {
      setSeatingGenerating(false);
    }
  };

  const moveSeatingGuest = (fromTableNumber: number, toTableNumber: number, guestName: string) => {
    if (fromTableNumber === toTableNumber) return;
    setSeatingResult((current) => {
      if (!current) return current;
      return {
        ...current,
        tables: current.tables.map((table) => {
          if (table.tableNumber === fromTableNumber) {
            return { ...table, guests: table.guests.filter((guest) => guest !== guestName) };
          }
          if (table.tableNumber === toTableNumber) {
            return { ...table, guests: [...table.guests, guestName] };
          }
          return table;
        }),
      };
    });
    setSeatingApplied(false);
  };

  const applyMobileSeating = async () => {
    if (!seatingResult) return;
    setSeatingSaving(true);
    setSeatingSyncMessage(null);
    try {
      const guests = mobileSeatingGuests(data);
      const saved = seatingChartId
        ? await updateSeatingChart(seatingChartId, {
          guests,
          name: `Mobile Seating Chart ${new Date().toLocaleDateString()}`,
          seatsPerTable: seatingSeatsPerTable,
          tableCount: seatingTableCount,
          tables: seatingResult.tables,
        })
        : await saveSeatingChart({
          guests,
          name: `Mobile Seating Chart ${new Date().toLocaleDateString()}`,
          seatsPerTable: seatingSeatsPerTable,
          tableCount: seatingTableCount,
          tables: seatingResult.tables,
        });
      await applySeatingChart(saved.id);
      setSeatingChartId(saved.id);
      setSeatingApplied(true);
      setSeatingSyncMessage('Applied to guest records.');
    } catch (error) {
      setSeatingApplied(true);
      setSeatingSyncMessage(error instanceof Error ? `${error.message} Applied locally for preview.` : 'Applied locally for preview.');
    } finally {
      setSeatingSaving(false);
    }
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(storageKeys.registryConnected),
      AsyncStorage.getItem(storageKeys.registryUrl),
    ]).then(([storedValue, storedUrl]) => {
      if (!alive) return;
      setRegistryConnected(storedValue === 'true');
      setRegistryUrl(storedUrl ?? '');
      setRegistryLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!registryLoaded) return;
    void AsyncStorage.setItem(storageKeys.registryConnected, String(registryConnected));
    void AsyncStorage.setItem(storageKeys.registryUrl, registryUrl);
  }, [registryConnected, registryLoaded, registryUrl]);

  return (
    <Section title={viewCopy[activeView].title} subtitle={viewCopy[activeView].subtitle}>
      <View style={styles.guestHubSwitch}>
        {[
          ['guests', 'Guests', 'people-outline'],
          ['seating', 'Seating', 'grid-outline'],
          ['invites', 'Invites', 'mail-open-outline'],
          ['travel', 'Travel', 'bed-outline'],
          ['website', 'Website', 'globe-outline'],
        ].map(([id, label, icon]) => {
          const active = activeView === id;
          return (
            <Pressable key={id} onPress={() => onChangeView(id as GuestHubView)} style={[styles.guestHubSwitchButton, active && styles.guestHubSwitchButtonActive]}>
              <Ionicons color={active ? colors.surface : colors.rose} name={icon as keyof typeof Ionicons.glyphMap} size={16} />
              <Text style={[styles.guestHubSwitchText, active && styles.guestHubSwitchTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeView === 'guests' ? (
        <>
          <LinearGradient colors={['#FFF2EA', '#F8DDE5']} style={styles.websiteHero}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Guest list</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{data.guests.length} guests</Text>
              </View>
            </View>
            <Text style={styles.websiteTitle}>Guests & RSVPs</Text>
            <Text style={styles.websiteMeta}>Manage households, meal choices, tables, and reminders.</Text>
          </LinearGradient>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Confirmed" value={String(confirmedGuests)} />
            <SummaryCard label="Pending" value={String(pendingGuests)} />
            <SummaryCard label="Declined" value={String(declinedGuests)} />
          </View>
        </>
      ) : null}

      {activeView === 'seating' ? (
        <>
          <LinearGradient colors={['#FFF2EA', '#F8DDE5']} style={styles.websiteHero}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>AI seating</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{data.seating.length} tables</Text>
              </View>
            </View>
            <Text style={styles.websiteTitle}>Seating Chart</Text>
            <Text style={styles.websiteMeta}>Generate, review, adjust, and apply guest table assignments.</Text>
          </LinearGradient>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Eligible" value={String(seatingEligibleGuests)} />
            <SummaryCard label="Tables" value={String(seatingTableCount)} />
            <SummaryCard label="Capacity" value={String(seatingCapacity)} />
          </View>
          <MobileSeatingGenerator
            applied={seatingApplied}
            capacity={seatingCapacity}
            eligibleGuests={seatingEligibleGuests}
            generating={seatingGenerating}
            notes={seatingNotes}
            onApply={applyMobileSeating}
            onGenerate={generateMobileSeating}
            onMoveGuest={moveSeatingGuest}
            onNotesChange={(value) => {
              setSeatingNotes(value);
              setSeatingApplied(false);
            }}
            onSeatsPerTableChange={(value) => {
              setSeatingSeatsPerTable(value);
              setSeatingApplied(false);
            }}
            onTableCountChange={(value) => {
              setSeatingTableCount(value);
              setSeatingApplied(false);
            }}
            result={seatingResult}
            saving={seatingSaving}
            seatsPerTable={seatingSeatsPerTable}
            syncMessage={seatingSyncMessage}
            tableCount={seatingTableCount}
          />
        </>
      ) : null}

      {activeView === 'invites' ? (
        <>
          <LinearGradient colors={['#FFF2EA', '#F4DEBE']} style={styles.websiteHero}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Invitations</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{inviteTotals.responses} replies</Text>
              </View>
            </View>
            <Text style={styles.websiteTitle}>Invitation Studio</Text>
            <Text style={styles.websiteMeta}>Design, send, and track Save the Dates, invitations, and RSVP reminders.</Text>
          </LinearGradient>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Sent" value={String(inviteTotals.sent)} />
            <SummaryCard label="Opened" value={String(inviteTotals.opened)} />
            <SummaryCard label="Responses" value={String(inviteTotals.responses)} />
          </View>
        </>
      ) : null}

      {activeView === 'website' ? (
        <>
          <LinearGradient colors={['#FFF2EA', '#F8DDE5']} style={styles.websiteHero}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Guest website</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Draft live</Text>
              </View>
            </View>
            <Text style={styles.websiteTitle}>{data.profile.coupleName}</Text>
            <Text style={styles.websiteMeta}>{data.profile.venue} - {formatShortDate(data.profile.weddingDate)}</Text>
            <View style={styles.websiteStatusRow}>
              <View style={styles.websiteStatusBadge}>
                <Ionicons color={registryConnected ? colors.green : colors.rose} name="gift-outline" size={14} />
                <Text style={[styles.websiteStatusBadgeText, registryConnected && styles.websiteStatusBadgeTextConnected]}>
                  Registry {registryConnected ? 'connected' : 'needed'}
                </Text>
              </View>
              <View style={styles.websiteStatusBadge}>
                <Ionicons color={colors.green} name="camera-outline" size={14} />
                <Text style={styles.websiteStatusBadgeTextConnected}>Photo drop on</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.summaryGrid}>
            <SummaryCard label="Published" value={String(published)} />
            <SummaryCard label="Ready" value={String(ready)} />
            <SummaryCard label="Drafts" value={String(drafts)} />
          </View>
        </>
      ) : null}

      {activeView === 'travel' ? (
        <>
          <LinearGradient colors={['#FFF2EA', '#E6EFE5']} style={styles.websiteHero}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Travel & Hotels</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{data.hotels.length} blocks</Text>
              </View>
            </View>
            <Text style={styles.websiteTitle}>Guest Travel</Text>
            <Text style={styles.websiteMeta}>Manage hotel blocks, rates, booking deadlines, shuttle notes, and travel website copy.</Text>
          </LinearGradient>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Rooms" value={`${hotelRoomsBooked}/${hotelRoomsTotal}`} />
            <SummaryCard label="Blocks" value={String(data.hotels.length)} />
            <SummaryCard label="Shuttles" value={String(hotelShuttleCount)} />
          </View>
          <TravelHotelsPanel
            data={data}
            onAddHotel={onAddHotel}
            onDeleteHotel={onDeleteHotel}
            onUpdateHotel={onUpdateHotel}
            openMockAction={openMockAction}
          />
        </>
      ) : null}

      {activeView === 'website' ? <Card style={styles.ariaCalendarCard}>
        <View style={styles.actionIcon}>
          <Image resizeMode="cover" source={ariaAvatar} style={styles.actionAvatar} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.overline}>Aria website check</Text>
          <Text style={styles.actionText}>
            Finish travel, registry, and RSVP copy before publishing the next update.
          </Text>
        </View>
      </Card> : null}

      {activeView === 'website' ? (
        <WebsiteMobilePreview
          data={data}
          onOpenEditor={(sectionTitle) =>
            openMockAction({
              title: `${sectionTitle} editor`,
              detail: `Edit ${sectionTitle} while keeping the guest-facing website preview visible, so couples can see the page as they edit.`,
              primaryLabel: 'Edit section',
            })
          }
          onPreview={() =>
            openMockAction({
              title: 'Website preview',
              detail: 'This is the guest-facing wedding website preview with mobile and desktop views for RSVP, schedule, travel, registry, and photo sections.',
              primaryLabel: 'Preview website',
            })
          }
          registryConnected={registryConnected}
        />
      ) : null}

      {activeView === 'guests' ? <Card>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Guest list</Text>
            <Text style={styles.hubDetail}>RSVPs, meals, tables, and reminders.</Text>
          </View>
          <Text style={styles.smallStatus}>{data.guests.length} guests</Text>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryCard label="Confirmed" value={String(confirmedGuests)} />
          <SummaryCard label="Pending" value={String(pendingGuests)} />
          <SummaryCard label="Declined" value={String(declinedGuests)} />
        </View>
        <View style={styles.calendarList}>
          {data.guests.map((guest) => (
            <GuestListRow
              key={guest.id}
              guest={guest}
              onPress={() => setSelectedGuest(guest)}
            />
          ))}
        </View>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={openNewGuestEditor}
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="person-add-outline" size={18} />
            <Text style={styles.primaryActionText}>Add guest</Text>
          </Pressable>
          <Pressable
            disabled={Boolean(guestCampaignSending)}
            onPress={() => void runGuestCampaign('rsvp-reminders', sendPendingRsvpReminders)}
            style={[styles.secondaryActionButton, guestCampaignSending && styles.disabledActionButton]}
          >
            <Ionicons color={colors.rose} name={guestCampaignSending === 'rsvp-reminders' ? 'sync-outline' : 'chatbubble-ellipses-outline'} size={18} />
            <Text style={styles.secondaryActionText}>{guestCampaignSending === 'rsvp-reminders' ? 'Sending...' : 'Send RSVP reminders'}</Text>
          </Pressable>
          <Pressable
            disabled={Boolean(guestCampaignSending)}
            onPress={() => void runGuestCampaign('save-the-dates', sendSaveTheDates)}
            style={[styles.secondaryActionButton, guestCampaignSending && styles.disabledActionButton]}
          >
            <Ionicons color={colors.rose} name={guestCampaignSending === 'save-the-dates' ? 'sync-outline' : 'calendar-outline'} size={18} />
            <Text style={styles.secondaryActionText}>{guestCampaignSending === 'save-the-dates' ? 'Sending...' : 'Send Save the Date'}</Text>
          </Pressable>
          <Pressable
            disabled={Boolean(guestCampaignSending)}
            onPress={() => void runGuestCampaign('rsvp-invites', sendRsvpInvitations)}
            style={[styles.secondaryActionButton, guestCampaignSending && styles.disabledActionButton]}
          >
            <Ionicons color={colors.rose} name={guestCampaignSending === 'rsvp-invites' ? 'sync-outline' : 'mail-open-outline'} size={18} />
            <Text style={styles.secondaryActionText}>{guestCampaignSending === 'rsvp-invites' ? 'Sending...' : 'Send RSVP invite'}</Text>
          </Pressable>
        </View>
        {guestCampaignMessage ? <SavedStrip label={guestCampaignMessage} /> : null}
      </Card> : null}

      <GuestDetailModal
        guest={selectedGuest}
        onClose={() => setSelectedGuest(null)}
        onDelete={(guestId) => {
          onDeleteGuest(guestId);
          setSelectedGuest(null);
        }}
        onSave={(guest) => {
          if (guest.id.startsWith('mobile-new-')) {
            onAddGuest(guest);
          } else {
            onUpdateGuest(guest);
          }
          setSelectedGuest(null);
        }}
      />

      {activeView === 'invites' ? <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Invitation Studio</Text>
          <Text style={styles.smallStatus}>{inviteTotals.responses} responses</Text>
        </View>
        <Text style={styles.mutedText}>Design, preview, and schedule guest invitation flows.</Text>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={() => setInvitationStudioOpen((open) => !open)}
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="color-palette-outline" size={18} />
            <Text style={styles.primaryActionText}>{invitationStudioOpen ? 'Close studio' : 'Open studio'}</Text>
          </Pressable>
        </View>
        {invitationStudioOpen ? <InvitationStudioPanel data={data} openMockAction={openMockAction} /> : null}
        <View style={styles.inviteStatsRow}>
          <SummaryCard label="Sent" value={String(inviteTotals.sent)} />
          <SummaryCard label="Opened" value={String(inviteTotals.opened)} />
        </View>
        <View style={styles.calendarList}>
          {data.invitations.map((invitation) => (
            <WebsitePageRow
              key={invitation.id}
              title={invitation.type}
              status={invitation.status}
              detail={`${invitation.sent} sent - ${invitation.opened} opened - ${invitation.responses} responses`}
              onPress={() => setInvitationStudioOpen(true)}
            />
          ))}
        </View>
      </Card> : null}

      {activeView === 'website' ? <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Registry</Text>
          <Text style={styles.smallStatus}>{registryConnected ? 'Connected' : 'Not connected'}</Text>
        </View>
        <Text style={styles.mutedText}>
          Connect a registry so guests can find gifts from the website, invitations, and RSVP flow.
        </Text>
        <View style={styles.registryPreview}>
          <View style={styles.registryIcon}>
            <Ionicons color={colors.rose} name="gift-outline" size={22} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>{registryConnected ? 'Registry link ready' : 'No registry linked yet'}</Text>
            <Text style={styles.hubDetail}>
              {registryConnected
                ? registryUrl || 'Guests will see the registry button on the public wedding website.'
                : 'Add Zola, The Knot, Amazon, Target, or a custom registry URL.'}
            </Text>
          </View>
        </View>
        <FormInput
          keyboardType="url"
          label="Registry URL"
          onChangeText={(value) => {
            setRegistryUrl(value);
            setRegistryConnected(Boolean(value.trim()));
          }}
          placeholder="https://..."
          value={registryUrl}
        />
        <View style={styles.registryProviderRow}>
          {['Zola', 'The Knot', 'Amazon', 'Target'].map((provider) => (
            <Pressable
              key={provider}
              onPress={() => {
                setRegistryConnected(true);
                setRegistryUrl(`https://${provider.toLowerCase().replace(/\s+/g, '')}.com/registry/stacy-rick`);
                openMockAction({
                  title: `${provider} registry connected`,
                  detail: `Connect the couple's ${provider} registry and make it available in Guest Hub, invitations, and RSVP flows.`,
                  primaryLabel: 'Done',
                });
              }}
              style={styles.registryProvider}
            >
              <Text style={styles.registryProviderText}>{provider}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={() => {
              setRegistryConnected(Boolean(registryUrl.trim()) || true);
              openMockAction({
                title: 'Registry connected',
                detail: registryUrl.trim()
                  ? `${registryUrl.trim()} is saved and ready for the website, invitations, and RSVP experience.`
                  : 'Add a registry URL when it is ready, then show it on the website, invitations, and RSVP experience.',
                primaryLabel: 'Save registry',
              });
            }}
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="link-outline" size={18} />
            <Text style={styles.primaryActionText}>{registryConnected ? 'Update link' : 'Connect registry'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setRegistryConnected(true);
              if (!registryUrl.trim()) setRegistryUrl('https://');
              openMockAction({
                title: 'Custom registry link',
                detail: 'Paste any registry URL and choose where guests see it.',
                primaryLabel: 'Add link',
              });
            }}
            style={styles.secondaryActionButton}
          >
            <Ionicons color={colors.rose} name="add-circle-outline" size={18} />
            <Text style={styles.secondaryActionText}>Add custom link</Text>
          </Pressable>
        </View>
      </Card> : null}

      {activeView === 'website' ? (
        <PhotoDropMobilePanel
          activeTab={photoDropTab}
          data={data}
          onChangeTab={setPhotoDropTab}
          onUpdateSettings={onUpdateGuestPhotoDropSettings}
          openMockAction={openMockAction}
        />
      ) : null}
    </Section>
  );
}

function TravelHotelsPanel({
  data,
  onAddHotel,
  onDeleteHotel,
  onUpdateHotel,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  onAddHotel: (hotel: (typeof samplePlanningData.hotels)[number]) => void;
  onDeleteHotel: (hotelId: string) => void;
  onUpdateHotel: (hotel: (typeof samplePlanningData.hotels)[number]) => void;
  openMockAction: (action: MockAction) => void;
}) {
  const [editingHotel, setEditingHotel] = useState<(typeof samplePlanningData.hotels)[number] | null>(null);
  const nextDeadline = [...data.hotels]
    .sort((a, b) => (parseDate(a.deadline)?.getTime() ?? 0) - (parseDate(b.deadline)?.getTime() ?? 0))[0];

  return (
    <>
      <Card>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Hotel blocks</Text>
            <Text style={styles.hubDetail}>Rates, room counts, deadlines, shuttle status, and guest-facing booking details.</Text>
          </View>
          <Text style={styles.smallStatus}>{data.hotels.length} active</Text>
        </View>
        <View style={styles.calendarList}>
          {data.hotels.map((hotel) => (
            <Pressable
              key={hotel.id}
              onPress={() => setEditingHotel(hotel)}
              style={styles.hotelBlockRow}
            >
              <View style={styles.hotelIcon}>
                <Ionicons color={colors.rose} name="bed-outline" size={20} />
              </View>
              <View style={styles.hubCopy}>
                <View style={styles.websitePageTitleRow}>
                  <Text style={styles.hubLabel}>{hotel.name}</Text>
                  <Text style={[styles.websiteStatusPill, hotel.shuttle ? websiteStatusStyle('Published') : websiteStatusStyle('Draft')]}>
                    {hotel.shuttle ? 'Shuttle' : 'No shuttle'}
                  </Text>
                </View>
                <Text style={styles.hubDetail}>{hotel.address}</Text>
                <Text style={styles.hubDetail}>{hotel.roomsBooked}/{hotel.roomsTotal} rooms - {formatCurrency(hotel.rate)}/night - Deadline {formatShortDate(hotel.deadline)}</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} />
            </Pressable>
          ))}
        </View>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={() =>
              setEditingHotel({
                address: '',
                contact: '',
                deadline: dateKey(new Date()),
                id: `hotel-new-${Date.now()}`,
                name: '',
                rate: 0,
                roomsBooked: 0,
                roomsTotal: 10,
                shuttle: false,
              })
            }
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="add" size={18} />
            <Text style={styles.primaryActionText}>Add hotel block</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              openMockAction({
                title: 'Travel website copy',
                detail: 'Update the Travel & Hotels section on the wedding website with booking links, hotel notes, shuttle timing, airports, and ride share details.',
                primaryLabel: 'Edit travel copy',
              })
            }
            style={styles.secondaryActionButton}
          >
            <Ionicons color={colors.rose} name="create-outline" size={18} />
            <Text style={styles.secondaryActionText}>Travel copy</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.ariaCalendarCard}>
        <View style={styles.actionIcon}>
          <Ionicons color={colors.rose} name="calendar-outline" size={22} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.overline}>Next hotel deadline</Text>
          <Text style={styles.actionText}>
            {nextDeadline ? `${nextDeadline.name} closes ${formatShortDate(nextDeadline.deadline)} with ${Math.max(0, nextDeadline.roomsTotal - nextDeadline.roomsBooked)} rooms left.` : 'No active hotel deadlines yet.'}
          </Text>
        </View>
      </Card>

      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Guest travel tools</Text>
          <Text style={styles.smallStatus}>Connected</Text>
        </View>
        <View style={styles.websiteEditorToolGrid}>
          <EditorToolButton icon="mail-open-outline" label="Add to Save the Date" onPress={() => openMockAction({ title: 'Save-the-Date hotel question', detail: 'Show hotel needs in Save-the-Date and save each response to the guest profile.', primaryLabel: 'Update invite' })} />
          <EditorToolButton icon="globe-outline" label="Website travel section" onPress={() => openMockAction({ title: 'Website travel section', detail: 'Publish hotel blocks, travel instructions, airports, and shuttle notes to the guest website.', primaryLabel: 'Open section' })} />
          <EditorToolButton icon="people-outline" label="Hotel responses" onPress={() => openMockAction({ title: 'Guest hotel responses', detail: 'Review which guests need rooms, booked inside the block, or still need a reminder.', primaryLabel: 'Review responses' })} />
        </View>
      </Card>

      <HotelEditorModal
        hotel={editingHotel}
        onClose={() => setEditingHotel(null)}
        onDelete={(hotelId) => {
          onDeleteHotel(hotelId);
          setEditingHotel(null);
        }}
        onSave={(hotel) => {
          if (hotel.id.startsWith('hotel-new-')) onAddHotel(hotel);
          else onUpdateHotel(hotel);
          setEditingHotel(null);
        }}
      />
    </>
  );
}

function HotelEditorModal({
  hotel,
  onClose,
  onDelete,
  onSave,
}: {
  hotel: (typeof samplePlanningData.hotels)[number] | null;
  onClose: () => void;
  onDelete: (hotelId: string) => void;
  onSave: (hotel: (typeof samplePlanningData.hotels)[number]) => void;
}) {
  const [draft, setDraft] = useState(hotel);
  useEffect(() => setDraft(hotel), [hotel]);
  if (!hotel || !draft) return null;
  const isNew = hotel.id.startsWith('hotel-new-');

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(hotel)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>{isNew ? 'Add hotel block' : 'Edit hotel block'}</Text>
              <Text style={styles.hubDetail}>Hotel block details for guests, website travel copy, and Save-the-Date hotel questions.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>
          <View style={styles.formStack}>
            <FormInput label="Hotel name" onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Hotel name" value={draft.name} />
            <FormInput label="Address" onChangeText={(value) => setDraft({ ...draft, address: value })} placeholder="Hotel address" value={draft.address} />
            <FormInput label="Rooms booked" onChangeText={(value) => setDraft({ ...draft, roomsBooked: Number(value) || 0 })} placeholder="0" value={String(draft.roomsBooked || '')} />
            <FormInput label="Rooms total" onChangeText={(value) => setDraft({ ...draft, roomsTotal: Number(value) || 0 })} placeholder="10" value={String(draft.roomsTotal || '')} />
            <FormInput label="Rate" onChangeText={(value) => setDraft({ ...draft, rate: Number(value) || 0 })} placeholder="189" value={String(draft.rate || '')} />
            <FormInput label="Deadline" onChangeText={(value) => setDraft({ ...draft, deadline: value })} placeholder="2026-06-15" value={draft.deadline} />
            <FormInput keyboardType="url" label="Contact" onChangeText={(value) => setDraft({ ...draft, contact: value })} placeholder="groups@hotel.com" value={draft.contact} />
            <Pressable onPress={() => setDraft({ ...draft, shuttle: !draft.shuttle })} style={styles.websiteEditorToggleRow}>
              <Text style={styles.hubLabel}>Shuttle available</Text>
              <View style={[styles.mockSwitch, draft.shuttle && styles.mockSwitchActive]}>
                <View style={[styles.mockSwitchThumb, draft.shuttle && styles.mockSwitchThumbActive]} />
              </View>
            </Pressable>
          </View>
          <View style={styles.websiteActions}>
            <Pressable disabled={!draft.name.trim()} onPress={() => onSave(draft)} style={[styles.primaryActionButton, !draft.name.trim() && styles.disabledButton]}>
              <Ionicons color={colors.surface} name="save-outline" size={18} />
              <Text style={styles.primaryActionText}>{isNew ? 'Add block' : 'Save block'}</Text>
            </Pressable>
            {!isNew ? (
              <Pressable onPress={() => onDelete(hotel.id)} style={styles.secondaryActionButton}>
                <Ionicons color={colors.rose} name="trash-outline" size={18} />
                <Text style={styles.secondaryActionText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MobileSeatingGenerator({
  applied,
  capacity,
  eligibleGuests,
  generating,
  notes,
  onApply,
  onGenerate,
  onMoveGuest,
  onNotesChange,
  onSeatsPerTableChange,
  onTableCountChange,
  result,
  saving,
  seatsPerTable,
  syncMessage,
  tableCount,
}: {
  applied: boolean;
  capacity: number;
  eligibleGuests: number;
  generating: boolean;
  notes: string;
  onApply: () => Promise<void>;
  onGenerate: () => Promise<void>;
  onMoveGuest: (fromTableNumber: number, toTableNumber: number, guestName: string) => void;
  onNotesChange: (value: string) => void;
  onSeatsPerTableChange: (value: number) => void;
  onTableCountChange: (value: number) => void;
  result: MobileSeatingResult | null;
  saving: boolean;
  seatsPerTable: number;
  syncMessage: string | null;
  tableCount: number;
}) {
  return (
    <Card style={styles.seatingGeneratorCard}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.seatingTitleRow}>
          <View style={styles.seatingSparkIcon}>
            <Ionicons color={colors.rose} name="sparkles-outline" size={19} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.cardTitle}>AI Seating Chart Generator</Text>
            <Text style={styles.hubDetail}>Generate a table plan from guests, capacity, and seating notes.</Text>
          </View>
        </View>
      </View>

      <View style={styles.seatingControlsGrid}>
        <SeatingStepper
          label="Number of tables"
          max={30}
          min={1}
          onChange={onTableCountChange}
          value={tableCount}
        />
        <SeatingStepper
          label="Seats per table"
          max={20}
          min={2}
          onChange={onSeatsPerTableChange}
          value={seatsPerTable}
        />
      </View>

      <View style={styles.seatingCapacityCard}>
        <Text style={styles.summaryLabel}>Capacity summary</Text>
        <Text style={styles.seatingCapacityValue}>{eligibleGuests} / {capacity}</Text>
        <Text style={styles.hubDetail}>Eligible guests / available seats</Text>
        {eligibleGuests > capacity ? (
          <View style={styles.seatingWarningRow}>
            <Ionicons color={colors.rose} name="warning-outline" size={14} />
            <Text style={styles.seatingWarningText}>Add tables or seats before generating.</Text>
          </View>
        ) : null}
      </View>

      <View>
        <Text style={styles.formLabel}>Additional notes</Text>
        <TextInput
          multiline
          onChangeText={onNotesChange}
          placeholder="Keep college friends together, avoid conflicts, reserve family seats..."
          placeholderTextColor={colors.muted}
          style={[styles.formInput, styles.seatingNotesInput]}
          value={notes}
        />
      </View>

      <View style={styles.websiteActions}>
        <Pressable
          accessibilityRole="button"
          disabled={eligibleGuests < 2 || generating}
          onPress={onGenerate}
          style={[styles.primaryActionButton, (eligibleGuests < 2 || generating) && styles.disabledActionButton]}
        >
          <Ionicons color={colors.surface} name={generating ? 'refresh-outline' : 'sparkles-outline'} size={18} />
          <Text style={styles.primaryActionText}>{generating ? 'Generating...' : 'Generate AI Seating Chart'}</Text>
        </Pressable>
        {result ? (
          <Pressable disabled={generating} onPress={onGenerate} style={[styles.secondaryActionButton, generating && styles.disabledActionButton]}>
            <Ionicons color={colors.rose} name="refresh-outline" size={17} />
            <Text style={styles.secondaryActionText}>Regenerate</Text>
          </Pressable>
        ) : null}
      </View>

      {syncMessage ? <SavedStrip label={syncMessage} /> : null}

      {result ? (
        <View style={styles.seatingResultBlock}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Your Seating Chart</Text>
              <Text style={styles.hubDetail}>{result.totalSeated} guests seated across {result.tables.length} tables.</Text>
            </View>
            <Text style={styles.smallStatus}>AI draft</Text>
          </View>

          {result.insights.map((insight) => (
            <View key={insight} style={styles.seatingInsightRow}>
              <Ionicons color={colors.green} name="checkmark-circle-outline" size={15} />
              <Text style={styles.seatingInsightText}>{insight}</Text>
            </View>
          ))}

          {result.warnings.map((warning) => (
            <View key={warning} style={styles.seatingWarningRow}>
              <Ionicons color={colors.rose} name="alert-circle-outline" size={15} />
              <Text style={styles.seatingWarningText}>{warning}</Text>
            </View>
          ))}

          <MobileSeatingFloorPlan onMoveGuest={onMoveGuest} result={result} seatsPerTable={seatsPerTable} />

          {applied ? <SavedStrip label="Seating chart applied to guest records" /> : null}

          <View style={styles.websiteActions}>
            <Pressable disabled={saving} onPress={onApply} style={[styles.primaryActionButton, saving && styles.disabledActionButton]}>
              <Ionicons color={colors.surface} name="checkmark-outline" size={18} />
              <Text style={styles.primaryActionText}>{saving ? 'Applying...' : 'Apply Plan'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryActionButton}>
              <Ionicons color={colors.rose} name="create-outline" size={17} />
              <Text style={styles.secondaryActionText}>Adjust</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function MobileSeatingFloorPlan({
  onMoveGuest,
  result,
  seatsPerTable,
}: {
  onMoveGuest: (fromTableNumber: number, toTableNumber: number, guestName: string) => void;
  result: MobileSeatingResult;
  seatsPerTable: number;
}) {
  const [selectedTableNumber, setSelectedTableNumber] = useState(result.tables[0]?.tableNumber ?? 1);
  const [moveGuest, setMoveGuest] = useState<{ fromTableNumber: number; name: string } | null>(null);
  const seatTotal = Math.max(2, Math.min(20, Math.round(seatsPerTable)));
  const totalCapacity = result.tables.length * seatTotal;
  const selectedIndex = Math.max(0, result.tables.findIndex((table) => table.tableNumber === selectedTableNumber));
  const selectedTable = result.tables[selectedIndex] ?? result.tables[0];
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < result.tables.length - 1;

  useEffect(() => {
    if (!result.tables.some((table) => table.tableNumber === selectedTableNumber)) {
      setSelectedTableNumber(result.tables[0]?.tableNumber ?? 1);
    }
  }, [result.tables, selectedTableNumber]);

  const selectByIndex = (nextIndex: number) => {
    const nextTable = result.tables[nextIndex];
    if (nextTable) {
      setSelectedTableNumber(nextTable.tableNumber);
    }
  };

  return (
    <LinearGradient colors={['#FFFDFB', '#FFF7F2', '#F8DDE5']} style={styles.seatingFloorPlan}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.hubCopy}>
          <Text style={styles.seatingFloorTitle}>Reception Layout Preview</Text>
          <Text style={styles.hubDetail}>A visual table map that follows your table count and seats-per-table settings.</Text>
        </View>
        <View style={styles.seatingCapacityBadge}>
          <Text style={styles.seatingCapacityBadgeText}>{result.totalSeated} / {totalCapacity}</Text>
        </View>
      </View>

      <View style={styles.seatingOverviewGrid}>
        {result.tables.map((table, index) => (
          <Pressable
            key={table.tableNumber}
            onPress={() => setSelectedTableNumber(table.tableNumber)}
            style={[
              styles.seatingOverviewBubble,
              table.tableNumber === selectedTable?.tableNumber && styles.seatingOverviewBubbleActive,
            ]}
          >
            <Text style={[styles.seatingOverviewNumber, table.tableNumber === selectedTable?.tableNumber && styles.seatingOverviewNumberActive]}>
              {table.tableNumber}
            </Text>
            <Text style={[styles.seatingOverviewMeta, table.tableNumber === selectedTable?.tableNumber && styles.seatingOverviewMetaActive]}>
              {table.guests.length}/{seatTotal}
            </Text>
            {index === 0 ? <Text style={[styles.seatingOverviewTag, table.tableNumber === selectedTable?.tableNumber && styles.seatingOverviewTagActive]}>VIP</Text> : null}
          </Pressable>
        ))}
      </View>

      {selectedTable ? (
        <>
          <View style={styles.seatingSelectedNav}>
            <Pressable
              disabled={!canGoPrevious}
              onPress={() => selectByIndex(selectedIndex - 1)}
              style={[styles.seatingNavButton, !canGoPrevious && styles.seatingNavButtonDisabled]}
            >
              <Ionicons color={canGoPrevious ? colors.rose : colors.muted} name="chevron-back" size={16} />
              <Text style={[styles.seatingNavText, !canGoPrevious && styles.seatingNavTextDisabled]}>Previous</Text>
            </Pressable>
            <Text style={styles.seatingSelectedLabel}>Table {selectedTable.tableNumber} of {result.tables.length}</Text>
            <Pressable
              disabled={!canGoNext}
              onPress={() => selectByIndex(selectedIndex + 1)}
              style={[styles.seatingNavButton, !canGoNext && styles.seatingNavButtonDisabled]}
            >
              <Text style={[styles.seatingNavText, !canGoNext && styles.seatingNavTextDisabled]}>Next</Text>
              <Ionicons color={canGoNext ? colors.rose : colors.muted} name="chevron-forward" size={16} />
            </Pressable>
          </View>
          <MobileSeatingPreviewTable
            index={selectedIndex}
            onSelectGuest={(guestName) => setMoveGuest({ fromTableNumber: selectedTable.tableNumber, name: guestName })}
            seatsPerTable={seatTotal}
            table={selectedTable}
          />
        </>
      ) : null}

      <Text style={styles.seatingDragHint}>Tap a table above to inspect its seats. Use the website for drag-and-drop edits across many tables.</Text>

      {moveGuest ? (
        <View style={styles.seatingMoveSheet}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.hubCopy}>
              <Text style={styles.seatingMoveTitle}>Move {moveGuest.name}</Text>
              <Text style={styles.hubDetail}>Choose a destination table.</Text>
            </View>
            <Pressable onPress={() => setMoveGuest(null)} style={styles.seatingMoveClose}>
              <Ionicons color={colors.muted} name="close" size={18} />
            </Pressable>
          </View>
          <View style={styles.seatingMoveGrid}>
            {result.tables.map((table) => {
              const isCurrent = table.tableNumber === moveGuest.fromTableNumber;
              const isFull = table.guests.length >= seatTotal && !isCurrent;
              return (
                <Pressable
                  disabled={isCurrent}
                  key={`move-${table.tableNumber}`}
                  onPress={() => {
                    onMoveGuest(moveGuest.fromTableNumber, table.tableNumber, moveGuest.name);
                    setSelectedTableNumber(table.tableNumber);
                    setMoveGuest(null);
                  }}
                  style={[
                    styles.seatingMoveOption,
                    isCurrent && styles.seatingMoveOptionCurrent,
                    isFull && styles.seatingMoveOptionFull,
                  ]}
                >
                  <Text style={[styles.seatingMoveOptionNumber, isCurrent && styles.seatingMoveOptionNumberCurrent]}>
                    {table.tableNumber}
                  </Text>
                  <Text style={styles.seatingMoveOptionMeta}>
                    {isCurrent ? 'Current' : `${table.guests.length}/${seatTotal}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function MobileSeatingPreviewTable({
  index,
  onSelectGuest,
  seatsPerTable,
  table,
}: {
  index: number;
  onSelectGuest: (guestName: string) => void;
  seatsPerTable: number;
  table: MobileSeatingTable;
}) {
  const seatTotal = Math.max(2, Math.min(20, Math.round(seatsPerTable)));
  const displaySeats = Array.from({ length: Math.min(seatTotal, 12) });
  const tableSize = seatTotal > 10 ? 104 : 96;
  const seatSize = seatTotal > 10 ? 22 : 24;
  const stageSize = tableSize + 64;
  const radius = tableSize / 2 + 16;
  const overCapacity = table.guests.length > seatTotal;

  return (
    <View style={styles.seatingPreviewCard}>
      <View style={styles.seatingPreviewHeader}>
        <View style={styles.hubCopy}>
          <Text style={styles.seatingPreviewEyebrow}>Table {table.tableNumber}</Text>
          <Text style={styles.seatingPreviewName}>{table.tableName || `Table ${table.tableNumber}`}</Text>
          <Text style={styles.seatingPreviewTheme}>{table.theme || 'Add a description for this table'}</Text>
        </View>
        <View style={[styles.seatingTableBadge, overCapacity && styles.seatingTableBadgeWarning]}>
          <Text style={[styles.seatingTableBadgeText, overCapacity && styles.seatingTableBadgeTextWarning]}>
            {Math.min(table.guests.length, seatTotal)} / {seatTotal}
          </Text>
        </View>
      </View>

      <View style={styles.seatingPreviewBody}>
        <View style={[styles.seatingRoundStage, { height: stageSize, width: stageSize }]}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF7F2']}
            style={[
              styles.seatingRoundTable,
              {
                height: tableSize,
                left: (stageSize - tableSize) / 2,
                top: (stageSize - tableSize) / 2,
                width: tableSize,
              },
            ]}
          >
            <View style={styles.seatingDashedRing} />
            <Text style={styles.seatingRoundTableNumber}>{table.tableNumber}</Text>
            <Text style={styles.seatingRoundTableSeats}>{seatTotal} seats</Text>
          </LinearGradient>
          {displaySeats.map((_, seatIndex) => {
            const angle = (-90 + seatIndex * (360 / displaySeats.length)) * (Math.PI / 180);
            const x = stageSize / 2 + Math.cos(angle) * radius - seatSize / 2;
            const y = stageSize / 2 + Math.sin(angle) * radius - seatSize / 2;
            const filled = Boolean(table.guests[seatIndex]);
            return (
              <View
                key={`${table.tableNumber}-seat-${seatIndex}`}
                style={[
                  styles.seatingRoundSeat,
                  filled && styles.seatingRoundSeatFilled,
                  { height: seatSize, left: x, top: y, width: seatSize },
                ]}
              >
                <Text style={[styles.seatingRoundSeatText, filled && styles.seatingRoundSeatTextFilled]}>{seatIndex + 1}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.seatingGuestRoster}>
          <View style={[styles.seatingRosterHeader, index % 2 === 1 && styles.seatingRosterHeaderAlt]}>
            <Text style={styles.seatingRosterNumber}>#</Text>
            <Text style={styles.seatingRosterGuest}>Guest</Text>
          </View>
          {Array.from({ length: Math.min(seatTotal, 10) }).map((_, seatIndex) => {
            const guestName = table.guests[seatIndex];
            return (
            <Pressable
              disabled={!guestName}
              key={`${table.tableNumber}-guest-${seatIndex}`}
              onPress={() => guestName ? onSelectGuest(guestName) : undefined}
              style={[styles.seatingRosterRow, guestName && styles.seatingRosterRowFilled]}
            >
              <Text style={styles.seatingRosterNumber}>{seatIndex + 1}</Text>
              <Text numberOfLines={1} style={[styles.seatingRosterGuest, guestName && styles.seatingRosterGuestFilled]}>
                {guestName ?? 'Open seat'}
              </Text>
              {guestName ? <Ionicons color={colors.rose} name="swap-horizontal-outline" size={13} style={styles.seatingRosterMoveIcon} /> : null}
            </Pressable>
          );
          })}
          {table.guests.length > seatTotal ? (
            <Text style={styles.seatingOverflowText}>+{table.guests.length - seatTotal} over capacity</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SeatingStepper({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <View style={styles.seatingStepper}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.seatingStepperControls}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(Math.max(min, value - 1))}
          style={styles.seatingStepButton}
        >
          <Ionicons color={colors.rose} name="remove-outline" size={18} />
        </Pressable>
        <Text style={styles.seatingStepValue}>{value}</Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(Math.min(max, value + 1))}
          style={styles.seatingStepButton}
        >
          <Ionicons color={colors.rose} name="add-outline" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function GuestDetailModal({
  guest,
  onClose,
  onDelete,
  onSave,
}: {
  guest: Guest | null;
  onClose: () => void;
  onDelete: (guestId: string) => void;
  onSave: (guest: Guest) => void;
}) {
  const [draft, setDraft] = useState<Guest | null>(guest);

  useEffect(() => {
    setDraft(guest);
  }, [guest]);

  if (!guest || !draft) return null;

  const isNew = guest.id.startsWith('mobile-new-');
  const canSave = draft.name.trim().length > 0;
  const saveGuest = () => {
    if (!canSave) return;
    onSave({
      ...draft,
      mealPreference: draft.mealPreference.trim() || 'Guest',
      name: draft.name.trim(),
      role: draft.role.trim() || 'Guest',
      table: draft.table.trim() || 'No table',
    });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(guest)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.accountHeader}>
              <View style={styles.guestListIcon}>
                <Ionicons color={colors.rose} name="person-outline" size={20} />
              </View>
              <View style={styles.hubCopy}>
                <Text style={styles.cardTitle}>{isNew ? 'Add guest' : 'Edit guest'}</Text>
                <Text style={styles.hubDetail}>{draft.role || 'Guest'} - {draft.rsvp}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.actionWorkspace}>
            <FormInput label="Guest name" onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Guest or household name" value={draft.name} />
            <View>
              <Text style={styles.formLabel}>RSVP</Text>
              <View style={styles.eventTypeRow}>
                {(['Confirmed', 'Pending', 'Declined'] as const).map((status) => {
                  const active = draft.rsvp === status;
                  return (
                    <Pressable key={status} onPress={() => setDraft({ ...draft, rsvp: status })} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{status}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <FormInput label="Meal" onChangeText={(value) => setDraft({ ...draft, mealPreference: value })} placeholder="Chicken, vegetarian, kids meal..." value={draft.mealPreference} />
            <FormInput label="Table" onChangeText={(value) => setDraft({ ...draft, table: value })} placeholder="Table 1 or No table" value={draft.table} />
            <FormInput label="Group" onChangeText={(value) => setDraft({ ...draft, role: value })} placeholder="Family, friend, wedding party..." value={draft.role} />
          </View>

          <View style={styles.websiteActions}>
            <Pressable disabled={!canSave} onPress={saveGuest} style={[styles.primaryActionButton, !canSave && styles.disabledButton]}>
              <Ionicons color={colors.surface} name="save-outline" size={18} />
              <Text style={styles.primaryActionText}>{isNew ? 'Add guest' : 'Save guest'}</Text>
            </Pressable>
            {!isNew ? (
              <Pressable onPress={() => onDelete(guest.id)} style={styles.secondaryActionButton}>
                <Ionicons color={colors.rose} name="trash-outline" size={17} />
                <Text style={styles.secondaryActionText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function WebsiteMobilePreview({
  data,
  onOpenEditor,
  onPreview,
  registryConnected,
}: {
  data: typeof samplePlanningData;
  onOpenEditor: (sectionTitle: string) => void;
  onPreview: () => void;
  registryConnected: boolean;
}) {
  const [editorTab, setEditorTab] = useState<'setup' | 'copy' | 'design' | 'sections' | 'rsvp' | 'publish'>('setup');
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [siteTitle, setSiteTitle] = useState(data.profile.coupleName);
  const [welcomeCopy, setWelcomeCopy] = useState('We cannot wait to celebrate with you under the sun.');
  const [rsvpDeadline, setRsvpDeadline] = useState('October 1, 2035');
  const [thankYouMessage, setThankYouMessage] = useState("We'll send you more details closer to the day.");
  const [slug, setSlug] = useState('stacy-rick');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [published, setPublished] = useState(false);
  const [accentColor] = useState(colors.rose);
  const [paperColor] = useState('#FFF8F5');
  const [fontStyle] = useState<'script' | 'classic' | 'modern'>('script');
  const [photoFilter, setPhotoFilter] = useState<'original' | 'soft' | 'bw' | 'warm'>('original');
  const [websiteRecord, setWebsiteRecord] = useState<MobileWebsiteRecord | null>(null);
  const [websiteSaving, setWebsiteSaving] = useState(false);
  const [websiteSyncMessage, setWebsiteSyncMessage] = useState('');
  const [sectionState, setSectionState] = useState({
    story: true,
    schedule: true,
    travel: true,
    registry: true,
    rsvp: true,
    photoDrop: true,
  });
  const [registryUrl, setRegistryUrl] = useState(registryConnected ? 'https://registry.example/stacy-rick' : '');
  const coupleFont = fontStyle === 'script' ? 'GreatVibes_400Regular' : fontStyle === 'classic' ? 'PlayfairDisplay_700Bold' : 'Inter_700Bold';
  const weddingDateLong = formatInvitationDate(data.profile.weddingDate);
  const parsedWeddingDate = parseDate(data.profile.weddingDate);
  const countdownDays = parsedWeddingDate ? Math.max(0, Math.ceil((parsedWeddingDate.getTime() - Date.now()) / 86400000)) : 0;
  const venueLine = [data.profile.venue, data.profile.location].filter(Boolean).join(', ');
  const mobileWebsiteSections = () => ({
    faq: Boolean(websiteRecord?.sectionsEnabled?.faq),
    gallery: Boolean(websiteRecord?.sectionsEnabled?.gallery),
    registry: sectionState.registry,
    rsvp: sectionState.rsvp,
    schedule: sectionState.schedule,
    story: sectionState.story,
    travel: sectionState.travel,
    weddingParty: Boolean(websiteRecord?.sectionsEnabled?.weddingParty),
    welcome: true,
  });
  const mobileWebsiteCustomText = () => ({
    ...(websiteRecord?.customText ?? {}),
    _registryLinks: registryUrl.trim()
      ? JSON.stringify([{ label: 'Registry', url: registryUrl.trim() }])
      : (websiteRecord?.customText?._registryLinks ?? '[]'),
    registry: registryUrl.trim() ? 'Registry details are linked below.' : (websiteRecord?.customText?.registry ?? ''),
    rsvp_deadline: rsvpDeadline,
    rsvp_thankyou: thankYouMessage,
    welcome: welcomeCopy,
  });
  const applyMobileWebsiteRecord = (record: MobileWebsiteRecord) => {
    setWebsiteRecord(record);
    setSlug(record.slug || slug);
    setPublished(Boolean(record.published));
    setPasswordEnabled(Boolean(record.passwordEnabled));
    setWelcomeCopy(record.customText?.welcome || welcomeCopy);
    setRsvpDeadline(record.customText?.rsvp_deadline || rsvpDeadline);
    setThankYouMessage(record.customText?.rsvp_thankyou || thankYouMessage);
    setRegistryUrl(extractFirstRegistryUrl(record.customText?._registryLinks) || registryUrl);
    setSectionState((current) => ({
      ...current,
      registry: record.sectionsEnabled?.registry ?? current.registry,
      rsvp: record.sectionsEnabled?.rsvp ?? current.rsvp,
      schedule: record.sectionsEnabled?.schedule ?? current.schedule,
      story: record.sectionsEnabled?.story ?? current.story,
      travel: record.sectionsEnabled?.travel ?? current.travel,
    }));
  };
  const saveMobileWebsite = async (message = 'Website quick updates saved.') => {
    if (websiteSaving) return null;
    setWebsiteSaving(true);
    setWebsiteSyncMessage('');
    try {
      let record = websiteRecord;
      if (!record) {
        record = await createMobileWebsite();
        setWebsiteRecord(record);
      }
      const updated = await saveMobileWebsiteQuickUpdate({
        customText: mobileWebsiteCustomText(),
        sectionsEnabled: mobileWebsiteSections(),
      });
      applyMobileWebsiteRecord(updated);
      setWebsiteSyncMessage(message);
      return updated;
    } catch (error) {
      setWebsiteSyncMessage(error instanceof Error ? error.message : 'Website updates could not sync.');
      return null;
    } finally {
      setWebsiteSaving(false);
    }
  };
  const toggleMobileWebsitePublish = async () => {
    if (websiteSaving) return;
    setWebsiteSaving(true);
    setWebsiteSyncMessage('');
    try {
      let record = websiteRecord;
      if (!record) {
        record = await createMobileWebsite();
        setWebsiteRecord(record);
      }
      if (slug.trim() && slug.trim() !== record.slug && !record.published) {
        record = await saveMobileWebsiteSlug(slug.trim());
        setWebsiteRecord(record);
      }
      const saved = await saveMobileWebsiteQuickUpdate({
        customText: mobileWebsiteCustomText(),
        sectionsEnabled: mobileWebsiteSections(),
      });
      const updated = await publishMobileWebsite(!Boolean(saved.published));
      applyMobileWebsiteRecord(updated);
      setWebsiteSyncMessage(updated.published ? 'Website published from the app.' : 'Website unpublished from the app.');
    } catch (error) {
      setWebsiteSyncMessage(error instanceof Error ? error.message : 'Publish status could not sync.');
    } finally {
      setWebsiteSaving(false);
    }
  };

  useEffect(() => {
    let alive = true;
    async function hydrateWebsite() {
      try {
        const record = await getMobileWebsite();
        if (alive) applyMobileWebsiteRecord(record);
      } catch {
        // Keep local preview values when the website is not created or sync is unavailable.
      }
    }
    void hydrateWebsite();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Card>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardTitle}>Website preview</Text>
          <Text style={styles.hubDetail}>Use the app for quick website updates, preview, publishing, and guest activity.</Text>
        </View>
        <Pressable onPress={onPreview} style={styles.previewMiniButton}>
          <Ionicons color={colors.rose} name="eye-outline" size={15} />
          <Text style={styles.previewMiniButtonText}>Preview</Text>
        </Pressable>
      </View>

      <View style={styles.mobileEditorGuidance}>
        <View style={styles.mobileEditorGuidanceIcon}>
          <Ionicons color={colors.rose} name="phone-portrait-outline" size={18} />
        </View>
        <View style={styles.hubCopy}>
          <Text style={styles.mobileEditorGuidanceTitle}>Mobile controls are for quick updates</Text>
          <Text style={styles.hubDetail}>
            Preview the site, update simple copy, toggle sections, manage photos, publish changes, send invites, and check RSVP activity here. Use desktop for full layout, templates, detailed design, drag-and-drop ordering, and invitation polish.
          </Text>
        </View>
      </View>
      <View style={styles.websiteActions}>
        <Pressable disabled={websiteSaving} onPress={() => void saveMobileWebsite()} style={[styles.secondaryActionButton, websiteSaving && styles.disabledActionButton]}>
          <Ionicons color={colors.rose} name={websiteSaving ? 'sync-outline' : 'save-outline'} size={18} />
          <Text style={styles.secondaryActionText}>{websiteSaving ? 'Saving...' : 'Save quick updates'}</Text>
        </Pressable>
      </View>
      {websiteSyncMessage ? <SavedStrip label={websiteSyncMessage} /> : null}

      <View style={styles.websiteEditorTabRow}>
        {[
          ['setup', 'Setup', 'settings-outline'],
          ['copy', 'Copy', 'create-outline'],
          ['design', 'Photos', 'image-outline'],
          ['sections', 'Sections', 'toggle-outline'],
          ['rsvp', 'RSVP', 'heart-outline'],
          ['publish', 'Publish', 'globe-outline'],
        ].map(([id, label, icon]) => {
          const active = editorTab === id;
          return (
            <Pressable key={id} onPress={() => setEditorTab(id as typeof editorTab)} style={[styles.websiteEditorTab, active && styles.websiteEditorTabActive]}>
              <Ionicons color={active ? colors.surface : colors.rose} name={icon as keyof typeof Ionicons.glyphMap} size={14} />
              <Text style={[styles.websiteEditorTabText, active && styles.websiteEditorTabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.websiteEditorControls}>
        {editorTab === 'setup' ? (
          <>
            <FormInput label="Couple name" onChangeText={setSiteTitle} placeholder="Couple name" value={siteTitle} />
            <FormInput label="Venue" onChangeText={() => undefined} placeholder="Venue" value={data.profile.venue} />
            <View style={styles.websiteEditorToolGrid}>
              <EditorToolButton icon="image-outline" label="Upload hero photo" onPress={() => onOpenEditor('Home Page Photos')} />
              <EditorToolButton icon="scan-outline" label="Reposition photo" onPress={() => onOpenEditor('Photo position')} />
              <EditorToolButton icon="calendar-outline" label="Add to calendar" onPress={() => onOpenEditor('Add to Calendar')} />
            </View>
          </>
        ) : null}

        {editorTab === 'copy' ? (
          <>
            <View>
              <Text style={styles.formLabel}>Welcome message</Text>
              <TextInput multiline onChangeText={setWelcomeCopy} placeholder="Welcome copy" placeholderTextColor={colors.muted} style={[styles.formInput, styles.messageInput]} value={welcomeCopy} />
            </View>
            <FormInput label="Navigation label" onChangeText={() => undefined} placeholder="Our Story" value="Our Story" />
            <View style={styles.websiteEditorToolGrid}>
              <EditorToolButton icon="sparkles-outline" label="Aria rewrite" onPress={() => setWelcomeCopy('We are so excited to celebrate with you. Find the schedule, travel details, registry, and RSVP here.')} />
              <EditorToolButton icon="text-outline" label="Edit inline text" onPress={() => onOpenEditor('Inline Text')} />
            </View>
          </>
        ) : null}

        {editorTab === 'design' ? (
          <>
            <View>
              <Text style={styles.formLabel}>Photo preview</Text>
              <View style={styles.eventTypeRow}>
                {[
                  ['original', 'Original'],
                  ['soft', 'Soft'],
                  ['bw', 'B&W'],
                  ['warm', 'Warm'],
                ].map(([id, label]) => {
                  const active = photoFilter === id;
                  return (
                    <Pressable key={id} onPress={() => setPhotoFilter(id as typeof photoFilter)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.websiteEditorToolGrid}>
              <EditorToolButton icon="image-outline" label="Upload hero photo" onPress={() => onOpenEditor('Home Page Photos')} />
              <EditorToolButton icon="images-outline" label="Gallery photos" onPress={() => onOpenEditor('Gallery')} />
              <EditorToolButton icon="scan-outline" label="Reposition photo" onPress={() => onOpenEditor('Photo position')} />
            </View>
            <View style={styles.desktopStudioNotice}>
              <Ionicons color={colors.gold} name="desktop-outline" size={18} />
              <View style={styles.hubCopy}>
                <Text style={styles.hubLabel}>Full design studio lives on desktop</Text>
                <Text style={styles.hubDetail}>Use the website editor on desktop for themes, templates, layout, section order, animation, and detailed invitation design.</Text>
              </View>
            </View>
          </>
        ) : null}

        {editorTab === 'sections' ? (
          <>
            {[
              ['story', 'Our Story'],
              ['schedule', 'Schedule'],
              ['travel', 'Travel & Hotels'],
              ['registry', 'Registry'],
              ['photoDrop', 'Photo drop'],
            ].map(([key, label]) => (
              <EditorToggleRow
                key={key}
                label={label}
                onPress={() => setSectionState((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))}
                value={sectionState[key as keyof typeof sectionState]}
              />
            ))}
            <View style={styles.websiteEditorToolGrid}>
              <EditorToolButton icon="time-outline" label="Schedule events" onPress={() => onOpenEditor('Schedule Events')} />
              <EditorToolButton icon="bed-outline" label="Hotel blocks" onPress={() => onOpenEditor('Travel & Venue Items')} />
              <EditorToolButton icon="gift-outline" label="Registry links" onPress={() => onOpenEditor('Registry Links')} />
            </View>
          </>
        ) : null}

        {editorTab === 'rsvp' ? (
          <>
            <EditorToggleRow label="Show RSVP section" onPress={() => setSectionState((current) => ({ ...current, rsvp: !current.rsvp }))} value={sectionState.rsvp} />
            <FormInput label="RSVP deadline" onChangeText={setRsvpDeadline} placeholder="October 1, 2035" value={rsvpDeadline} />
            <FormInput label="Thank-you message" onChangeText={setThankYouMessage} placeholder="Thanks for RSVPing" value={thankYouMessage} />
            <FormInput label="Registry URL" onChangeText={setRegistryUrl} placeholder="https://..." value={registryUrl} />
            <View style={styles.websiteEditorToolGrid}>
              <EditorToolButton icon="restaurant-outline" label="Meal options" onPress={() => onOpenEditor('RSVP Meal Options')} />
              <EditorToolButton icon="bed-outline" label="Ask hotel needs" onPress={() => onOpenEditor('RSVP Hotel Questions')} />
            </View>
          </>
        ) : null}

        {editorTab === 'publish' ? (
          <>
            <FormInput label="Website URL" onChangeText={setSlug} placeholder="stacy-rick" value={slug} />
            <EditorToggleRow label="Password protection" onPress={() => setPasswordEnabled((current) => !current)} value={passwordEnabled} />
            {passwordEnabled ? <FormInput label="Password" onChangeText={() => undefined} placeholder="Enter password" value="familyonly" /> : null}
            <View style={styles.websiteActions}>
              <Pressable onPress={onPreview} style={styles.secondaryActionButton}>
                <Ionicons color={colors.rose} name="eye-outline" size={18} />
                <Text style={styles.secondaryActionText}>Preview</Text>
              </Pressable>
              <Pressable disabled={websiteSaving} onPress={toggleMobileWebsitePublish} style={[styles.primaryActionButton, websiteSaving && styles.disabledActionButton]}>
                <Ionicons color={colors.surface} name={websiteSaving ? 'sync-outline' : published ? 'checkmark-circle-outline' : 'cloud-upload-outline'} size={18} />
                <Text style={styles.primaryActionText}>{websiteSaving ? 'Saving...' : published ? 'Published' : 'Publish'}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.websiteEditorPreviewGrid}>
        <View style={styles.websiteEditorRail}>
          {data.websiteSections.map((section) => (
            <Pressable key={section.id} onPress={() => onOpenEditor(section.title)} style={styles.websiteEditorRailItem}>
              <View style={[styles.websiteEditorRailDot, section.status === 'Published' && styles.websiteEditorRailDotLive]} />
              <View style={styles.hubCopy}>
                <Text style={styles.websiteEditorRailTitle}>{section.title}</Text>
                <Text style={styles.websiteEditorRailMeta}>{section.status}</Text>
              </View>
              <Ionicons color={colors.muted} name="create-outline" size={14} />
            </Pressable>
          ))}
        </View>

        <View style={styles.websiteLivePreviewWrap}>
          <View style={styles.websitePreviewModeRow}>
            {[
              ['mobile', 'Mobile'],
              ['desktop', 'Desktop'],
            ].map(([id, label]) => {
              const active = previewDevice === id;
              return (
                <Pressable key={id} onPress={() => setPreviewDevice(id as 'mobile' | 'desktop')} style={[styles.websitePreviewModeButton, active && styles.websitePreviewModeButtonActive]}>
                  <Text style={[styles.websitePreviewModeText, active && styles.websitePreviewModeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.websitePreviewDeviceHint}>
            {previewDevice === 'desktop' ? 'Desktop guest preview' : 'Mobile guest preview'}
          </Text>
          <View style={[styles.websiteLivePreviewFrame, previewDevice === 'desktop' && styles.websiteLivePreviewFrameDesktop]}>
            {previewDevice === 'desktop' ? (
              <View style={styles.websiteDesktopChrome}>
                <View style={styles.websiteDesktopDots}>
                  <View style={styles.websiteDesktopDot} />
                  <View style={styles.websiteDesktopDot} />
                  <View style={styles.websiteDesktopDot} />
                </View>
                <Text numberOfLines={1} style={styles.websiteDesktopUrl}>aidowedding.net/{slug || 'wedding'}</Text>
              </View>
            ) : null}
            <ScrollView
              contentContainerStyle={{ backgroundColor: paperColor }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={[styles.websiteLivePreviewPage, previewDevice === 'desktop' ? styles.websiteLivePreviewPageDesktop : styles.websiteLivePreviewPageMobile, { backgroundColor: paperColor }]}
            >
              <View style={[styles.websiteLiveAnnouncement, { backgroundColor: accentColor }]}>
                <Text style={styles.websiteLiveAnnouncementText}>Stacy & Rick are getting married</Text>
              </View>
              <View style={[styles.websiteLiveNav, previewDevice === 'desktop' && styles.websiteLiveNavDesktop, { borderColor: `${accentColor}33`, backgroundColor: paperColor }]}>
                <Text style={[styles.websiteLiveNavCouple, previewDevice === 'desktop' && styles.websiteLiveNavCoupleDesktop, { color: accentColor, fontFamily: coupleFont }]}>{siteTitle}</Text>
                <View style={[styles.websiteLiveNavItems, previewDevice === 'desktop' && styles.websiteLiveNavItemsDesktop]}>
                  {[
                    'Home',
                    sectionState.story ? 'Our Story' : null,
                    sectionState.schedule ? 'Schedule' : null,
                    sectionState.travel ? 'Travel' : null,
                    sectionState.registry ? 'Registry' : null,
                    sectionState.rsvp ? 'RSVP' : null,
                  ].filter(Boolean).map((item) => (
                    <Text key={item} style={[styles.websiteLiveNavText, { color: colors.ink }]}>{item}</Text>
                  ))}
                </View>
              </View>

              <View style={[styles.websiteLiveHero, previewDevice === 'desktop' && styles.websiteLiveHeroDesktop]}>
                <Image resizeMode="cover" source={{ uri: couplePhotoUri }} style={[styles.websiteLiveHeroImage, photoFilterStyle(photoFilter)]} />
                <View style={styles.websiteLiveHeroOverlay} />
                <View style={[styles.websiteLiveHeroCopy, previewDevice === 'desktop' && styles.websiteLiveHeroCopyDesktop]}>
                  <Text style={styles.websiteLiveKicker}>{previewDevice === 'desktop' ? "We're getting married" : 'Wedding Celebration'}</Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    numberOfLines={previewDevice === 'desktop' ? 2 : undefined}
                    style={[styles.websiteLiveHeroNames, previewDevice === 'desktop' && styles.websiteLiveHeroNamesDesktop, { fontFamily: coupleFont }]}
                  >
                    {siteTitle}
                  </Text>
                  {previewDevice === 'desktop' ? (
                    <>
                      <View style={styles.websiteLiveHeroDetailRow}>
                        <Ionicons color={colors.surface} name="calendar-outline" size={13} />
                        <Text style={styles.websiteLiveHeroMeta}>{weddingDateLong}</Text>
                      </View>
                      <View style={styles.websiteLiveHeroDetailRow}>
                        <Ionicons color={colors.surface} name="location-outline" size={13} />
                        <Text style={styles.websiteLiveHeroMeta}>{venueLine}</Text>
                      </View>
                      <View style={styles.websiteLiveCountdownRow}>
                        {[
                          [String(countdownDays), 'Days'],
                          ['00', 'Hours'],
                          ['00', 'Min'],
                          ['00', 'Sec'],
                        ].map(([value, label]) => (
                          <View key={label} style={styles.websiteLiveCountdownPill}>
                            <Text style={styles.websiteLiveCountdownNumber}>{value}</Text>
                            <Text style={styles.websiteLiveCountdownLabel}>{label}</Text>
                          </View>
                        ))}
                      </View>
                      <Pressable onPress={onPreview} style={styles.websiteLiveCalendarButton}>
                        <Ionicons color={colors.surface} name="calendar-clear-outline" size={13} />
                        <Text style={styles.websiteLiveCalendarButtonText}>Add to Calendar</Text>
                      </Pressable>
                    </>
                  ) : null}
                  {previewDevice !== 'desktop' ? (
                    <>
                  <Text style={styles.websiteLiveHeroMeta}>{formatShortDate(data.profile.weddingDate)} · {data.profile.venue}</Text>
                  <Text style={styles.websiteLiveHeroMeta}>{data.profile.location}</Text>
                  {sectionState.rsvp ? (
                    <Pressable onPress={onPreview} style={[styles.websiteLiveHeroButton, { backgroundColor: accentColor }]}>
                      <Text style={styles.websiteLiveHeroButtonText}>RSVP</Text>
                    </Pressable>
                  ) : null}
                    </>
                  ) : null}
                </View>
              </View>

              <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>Welcome</Text>
                <Text style={[styles.websiteLiveSectionText, previewDevice === 'desktop' && styles.websiteLiveSectionTextDesktop]}>{welcomeCopy}</Text>
              </View>
              {sectionState.story ? (
                <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                  <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>Our Story</Text>
                  <Text style={[styles.websiteLiveSectionText, previewDevice === 'desktop' && styles.websiteLiveSectionTextDesktop]}>A note from the couple appears here exactly as it will on the guest website.</Text>
                </View>
              ) : null}
              {sectionState.schedule ? (
                <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                  <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>Schedule</Text>
                  <View style={[styles.websiteLiveScheduleList, previewDevice === 'desktop' && styles.websiteLiveScheduleListDesktop]}>
                    {[
                      ['5:00 PM', 'Ceremony'],
                      ['6:00 PM', 'Cocktail Hour'],
                      ['7:00 PM', 'Reception'],
                    ].map(([time, label]) => (
                      <View key={label} style={styles.websiteLiveScheduleItem}>
                        <Text style={[styles.websiteLiveScheduleTime, { color: accentColor }]}>{time}</Text>
                        <Text style={styles.websiteLiveScheduleLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {sectionState.travel ? (
                <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                  <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>Travel & Venue</Text>
                  <Text style={styles.websiteLiveSectionText}>{data.profile.venue} · {data.profile.location}</Text>
                  <Text style={styles.websiteLiveSectionText}>Hotel blocks and travel notes display in this section.</Text>
                </View>
              ) : null}
              {sectionState.registry ? (
                <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                  <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>Registry</Text>
                  <Text style={styles.websiteLiveSectionText}>{registryUrl ? 'Registry links display here for guests.' : 'Add a registry link when you are ready.'}</Text>
                </View>
              ) : null}
              {sectionState.photoDrop ? (
                <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                  <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>Photo Drop</Text>
                  <Text style={styles.websiteLiveSectionText}>Guest upload instructions and upload button appear here.</Text>
                </View>
              ) : null}
              {sectionState.rsvp ? (
                <View style={[styles.websiteLiveSection, previewDevice === 'desktop' && styles.websiteLiveSectionDesktop]}>
                  <Text style={[styles.websiteLiveSectionTitle, { color: accentColor, fontFamily: coupleFont }]}>RSVP</Text>
                  <Text style={styles.websiteLiveSectionText}>Please RSVP by {rsvpDeadline}.</Text>
                  <Text style={styles.websiteLiveSectionText}>{thankYouMessage}</Text>
                  <View style={[styles.websiteLiveRsvpButton, { backgroundColor: accentColor }]}>
                    <Text style={styles.websiteLiveHeroButtonText}>Send RSVP</Text>
                  </View>
                </View>
              ) : null}
              <View style={[styles.websiteLiveFooter, { backgroundColor: colors.ink }]}>
                <Text style={styles.websiteLiveFooterText}>Built with A.IDO</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Card>
  );
}

function EditorToolButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.websiteEditorToolButton}>
      <Ionicons color={colors.rose} name={icon} size={16} />
      <Text style={styles.websiteEditorToolText}>{label}</Text>
    </Pressable>
  );
}

function EditorToggleRow({ label, onPress, value }: { label: string; onPress: () => void; value: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.websiteEditorToggleRow}>
      <Text style={styles.hubLabel}>{label}</Text>
      <View style={[styles.mockSwitch, value && styles.mockSwitchActive]}>
        <View style={[styles.mockSwitchThumb, value && styles.mockSwitchThumbActive]} />
      </View>
    </Pressable>
  );
}

function photoFilterStyle(filter: 'original' | 'soft' | 'bw' | 'warm') {
  if (filter === 'soft') return { opacity: 0.86 };
  if (filter === 'bw') return { tintColor: 'rgba(190,190,190,0.18)' };
  if (filter === 'warm') return { opacity: 0.92 };
  return null;
}

function extractFirstRegistryUrl(raw: string | undefined) {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as Array<{ url?: string }>;
    return parsed.find((item) => typeof item.url === 'string' && item.url.trim())?.url?.trim() ?? '';
  } catch {
    return '';
  }
}

function PhotoDropMobilePanel({
  activeTab,
  data,
  onChangeTab,
  onUpdateSettings,
  openMockAction,
}: {
  activeTab: 'share' | 'queue' | 'settings';
  data: typeof samplePlanningData;
  onChangeTab: (tab: 'share' | 'queue' | 'settings') => void;
  onUpdateSettings: (patch: Partial<GuestPhotoDropSettings>) => void;
  openMockAction: (action: MockAction) => void;
}) {
  const pendingUploads = data.guestPhotoUploads.filter((upload) => upload.status === 'Pending').length;
  const approvedUploads = data.guestPhotoUploads.filter((upload) => upload.status === 'Approved').length;
  const photoCount = data.guestPhotoUploads.reduce((sum, upload) => sum + upload.photoCount, 0);

  return (
    <Card style={styles.photoDropMobileCard}>
      <View style={styles.photoDropTopRow}>
        <View style={styles.photoDropTitleRow}>
          <View style={styles.photoDropHeroIcon}>
            <Ionicons color={colors.rose} name="camera-outline" size={22} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.cardTitle}>Photo drop</Text>
            <Text style={styles.hubDetail}>{data.guestPhotoDrop.enabled ? 'Guest uploads are on' : 'Guest uploads are off'}</Text>
          </View>
        </View>
        <Text style={[styles.websiteStatusPill, data.guestPhotoDrop.enabled ? websiteStatusStyle('Published') : websiteStatusStyle('Draft')]}>
          {data.guestPhotoDrop.enabled ? 'On' : 'Off'}
        </Text>
      </View>

      <View style={styles.photoDropTabRow}>
        {([
          ['share', 'Share', 'qr-code-outline'],
          ['queue', 'Queue', 'images-outline'],
          ['settings', 'Settings', 'options-outline'],
        ] as const).map(([id, label, icon]) => {
          const active = activeTab === id;
          return (
            <Pressable key={id} onPress={() => onChangeTab(id)} style={[styles.photoDropTab, active && styles.photoDropTabActive]}>
              <Ionicons color={active ? colors.surface : colors.rose} name={icon} size={15} />
              <Text style={[styles.photoDropTabText, active && styles.photoDropTabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'share' ? (
        <View style={styles.photoDropPanel}>
          <LinearGradient colors={['#FFF2EA', '#F8DDE5']} style={styles.photoDropShareCard}>
            <View style={styles.photoDropQrBox}>
              <Ionicons color={colors.rose} name="qr-code-outline" size={46} />
            </View>
            <View style={styles.hubCopy}>
              <Text style={styles.hubLabel}>{data.guestPhotoDrop.title}</Text>
              <Text style={styles.hubDetail}>{data.guestPhotoDrop.instructions}</Text>
            </View>
          </LinearGradient>
          <View style={styles.photoDropQuickStats}>
            <PhotoDropMiniStat label="Target" value={data.guestPhotoDrop.selectedQrTarget === 'website' ? 'Website' : 'Portal'} />
            <PhotoDropMiniStat label="Mode" value={photoDropModeLabel(data.guestPhotoDrop.displayMode)} />
            <PhotoDropMiniStat label="Limit" value={`${data.guestPhotoDrop.maxUploads}/guest`} />
          </View>
          <View style={styles.websiteActions}>
            <Pressable
              onPress={() =>
                openMockAction({
                  title: 'Photo Drop QR code',
                  detail: 'Show, download, or share the QR code for the selected upload destination.',
                  primaryLabel: 'Show QR',
                })
              }
              style={styles.primaryActionButton}
            >
              <Ionicons color={colors.surface} name="qr-code-outline" size={18} />
              <Text style={styles.primaryActionText}>Show QR</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                openMockAction({
                  title: 'Photo Drop link',
                  detail: 'Copy the guest upload link so it can be shared by text, email, or printed signage.',
                  primaryLabel: 'Copy link',
                })
              }
              style={styles.secondaryActionButton}
            >
              <Ionicons color={colors.rose} name="link-outline" size={18} />
              <Text style={styles.secondaryActionText}>Copy link</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {activeTab === 'queue' ? (
        <View style={styles.photoDropPanel}>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Pending" value={String(pendingUploads)} />
            <SummaryCard label="Approved" value={String(approvedUploads)} />
            <SummaryCard label="Photos" value={String(photoCount)} />
          </View>
          <View style={styles.photoDropUploadList}>
            {data.guestPhotoUploads.map((upload) => (
              <Pressable
                key={upload.id}
                onPress={() =>
                  openMockAction({
                    title: `${upload.guestName} upload`,
                    detail: 'Approve, hide, caption, or feature this guest upload on the wedding website gallery.',
                    primaryLabel: 'Review upload',
                  })
                }
                style={styles.photoDropUploadRow}
              >
                <View style={styles.photoDropThumb}>
                  <Ionicons color={colors.rose} name="image-outline" size={20} />
                </View>
                <View style={styles.hubCopy}>
                  <View style={styles.websitePageTitleRow}>
                    <Text style={styles.hubLabel}>{upload.guestName}</Text>
                    <Text style={[styles.websiteStatusPill, photoUploadStatusStyle(upload.status)]}>{upload.status}</Text>
                  </View>
                  <Text style={styles.hubDetail}>{upload.photoCount} photos - {upload.caption}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {activeTab === 'settings' ? (
        <View style={styles.photoDropPanel}>
          <PhotoDropSettingRow icon="albums-outline" label="Display mode" value={photoDropModeLabel(data.guestPhotoDrop.displayMode)} />
          <View style={styles.eventTypeRow}>
            {(['portal', 'website', 'both'] as const).map((mode) => {
              const active = data.guestPhotoDrop.displayMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => onUpdateSettings({ displayMode: mode })}
                  style={[styles.eventTypePill, active && styles.eventTypePillActive]}
                >
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{photoDropModeLabel(mode)}</Text>
                </Pressable>
              );
            })}
          </View>
          <PhotoDropSettingRow icon="qr-code-outline" label="QR target" value={data.guestPhotoDrop.selectedQrTarget === 'website' ? 'Website' : 'RSVP'} />
          <View style={styles.eventTypeRow}>
            {(['website', 'rsvp'] as const).map((target) => {
              const active = data.guestPhotoDrop.selectedQrTarget === target;
              return (
                <Pressable
                  key={target}
                  onPress={() => onUpdateSettings({ selectedQrTarget: target })}
                  style={[styles.eventTypePill, active && styles.eventTypePillActive]}
                >
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{target === 'website' ? 'Website QR' : 'RSVP QR'}</Text>
                </Pressable>
              );
            })}
          </View>
          <PhotoDropSettingRow icon="cloud-upload-outline" label="Upload limit" value={`${data.guestPhotoDrop.maxUploads} photos per guest`} />
          <View style={styles.fontStepperRow}>
            <Pressable
              accessibilityLabel="Decrease photo upload limit"
              accessibilityRole="button"
              onPress={() => onUpdateSettings({ maxUploads: Math.max(1, data.guestPhotoDrop.maxUploads - 1) })}
              style={styles.iconMiniButton}
            >
              <Ionicons color={colors.rose} name="remove" size={15} />
            </Pressable>
            <View style={styles.fontSizeValueBox}>
              <Text style={styles.fontSizeValue}>{data.guestPhotoDrop.maxUploads}</Text>
            </View>
            <Pressable
              accessibilityLabel="Increase photo upload limit"
              accessibilityRole="button"
              onPress={() => onUpdateSettings({ maxUploads: Math.min(20, data.guestPhotoDrop.maxUploads + 1) })}
              style={styles.iconMiniButton}
            >
              <Ionicons color={colors.rose} name="add" size={15} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => onUpdateSettings({ enabled: !data.guestPhotoDrop.enabled })}
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name={data.guestPhotoDrop.enabled ? 'pause-circle-outline' : 'play-circle-outline'} size={18} />
            <Text style={styles.primaryActionText}>{data.guestPhotoDrop.enabled ? 'Turn Photo Drop off' : 'Turn Photo Drop on'}</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function PhotoDropMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.photoDropMiniStat}>
      <Text style={styles.photoDropControlLabel}>{label}</Text>
      <Text style={styles.photoDropControlValue}>{value}</Text>
    </View>
  );
}

function PhotoDropSettingRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.photoDropSettingRow}>
      <View style={styles.financeRowIcon}>
        <Ionicons color={colors.rose} name={icon} size={18} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={styles.photoDropControlLabel}>{label}</Text>
        <Text style={styles.hubLabel}>{value}</Text>
      </View>
    </View>
  );
}

function InvitationStudioPanel({ data, openMockAction }: { data: typeof samplePlanningData; openMockAction: (action: MockAction) => void }) {
  const [activeStudioTool, setActiveStudioTool] = useState<'photo' | 'message' | 'design' | 'print' | 'delivery' | 'hotel'>('design');
  const [mode, setMode] = useState<'saveTheDate' | 'rsvp'>('rsvp');
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('both');
  const [accent, setAccent] = useState(colors.rose);
  const [background, setBackground] = useState<'blush' | 'ivory' | 'sage'>('blush');
  const [coupleNames, setCoupleNames] = useState(`${data.profile.partnerOne} & ${data.profile.partnerTwo}`);
  const [includeHotel, setIncludeHotel] = useState(true);
  const [includeQr, setIncludeQr] = useState(true);
  const [designFont, setDesignFont] = useState<'playfair' | 'cormorant'>('playfair');
  const [designFontSize, setDesignFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#3B1C2B');
  const [messageTone, setMessageTone] = useState<'warm' | 'formal' | 'fun'>('warm');
  const [message, setMessage] = useState('Please RSVP and choose your meal by August 1.');
  const [photoEffect, setPhotoEffect] = useState<'Original' | 'Soft' | 'Warm'>('Original');
  const [photoZoom, setPhotoZoom] = useState(100);
  const [printSide, setPrintSide] = useState<'front' | 'back'>('front');
  const [printSize, setPrintSize] = useState<'5x7' | '4x6'>('5x7');
  const [sendType, setSendType] = useState<'digital' | 'print'>('digital');
  const [showPhoto, setShowPhoto] = useState(true);
  const [studioSavedMessage, setStudioSavedMessage] = useState('');
  const [studioSaving, setStudioSaving] = useState(false);
  const [rsvpBy, setRsvpBy] = useState('2026-08-01');
  const isRsvp = mode === 'rsvp';
  const isDigital = sendType === 'digital';
  const invitationLabel = isRsvp ? 'RSVP' : 'Save the Date';
  const previewColors = invitationPreviewColors(background);
  const paperColor = invitationPaperColor(background);
  const previewFontFamily = invitationFontFamily(designFont);
  const previewFontScale = invitationFontScale(designFontSize);
  const invitationPhotoLabel = isRsvp ? 'RSVP invitation photo' : 'Save-the-Date photo';
  const studioTools: Array<{ id: typeof activeStudioTool; icon: keyof typeof Ionicons.glyphMap; label: string; visible: boolean }> = [
    { id: 'photo', icon: 'image-outline', label: 'Photo', visible: true },
    { id: 'message', icon: 'chatbubble-ellipses-outline', label: 'Message', visible: true },
    { id: 'design', icon: 'color-palette-outline', label: 'Design', visible: true },
    { id: 'print', icon: 'print-outline', label: 'Print', visible: !isDigital },
    { id: 'delivery', icon: 'paper-plane-outline', label: 'Delivery', visible: isDigital },
    { id: 'hotel', icon: 'bed-outline', label: 'Hotel', visible: !isRsvp },
  ];
  const visibleStudioTools = studioTools.filter((tool) => tool.visible);

  useEffect(() => {
    const toolStillVisible = studioTools.some((tool) => tool.id === activeStudioTool && tool.visible);
    if (!toolStillVisible) {
      setActiveStudioTool('design');
    }
  }, [activeStudioTool, isDigital, isRsvp]);

  const openPhotoUpload = () => {
    setShowPhoto(true);
    openMockAction({
      title: `Upload ${invitationPhotoLabel}`,
      detail: 'Open the photo picker so the couple can upload a JPG, PNG, or WebP, crop it, reposition it, then save it to this invitation design.',
      primaryLabel: 'Choose photo',
    });
  };
  const generateInvitationMessage = () => {
    const draft = buildInvitationMessageDraft({
      coupleNames,
      isRsvp,
      tone: messageTone,
      venue: data.profile.venue,
      weddingDate: formatShortDate(data.profile.weddingDate),
    });
    setMessage(draft);
    openMockAction({
      title: 'Aria generated a draft',
      detail: 'The AI generator filled the invitation message. The couple can edit it, reset it, or save it before sending.',
      primaryLabel: 'Use draft',
    });
  };
  const saveStudioToWebsite = async (messageText = 'Invitation design saved to website sender') => {
    setStudioSaving(true);
    try {
      await saveMobileInvitationStudio({
        accent,
        background,
        designFont,
        designFontSize,
        includeHotel,
        rsvpBy,
        textColor,
      });
      setStudioSavedMessage(messageText);
    } catch (error) {
      setStudioSavedMessage(error instanceof Error ? `${error.message} Design saved locally for preview.` : 'Design saved locally for preview.');
    } finally {
      setStudioSaving(false);
    }
  };

  return (
    <View style={styles.invitationStudioPanel}>
      <View style={styles.studioToolbar}>
        <StudioSegment
          label="Invitation"
          options={[
            ['saveTheDate', 'Save Date', 'calendar-outline'],
            ['rsvp', 'RSVP', 'heart-outline'],
          ]}
          value={mode}
          onChange={(value) => setMode(value as 'saveTheDate' | 'rsvp')}
        />
        <StudioSegment
          label="Send Type"
          options={[
            ['digital', 'Digital', 'mail-outline'],
            ['print', 'Print', 'print-outline'],
          ]}
          value={sendType}
          onChange={(value) => setSendType(value as 'digital' | 'print')}
        />
        <View style={styles.studioFinishGroup}>
          <Text style={styles.formLabel}>Finish</Text>
          <Pressable
            accessibilityLabel={isDigital ? 'Send From Guest List' : 'Download Print PDF'}
            accessibilityRole="button"
            onPress={() => void saveStudioToWebsite(isDigital ? 'Invitation design saved. Guest list send flow ready.' : 'Print PDF prepared')}
            style={styles.studioSendButton}
          >
            <Ionicons color={colors.surface} name={isDigital ? 'paper-plane-outline' : 'download-outline'} size={16} />
            <Text style={styles.primaryActionText}>{isDigital ? 'Send From Guest List' : 'Download Print PDF'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.invitationPreviewShell}>
        <View style={styles.studioPreviewHeader}>
          <Text style={styles.studioPreviewEyebrow}>Preview</Text>
          <Text style={styles.studioPreviewTitle}>{invitationLabel} / {isDigital ? 'Digital' : 'Print'}</Text>
        </View>
        <View style={styles.studioPreviewWorkspace}>
          <View style={styles.invitationDeviceFrame}>
            <View style={styles.iphoneIsland} />
            <View style={styles.iphoneScreen}>
              <ScrollView contentContainerStyle={styles.invitationPreviewScrollContent} showsVerticalScrollIndicator={false}>
                <LinearGradient colors={isRsvp ? previewColors : [paperColor, paperColor]} style={[styles.invitationCanvas, !isRsvp && styles.websiteSaveDateCanvas]}>
                  {isRsvp ? (
                    <RsvpWebsitePreview
                      accent={accent}
                      coupleNames={coupleNames}
                      fontFamily={previewFontFamily}
                      fontScale={previewFontScale}
                      message={message}
                      onRsvpPress={() =>
                        openMockAction({
                          title: 'Guest RSVP',
                          detail: 'Choose attendance, confirm household guests, select meals, add a note, and submit the RSVP.',
                          primaryLabel: 'Submit RSVP',
                        })
                      }
                      paperColor={paperColor}
                      rsvpBy={rsvpBy}
                      showPhoto={showPhoto}
                      textColor={textColor}
                      venue={data.profile.venue}
                      weddingDate={data.profile.weddingDate}
                    />
                  ) : (
                    <SaveDateWebsitePreview
                      accent={accent}
                      coupleNames={coupleNames}
                      fontFamily={previewFontFamily}
                      fontScale={previewFontScale}
                      includeHotel={includeHotel}
                      message={message}
                      onDownloadPress={() =>
                        openMockAction({
                          title: 'Save the Date',
                          detail: 'View the guest Save-the-Date, download the PDF, copy the share link, or continue to the wedding website.',
                          primaryLabel: 'Download PDF',
                        })
                      }
                      onHotelPress={() =>
                        openMockAction({
                          title: 'Hotel response',
                          detail: 'Choose whether a hotel room is needed, select a room block, and save the response to the guest profile.',
                          primaryLabel: 'Save hotel response',
                        })
                      }
                      paperColor={paperColor}
                      showPhoto={showPhoto}
                      textColor={textColor}
                      venue={data.profile.venue}
                      weddingDate={data.profile.weddingDate}
                    />
                  )}
                </LinearGradient>
              </ScrollView>
            </View>
            <View style={styles.iphoneHomeIndicator} />
          </View>
          <View style={styles.studioToolRail}>
            {visibleStudioTools.map((tool) => {
              const active = activeStudioTool === tool.id;
              return (
                <Pressable
                  accessibilityLabel={`Open ${tool.label} controls`}
                  accessibilityRole="button"
                  key={tool.id}
                  onPress={() => setActiveStudioTool(tool.id)}
                  style={[styles.studioToolButton, active && styles.studioToolButtonActive]}
                >
                  <Ionicons color={active ? colors.surface : colors.rose} name={tool.icon} size={18} />
                  <Text style={[styles.studioToolText, active && styles.studioToolTextActive]}>{tool.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.invitationBackPreview}>
          <View style={styles.qrMock}>
            <Ionicons color={colors.rose} name="qr-code-outline" size={42} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>{isDigital ? 'Digital preview' : 'Print back preview'}</Text>
            <Text style={styles.hubDetail}>
              {isDigital ? `${channel.toUpperCase()} delivery uses the guest list.` : includeQr ? 'Back side includes RSVP QR and website link.' : 'Print suite exports without QR.'}
            </Text>
          </View>
        </View>
      </View>

      {!isDigital && activeStudioTool === 'print' ? (
        <View style={styles.studioSettingsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Print Settings</Text>
            <Text style={styles.smallStatus}>{printSize}</Text>
          </View>
          <Text style={styles.mutedText}>Physical invitations use a print layout separate from the digital email.</Text>
          <Text style={styles.formLabel}>Print size</Text>
          <View style={styles.eventTypeRow}>
            {(['5x7', '4x6'] as const).map((size) => {
              const active = printSize === size;
              return (
                <Pressable key={size} onPress={() => setPrintSize(size)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{size}</Text>
                </Pressable>
              );
            })}
          </View>
          {isRsvp ? (
            <>
              <Text style={styles.formLabel}>Side</Text>
              <View style={styles.eventTypeRow}>
                {(['front', 'back'] as const).map((side) => {
                  const active = printSide === side;
                  return (
                    <Pressable key={side} onPress={() => setPrintSide(side)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{side === 'front' ? 'Front' : 'Back'}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setIncludeQr((value) => !value)} style={[styles.eventTypePill, includeQr && styles.eventTypePillActive]}>
                  <Text style={[styles.eventTypeText, includeQr && styles.eventTypeTextActive]}>{includeQr ? 'Show RSVP code area' : 'Hide RSVP code area'}</Text>
                </Pressable>
              </View>
              <Text style={styles.hubDetail}>When the wedding website is published, the back side can include a scannable QR code for guests to RSVP.</Text>
            </>
          ) : (
            <Text style={styles.hubDetail}>Save-the-Dates are front-only announcements. RSVP links and QR codes are only added to RSVP invitations.</Text>
          )}
        </View>
      ) : null}

      {activeStudioTool === 'photo' ? <View style={styles.studioSettingsCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Photo</Text>
          <Text style={styles.smallStatus}>{showPhoto ? 'On' : 'Off'}</Text>
        </View>
        <View style={styles.studioPhotoPreview}>
          {showPhoto ? <Image resizeMode="cover" source={{ uri: couplePhotoUri }} style={styles.studioPhotoImage} /> : <Ionicons color={colors.rose} name="image-outline" size={28} />}
          {showPhoto ? (
            <View style={styles.studioPhotoOverlayTools}>
              <Pressable accessibilityLabel="Change invitation photo" accessibilityRole="button" onPress={openPhotoUpload} style={styles.photoOverlayButton}>
                <Ionicons color={colors.surface} name="cloud-upload-outline" size={15} />
              </Pressable>
              <Pressable accessibilityLabel="Re-crop invitation photo" accessibilityRole="button" onPress={openPhotoUpload} style={styles.photoOverlayButton}>
                <Ionicons color={colors.surface} name="crop-outline" size={15} />
              </Pressable>
              <Pressable accessibilityLabel="Remove invitation photo" accessibilityRole="button" onPress={() => setShowPhoto(false)} style={[styles.photoOverlayButton, styles.photoOverlayDangerButton]}>
                <Ionicons color={colors.surface} name="close" size={15} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.studioPhotoTools}>
            <Pressable onPress={() => setPhotoZoom((value) => Math.max(80, value - 10))} style={styles.iconMiniButton}>
              <Ionicons color={colors.rose} name="remove" size={15} />
            </Pressable>
            <Text style={styles.hubDetail}>Photo zoom {photoZoom}%</Text>
            <Pressable onPress={() => setPhotoZoom((value) => Math.min(140, value + 10))} style={styles.iconMiniButton}>
              <Ionicons color={colors.rose} name="add" size={15} />
            </Pressable>
          </View>
        </View>
        <View style={styles.websiteActions}>
          <Pressable onPress={openPhotoUpload} style={styles.primaryActionButton}>
            <Ionicons color={colors.surface} name="cloud-upload-outline" size={18} />
            <Text style={styles.primaryActionText}>{showPhoto ? 'Change photo' : 'Upload photo'}</Text>
          </Pressable>
          {showPhoto ? (
            <Pressable onPress={() => setShowPhoto(false)} style={styles.secondaryActionButton}>
              <Ionicons color={colors.rose} name="trash-outline" size={18} />
              <Text style={styles.secondaryActionText}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.eventTypeRow}>
          {(['Original', 'Soft', 'Warm'] as const).map((effect) => {
            const active = photoEffect === effect;
            return (
              <Pressable key={effect} onPress={() => setPhotoEffect(effect)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{effect}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setShowPhoto((value) => !value)} style={[styles.eventTypePill, showPhoto && styles.eventTypePillActive]}>
            <Text style={[styles.eventTypeText, showPhoto && styles.eventTypeTextActive]}>{showPhoto ? 'Photo on' : 'Photo off'}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => void saveStudioToWebsite('Photo settings saved to website sender')} style={styles.secondaryActionButton}>
          <Ionicons color={colors.rose} name="save-outline" size={18} />
          <Text style={styles.secondaryActionText}>Save Photo</Text>
        </Pressable>
      </View> : null}

      {activeStudioTool === 'message' ? <View style={styles.studioSettingsCard}>
        <Text style={styles.cardTitle}>{isRsvp ? 'Invitation Message' : 'Save the Date Message'}</Text>
        <FormInput label="Couple names" onChangeText={setCoupleNames} placeholder="Stacy & Rick" value={coupleNames} />
        <View style={styles.aiMessageBox}>
          <View style={styles.aiMessageHeader}>
            <View style={styles.aiMessageAvatar}>
              <Image resizeMode="cover" source={ariaAvatar} style={styles.aiMessageAvatarImage} />
            </View>
            <View style={styles.hubCopy}>
              <Text style={styles.hubLabel}>Aria message generator</Text>
              <Text style={styles.hubDetail}>Create wording for this {isRsvp ? 'RSVP invitation' : 'save-the-date'}.</Text>
            </View>
          </View>
          <View style={styles.eventTypeRow}>
            {([
              ['warm', 'Warm'],
              ['formal', 'Formal'],
              ['fun', 'Fun'],
            ] as const).map(([id, label]) => {
              const active = messageTone === id;
              return (
                <Pressable key={id} onPress={() => setMessageTone(id)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.websiteActions}>
            <Pressable accessibilityLabel="Generate invitation message with Aria" accessibilityRole="button" onPress={generateInvitationMessage} style={styles.primaryActionButton}>
              <Ionicons color={colors.surface} name="sparkles-outline" size={18} />
              <Text style={styles.primaryActionText}>Generate message</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                openMockAction({
                  title: 'Custom AI prompt',
                  detail: 'Ask Aria for a specific style, like romantic, short SMS, family formal, or bilingual wording.',
                  primaryLabel: 'Write prompt',
                })
              }
              style={styles.secondaryActionButton}
            >
              <Ionicons color={colors.rose} name="create-outline" size={18} />
              <Text style={styles.secondaryActionText}>Custom prompt</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          multiline
          onChangeText={setMessage}
          placeholder="Message"
          placeholderTextColor={colors.muted}
          style={[styles.formInput, styles.messageInput]}
          value={message}
        />
        <View style={styles.studioMessageMetaRow}>
          <Pressable
            onPress={() =>
              setMessage(
                isRsvp
                  ? `Together with their families, ${coupleNames} joyfully invite you to celebrate their wedding day with them.`
                  : `Mark your calendar! ${coupleNames} are getting married and we'd love to celebrate with you. Formal invitation to follow.`,
              )
            }
          >
            <Text style={styles.resetTemplateText}>Reset to template</Text>
          </Pressable>
          <Text style={styles.hubDetail}>{message.length}/400</Text>
        </View>
        {isRsvp ? <FormInput label="RSVP by" onChangeText={setRsvpBy} placeholder="2026-08-01" value={rsvpBy} /> : null}
        <Pressable onPress={() => void saveStudioToWebsite('Invitation message settings saved to website sender')} style={styles.secondaryActionButton}>
          <Ionicons color={colors.rose} name="save-outline" size={18} />
          <Text style={styles.secondaryActionText}>Save Message</Text>
        </Pressable>
      </View> : null}

      {!isRsvp && activeStudioTool === 'hotel' ? (
        <View style={styles.studioSettingsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Hotel Block</Text>
            <Text style={styles.smallStatus}>{includeHotel ? 'On' : 'Off'}</Text>
          </View>
          <Text style={styles.mutedText}>Ask guests if they need a hotel room from the Save-the-Date preview.</Text>
          <Pressable onPress={() => setIncludeHotel((value) => !value)} style={[styles.eventTypePill, includeHotel && styles.eventTypePillActive]}>
            <Text style={[styles.eventTypeText, includeHotel && styles.eventTypeTextActive]}>{includeHotel ? 'Hotel question shown' : 'Hotel question hidden'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryActionButton}>
            <Ionicons color={colors.rose} name="eye-outline" size={18} />
            <Text style={styles.secondaryActionText}>Preview save hotel response</Text>
          </Pressable>
        </View>
      ) : null}

      {activeStudioTool === 'design' ? <View style={styles.studioSettingsCard}>
        <Text style={styles.formLabel}>Design</Text>
        <View style={styles.swatchRow}>
          {[
            ['#A93D5B', 'Rose'],
            ['#637B59', 'Sage'],
            ['#B98343', 'Gold'],
            ['#496D89', 'Blue'],
          ].map(([hex, label]) => (
            <Pressable key={hex} onPress={() => setAccent(hex)} style={[styles.colorSwatchButton, accent === hex && styles.colorSwatchButtonActive]}>
              <View style={[styles.colorSwatch, { backgroundColor: hex }]} />
              <Text style={styles.colorSwatchLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.formLabel}>Text color</Text>
        <View style={styles.swatchRow}>
          {[
            ['#3B1C2B', 'Ink'],
            ['#6F3E54', 'Mauve'],
            ['#2F3F37', 'Sage Ink'],
            ['#4B5563', 'Slate'],
          ].map(([hex, label]) => (
            <Pressable key={hex} onPress={() => setTextColor(hex)} style={[styles.colorSwatchButton, textColor === hex && styles.colorSwatchButtonActive]}>
              <View style={[styles.colorSwatch, { backgroundColor: hex }]} />
              <Text style={styles.colorSwatchLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.formLabel}>Font family</Text>
        <View style={styles.eventTypeRow}>
          {([
            ['playfair', 'Playfair Display'],
            ['cormorant', 'Cormorant Garamond'],
          ] as const).map(([id, label]) => {
            const active = designFont === id;
            return (
              <Pressable key={id} onPress={() => setDesignFont(id)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.formLabel}>Font size</Text>
        <View style={styles.fontStepperRow}>
          <Pressable accessibilityLabel="Decrease font size" accessibilityRole="button" onPress={() => setDesignFontSize((size) => Math.max(10, size - 1))} style={styles.iconMiniButton}>
            <Ionicons color={colors.rose} name="remove" size={15} />
          </Pressable>
          <View style={styles.fontSizeValueBox}>
            <Text style={styles.fontSizeValue}>{designFontSize}px</Text>
          </View>
          <Pressable accessibilityLabel="Increase font size" accessibilityRole="button" onPress={() => setDesignFontSize((size) => Math.min(28, size + 1))} style={styles.iconMiniButton}>
            <Ionicons color={colors.rose} name="add" size={15} />
          </Pressable>
        </View>
        <Text style={styles.formLabel}>Background</Text>
        <View style={styles.eventTypeRow}>
          {[
            ['blush', 'Blush'],
            ['ivory', 'Ivory'],
            ['sage', 'Sage'],
          ].map(([id, label]) => {
            const active = background === id;
            return (
              <Pressable key={id} onPress={() => setBackground(id as 'blush' | 'ivory' | 'sage')} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setIncludeQr((value) => !value)} style={[styles.eventTypePill, includeQr && styles.eventTypePillActive]}>
            <Text style={[styles.eventTypeText, includeQr && styles.eventTypeTextActive]}>{includeQr ? 'QR on' : 'QR off'}</Text>
          </Pressable>
          <Pressable onPress={() => setIncludeHotel((value) => !value)} style={[styles.eventTypePill, includeHotel && styles.eventTypePillActive]}>
            <Text style={[styles.eventTypeText, includeHotel && styles.eventTypeTextActive]}>Hotel block</Text>
          </Pressable>
        </View>
      </View> : null}

      {isDigital && activeStudioTool === 'delivery' ? <View style={styles.studioSettingsCard}>
        <Text style={styles.formLabel}>Delivery</Text>
        <View style={styles.eventTypeRow}>
          {[
            ['sms', 'SMS'],
            ['email', 'Email'],
            ['both', 'Both'],
          ].map(([id, label]) => {
            const active = channel === id;
            return (
              <Pressable key={id} onPress={() => setChannel(id as 'sms' | 'email' | 'both')} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View> : null}

      <View style={styles.websiteActions}>
        <Pressable disabled={studioSaving} onPress={() => void saveStudioToWebsite()} style={[styles.primaryActionButton, studioSaving && styles.disabledActionButton]}>
          <Ionicons color={colors.surface} name={studioSaving ? 'sync-outline' : 'save-outline'} size={18} />
          <Text style={styles.primaryActionText}>{studioSaving ? 'Saving...' : 'Save design'}</Text>
        </Pressable>
        <Pressable onPress={() => void saveStudioToWebsite(`Test ${invitationLabel} ready to send`)} style={styles.secondaryActionButton}>
          <Ionicons color={colors.rose} name="paper-plane-outline" size={18} />
          <Text style={styles.secondaryActionText}>Send test</Text>
        </Pressable>
      </View>
      {studioSavedMessage ? <SavedStrip label={studioSavedMessage} /> : null}
    </View>
  );
}

function StudioSegment({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string, keyof typeof Ionicons.glyphMap]>;
  value: string;
}) {
  return (
    <View style={styles.studioSegmentGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.studioSegmentButtons}>
        {options.map(([id, text, icon]) => {
          const active = value === id;

          return (
            <Pressable
              key={id}
              accessibilityLabel={`${label} ${text}`}
              accessibilityRole="button"
              onPress={() => onChange(id)}
              style={[styles.studioSegmentButton, active && styles.studioSegmentButtonActive]}
            >
              <Ionicons color={active ? colors.surface : colors.rose} name={icon} size={15} />
              <Text style={[styles.studioSegmentText, active && styles.studioSegmentTextActive]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SaveDateWebsitePreview({
  accent,
  coupleNames,
  fontFamily,
  fontScale,
  includeHotel,
  message,
  onDownloadPress,
  onHotelPress,
  paperColor,
  showPhoto,
  textColor,
  venue,
  weddingDate,
}: {
  accent: string;
  coupleNames: string;
  fontFamily: string;
  fontScale: number;
  includeHotel: boolean;
  message: string;
  onDownloadPress: () => void;
  onHotelPress: () => void;
  paperColor: string;
  showPhoto: boolean;
  textColor: string;
  venue: string;
  weddingDate: string;
}) {
  const mutedColor = softenTextColor(textColor);
  return (
    <Pressable accessibilityLabel="Open Save the Date preview workflow" accessibilityRole="button" onPress={onDownloadPress} style={[styles.websiteSaveDateCard, { backgroundColor: paperColor }]}>
      <View style={[styles.websiteSaveDateTop, { backgroundColor: paperColor }]}>
        <DottedPaper accent={accent} />
        <Text style={[styles.websiteSaveDateKicker, { color: accent, fontFamily, fontSize: 10 * fontScale }]}>Save the Date</Text>
      </View>
      {showPhoto ? (
        <View style={[styles.websiteSaveDatePhotoWrap, { backgroundColor: paperColor }]}>
          <Image resizeMode="cover" source={{ uri: couplePhotoUri }} style={styles.websiteSaveDatePhoto} />
        </View>
      ) : null}
      <View style={[styles.websiteSaveDateBody, { backgroundColor: paperColor }]}>
        <DottedPaper accent={accent} />
        <Text style={[styles.websiteSaveDateNames, { color: accent, fontFamily, fontSize: 37 * fontScale, lineHeight: 43 * fontScale }]}>{coupleNames}</Text>
        <View style={styles.websiteSaveDateDivider} />
        <Text style={[styles.websiteSaveDateDate, { color: textColor, fontFamily, fontSize: 10 * fontScale, lineHeight: 15 * fontScale }]}>{formatInvitationDate(weddingDate)}</Text>
        <Text style={[styles.websiteSaveDateLocation, { color: textColor, fontFamily, fontSize: 10 * fontScale, lineHeight: 15 * fontScale }]}>{venue}</Text>
        {message ? <Text style={[styles.websiteSaveDateMessage, { color: textColor, fontFamily, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }]}>"{message}"</Text> : null}
        {includeHotel ? (
          <View style={[styles.websiteSaveDateHotel, { borderColor: `${accent}55`, backgroundColor: `${accent}10` }]}>
            <View style={styles.websiteSaveDateHotelHeader}>
              <Ionicons color={accent} name="bed-outline" size={14} />
              <Text style={[styles.websiteSaveDateHotelTitle, { color: accent, fontFamily, fontSize: 9 * fontScale }]}>Hotel Accommodations</Text>
            </View>
            <Text style={[styles.websiteSaveDateHotelQuestion, { color: textColor, fontFamily, fontSize: 9 * fontScale }]}>Will you need a hotel room?</Text>
            <Pressable accessibilityLabel="Preview hotel answer selector" accessibilityRole="button" onPress={onHotelPress} style={styles.websiteSaveDateSelect}>
              <Text style={[styles.websiteSaveDateSelectText, { color: textColor, fontFamily }]}>No</Text>
              <Ionicons color={mutedColor} name="chevron-down" size={13} />
            </Pressable>
            <Pressable accessibilityLabel="Preview save hotel response" accessibilityRole="button" onPress={onHotelPress}>
              <Text style={[styles.websiteSaveDateHotelButton, { backgroundColor: accent, fontFamily, fontSize: 10 * fontScale }]}>Preview save hotel response</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={[styles.websiteSaveDateFormal, { color: mutedColor, fontFamily, fontSize: 13 * fontScale }]}>Formal invitation to follow</Text>
        <Pressable accessibilityLabel="View and download Save the Date" accessibilityRole="button" onPress={onDownloadPress}>
          <Text style={[styles.websiteSaveDateDownload, { borderColor: `${accent}55`, color: mutedColor, fontFamily, fontSize: 9 * fontScale }]}>View & Download</Text>
        </Pressable>
        <View style={styles.websiteSaveDateFooter}>
          <Image resizeMode="contain" source={logo} style={styles.websiteSaveDateLogo} />
          <Text style={[styles.websiteSaveDateFooterText, { color: mutedColor, fontFamily }]}>Planning your own wedding?</Text>
          <Text style={[styles.websiteSaveDateFooterLink, { color: accent, fontFamily }]}>Try A.IDO - AI-powered wedding planning</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RsvpWebsitePreview({
  accent,
  coupleNames,
  fontFamily,
  fontScale,
  message,
  onRsvpPress,
  paperColor,
  rsvpBy,
  showPhoto,
  textColor,
  venue,
  weddingDate,
}: {
  accent: string;
  coupleNames: string;
  fontFamily: string;
  fontScale: number;
  message: string;
  onRsvpPress: () => void;
  paperColor: string;
  rsvpBy: string;
  showPhoto: boolean;
  textColor: string;
  venue: string;
  weddingDate: string;
}) {
  const mutedColor = softenTextColor(textColor);
  return (
    <Pressable accessibilityLabel="Open RSVP preview workflow" accessibilityRole="button" onPress={onRsvpPress} style={[styles.websiteSaveDateCard, { backgroundColor: paperColor }]}>
      {showPhoto ? (
        <View style={[styles.websiteRsvpPhotoWrap, { backgroundColor: paperColor }]}>
          <DottedPaper accent={accent} />
          <Image resizeMode="cover" source={{ uri: couplePhotoUri }} style={styles.websiteSaveDatePhoto} />
        </View>
      ) : null}
      <View style={[styles.websiteRsvpBody, { backgroundColor: paperColor }]}>
        <DottedPaper accent={accent} />
        <View style={[styles.websiteRsvpBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
          <Ionicons color={accent} name="heart" size={22} />
        </View>
        <Text style={[styles.websiteSaveDateKicker, styles.websiteRsvpKicker, { color: accent, fontFamily, fontSize: 10 * fontScale }]}>Wedding RSVP</Text>
        <Text style={[styles.websiteSaveDateNames, { color: accent, fontFamily, fontSize: 37 * fontScale, lineHeight: 43 * fontScale }]}>{coupleNames}</Text>
        <Text style={[styles.websiteSaveDateDate, { color: textColor, fontFamily, fontSize: 10 * fontScale, lineHeight: 15 * fontScale }]}>{formatInvitationDate(weddingDate)}</Text>
        <View style={styles.websiteRsvpDetails}>
          <View style={styles.websiteRsvpVenueRow}>
            <Ionicons color={accent} name="location-outline" size={13} />
            <Text style={[styles.websiteRsvpVenue, { color: accent, fontFamily, fontSize: 17 * fontScale, lineHeight: 22 * fontScale }]}>{venue}</Text>
          </View>
          <Text style={[styles.websiteRsvpAddress, { color: textColor, fontFamily, fontSize: 10 * fontScale }]}>123 Rose Garden Lane</Text>
          <Text style={[styles.websiteRsvpCity, { color: mutedColor, fontFamily, fontSize: 10 * fontScale }]}>Babylon, NY</Text>
          <View style={styles.websiteRsvpTimeRow}>
            <Text style={[styles.websiteRsvpTimePill, { borderColor: `${accent}55`, color: accent, fontFamily, fontSize: 8 * fontScale }]}>Ceremony 5:00 PM</Text>
            <Text style={[styles.websiteRsvpTimePill, { borderColor: `${accent}55`, color: accent, fontFamily, fontSize: 8 * fontScale }]}>Reception 6:00 PM</Text>
          </View>
          <Text style={[styles.websiteRsvpBy, { backgroundColor: accent, fontFamily, fontSize: 8 * fontScale }]}>RSVP By {formatInvitationDate(rsvpBy)}</Text>
        </View>
        {message ? <Text style={[styles.websiteSaveDateMessage, { color: textColor, fontFamily, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }]}>"{message}"</Text> : null}
        <Text style={[styles.websiteRsvpGuestLine, { color: mutedColor, fontFamily, fontSize: 11 * fontScale }]}>
          Dear <Text style={[styles.websiteRsvpGuestName, { color: textColor, fontFamily }]}>Guest</Text>, will you be joining us?
        </Text>
        <View style={styles.websiteRsvpDivider} />
        <Pressable accessibilityLabel="RSVP Now preview button" accessibilityRole="button" onPress={onRsvpPress} style={styles.websiteRsvpButtonPressable}>
          <Text style={[styles.websiteRsvpButton, { backgroundColor: accent, fontFamily, fontSize: 12 * fontScale }]}>RSVP Now</Text>
        </Pressable>
        <View style={styles.websiteSaveDateFooter}>
          <Image resizeMode="contain" source={logo} style={styles.websiteSaveDateLogo} />
          <Text style={[styles.websiteSaveDateFooterText, { color: mutedColor, fontFamily }]}>Planning your own wedding?</Text>
          <Text style={[styles.websiteSaveDateFooterLink, { color: accent, fontFamily }]}>Try A.IDO - AI-powered wedding planning</Text>
        </View>
      </View>
    </Pressable>
  );
}

function DottedPaper({ accent }: { accent: string }) {
  return (
    <View pointerEvents="none" style={styles.dottedPaper}>
      {Array.from({ length: 80 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dottedPaperDot,
            {
              backgroundColor: `${accent}33`,
              left: `${(index % 10) * 10 + 4}%`,
              top: `${Math.floor(index / 10) * 12 + 4}%`,
            },
          ]}
        />
      ))}
    </View>
  );
}

function PlanSection({
  data,
  onAddWeddingPartyMember,
  onDeleteWeddingPartyMember,
  onUpdateWeddingPartyMember,
  onToggleDayOfChecklist,
  onToggleTask,
  onOpenFinance,
  onOpenGuestHub,
  onOpenGuidedSetup,
  onOpenVendors,
  openMockAction,
  progress,
}: {
  data: typeof samplePlanningData;
  onAddWeddingPartyMember: (member: (typeof samplePlanningData.weddingParty)[number]) => void;
  onDeleteWeddingPartyMember: (memberId: string) => void;
  onUpdateWeddingPartyMember: (member: (typeof samplePlanningData.weddingParty)[number]) => void;
  onToggleDayOfChecklist: (itemId: string, completed: boolean) => void;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onOpenFinance: () => void;
  onOpenGuestHub: (view: GuestHubView) => void;
  onOpenGuidedSetup: () => void;
  onOpenVendors: () => void;
  openMockAction: (action: MockAction) => void;
  progress: number;
}) {
  const [plannerView, setPlannerView] = useState<'calendar' | 'checklist' | 'timeline' | 'party'>('calendar');

  return (
    <>
      <View style={styles.plannerSwitch}>
        {[
          ['calendar', 'Calendar', 'calendar-outline'],
          ['checklist', 'Checklist', 'checkbox-outline'],
          ['timeline', 'Timeline', 'time-outline'],
          ['party', 'Party', 'person-add-outline'],
        ].map(([id, label, icon]) => {
          const active = plannerView === id;
          return (
            <Pressable key={id} onPress={() => setPlannerView(id as 'calendar' | 'checklist' | 'timeline' | 'party')} style={[styles.plannerSwitchButton, active && styles.plannerSwitchButtonActive]}>
              <Ionicons color={active ? colors.surface : colors.rose} name={icon as keyof typeof Ionicons.glyphMap} size={17} />
              <Text style={[styles.plannerSwitchText, active && styles.plannerSwitchTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {plannerView === 'calendar' ? (
        <CalendarSection
          data={data}
          onOpenFinance={onOpenFinance}
          onOpenGuestHub={onOpenGuestHub}
          onOpenVendors={onOpenVendors}
          openMockAction={openMockAction}
        />
      ) : plannerView === 'checklist' ? (
        <PlannerChecklistSection
          onOpenGuidedSetup={onOpenGuidedSetup}
          openMockAction={openMockAction}
          data={data}
          onToggleTask={onToggleTask}
          progress={progress}
        />
      ) : plannerView === 'timeline' ? (
        <PlannerTimelineSection data={data} onToggleDayOfChecklist={onToggleDayOfChecklist} openMockAction={openMockAction} />
      ) : (
        <WeddingPartySection
          data={data}
          onAddMember={onAddWeddingPartyMember}
          onDeleteMember={onDeleteWeddingPartyMember}
          onUpdateMember={onUpdateWeddingPartyMember}
          openMockAction={openMockAction}
        />
      )}
    </>
  );
}

function PlannerChecklistSection({
  data,
  onToggleTask,
  onOpenGuidedSetup,
  openMockAction,
  progress,
}: {
  data: typeof samplePlanningData;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onOpenGuidedSetup: () => void;
  openMockAction: (action: MockAction) => void;
  progress: number;
}) {
  const tasks = [...data.tasks].sort((a, b) => (daysFromToday(a.dueDate) ?? 999) - (daysFromToday(b.dueDate) ?? 999));

  return (
    <Section title="Checklist" subtitle="Planning tasks, due dates, and setup progress.">
      <Card>
        <View style={styles.cardHeaderRow}>
          <View style={styles.hubCopy}>
            <Text style={styles.cardTitle}>Overall readiness</Text>
            <Text style={styles.mutedText}>{progress}% of core planning tasks are complete.</Text>
          </View>
          <Pressable onPress={onOpenGuidedSetup} style={styles.addPaymentMiniButton}>
            <Ionicons color={colors.rose} name="compass-outline" size={15} />
            <Text style={styles.addPaymentMiniText}>Setup</Text>
          </Pressable>
        </View>
        <Progress value={progress} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Tasks</Text>
        <View style={styles.calendarList}>
          {tasks.length ? tasks.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              completed={task.completed}
              meta={`${task.completed ? 'Complete' : formatDeadlineLabel(task.dueDate)} - ${task.category}`}
              onToggle={() => onToggleTask(task.id, !task.completed)}
              onPress={() =>
                openMockAction({
                  title: task.title,
                  detail: `${task.detail} Task details, reminders, and related planning files stay tied to this item.`,
                  primaryLabel: task.completed ? 'Review task' : 'Open task',
                })
              }
            />
          )) : (
            <Text style={styles.mutedText}>No checklist tasks yet. Use Guided setup to create your first planning tasks.</Text>
          )}
        </View>
      </Card>
    </Section>
  );
}

function PlannerTimelineSection({
  data,
  onToggleDayOfChecklist,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  onToggleDayOfChecklist: (itemId: string, completed: boolean) => void;
  openMockAction: (action: MockAction) => void;
}) {
  return (
    <Section title="Timeline" subtitle="Wedding-day timing, owners, locations, and final prep.">
      <Card>
        <Text style={styles.cardTitle}>Day-of timeline</Text>
        <View style={styles.calendarList}>
          {data.dayOf.length ? data.dayOf.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                openMockAction({
                  title: item.title,
                  detail: `${item.time}. Owner: ${item.owner}. Location: ${item.location}. Timeline details, vendor notes, and reminders stay with this item.`,
                  primaryLabel: 'Open timeline item',
                })
              }
              style={styles.timelineRow}
            >
              <Text style={styles.timelineTime}>{item.time}</Text>
              <View style={styles.hubCopy}>
                <Text style={styles.hubLabel}>{item.title}</Text>
                <Text style={styles.hubDetail}>{item.owner} - {item.location}</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} />
            </Pressable>
          )) : (
            <Text style={styles.mutedText}>No timeline items yet. Add ceremony, reception, and vendor arrival times here.</Text>
          )}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Day-of checklist</Text>
        <View style={styles.calendarList}>
          {data.dayOfChecklist.length ? data.dayOfChecklist.slice(0, 5).map((item) => (
            <TaskRow
              key={item.id}
              title={item.title}
              completed={item.completed}
              meta={`${item.completed ? 'Complete' : 'Open'} - ${item.category}`}
              onToggle={() => onToggleDayOfChecklist(item.id, !item.completed)}
              onPress={() =>
                openMockAction({
                  title: item.title,
                  detail: `${item.note} Day-of checklist updates save with the planning data.`,
                  primaryLabel: 'Open item',
                })
              }
            />
          )) : (
            <Text style={styles.mutedText}>No day-of checklist items yet.</Text>
          )}
        </View>
      </Card>
    </Section>
  );
}

function WeddingPartySection({
  data,
  onAddMember,
  onDeleteMember,
  onUpdateMember,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  onAddMember: (member: (typeof samplePlanningData.weddingParty)[number]) => void;
  onDeleteMember: (memberId: string) => void;
  onUpdateMember: (member: (typeof samplePlanningData.weddingParty)[number]) => void;
  openMockAction: (action: MockAction) => void;
}) {
  const [editingMember, setEditingMember] = useState<(typeof samplePlanningData.weddingParty)[number] | null>(null);
  const completeAttire = data.weddingParty.filter((member) => member.attireStatus === 'Complete').length;
  const openPartyTasks = data.weddingParty.reduce((sum, member) => sum + member.tasks.length, 0);

  return (
    <Section title="Wedding Party" subtitle="Roles, contact info, attire status, and assigned responsibilities.">
      <LinearGradient colors={['#FFF2EA', '#F8DDE5']} style={styles.websiteHero}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>Planner team</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{data.weddingParty.length} members</Text>
          </View>
        </View>
        <Text style={styles.websiteTitle}>Wedding Party</Text>
        <Text style={styles.websiteMeta}>Keep attendants, officiant, family helpers, attire, and day-of tasks organized.</Text>
      </LinearGradient>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Members" value={String(data.weddingParty.length)} />
        <SummaryCard label="Attire done" value={`${completeAttire}/${data.weddingParty.length}`} />
        <SummaryCard label="Tasks" value={String(openPartyTasks)} />
      </View>

      <Card>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Members</Text>
            <Text style={styles.hubDetail}>Tap a member for responsibilities, contact details, and attire notes.</Text>
          </View>
          <Text style={styles.smallStatus}>{data.weddingParty.length} people</Text>
        </View>
        <View style={styles.calendarList}>
          {data.weddingParty.map((member) => (
            <Pressable
              key={member.id}
              onPress={() => setEditingMember(member)}
              style={styles.partyMemberRow}
            >
              <View style={styles.partyAvatar}>
                <Text style={styles.partyAvatarText}>{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text>
              </View>
              <View style={styles.hubCopy}>
                <View style={styles.websitePageTitleRow}>
                  <Text style={styles.hubLabel}>{member.name}</Text>
                  <Text style={[styles.websiteStatusPill, member.attireStatus === 'Complete' ? websiteStatusStyle('Published') : websiteStatusStyle('Ready')]}>
                    {member.attireStatus}
                  </Text>
                </View>
                <Text style={styles.hubDetail}>{member.role} - {member.side} side - {member.phone}</Text>
                <View style={styles.partyTaskWrap}>
                  {member.tasks.map((task) => (
                    <Text key={task} style={styles.partyTaskPill}>{task}</Text>
                  ))}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={() =>
              setEditingMember({
                attireStatus: 'Not Started',
                id: `party-new-${Date.now()}`,
                name: '',
                phone: '',
                role: '',
                side: 'Shared',
                tasks: [],
              })
            }
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="person-add-outline" size={18} />
            <Text style={styles.primaryActionText}>Add member</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              openMockAction({
                title: 'Party contact sheet',
                detail: 'Share the contact sheet with planner, partner, and key family members for wedding-week coordination.',
                primaryLabel: 'Share contact sheet',
              })
            }
            style={styles.secondaryActionButton}
          >
            <Ionicons color={colors.rose} name="share-outline" size={18} />
            <Text style={styles.secondaryActionText}>Contact sheet</Text>
          </Pressable>
        </View>
      </Card>
      <WeddingPartyEditorModal
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onDelete={(memberId) => {
          onDeleteMember(memberId);
          setEditingMember(null);
        }}
        onSave={(member) => {
          if (member.id.startsWith('party-new-')) onAddMember(member);
          else onUpdateMember(member);
          setEditingMember(null);
        }}
      />
    </Section>
  );
}

function WeddingPartyEditorModal({
  member,
  onClose,
  onDelete,
  onSave,
}: {
  member: (typeof samplePlanningData.weddingParty)[number] | null;
  onClose: () => void;
  onDelete: (memberId: string) => void;
  onSave: (member: (typeof samplePlanningData.weddingParty)[number]) => void;
}) {
  const [draft, setDraft] = useState(member);
  const [tasksText, setTasksText] = useState(member?.tasks.join(', ') ?? '');
  useEffect(() => {
    setDraft(member);
    setTasksText(member?.tasks.join(', ') ?? '');
  }, [member]);
  if (!member || !draft) return null;
  const isNew = member.id.startsWith('party-new-');

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(member)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>{isNew ? 'Add member' : 'Edit member'}</Text>
              <Text style={styles.hubDetail}>Roles, contact details, attire status, and wedding-day tasks.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>
          <View style={styles.formStack}>
            <FormInput label="Name" onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Member name" value={draft.name} />
            <FormInput label="Role" onChangeText={(value) => setDraft({ ...draft, role: value })} placeholder="Maid of Honor, Officiant..." value={draft.role} />
            <FormInput label="Phone" onChangeText={(value) => setDraft({ ...draft, phone: value })} placeholder="(555) 000-0000" value={draft.phone} />
            <View>
              <Text style={styles.formLabel}>Side</Text>
              <View style={styles.eventTypeRow}>
                {(['Bride', 'Groom', 'Shared'] as const).map((side) => {
                  const active = draft.side === side;
                  return (
                    <Pressable key={side} onPress={() => setDraft({ ...draft, side })} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{side}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View>
              <Text style={styles.formLabel}>Attire</Text>
              <View style={styles.eventTypeRow}>
                {(['Not Started', 'In Progress', 'Complete'] as const).map((attireStatus) => {
                  const active = draft.attireStatus === attireStatus;
                  return (
                    <Pressable key={attireStatus} onPress={() => setDraft({ ...draft, attireStatus })} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{attireStatus}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <FormInput label="Tasks" onChangeText={setTasksText} placeholder="Toast draft, ring handoff..." value={tasksText} />
          </View>
          <View style={styles.websiteActions}>
            <Pressable
              disabled={!draft.name.trim()}
              onPress={() => onSave({ ...draft, tasks: tasksText.split(',').map((task) => task.trim()).filter(Boolean) })}
              style={[styles.primaryActionButton, !draft.name.trim() && styles.disabledButton]}
            >
              <Ionicons color={colors.surface} name="save-outline" size={18} />
              <Text style={styles.primaryActionText}>{isNew ? 'Add member' : 'Save member'}</Text>
            </Pressable>
            {!isNew ? (
              <Pressable onPress={() => onDelete(member.id)} style={styles.secondaryActionButton}>
                <Ionicons color={colors.rose} name="trash-outline" size={18} />
                <Text style={styles.secondaryActionText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function VendorsSection({
  data,
  onAddVendor,
  openMockAction,
  openVendor,
}: {
  data: typeof samplePlanningData;
  onAddVendor: (vendor: VendorRecord) => void;
  openMockAction: (action: MockAction) => void;
  openVendor: (vendor: VendorRecord) => void;
}) {
  const [addingVendor, setAddingVendor] = useState<VendorRecord | null>(null);
  const [vendorView, setVendorView] = useState<'list' | 'contacts' | 'messages'>('list');
  const [messageVendor, setMessageVendor] = useState<VendorRecord | null>(null);
  const vendors = data.vendors;
  const totalCommitted = vendors.reduce((sum, vendor) => sum + vendor.committed, 0);
  const totalPaid = vendors.reduce((sum, vendor) => sum + vendor.paid, 0);
  const signedCount = vendors.filter((vendor) => vendor.status === 'Signed' || vendor.status === 'Completed').length;

  return (
    <Section title="Vendors" subtitle="Track vendor contacts, contracts, payment status, files, and messages.">
      <LinearGradient colors={['#FFF2EA', '#F4DEBE']} style={styles.vendorHero}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>Vendor Tracking</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{vendors.length} booked</Text>
          </View>
        </View>
        <Text style={styles.vendorHeroTitle}>Keep every vendor in one clean place.</Text>
        <Text style={styles.vendorHeroText}>Contacts, contracts, scheduled payments, files, and Aria-assisted messages stay tied to each vendor.</Text>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={() =>
              setAddingVendor({
                arrivalTime: '',
                category: '',
                committed: 0,
                contactName: '',
                email: '',
                id: `vendor-new-${Date.now()}`,
                name: '',
                paid: 0,
                payments: [],
                phone: '',
                remaining: 0,
                status: 'Pending',
              })
            }
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="add" size={18} />
            <Text style={styles.primaryActionText}>Add vendor</Text>
          </Pressable>
          <Pressable onPress={() => setVendorView('messages')} style={styles.secondaryActionButton}>
            <Ionicons color={colors.rose} name="chatbubbles-outline" size={18} />
            <Text style={styles.secondaryActionText}>Messages</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Committed" value={formatCurrency(totalCommitted)} />
        <SummaryCard label="Paid" value={formatCurrency(totalPaid)} />
        <SummaryCard label="Contracts" value={`${signedCount}/${vendors.length}`} />
      </View>

      <View style={styles.plannerSwitch}>
        {[
          ['list', 'Vendor List', 'storefront-outline'],
          ['contacts', 'Contacts', 'people-outline'],
          ['messages', 'Messages', 'chatbubbles-outline'],
        ].map(([id, label, icon]) => {
          const active = vendorView === id;
          return (
            <Pressable key={id} onPress={() => setVendorView(id as 'list' | 'contacts' | 'messages')} style={[styles.plannerSwitchButton, active && styles.plannerSwitchButtonActive]}>
              <Ionicons color={active ? colors.surface : colors.rose} name={icon as keyof typeof Ionicons.glyphMap} size={16} />
              <Text style={[styles.plannerSwitchText, active && styles.plannerSwitchTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {vendorView === 'list' ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Vendor List</Text>
              <Text style={styles.hubDetail}>Tap a vendor for details, contract status, and payment info.</Text>
            </View>
            <Text style={styles.smallStatus}>{vendors.length} vendors</Text>
          </View>
          <View style={styles.calendarList}>
            {vendors.map((vendor) => (
              <VendorTrackerCard
                key={vendor.id}
                data={data}
                onContract={() =>
                  openMockAction({
                    title: `${vendor.name} contract`,
                    detail: 'Open the contract file, signature status, risk notes, and upload controls for this vendor.',
                    primaryLabel: 'Open contract',
                  })
                }
                onMessage={() => setMessageVendor(vendor)}
                onOpen={() => openVendor(vendor)}
                vendor={vendor}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {vendorView === 'contacts' ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Contacts</Text>
              <Text style={styles.hubDetail}>Synced from each vendor card, plus room for extra contacts later.</Text>
            </View>
            <Text style={styles.smallStatus}>{vendors.length} synced</Text>
          </View>
          <View style={styles.calendarList}>
            {vendors.map((vendor) => (
              <VendorContactRow
                key={vendor.id}
                onMessage={() => setMessageVendor(vendor)}
                onOpen={() => openVendor(vendor)}
                vendor={vendor}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {vendorView === 'messages' ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Vendor Messages</Text>
              <Text style={styles.hubDetail}>Send SMS, email, or both with Aria helping draft the message.</Text>
            </View>
            <Text style={styles.smallStatus}>Aria ready</Text>
          </View>
          <View style={styles.calendarList}>
            {vendors.map((vendor) => (
              <VendorMessageRow key={vendor.id} onMessage={() => setMessageVendor(vendor)} vendor={vendor} />
            ))}
          </View>
        </Card>
      ) : null}

      <VendorMessageModal onClose={() => setMessageVendor(null)} vendor={messageVendor} />
      <VendorEditorModal
        onClose={() => setAddingVendor(null)}
        onDelete={() => setAddingVendor(null)}
        onSave={(vendor) => {
          onAddVendor({ ...vendor, remaining: Math.max(0, vendor.committed - vendor.paid) });
          setAddingVendor(null);
        }}
        vendor={addingVendor}
      />
    </Section>
  );
}

function MoneySection({
  data,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  openMockAction: (action: MockAction) => void;
  paid: number;
  total: number;
}) {
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addMiscOpen, setAddMiscOpen] = useState(false);
  const [financeView, setFinanceView] = useState<'payments' | 'vendors' | 'misc' | 'contracts' | 'docs'>('payments');
  const [paymentView, setPaymentView] = useState<'upcoming' | 'all' | 'paid'>('upcoming');
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [miscForm, setMiscForm] = useState({
    category: 'Misc',
    nextAmount: '',
    nextDate: '',
    notes: '',
    paid: '',
    receiptName: '',
    title: '',
    total: '',
  });
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: dateKey(new Date()),
    itemId: data.budget[0]?.id ?? '',
    label: 'Scheduled payment',
  });
  const [budgetItems, setBudgetItems] = useState<LocalBudgetRecord[]>(() =>
    [
      ...data.budget.map((item) => ({
        ...item,
        scheduledPayments: item.nextPayment
          ? [
              {
                amount: item.nextPayment.amount,
                date: item.nextPayment.date,
                id: `scheduled-${item.id}-next`,
                label: 'Scheduled payment',
              },
            ]
          : [],
        payments: [...item.payments],
        source: 'vendor' as const,
      })),
      {
        id: 'misc-license',
        category: 'License',
        nextPayment: undefined,
        paid: 0,
        payments: [],
        receiptName: 'County clerk receipt',
        scheduledPayments: [{ amount: 150, date: '2026-06-05', id: 'scheduled-misc-license', label: 'County fee' }],
        source: 'misc' as const,
        title: 'Marriage license',
        total: 150,
      },
      {
        id: 'misc-alterations',
        category: 'Attire',
        nextPayment: undefined,
        notes: 'Final fitting and bustle work.',
        paid: 200,
        payments: [{ id: 'misc-alt-1', amount: 200, date: '2026-04-20', note: 'Fitting deposit' }],
        scheduledPayments: [{ amount: 325, date: '2026-06-22', id: 'scheduled-misc-alterations', label: 'Final fitting balance' }],
        source: 'misc' as const,
        title: 'Dress alterations',
        total: 525,
      },
    ],
  );
  const [budgetItemsLoaded, setBudgetItemsLoaded] = useState(false);
  const [apiSyncStatus, setApiSyncStatus] = useState<'local' | 'synced' | 'syncing'>('local');
  const localPaid = budgetItems.reduce((sum, item) => sum + item.paid, 0);
  const localTotal = budgetItems.reduce((sum, item) => sum + item.total, 0);
  const percent = localTotal ? Math.round((localPaid / localTotal) * 100) : 0;
  const scheduledPaymentRows = budgetItems
    .flatMap((item) => item.scheduledPayments.map((payment) => ({ item, payment })))
    .sort((a, b) => (parseDate(a.payment.date)?.getTime() ?? 0) - (parseDate(b.payment.date)?.getTime() ?? 0));
  const nextPayment = scheduledPaymentRows[0];
  const scheduledOpen = scheduledPaymentRows.reduce((sum, row) => sum + row.payment.amount, 0);
  const paidInFullCount = budgetItems.filter((item) => item.total > 0 && item.paid >= item.total).length;
  const miscItems = budgetItems.filter((item) => item.source === 'misc');
  const miscTotal = miscItems.reduce((sum, item) => sum + item.total, 0);
  const miscPaid = miscItems.reduce((sum, item) => sum + item.paid, 0);
  const filteredBudgetItems = budgetItems.filter((item) => {
    if (item.source === 'misc') return false;
    const remaining = Math.max(0, item.total - item.paid);
    if (paymentView === 'paid') return remaining <= 0;
    if (paymentView === 'upcoming') return item.scheduledPayments.length > 0 || remaining > 0;
    return true;
  });
  const scheduleItem = budgetItems.find((item) => item.id === scheduleItemId) ?? null;
  const signedVendors = data.vendors.filter((vendor) => vendor.status === 'Signed' || vendor.status === 'Completed').length;

  useEffect(() => {
    let alive = true;
    async function hydrateBudgetItems() {
      const storedBudgetItems = await readStoredJson<LocalBudgetRecord[]>(storageKeys.budgetItems);
      if (!alive) return;
      if (storedBudgetItems?.length) setBudgetItems(storedBudgetItems);
      setBudgetItemsLoaded(true);
      setApiSyncStatus('syncing');
      const apiItems = await loadBudgetItemsFromApi();
      if (!alive) return;
      if (apiItems.length) {
        setBudgetItems(apiItems);
        setApiSyncStatus('synced');
      } else {
        setApiSyncStatus('local');
      }
    }
    hydrateBudgetItems();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!budgetItemsLoaded) return;
    void AsyncStorage.setItem(storageKeys.budgetItems, JSON.stringify(budgetItems));
  }, [budgetItems, budgetItemsLoaded]);

  const markScheduledPaid = (item: LocalBudgetRecord, payment: ScheduledPayment) => {
    void markPaymentPaidInApi(item, payment);
    setBudgetItems((current) =>
      current.map((budgetItem) => {
        if (budgetItem.id !== item.id) return budgetItem;
        const amount = Math.min(payment.amount, Math.max(0, budgetItem.total - budgetItem.paid));
        const paid = Math.min(budgetItem.total, budgetItem.paid + amount);
        return {
          ...budgetItem,
          paid,
          nextPayment: undefined,
          payments: [
            ...budgetItem.payments,
            {
              amount,
              date: dateKey(new Date()),
              id: `mobile-paid-${budgetItem.id}-${payment.id}-${Date.now()}`,
              note: `${payment.label} paid in app`,
            },
          ],
          scheduledPayments: budgetItem.scheduledPayments.filter((scheduled) => scheduled.id !== payment.id),
        };
      }),
    );
  };
  const markPaidInFull = (item: LocalBudgetRecord) => {
    void markPaidInFullInApi(item);
    setBudgetItems((current) =>
      current.map((budgetItem) => {
        if (budgetItem.id !== item.id) return budgetItem;
        const amount = Math.max(0, budgetItem.total - budgetItem.paid);
        if (!amount) return budgetItem;
        return {
          ...budgetItem,
          paid: budgetItem.total,
          nextPayment: undefined,
          payments: [
            ...budgetItem.payments,
            {
              amount,
              date: dateKey(new Date()),
              id: `mobile-full-${budgetItem.id}-${Date.now()}`,
              note: 'Paid full balance in app',
            },
          ],
          scheduledPayments: [],
        };
      }),
    );
  };
  const addScheduledPayment = () => {
    const amount = Number(newPayment.amount);
    if (!newPayment.itemId || !newPayment.label.trim() || !newPayment.date.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const targetItem = budgetItems.find((item) => item.id === newPayment.itemId);
    const localPaymentId = `mobile-scheduled-${newPayment.itemId}-${Date.now()}`;
    if (targetItem) {
      void createPaymentInApi(targetItem, { amount, date: newPayment.date.trim(), id: localPaymentId, label: newPayment.label.trim() }).then((syncedPayment) => {
        if (!syncedPayment) return;
        setBudgetItems((current) =>
          current.map((item) =>
            item.id === targetItem.id
              ? {
                  ...item,
                  scheduledPayments: item.scheduledPayments.map((payment) => (payment.id === localPaymentId ? syncedPayment : payment)),
                }
              : item,
          ),
        );
      });
    }
    setBudgetItems((current) =>
      current.map((item) =>
        item.id === newPayment.itemId
          ? {
              ...item,
              scheduledPayments: [
                ...item.scheduledPayments,
                {
                  amount,
                  date: newPayment.date.trim(),
                  id: localPaymentId,
                  label: newPayment.label.trim(),
                },
              ],
            }
          : item,
      ),
    );
    setNewPayment({
      amount: '',
      date: dateKey(new Date()),
      itemId: newPayment.itemId,
      label: 'Scheduled payment',
    });
    setAddPaymentOpen(false);
  };
  const addMiscExpense = () => {
    const total = Number(miscForm.total);
    const paid = Math.max(0, Math.min(total, Number(miscForm.paid) || 0));
    const nextAmount = Number(miscForm.nextAmount);
    if (!miscForm.title.trim() || !miscForm.category.trim() || !Number.isFinite(total) || total <= 0) return;
    if (nextAmount > 0 && !miscForm.nextDate.trim()) return;
    const id = `misc-${Date.now()}`;
    const scheduledPayments =
      Number.isFinite(nextAmount) && nextAmount > 0
        ? [{ amount: nextAmount, date: miscForm.nextDate.trim(), id: `scheduled-${id}`, label: 'Scheduled payment' }]
        : [];
    const localExpense: LocalBudgetRecord = {
      id,
      category: miscForm.category.trim(),
      nextPayment: undefined,
      paid,
      payments: paid > 0 ? [{ amount: paid, date: dateKey(new Date()), id: `paid-${id}`, note: 'Already paid' }] : [],
      notes: miscForm.notes.trim() || undefined,
      receiptName: miscForm.receiptName.trim() || undefined,
      scheduledPayments,
      source: 'misc',
      title: miscForm.title.trim(),
      total,
    };
    setBudgetItems((current) => [...current, localExpense]);
    void createManualExpenseInApi({
      amountPaid: paid,
      category: localExpense.category,
      cost: total,
      name: localExpense.title,
      nextPaymentAmount: scheduledPayments[0]?.amount,
      nextPaymentDue: scheduledPayments[0]?.date,
      notes: localExpense.notes,
      receiptName: localExpense.receiptName,
    }).then((syncedExpense) => {
      if (!syncedExpense) return;
      setBudgetItems((current) => current.map((item) => (item.id === localExpense.id ? syncedExpense : item)));
    });
    setMiscForm({ category: 'Misc', nextAmount: '', nextDate: '', notes: '', paid: '', receiptName: '', title: '', total: '' });
    setAddMiscOpen(false);
  };
  const deleteMiscExpense = (itemId: string) => {
    const item = budgetItems.find((budgetItem) => budgetItem.id === itemId);
    if (item) void deleteManualExpenseInApi(item);
    setBudgetItems((current) => current.filter((item) => item.id !== itemId));
  };
  const openAddPayment = (itemId?: string) => {
    setNewPayment((current) => ({
      ...current,
      amount: '',
      date: dateKey(new Date()),
      itemId: itemId ?? current.itemId,
      label: 'Scheduled payment',
    }));
    setAddPaymentOpen(true);
  };
  const deleteScheduledPayment = (itemId: string, paymentId: string) => {
    const item = budgetItems.find((budgetItem) => budgetItem.id === itemId);
    if (item) void deleteBudgetPaymentInApi(item, paymentId);
    setBudgetItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, scheduledPayments: item.scheduledPayments.filter((payment) => payment.id !== paymentId) }
          : item,
      ),
    );
  };

  return (
    <Section title="Finance" subtitle="Budget, vendors, payments, contracts, and files tied together.">
      <LinearGradient colors={['#FFF2EA', '#F4DEBE']} style={styles.financeHero}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.kicker}>Budget summary</Text>
            <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.72} numberOfLines={1} style={styles.financeTitle}>{formatCurrency(localTotal - localPaid)} remaining</Text>
          </View>
          <View style={styles.financeBadge}>
            <Text style={styles.financeBadgeText}>{apiSyncStatus === 'syncing' ? 'Syncing' : apiSyncStatus === 'synced' ? 'Synced' : `${percent}% paid`}</Text>
          </View>
        </View>
        <View style={styles.moneyRow}>
          <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.72} numberOfLines={1} style={styles.moneyValue}>{formatCurrency(localPaid)}</Text>
          <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.78} numberOfLines={1} style={styles.moneyMeta}>of {formatCurrency(localTotal)}</Text>
        </View>
        <Progress value={percent} />
        <Text style={styles.mutedText}>
          {nextPayment ? `${nextPayment.item.title} has the next scheduled payment.` : 'All scheduled payments shown here are paid.'}
        </Text>
      </LinearGradient>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Vendors" value={`${signedVendors}/${data.vendors.length}`} />
        <SummaryCard label="Misc" value={String(miscItems.length)} />
        <SummaryCard label="Paid full" value={`${paidInFullCount}/${budgetItems.length}`} />
      </View>

      <View style={styles.budgetSummaryGrid}>
        <SummaryCard wide label="Total" value={formatCurrency(localTotal)} />
        <SummaryCard wide label="Paid out" value={formatCurrency(localPaid)} />
        <SummaryCard wide label="Scheduled" value={formatCurrency(scheduledOpen)} />
        <SummaryCard wide label="Paid full" value={`${paidInFullCount}/${budgetItems.length}`} />
      </View>

      <View style={styles.financeSwitch}>
        {[
          ['payments', 'Payments', 'card-outline'],
          ['vendors', 'Costs', 'cash-outline'],
          ['misc', 'Misc', 'receipt-outline'],
          ['contracts', 'Contracts', 'document-text-outline'],
          ['docs', 'Docs', 'folder-open-outline'],
        ].map(([id, label, icon]) => {
          const active = financeView === id;
          return (
            <Pressable key={id} onPress={() => setFinanceView(id as 'payments' | 'vendors' | 'misc' | 'contracts' | 'docs')} style={[styles.financeSwitchButton, active && styles.financeSwitchButtonActive]}>
              <Ionicons color={active ? colors.surface : colors.rose} name={icon as keyof typeof Ionicons.glyphMap} size={16} />
              <Text style={[styles.financeSwitchText, active && styles.financeSwitchTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {financeView === 'payments' ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Next payments</Text>
            <Pressable onPress={() => openAddPayment()} style={styles.addPaymentMiniButton}>
              <Ionicons color={colors.rose} name="add" size={15} />
              <Text style={styles.addPaymentMiniText}>Add payment</Text>
            </Pressable>
          </View>
          <Text style={styles.mutedText}>Scheduled amounts only. Use paid full balance when the whole item is finished.</Text>
          <View style={styles.calendarList}>
            {scheduledPaymentRows
              .slice(0, 3)
              .map(({ item, payment }) => (
                <PaymentActionRow
                  key={payment.id}
                  item={item}
                  payment={payment}
                  onMarkPaid={() => markScheduledPaid(item, payment)}
                  onPaidFull={() => markPaidInFull(item)}
                  onPress={() =>
                    openMockAction({
                      title: `${item.title} payment`,
                      detail: `Open payment details, due date reminders, receipt uploads, and vendor payment history for ${item.title}. Use Paid scheduled payment for this milestone or Paid full balance for the whole remaining balance.`,
                      primaryLabel: 'Open payment',
                    })
                  }
                />
              ))}
            {scheduledPaymentRows.length === 0 ? (
              <Text style={styles.mutedText}>No scheduled payments left to mark paid.</Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      {financeView === 'vendors' ? (
        <>
          <Card>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Vendor costs</Text>
                <Text style={styles.hubDetail}>Track balances, scheduled payments, and paid-in-full status.</Text>
              </View>
              <Text style={styles.smallStatus}>{filteredBudgetItems.length} shown</Text>
            </View>
            <View style={styles.budgetFilterRow}>
              {[
                ['upcoming', 'Needs action'],
                ['all', 'All'],
                ['paid', 'Paid full'],
              ].map(([id, label]) => {
                const active = paymentView === id;
                return (
                  <Pressable key={id} onPress={() => setPaymentView(id as 'upcoming' | 'all' | 'paid')} style={[styles.budgetFilterChip, active && styles.budgetFilterChipActive]}>
                    <Text style={[styles.budgetFilterText, active && styles.budgetFilterTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.calendarList}>
              {filteredBudgetItems.map((item) => (
                <BudgetLineCard
                  item={item}
                  key={item.id}
                  onAddPayment={() => openAddPayment(item.id)}
                  onManageSchedule={() => setScheduleItemId(item.id)}
                  onPaidFull={() => markPaidInFull(item)}
                />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {financeView === 'contracts' ? (
        <FinanceContractsPanel data={data} openMockAction={openMockAction} />
      ) : null}

      {financeView === 'docs' ? (
        <FinanceDocumentsPanel data={data} openMockAction={openMockAction} />
      ) : null}

      {financeView === 'misc' ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Misc expenses</Text>
              <Text style={styles.hubDetail}>{formatCurrency(miscPaid)} paid of {formatCurrency(miscTotal)}</Text>
            </View>
            <Pressable onPress={() => setAddMiscOpen(true)} style={styles.addPaymentMiniButton}>
              <Ionicons color={colors.rose} name="add" size={15} />
              <Text style={styles.addPaymentMiniText}>Add misc</Text>
            </Pressable>
          </View>
          <Text style={styles.mutedText}>Track non-vendor costs like license, attire, tips, travel, gifts, and decor.</Text>
          <View style={styles.calendarList}>
            {miscItems.map((item) => (
              <BudgetLineCard
                item={item}
                key={item.id}
                onAddPayment={() => openAddPayment(item.id)}
                onDelete={() => deleteMiscExpense(item.id)}
                onManageSchedule={() => setScheduleItemId(item.id)}
                onPaidFull={() => markPaidInFull(item)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <AddPaymentModal
        budgetItems={budgetItems}
        form={newPayment}
        onChange={setNewPayment}
        onClose={() => setAddPaymentOpen(false)}
        onSave={addScheduledPayment}
        open={addPaymentOpen}
      />
      <AddMiscExpenseModal
        form={miscForm}
        onChange={setMiscForm}
        onClose={() => setAddMiscOpen(false)}
        onSave={addMiscExpense}
        open={addMiscOpen}
      />
      <PaymentScheduleModal
        item={scheduleItem}
        onAddPayment={(itemId) => openAddPayment(itemId)}
        onClose={() => setScheduleItemId(null)}
        onDeletePayment={deleteScheduledPayment}
        onMarkPaid={markScheduledPaid}
        onPaidFull={markPaidInFull}
      />
    </Section>
  );
}

function FinanceContractsPanel({
  data,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  openMockAction: (action: MockAction) => void;
}) {
  const [apiContracts, setApiContracts] = useState<MobileContractRecord[] | null>(null);
  useEffect(() => {
    let alive = true;
    listMobileContracts()
      .then((contracts) => {
        if (alive) setApiContracts(contracts);
      })
      .catch(() => {
        if (alive) setApiContracts(null);
      });
    return () => {
      alive = false;
    };
  }, []);
  const contracts = apiContracts?.length
    ? apiContracts.map((contract) => ({
        clauses: [...(contract.analysis?.clauses ?? []), ...(contract.analysis?.keyTerms ?? [])].map((_, index) => `Clause ${index + 1}`),
        id: `api-contract-${contract.id}`,
        nextAction: contract.analysis?.summary || 'Review uploaded contract analysis.',
        riskLevel: contract.analysis?.riskLevel || ((contract.analysis?.redFlags?.length ?? 0) > 0 ? 'Medium' : 'Low'),
        status: (contract.analysis ? 'Needs review' : 'Uploaded') as 'Needs review' | 'Uploaded',
        title: contract.fileName,
        value: 0,
        vendorName: contract.vendorName || contract.hotelName || 'Unlinked',
      }))
    : data.contracts;
  const signed = contracts.filter((contract) => contract.status === 'Signed').length;
  const needsReview = contracts.filter((contract) => contract.status !== 'Signed').length;

  return (
    <>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Signed" value={`${signed}/${data.contracts.length}`} />
        <SummaryCard label="Review" value={String(needsReview)} />
        <SummaryCard label="Value" value={formatCurrency(data.contracts.reduce((sum, contract) => sum + contract.value, 0))} />
      </View>
      <Card>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Contracts</Text>
            <Text style={styles.hubDetail}>AI review status, key clauses, vendor link, value, and next action.</Text>
          </View>
        <Text style={styles.smallStatus}>{apiContracts?.length ? 'Synced' : `${needsReview} need review`}</Text>
        </View>
        <View style={styles.calendarList}>
          {contracts.map((contract) => (
            <Pressable
              key={contract.id}
              onPress={() =>
                openMockAction({
                  title: contract.title,
                  detail: `${contract.vendorName}. ${formatCurrency(contract.value)}. Risk: ${contract.riskLevel}. Next action: ${contract.nextAction}. Clauses: ${contract.clauses.join(', ')}.`,
                  primaryLabel: contract.status === 'Signed' ? 'Open contract' : 'Review contract',
                })
              }
              style={styles.contractReviewRow}
            >
              <View style={[styles.contractRiskIcon, contract.riskLevel === 'High' ? styles.contractRiskHigh : contract.riskLevel === 'Medium' ? styles.contractRiskMedium : styles.contractRiskLow]}>
                <Ionicons color={contract.riskLevel === 'Low' ? colors.green : colors.rose} name="document-text-outline" size={20} />
              </View>
              <View style={styles.hubCopy}>
                <View style={styles.websitePageTitleRow}>
                  <Text style={styles.hubLabel}>{contract.title}</Text>
                  <Text style={[styles.websiteStatusPill, contract.status === 'Signed' ? websiteStatusStyle('Published') : websiteStatusStyle('Draft')]}>
                    {contract.status}
                  </Text>
                </View>
                <Text style={styles.hubDetail}>{contract.vendorName} - {formatCurrency(contract.value)} - {contract.riskLevel} risk</Text>
                <Text style={styles.hubDetail}>{contract.nextAction}</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} />
            </Pressable>
          ))}
        </View>
        <View style={styles.websiteActions}>
          <Pressable
            onPress={() =>
              openMockAction({
                title: 'Upload contract',
                detail: 'Upload a vendor or hotel contract, link it to the right record, and run AI review for clauses, payment terms, cancellation, liability, and missing details.',
                primaryLabel: 'Upload contract',
              })
            }
            style={styles.primaryActionButton}
          >
            <Ionicons color={colors.surface} name="cloud-upload-outline" size={18} />
            <Text style={styles.primaryActionText}>Upload contract</Text>
          </Pressable>
        </View>
      </Card>
    </>
  );
}

function FinanceDocumentsPanel({
  data,
  openMockAction,
}: {
  data: typeof samplePlanningData;
  openMockAction: (action: MockAction) => void;
}) {
  const [apiDocuments, setApiDocuments] = useState<MobileDocumentRecord[] | null>(null);
  useEffect(() => {
    let alive = true;
    listMobileDocuments()
      .then((documents) => {
        if (alive) setApiDocuments(documents);
      })
      .catch(() => {
        if (alive) setApiDocuments(null);
      });
    return () => {
      alive = false;
    };
  }, []);
  const documents = apiDocuments?.length
    ? apiDocuments.map((document) => ({
        id: `api-document-${document.id}`,
        linkedTo: document.linkedVendorName || document.folder || 'General',
        status: 'Synced',
        summary: document.summary || 'Uploaded to the website document library.',
        title: document.originalFileName || document.fileName || `Document ${document.id}`,
        type: document.fileType || 'Document',
        updatedAt: document.updatedAt || dateKey(new Date()),
      }))
    : data.documents;

  return (
    <Card>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardTitle}>Documents</Text>
          <Text style={styles.hubDetail}>Contracts, receipts, timelines, exports, and shared planning files.</Text>
        </View>
        <Text style={styles.smallStatus}>{apiDocuments?.length ? 'Synced' : `${data.documents.length} files`}</Text>
      </View>
      <View style={styles.calendarList}>
        {documents.map((document) => (
          <Pressable
            key={document.id}
            onPress={() =>
              openMockAction({
                title: document.title,
                detail: `${document.type} linked to ${document.linkedTo}. Status: ${document.status}. ${document.summary}`,
                primaryLabel: 'Open document',
              })
            }
            style={styles.documentLibraryRow}
          >
            <View style={styles.documentIcon}>
              <Ionicons color={colors.rose} name={documentIcon(document.type)} size={20} />
            </View>
            <View style={styles.hubCopy}>
              <View style={styles.websitePageTitleRow}>
                <Text style={styles.hubLabel}>{document.title}</Text>
                <Text style={[styles.websiteStatusPill, document.status === 'Signed' || document.status === 'Approved' ? websiteStatusStyle('Published') : websiteStatusStyle('Ready')]}>
                  {document.status}
                </Text>
              </View>
              <Text style={styles.hubDetail}>{document.type} - {document.linkedTo} - Updated {formatShortDate(document.updatedAt)}</Text>
              <Text style={styles.hubDetail}>{document.summary}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.websiteActions}>
        <Pressable
          onPress={() =>
            openMockAction({
              title: 'Upload document',
              detail: 'Upload a receipt, contract, mood board, timeline, or planning file and link it to a vendor, budget line, or day-of item.',
              primaryLabel: 'Upload file',
            })
          }
          style={styles.primaryActionButton}
        >
          <Ionicons color={colors.surface} name="cloud-upload-outline" size={18} />
          <Text style={styles.primaryActionText}>Upload file</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function FeatureHub({
  data,
  onAddWorkspaceInvite,
  onOpenAccount,
  openMockAction,
  openTab,
}: {
  data: typeof samplePlanningData;
  onAddWorkspaceInvite: (invite: (typeof samplePlanningData.workspaceInvites)[number]) => void;
  onOpenAccount: () => void;
  openMockAction: (action: MockAction) => void;
  openTab: (tab: TabId) => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  return (
    <Section title="More" subtitle="Account, privacy, collaboration, and support.">
      {featureGroups.map((group) => (
        <View key={group.title} style={styles.groupBlock}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.items.map(([label, detail, icon]) => (
            <HubRow
              key={label}
              icon={icon as keyof typeof Ionicons.glyphMap}
              label={label}
              detail={detail}
              onPress={() => {
                if (label === 'Account settings' || label === 'Notifications' || label === 'Privacy & data') {
                  onOpenAccount();
                  return;
                }
                if (label === 'Workspace') {
                  setWorkspaceOpen(true);
                  return;
                }
                const target = targetTabForFeature(label);
                if (target) {
                  openTab(target);
                  return;
                }
                openFeatureMock(openMockAction, label);
              }}
            />
          ))}
        </View>
      ))}
      <WorkspaceModal data={data} onAddInvite={onAddWorkspaceInvite} onClose={() => setWorkspaceOpen(false)} open={workspaceOpen} />
    </Section>
  );
}

function WorkspaceModal({
  data,
  onAddInvite,
  onClose,
  open,
}: {
  data: typeof samplePlanningData;
  onAddInvite: (invite: (typeof samplePlanningData.workspaceInvites)[number]) => void;
  onClose: () => void;
  open: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Planner' | 'Partner' | 'Family' | 'Vendor'>('Planner');
  const [invites, setInvites] = useState(data.workspaceInvites);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInvites(data.workspaceInvites);
    setEmail('');
    setRole('Planner');
    setSyncMessage('');
    let alive = true;
    listMobileCollaborators()
      .then((result) => {
        if (!alive) return;
        const collaborators = [...(result.collaborators ?? []), ...(result.pendingForMe ?? [])];
        if (!collaborators.length) return;
        setInvites(collaborators.map((item) => ({
          email: item.inviteeEmail ?? 'Collaborator',
          id: String(item.id),
          role: workspaceRoleLabel(item.role),
          status: item.status === 'active' || item.status === 'accepted' ? 'Accepted' : 'Pending',
        })));
        setSyncMessage('Workspace collaborators synced');
      })
      .catch(() => {
        if (alive) setSyncMessage('Workspace is in local preview mode until mobile auth is connected.');
      });
    return () => {
      alive = false;
    };
  }, [data.workspaceInvites, open]);

  const addInvite = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@') || syncing) return;
    const invite: (typeof samplePlanningData.workspaceInvites)[number] = { email: trimmedEmail, id: `workspace-${Date.now()}`, role, status: 'Pending' };
    setSyncing(true);
    try {
      const result = await inviteMobileCollaborator({ email: trimmedEmail, role: workspaceRoleValue(role) });
      const syncedInvite: (typeof samplePlanningData.workspaceInvites)[number] = {
        email: result.inviteeEmail ?? trimmedEmail,
        id: String(result.id),
        role: workspaceRoleLabel(result.role),
        status: result.status === 'active' || result.status === 'accepted' ? 'Accepted' : 'Pending',
      };
      onAddInvite(syncedInvite);
      setInvites((current) => [syncedInvite, ...current.filter((item) => item.email.toLowerCase() !== trimmedEmail.toLowerCase())]);
      setSyncMessage(result.emailSent === false ? 'Invite saved, but email delivery needs attention.' : 'Collaborator invite sent');
      setEmail('');
    } catch (error) {
      onAddInvite(invite);
      setInvites((current) => [invite, ...current.filter((item) => item.email.toLowerCase() !== trimmedEmail.toLowerCase())]);
      setSyncMessage(error instanceof Error ? `${error.message} Saved locally for now.` : 'Saved locally for now.');
      setEmail('');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={onClose} style={styles.modalScrim} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.accountHeader}>
              <View style={styles.financeRowIcon}>
                <Ionicons color={colors.rose} name="business-outline" size={20} />
              </View>
              <View style={styles.hubCopy}>
                <Text style={styles.cardTitle}>Workspace</Text>
                <Text style={styles.hubDetail}>Invite your partner, planner, family, or vendors into the planning workspace.</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.formStack}>
            <View>
              <Text style={styles.formLabel}>Invite email</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="planner@example.com"
                placeholderTextColor={colors.muted}
                style={styles.formInput}
                value={email}
              />
            </View>
            <View>
              <Text style={styles.formLabel}>Role</Text>
              <View style={styles.eventTypeRow}>
                {(['Planner', 'Partner', 'Family', 'Vendor'] as const).map((item) => {
                  const active = role === item;
                  return (
                    <Pressable key={item} onPress={() => setRole(item)} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.websiteActions}>
            <Pressable disabled={!email.trim().includes('@') || syncing} onPress={addInvite} style={[styles.primaryActionButton, (!email.trim().includes('@') || syncing) && styles.disabledActionButton]}>
              <Ionicons color={colors.surface} name="person-add-outline" size={18} />
              <Text style={styles.primaryActionText}>{syncing ? 'Inviting...' : 'Invite'}</Text>
            </Pressable>
          </View>
          {syncMessage ? <SavedStrip label={syncMessage} /> : null}

          <View style={styles.vendorInfoList}>
            {invites.map((invite) => (
              <View key={invite.id} style={styles.vendorInfoRow}>
                <View style={styles.financeRowIcon}>
                  <Ionicons color={colors.rose} name={invite.status === 'Accepted' ? 'checkmark-circle-outline' : 'time-outline'} size={18} />
                </View>
                <View style={styles.hubCopy}>
                  <Text style={styles.hubLabel}>{invite.email}</Text>
                  <Text style={styles.hubDetail}>{invite.role} - {invite.status}</Text>
                </View>
              </View>
            ))}
            {invites.length === 0 ? <Text style={styles.mutedText}>No collaborators invited yet.</Text> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BottomTabs({
  activeTab,
  ariaOpen,
  onOpenAria,
  setActiveTab,
}: {
  activeTab: TabId;
  ariaOpen: boolean;
  onOpenAria: () => void;
  setActiveTab: (tab: TabId) => void;
}) {
  return (
    <View style={styles.tabShell}>
      {tabs.map((tab) => {
        const active = tab.id === 'aria' ? ariaOpen : activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              if (tab.id === 'aria') {
                onOpenAria();
                return;
              }
              setActiveTab(tab.id);
            }}
            style={styles.tabButton}
          >
            <View style={[styles.tabIcon, active && styles.tabIconActive]}>
              <Ionicons color={active ? colors.rose : colors.muted} name={tab.icon} size={22} />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AriaModal({
  contained = false,
  data,
  onClose,
  open,
}: {
  contained?: boolean;
  data: typeof samplePlanningData;
  onClose: () => void;
  open: boolean;
}) {
  type AriaChatMessage = { id: string; role: 'assistant' | 'user'; text: string; pending?: boolean };
  const [messages, setMessages] = useState<AriaChatMessage[]>([
    { id: 'aria-welcome', role: 'assistant', text: 'What can I help you plan right now?' },
  ]);
  const [ariaDraft, setAriaDraft] = useState('');
  const [ariaSending, setAriaSending] = useState(false);
  const trimmedAriaDraft = ariaDraft.trim();
  const sendAriaMessage = async (messageText = trimmedAriaDraft) => {
    const cleanMessage = messageText.trim();
    if (!cleanMessage || ariaSending) return;

    const timestamp = Date.now();
    const userMessage: AriaChatMessage = { id: `user-${timestamp}`, role: 'user', text: cleanMessage };
    const assistantMessage: AriaChatMessage = {
      id: `aria-${timestamp}`,
      pending: true,
      role: 'assistant',
      text: 'Thinking...',
    };

    const history = [...messages, userMessage].map((message) => ({
      content: message.text,
      role: message.role,
    }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setAriaDraft('');
    setAriaSending(true);

    try {
      const reply = await sendMobileAriaMessage(history);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id ? { ...message, pending: false, text: reply } : message,
        ),
      );
    } catch (error) {
      const fallback =
        error instanceof Error && error.message
          ? error.message
          : 'Aria could not respond right now. Please try again.';
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                pending: false,
                text: `${fallback}\n\nYou can still use the website Aria chat for the full synced assistant while we finish mobile parity.`,
              }
            : message,
        ),
      );
    } finally {
      setAriaSending(false);
    }
  };

  const sheet = (
    <View style={styles.ariaPanel}>
      <View style={styles.ariaPanelHeader}>
        <View style={styles.ariaPanelAvatar}>
          <Image resizeMode="cover" source={ariaAvatar} style={styles.actionAvatar} />
        </View>
        <View style={styles.hubCopy}>
          <Text style={styles.cardTitle}>Aria</Text>
          <Text style={styles.hubDetail}>Your wedding planning assistant</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons color={colors.muted} name="close" size={22} />
        </Pressable>
      </View>

      <View style={styles.ariaWorkspace}>
        <View style={styles.ariaChatPane}>
          <View style={styles.ariaMessageThread}>
            {messages.map((message) => (
              <Text key={message.id} style={[styles.ariaThreadBubble, message.role === 'user' && styles.ariaThreadBubbleUser]}>
                {message.role === 'user' ? 'You: ' : 'Aria: '}{message.text}
              </Text>
            ))}
          </View>

          <View style={styles.ariaComposerBlock}>
            <Text style={styles.ariaComposerLabel}>Type your message</Text>
            <View style={styles.ariaInputMock}>
              <TextInput
                editable={!ariaSending}
                multiline
                onChangeText={setAriaDraft}
                onSubmitEditing={() => sendAriaMessage()}
                placeholder="Ask Aria anything..."
                placeholderTextColor={colors.muted}
                returnKeyType="send"
                style={styles.ariaTextInput}
                value={ariaDraft}
              />
              <Pressable
                disabled={!trimmedAriaDraft || ariaSending}
                onPress={() => sendAriaMessage()}
                style={[styles.ariaSendButton, (!trimmedAriaDraft || ariaSending) && styles.ariaSendButtonDisabled]}
              >
                <Ionicons color={colors.surface} name={ariaSending ? 'hourglass' : 'send'} size={17} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.ariaComposerLabel}>Quick prompts</Text>
          <View style={styles.ariaPromptGrid}>
            {[
              'What should I do next?',
              'Draft a vendor follow-up',
              'Check my website',
              'Review this week',
            ].map((prompt) => (
              <Pressable disabled={ariaSending} key={prompt} onPress={() => sendAriaMessage(prompt)} style={styles.ariaPrompt}>
                <Text style={styles.ariaPromptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  if (contained) {
    if (!open) return null;
    return (
      <View style={styles.containedModalBackdrop}>
        <Pressable style={styles.containedModalScrim} onPress={onClose} />
        {sheet}
      </View>
    );
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        {sheet}
      </View>
    </Modal>
  );
}

function AccountModal({
  clerkConnected,
  onClose,
  onSignOut,
  open,
  user,
}: {
  clerkConnected: boolean;
  onClose: () => void;
  onSignOut: () => void;
  open: boolean;
  user: AuthUser;
}) {
  const [syncToken, setSyncToken] = useState('');
  const [syncSaved, setSyncSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getMobileAuthToken()
      .then((token) => {
        if (!alive) return;
        setSyncToken(token ?? '');
        setSyncStatus(
          clerkConnected
            ? hasMobileApiBase()
              ? 'Signed in with Clerk. Website backend sync is active.'
              : 'Signed in. Set EXPO_PUBLIC_AIDO_API_URL to connect the website backend.'
            : hasMobileApiBase()
              ? token
                ? 'Backend sync is ready.'
                : 'Add a bearer token to sync with the website backend.'
              : 'Set EXPO_PUBLIC_AIDO_API_URL to enable backend sync.',
        );
      })
      .catch(() => {
        if (alive) setSyncStatus('Backend sync is not configured yet.');
      });
    return () => {
      alive = false;
    };
  }, [clerkConnected, open]);

  const saveToken = async () => {
    await saveMobileAuthToken(syncToken);
    setSyncSaved(true);
    setSyncStatus(syncToken.trim() ? 'Backend token saved. Synced features will use it now.' : 'Backend token cleared. The app will use local preview mode.');
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.accountHeader}>
              <Image resizeMode="cover" source={{ uri: userAvatarUri }} style={styles.accountAvatar} />
              <View style={styles.hubCopy}>
                <Text style={styles.cardTitle}>Account</Text>
                <Text style={styles.hubDetail}>{user.email}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.vendorInfoList}>
            <VendorInfoRow icon="person-circle-outline" label="Profile" value={`${user.firstName} - Couple account`} />
            <VendorInfoRow icon="notifications-outline" label="Notifications" value="RSVP, vendor, payment, and deadline alerts" />
            <VendorInfoRow icon="shield-checkmark-outline" label="Privacy" value="Aria memory, data export, and security" />
          </View>

          <View style={styles.accountSyncCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.hubCopy}>
                <Text style={styles.hubLabel}>Backend sync</Text>
                <Text style={styles.hubDetail}>{syncStatus}</Text>
              </View>
              <View style={[styles.websiteStatusBadge, hasMobileApiBase() && styles.websiteStatusBadgeConnected]}>
                <Ionicons color={hasMobileApiBase() ? colors.green : colors.rose} name={hasMobileApiBase() ? 'cloud-done-outline' : 'cloud-offline-outline'} size={14} />
                <Text style={[styles.websiteStatusBadgeText, hasMobileApiBase() && styles.websiteStatusBadgeTextConnected]}>{hasMobileApiBase() ? 'API set' : 'Local'}</Text>
              </View>
            </View>
            <TextInput
              autoCapitalize="none"
              editable={!clerkConnected}
              onChangeText={(value) => {
                setSyncSaved(false);
                setSyncToken(value);
              }}
              placeholder={clerkConnected ? 'Managed by Clerk sign-in' : 'Paste Clerk bearer token for preview sync'}
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={[styles.formInput, clerkConnected && styles.disabledInput]}
              value={syncToken}
            />
            {syncSaved ? <SavedStrip label="Backend sync settings saved" /> : null}
          </View>

          <View style={styles.websiteActions}>
            <Pressable disabled={clerkConnected} onPress={saveToken} style={[styles.secondaryActionButton, clerkConnected && styles.disabledButton]}>
              <Ionicons color={colors.rose} name="settings-outline" size={18} />
              <Text style={styles.secondaryActionText}>Save sync</Text>
            </Pressable>
            <Pressable
              disabled={clerkConnected}
              onPress={() => {
                setSyncToken('');
                void saveMobileAuthToken(null).then(() => {
                  setSyncSaved(true);
                  setSyncStatus('Backend token cleared. The app will use local preview mode.');
                });
              }}
              style={[styles.secondaryActionButton, clerkConnected && styles.disabledButton]}
            >
              <Ionicons color={colors.rose} name="trash-outline" size={18} />
              <Text style={styles.secondaryActionText}>Clear sync</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.signOutButton}>
              <Ionicons color={colors.surface} name="log-out-outline" size={18} />
              <Text style={styles.primaryActionText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MockActionModal({ action, data, onClose }: { action: MockAction | null; data: typeof samplePlanningData; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setSaved(false);
    setSending(false);
    setStatusMessage('');
  }, [action?.title]);

  const sendAction = async () => {
    if (!action || sending) return;
    const actionTitle = action.title.toLowerCase();
    if (actionTitle.includes('rsvp reminders') || actionTitle.includes('send save the date') || actionTitle.includes('send rsvp invitation')) {
      setSending(true);
      setStatusMessage('');
      try {
        const result = actionTitle.includes('send save the date')
          ? await sendSaveTheDates()
          : actionTitle.includes('send rsvp invitation')
            ? await sendRsvpInvitations()
            : await sendPendingRsvpReminders();
        setSaved(true);
        if (result.attempted === 0) {
          setStatusMessage(actionTitle.includes('send save the date')
            ? 'No Save-the-Dates need to be sent.'
            : actionTitle.includes('send rsvp invitation')
              ? 'No RSVP invitations need to be sent.'
              : 'No pending RSVP reminders need to be sent.');
        } else {
          const label = actionTitle.includes('send save the date')
            ? 'Save-the-Date'
            : actionTitle.includes('send rsvp invitation')
              ? 'RSVP invitation'
              : 'RSVP reminder';
          setStatusMessage(`${result.delivered} of ${result.attempted} ${label} email${result.attempted === 1 ? '' : 's'} delivered${result.markedSent ? `; ${result.markedSent} marked sent without email` : ''}.`);
        }
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Could not send from the website sender.');
      } finally {
        setSending(false);
      }
      return;
    }
    setSaved(true);
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(action)}>
      <View style={styles.mockModalBackdrop}>
        <Pressable style={styles.mockModalScrim} onPress={onClose} />
        <View style={styles.mockModalCard}>
          <View style={styles.mockModalIcon}>
            <Ionicons color={colors.rose} name="sparkles-outline" size={24} />
          </View>
          <Text style={styles.cardTitle}>{action?.title}</Text>
          <Text style={styles.mutedText}>{cleanActionDetail(action?.detail ?? '')}</Text>
          {action ? <ActionWorkspace action={action} data={data} saved={saved} /> : null}
          {statusMessage ? <SavedStrip label={statusMessage} /> : null}
          <View style={styles.websiteActions}>
            <Pressable disabled={sending} onPress={sendAction} style={[styles.primaryActionButton, sending && styles.disabledActionButton]}>
              <Ionicons color={colors.surface} name={saved ? 'checkmark-circle-outline' : action?.title.toLowerCase().includes('send') || action?.title.toLowerCase().includes('rsvp reminders') ? 'mail-outline' : 'save-outline'} size={18} />
              <Text style={styles.primaryActionText}>{sending ? 'Sending...' : saved ? 'Sent' : action?.primaryLabel ?? 'Save'}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.secondaryActionButton}>
              <Text style={styles.secondaryActionText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ActionWorkspace({ action, data, saved }: { action: MockAction; data: typeof samplePlanningData; saved: boolean }) {
  const title = action.title.toLowerCase();

  if (title === 'guest rsvp') {
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.guestFlowStep}>
          <View style={styles.guestFlowStepIcon}>
            <Ionicons color={colors.rose} name="checkmark-circle-outline" size={18} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>Attendance</Text>
            <Text style={styles.hubDetail}>Yes, we will celebrate with you.</Text>
          </View>
        </View>
        <View style={styles.guestFlowStep}>
          <View style={styles.guestFlowStepIcon}>
            <Ionicons color={colors.rose} name="people-outline" size={18} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>Household</Text>
            <Text style={styles.hubDetail}>Stacy Guest + Rick Guest confirmed.</Text>
          </View>
        </View>
        <View style={styles.formStack}>
          <TextInput placeholder="Meal choice" placeholderTextColor={colors.muted} style={styles.formInput} value="Chicken" />
          <TextInput multiline placeholder="Note to couple" placeholderTextColor={colors.muted} style={[styles.formInput, styles.messageInput]} value="So excited to celebrate with you!" />
        </View>
        {saved ? <SavedStrip label="RSVP submitted" /> : null}
      </View>
    );
  }

  if (title === 'save the date') {
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.saveDateGuestPreview}>
          <Text style={styles.overline}>Save the Date</Text>
          <Text style={styles.saveDateGuestNames}>{data.profile.partnerOne} & {data.profile.partnerTwo}</Text>
          <Text style={styles.hubDetail}>{formatInvitationDate(data.profile.weddingDate)} - {data.profile.venue}</Text>
        </View>
        <View style={styles.photoDropControlGrid}>
          <PhotoDropControl label="PDF" value="Ready" icon="download-outline" />
          <PhotoDropControl label="Share link" value="Copied after tap" icon="link-outline" />
          <PhotoDropControl label="Website" value="Continue" icon="globe-outline" />
          <PhotoDropControl label="Calendar" value="Add date" icon="calendar-outline" />
        </View>
        {saved ? <SavedStrip label="Save-the-Date PDF prepared" /> : null}
      </View>
    );
  }

  if (title === 'hotel response') {
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.eventTypeRow}>
          {['No room needed', 'Need a room', 'Already booked'].map((item) => <ActionChip key={item} label={item} active={item === 'Need a room'} />)}
        </View>
        <View style={styles.formStack}>
          <TextInput placeholder="Hotel block" placeholderTextColor={colors.muted} style={styles.formInput} value="Wedding room block" />
          <TextInput placeholder="Rooms" placeholderTextColor={colors.muted} style={styles.formInput} value="1 room" />
        </View>
        {saved ? <SavedStrip label="Hotel response saved to guest profile" /> : null}
      </View>
    );
  }

  if (title.includes('rsvp reminders')) {
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.guestFlowStep}>
          <View style={styles.guestFlowStepIcon}>
            <Ionicons color={colors.rose} name="people-outline" size={18} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>Pending guests</Text>
            <Text style={styles.hubDetail}>
              {data.guests.filter((guest) => guest.rsvp === 'Pending').map((guest) => guest.name).join(', ') || 'No pending RSVPs'}
            </Text>
          </View>
        </View>
        <SavedStrip label="Uses the website RSVP reminder email template and guest RSVP links." />
        <TextInput
          multiline
          placeholder="Reminder message"
          placeholderTextColor={colors.muted}
          editable={false}
          style={[styles.formInput, styles.messageInput]}
          value="The website sender writes and sends the final reminder email from your saved RSVP invitation design."
        />
        <View style={styles.eventTypeRow}>
          <ActionChip label="Email" active />
          <ActionChip label="Website template" active />
          <ActionChip label="RSVP link" active />
        </View>
        {saved ? <SavedStrip label="RSVP reminders sent through website sender" /> : null}
      </View>
    );
  }

  if (title.includes('send save the date')) {
    const eligible = data.guests.length;
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.guestFlowStep}>
          <View style={styles.guestFlowStepIcon}>
            <Ionicons color={colors.rose} name="calendar-outline" size={18} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>Save-the-Date send</Text>
            <Text style={styles.hubDetail}>{eligible} guest{eligible === 1 ? '' : 's'} will be checked against the live website guest list before sending.</Text>
          </View>
        </View>
        <SavedStrip label="Uses the website Save-the-Date sender and current invitation design." />
        <View style={styles.eventTypeRow}>
          <ActionChip label="Email" active />
          <ActionChip label="Website design" active />
          <ActionChip label="Guest tracking" active />
        </View>
        {saved ? <SavedStrip label="Save-the-Dates sent through website sender" /> : null}
      </View>
    );
  }

  if (title.includes('send rsvp invitation')) {
    const pending = data.guests.filter((guest) => guest.rsvp !== 'Declined').length;
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.guestFlowStep}>
          <View style={styles.guestFlowStepIcon}>
            <Ionicons color={colors.rose} name="mail-open-outline" size={18} />
          </View>
          <View style={styles.hubCopy}>
            <Text style={styles.hubLabel}>RSVP invitation send</Text>
            <Text style={styles.hubDetail}>{pending} guest{pending === 1 ? '' : 's'} will be checked against the live website guest list before sending.</Text>
          </View>
        </View>
        <SavedStrip label="Uses the website RSVP invitation email template and RSVP links." />
        <View style={styles.eventTypeRow}>
          <ActionChip label="Email" active />
          <ActionChip label="RSVP form" active />
          <ActionChip label="Response tracking" active />
        </View>
        {saved ? <SavedStrip label="RSVP invitations sent through website sender" /> : null}
      </View>
    );
  }

  if (title.includes('add guest') || title.includes('guest profile') || title.includes('rsvp')) {
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.formStack}>
          <TextInput placeholder="Guest name" placeholderTextColor={colors.muted} style={styles.formInput} value={title.includes('add guest') ? '' : action.title} />
          <TextInput placeholder="Meal choice" placeholderTextColor={colors.muted} style={styles.formInput} value={title.includes('add guest') ? '' : 'Chicken'} />
          <TextInput placeholder="Table assignment" placeholderTextColor={colors.muted} style={styles.formInput} value={title.includes('add guest') ? '' : 'Table 3'} />
        </View>
        <View style={styles.eventTypeRow}>
          {['SMS', 'Email', 'Both'].map((item) => <ActionChip key={item} label={item} active={item === 'Both'} />)}
        </View>
      </View>
    );
  }

  if (title.includes('website') || title.includes('section') || title.includes('publish')) {
    return (
      <View style={styles.actionWorkspace}>
        {data.websiteSections.slice(0, 4).map((section) => (
          <View key={section.id} style={styles.workspaceRow}>
            <Ionicons color={colors.rose} name={websiteStatusIcon(section.status)} size={18} />
            <View style={styles.hubCopy}>
              <Text style={styles.hubLabel}>{section.title}</Text>
              <Text style={styles.hubDetail}>{section.status} - {section.description}</Text>
            </View>
          </View>
        ))}
        {saved ? <SavedStrip label="Website changes saved" /> : null}
      </View>
    );
  }

  if (title.includes('invitation') || title.includes('campaign') || title.includes('send test')) {
    if (title.includes('send test')) {
      return (
        <View style={styles.actionWorkspace}>
          <TextInput
            autoCapitalize="none"
            defaultValue="stacy@example.com"
            keyboardType="email-address"
            placeholder="Recipient email"
            placeholderTextColor={colors.muted}
            style={styles.formInput}
          />
          <View style={styles.eventTypeRow}>
            {['Save Date', 'RSVP'].map((item) => <ActionChip key={item} label={item} active={item === 'RSVP'} />)}
            {['Digital email'].map((item) => <ActionChip key={item} label={item} active />)}
          </View>
          {saved ? <SavedStrip label="Test invitation sent" /> : null}
        </View>
      );
    }

    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.eventTypeRow}>
          {['Save the Date', 'RSVP', 'Invite'].map((item) => <ActionChip key={item} label={item} active={item === 'RSVP'} />)}
        </View>
        <TextInput multiline placeholder="Invitation message" placeholderTextColor={colors.muted} style={[styles.formInput, styles.messageInput]} value="We are so excited to celebrate with you. Please RSVP by the date listed on our wedding website." />
        <View style={styles.eventTypeRow}>
          {['SMS', 'Email', 'Both'].map((item) => <ActionChip key={item} label={item} active={item === 'Both'} />)}
        </View>
      </View>
    );
  }

  if (title.includes('registry')) {
    return (
      <View style={styles.actionWorkspace}>
        <TextInput placeholder="Registry URL" placeholderTextColor={colors.muted} style={styles.formInput} value="https://registry.example/stacy-rick" />
        <View style={styles.eventTypeRow}>
          {['Website', 'Invites', 'RSVP'].map((item) => <ActionChip key={item} label={item} active />)}
        </View>
      </View>
    );
  }

  if (title.includes('photo drop') || title.includes('qr') || title.includes('uploads')) {
    return (
      <View style={styles.actionWorkspace}>
        <View style={styles.photoDropControlGrid}>
          <PhotoDropControl label="Display" value="Portal + website" icon="albums-outline" />
          <PhotoDropControl label="Limit" value="20 photos per guest" icon="cloud-upload-outline" />
        </View>
        <SavedStrip label="QR target and approval queue ready" />
      </View>
    );
  }

  if (title.includes('contract')) {
    return (
      <View style={styles.actionWorkspace}>
        <Pressable style={styles.noContractStrip}>
          <Ionicons color={colors.rose} name="cloud-upload-outline" size={18} />
          <View style={styles.hubCopy}>
            <Text style={styles.noContractTitle}>Upload contract</Text>
            <Text style={styles.hubDetail}>Attach PDF or image files to this vendor.</Text>
          </View>
        </Pressable>
        <View style={styles.eventTypeRow}>
          {['Pending', 'Signed', 'Needs review'].map((item) => <ActionChip key={item} label={item} active={item === 'Needs review'} />)}
        </View>
      </View>
    );
  }

  if (title.includes('document')) {
    return (
      <View style={styles.actionWorkspace}>
        {data.documents.map((document) => (
          <View key={document.id} style={styles.workspaceRow}>
            <Ionicons color={colors.rose} name="document-text-outline" size={18} />
            <View style={styles.hubCopy}>
              <Text style={styles.hubLabel}>{document.title}</Text>
              <Text style={styles.hubDetail}>{document.type} - {document.status}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.actionWorkspace}>
      <View style={styles.workspaceRow}>
        <Ionicons color={colors.rose} name="create-outline" size={18} />
        <View style={styles.hubCopy}>
          <Text style={styles.hubLabel}>Action details</Text>
          <Text style={styles.hubDetail}>Review the details, make updates, then save when finished.</Text>
        </View>
      </View>
      {saved ? <SavedStrip label="Saved" /> : null}
    </View>
  );
}

function ActionChip({ active, label }: { active?: boolean; label: string }) {
  return (
    <View style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
    </View>
  );
}

function SavedStrip({ label }: { label: string }) {
  return (
    <View style={styles.savedStrip}>
      <Ionicons color={colors.green} name="checkmark-circle-outline" size={16} />
      <Text style={styles.savedStripText}>{label}</Text>
    </View>
  );
}

function VendorDetailModal({
  data,
  onClose,
  onDelete,
  onUpdate,
  vendor,
}: {
  data: typeof samplePlanningData;
  onClose: () => void;
  onDelete: (vendorId: string) => void;
  onUpdate: (vendor: VendorRecord) => void;
  vendor: VendorRecord | null;
}) {
  const [detailView, setDetailView] = useState<'overview' | 'message' | 'contract' | 'edit'>('overview');

  useEffect(() => {
    if (vendor) setDetailView('overview');
  }, [vendor?.id]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(vendor)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>{vendor?.name}</Text>
              <Text style={styles.hubDetail}>{vendor?.category} - {vendor?.status}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.eventTypeRow}>
            {[
              ['overview', 'Overview'],
              ['message', 'Message'],
              ['contract', 'Contract'],
              ['edit', 'Edit'],
            ].map(([id, label]) => {
              const active = detailView === id;
              return (
                <Pressable key={id} onPress={() => setDetailView(id as 'overview' | 'message' | 'contract' | 'edit')} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {detailView === 'overview' ? (
            <>
              <View style={styles.vendorMetricGrid}>
                <SummaryCard label="Committed" value={formatCurrency(vendor?.committed ?? 0)} />
                <SummaryCard label="Paid" value={formatCurrency(vendor?.paid ?? 0)} />
                <SummaryCard label="Remaining" value={formatCurrency(vendor?.remaining ?? 0)} />
              </View>

              <View style={styles.vendorInfoList}>
                <VendorInfoRow icon="person-outline" label="Contact" value={vendor?.contactName ?? 'Not added'} />
                <VendorInfoRow icon="call-outline" label="Phone" value={vendor?.phone ?? 'Not added'} />
                <VendorInfoRow icon="mail-outline" label="Email" value={vendor?.email ?? 'Not added'} />
                <VendorInfoRow icon="time-outline" label="Arrival" value={vendor?.arrivalTime ?? 'Not scheduled'} />
                <VendorInfoRow icon="card-outline" label="Next payment" value={vendor?.nextPaymentDate ? formatShortDate(vendor.nextPaymentDate) : 'No payment due'} />
                <VendorInfoRow icon="document-attach-outline" label="Contract" value={vendor && vendorHasUploadedContract(data, vendor) ? 'Contract uploaded' : 'No contract uploaded - tap Contract to upload'} />
              </View>
            </>
          ) : null}

          {detailView === 'message' && vendor ? <VendorMessageComposer vendor={vendor} /> : null}
          {detailView === 'contract' && vendor ? <VendorContractPanel data={data} vendor={vendor} /> : null}
          {detailView === 'edit' && vendor ? (
            <VendorEditorPanel
              onDelete={() => onDelete(vendor.id)}
              onSave={(updatedVendor) => {
                onUpdate(updatedVendor);
                setDetailView('overview');
              }}
              vendor={vendor}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function VendorMessageModal({ onClose, vendor }: { onClose: () => void; vendor: VendorRecord | null }) {
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('sms');
  const [tone, setTone] = useState<'warm' | 'direct' | 'formal'>('warm');
  const [composeMode, setComposeMode] = useState<'aria' | 'custom'>('aria');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Array<{ body: string; createdAt: string; deliveryStatus: string; id: number; senderType: string }>>([]);
  const [messageStatus, setMessageStatus] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const defaultMessage = vendor
    ? `Hi ${vendor.contactName ?? vendor.name}, this is Stacy from Stacy & Rick's wedding. Can you confirm our next payment and arrival details?`
    : '';
  const [message, setMessage] = useState(defaultMessage);

  useEffect(() => {
    setMessage(defaultMessage);
    setComposeMode('aria');
    setTone('warm');
    setConversationId(null);
    setConversationMessages([]);
    setMessageStatus('');
    if (!vendor) return;
    let alive = true;
    async function hydrateConversation() {
      try {
        const conversation = await getOrCreateMobileVendorConversation(vendor.id);
        if (!alive) return;
        setConversationId(conversation.id);
        const messages = await listMobileVendorMessages(conversation.id);
        if (!alive) return;
        setConversationMessages(messages);
      } catch (error) {
        if (!alive) return;
        setMessageStatus(error instanceof Error ? error.message : 'Vendor conversation could not load.');
      }
    }
    void hydrateConversation();
    return () => {
      alive = false;
    };
  }, [defaultMessage]);

  const applyDraft = (draft: string, selectedTone = tone) => {
    const tonedDraft = selectedTone === 'formal'
      ? draft.replace('Hi', 'Hello')
      : selectedTone === 'direct'
        ? draft.replace("hope you're doing well. ", '')
        : draft;
    setComposeMode('aria');
    setTone(selectedTone);
    setMessage(tonedDraft);
  };
  const sendMessage = async () => {
    if (!vendor || sendingMessage || !message.trim()) return;
    setSendingMessage(true);
    setMessageStatus('');
    try {
      const activeConversationId = conversationId ?? (await getOrCreateMobileVendorConversation(vendor.id)).id;
      setConversationId(activeConversationId);
      const sent = await sendMobileVendorMessage({
        body: message.trim(),
        conversationId: activeConversationId,
        subject: `Wedding planning - ${vendor.name}`,
      });
      setConversationMessages((current) => [...current, sent]);
      setMessageStatus(sent.deliveryStatus === 'sent' ? 'Message sent and conversation synced.' : sent.errorMessage || 'Message saved, but delivery needs attention.');
      setMessage('');
      setComposeMode('custom');
    } catch (error) {
      setMessageStatus(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(vendor)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Message vendor</Text>
              <Text style={styles.hubDetail}>{vendor?.name} - {vendor?.contactName ?? 'Contact not added'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.vendorInfoList}>
            <VendorInfoRow icon="call-outline" label="SMS" value={vendor?.phone ?? 'No phone added'} />
            <VendorInfoRow icon="mail-outline" label="Email" value={vendor?.email ?? 'No email added'} />
          </View>
          {messageStatus ? <SavedStrip label={messageStatus} /> : null}
          {conversationMessages.length > 0 ? (
            <View style={styles.vendorInfoList}>
              {conversationMessages.slice(-3).map((item) => (
                <View key={item.id} style={styles.workspaceRow}>
                  <Ionicons color={item.senderType === 'vendor' ? colors.green : colors.rose} name={item.senderType === 'vendor' ? 'mail-unread-outline' : 'mail-outline'} size={18} />
                  <View style={styles.hubCopy}>
                    <Text style={styles.hubLabel}>{item.senderType === 'vendor' ? 'Vendor reply' : 'You'}</Text>
                    <Text numberOfLines={2} style={styles.hubDetail}>{item.body}</Text>
                  </View>
                  <Text style={styles.smallStatus}>{item.deliveryStatus}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.eventTypeRow}>
            {[
              ['sms', 'SMS'],
              ['email', 'Email'],
              ['both', 'Both'],
            ].map(([id, label]) => {
              const active = channel === id;
              return (
                <Pressable key={id} onPress={() => setChannel(id as 'sms' | 'email' | 'both')} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.formStack}>
            <View>
              <Text style={styles.formLabel}>Compose</Text>
              <View style={styles.eventTypeRow}>
                <Pressable
                  onPress={() => applyDraft(defaultMessage)}
                  style={[styles.eventTypePill, composeMode === 'aria' && styles.eventTypePillActive]}
                >
                  <Text style={[styles.eventTypeText, composeMode === 'aria' && styles.eventTypeTextActive]}>Use Aria draft</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setComposeMode('custom');
                    setMessage('');
                  }}
                  style={[styles.eventTypePill, composeMode === 'custom' && styles.eventTypePillActive]}
                >
                  <Text style={[styles.eventTypeText, composeMode === 'custom' && styles.eventTypeTextActive]}>Write my own</Text>
                </Pressable>
              </View>
            </View>
            <View>
              <Text style={styles.formLabel}>{composeMode === 'custom' ? 'Your message' : 'Message'}</Text>
              <TextInput
                multiline
                onChangeText={(value) => {
                  setComposeMode('custom');
                  setMessage(value);
                }}
                placeholder={composeMode === 'custom' ? 'Type your own vendor message...' : 'Edit Aria draft...'}
                placeholderTextColor={colors.muted}
                style={[styles.formInput, styles.messageInput]}
                value={message}
              />
            </View>
          </View>

          <View style={styles.aiDraftCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.aiDraftHeader}>
                <Image resizeMode="cover" source={ariaAvatar} style={styles.aiDraftAvatar} />
                <View style={styles.hubCopy}>
                  <Text style={styles.overline}>Aria message generator</Text>
                  <Text style={styles.hubDetail}>Draft a vendor-ready message before sending.</Text>
                </View>
              </View>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            </View>

            <View style={styles.aiToneRow}>
              {[
                ['warm', 'Warm'],
                ['direct', 'Direct'],
                ['formal', 'Formal'],
              ].map(([id, label]) => {
                const active = tone === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => applyDraft(message || defaultMessage, id as 'warm' | 'direct' | 'formal')}
                    style={[styles.aiTonePill, active && styles.aiTonePillActive]}
                  >
                    <Text style={[styles.aiToneText, active && styles.aiToneTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.aiPromptGrid}>
              {[
                ['Payment follow-up', `Hi ${vendor?.contactName ?? vendor?.name ?? 'there'}, hope you're doing well. Can you confirm the next payment amount, due date, and best way to pay for Stacy & Rick's wedding?`],
                ['Arrival details', `Hi ${vendor?.contactName ?? vendor?.name ?? 'there'}, can you confirm your arrival time, onsite contact, and anything you need from the venue for Stacy & Rick's wedding day?`],
                ['Contract question', `Hi ${vendor?.contactName ?? vendor?.name ?? 'there'}, I am reviewing the agreement and wanted to confirm the remaining balance, cancellation terms, and final deliverables.`],
              ].map(([label, draft]) => (
                <Pressable
                  key={label}
                  onPress={() => applyDraft(draft)}
                  style={styles.aiPromptButton}
                >
                  <Ionicons color={colors.rose} name="sparkles-outline" size={14} />
                  <Text style={styles.aiPromptButtonText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.websiteActions}>
            <Pressable disabled={sendingMessage || !message.trim()} onPress={sendMessage} style={[styles.primaryActionButton, (sendingMessage || !message.trim()) && styles.disabledActionButton]}>
              <Ionicons color={colors.surface} name={sendingMessage ? 'sync-outline' : 'send-outline'} size={18} />
              <Text style={styles.primaryActionText}>{sendingMessage ? 'Sending...' : 'Send message'}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.secondaryActionButton}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddEventModal({
  event,
  onChange,
  onClose,
  onSave,
  open,
}: {
  event: { date: string; detail: string; link: string; time: string; title: string; type: CalendarEvent['type'] };
  onChange: (event: { date: string; detail: string; link: string; time: string; title: string; type: CalendarEvent['type'] }) => void;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
}) {
  const types: Array<{ label: string; value: CalendarEvent['type'] }> = [
    { label: 'Appointment', value: 'custom' },
    { label: 'Vendor', value: 'vendor' },
    { label: 'Payment', value: 'payment' },
    { label: 'Task', value: 'task' },
  ];

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Add event</Text>
              <Text style={styles.hubDetail}>Create an appointment, reminder, meeting, or payment date.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.formStack}>
            <FormInput label="Title" onChangeText={(value) => onChange({ ...event, title: value })} placeholder="Vendor meeting" value={event.title} />
            <FormInput label="Date" onChangeText={(value) => onChange({ ...event, date: value })} placeholder="2026-06-15" value={event.date} />
            <FormInput label="Time" onChangeText={(value) => onChange({ ...event, time: value })} placeholder="2:00 PM" value={event.time} />
            <FormInput
              keyboardType="url"
              label="Link"
              onChangeText={(value) => onChange({ ...event, link: value })}
              placeholder="Zoom, map, invoice, or vendor portal"
              value={event.link}
            />
            <FormInput label="Notes" onChangeText={(value) => onChange({ ...event, detail: value })} placeholder="What is this for?" value={event.detail} />
            <View>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.eventTypeRow}>
                {types.map((type) => {
                  const active = event.type === type.value;
                  return (
                    <Pressable key={type.value} onPress={() => onChange({ ...event, type: type.value })} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{type.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.websiteActions}>
            <Pressable onPress={onSave} style={styles.primaryActionButton}>
              <Ionicons color={colors.surface} name="checkmark-outline" size={18} />
              <Text style={styles.primaryActionText}>Save event</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.secondaryActionButton}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function VendorMessageComposer({ vendor }: { vendor: VendorRecord }) {
  const ariaDraft = `Hi ${vendor.contactName ?? vendor.name}, this is Stacy from Stacy & Rick's wedding. Can you confirm our next payment and arrival details?`;
  const [composeMode, setComposeMode] = useState<'aria' | 'custom'>('aria');
  const [message, setMessage] = useState(ariaDraft);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setComposeMode('aria');
    setMessage(ariaDraft);
    setStatus('');
  }, [ariaDraft]);
  const sendMessage = async () => {
    if (sending || !message.trim()) return;
    setSending(true);
    setStatus('');
    try {
      const conversation = await getOrCreateMobileVendorConversation(vendor.id);
      const sent = await sendMobileVendorMessage({
        body: message.trim(),
        conversationId: conversation.id,
        subject: `Wedding planning - ${vendor.name}`,
      });
      setStatus(sent.deliveryStatus === 'sent' ? 'Message sent and added to vendor conversation.' : sent.errorMessage || 'Message saved, but delivery needs attention.');
      setComposeMode('custom');
      setMessage('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.actionWorkspace}>
      <View style={styles.vendorInfoList}>
        <VendorInfoRow icon="call-outline" label="SMS" value={vendor.phone ?? 'No phone added'} />
        <VendorInfoRow icon="mail-outline" label="Email" value={vendor.email ?? 'No email added'} />
      </View>
      <View style={styles.eventTypeRow}>
        {['SMS', 'Email', 'Both'].map((item) => <ActionChip key={item} label={item} active={item === 'Both'} />)}
      </View>
      <View>
        <Text style={styles.formLabel}>Compose</Text>
        <View style={styles.eventTypeRow}>
          <Pressable
            onPress={() => {
              setComposeMode('aria');
              setMessage(ariaDraft);
            }}
            style={[styles.eventTypePill, composeMode === 'aria' && styles.eventTypePillActive]}
          >
            <Text style={[styles.eventTypeText, composeMode === 'aria' && styles.eventTypeTextActive]}>Use Aria draft</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setComposeMode('custom');
              setMessage('');
            }}
            style={[styles.eventTypePill, composeMode === 'custom' && styles.eventTypePillActive]}
          >
            <Text style={[styles.eventTypeText, composeMode === 'custom' && styles.eventTypeTextActive]}>Write my own</Text>
          </Pressable>
        </View>
      </View>
      <TextInput
        multiline
        onChangeText={(value) => {
          setComposeMode('custom');
          setMessage(value);
        }}
        placeholder={composeMode === 'custom' ? 'Type your own vendor message...' : 'Edit Aria draft...'}
        placeholderTextColor={colors.muted}
        style={[styles.formInput, styles.messageInput]}
        value={message}
      />
      <SavedStrip label={status || (composeMode === 'custom' ? 'Custom message ready to send' : 'Aria draft ready to send')} />
      <View style={styles.websiteActions}>
        <Pressable disabled={sending || !message.trim()} onPress={sendMessage} style={[styles.primaryActionButton, (sending || !message.trim()) && styles.disabledActionButton]}>
          <Ionicons color={colors.surface} name={sending ? 'sync-outline' : 'send-outline'} size={18} />
          <Text style={styles.primaryActionText}>{sending ? 'Sending...' : 'Send message'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VendorContractPanel({ data, vendor }: { data: typeof samplePlanningData; vendor: VendorRecord }) {
  const hasContract = vendorHasUploadedContract(data, vendor);

  return (
    <View style={styles.actionWorkspace}>
      <View style={hasContract ? styles.workspaceRow : styles.noContractStrip}>
        <Ionicons color={colors.rose} name={hasContract ? 'document-text-outline' : 'cloud-upload-outline'} size={18} />
        <View style={styles.hubCopy}>
          <Text style={hasContract ? styles.hubLabel : styles.noContractTitle}>{hasContract ? 'Contract uploaded' : 'No contract uploaded'}</Text>
          <Text style={styles.hubDetail}>{hasContract ? 'Open the uploaded contract, review terms, or replace the file.' : 'Upload it here under Contract so Aria can track terms and payment dates.'}</Text>
        </View>
      </View>
      <View style={styles.eventTypeRow}>
        {['Pending', 'Signed', 'Needs review'].map((item) => <ActionChip key={item} label={item} active={item === (hasContract ? 'Needs review' : 'Pending')} />)}
      </View>
    </View>
  );
}

function VendorEditorPanel({
  onDelete,
  onSave,
  vendor,
}: {
  onDelete: () => void;
  onSave: (vendor: VendorRecord) => void;
  vendor: VendorRecord;
}) {
  const [draft, setDraft] = useState(vendor);
  useEffect(() => setDraft(vendor), [vendor]);
  const committed = Number(draft.committed) || 0;
  const paid = Number(draft.paid) || 0;

  return (
    <View style={styles.actionWorkspace}>
      <View style={styles.formStack}>
        <FormInput label="Vendor name" onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Vendor name" value={draft.name} />
        <FormInput label="Category" onChangeText={(value) => setDraft({ ...draft, category: value })} placeholder="Florist, venue, DJ..." value={draft.category} />
        <FormInput label="Contact" onChangeText={(value) => setDraft({ ...draft, contactName: value })} placeholder="Contact name" value={draft.contactName ?? ''} />
        <FormInput label="Phone" onChangeText={(value) => setDraft({ ...draft, phone: value })} placeholder="(555) 000-0000" value={draft.phone ?? ''} />
        <FormInput keyboardType="url" label="Email" onChangeText={(value) => setDraft({ ...draft, email: value })} placeholder="vendor@example.com" value={draft.email ?? ''} />
        <FormInput label="Arrival time" onChangeText={(value) => setDraft({ ...draft, arrivalTime: value })} placeholder="10:30 AM" value={draft.arrivalTime ?? ''} />
        <FormInput label="Total cost" onChangeText={(value) => setDraft({ ...draft, committed: Number(value) || 0, remaining: Math.max(0, (Number(value) || 0) - paid) })} placeholder="2500" value={String(draft.committed || '')} />
        <FormInput label="Paid" onChangeText={(value) => setDraft({ ...draft, paid: Number(value) || 0, remaining: Math.max(0, committed - (Number(value) || 0)) })} placeholder="700" value={String(draft.paid || '')} />
        <View>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.eventTypeRow}>
            {(['Pending', 'Signed', 'Ongoing', 'Completed'] as const).map((status) => {
              const active = draft.status === status;
              return (
                <Pressable key={status} onPress={() => setDraft({ ...draft, status })} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                  <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{status}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.websiteActions}>
        <Pressable
          disabled={!draft.name.trim()}
          onPress={() => onSave({ ...draft, remaining: Math.max(0, (Number(draft.committed) || 0) - (Number(draft.paid) || 0)) })}
          style={[styles.primaryActionButton, !draft.name.trim() && styles.disabledButton]}
        >
          <Ionicons color={colors.surface} name="save-outline" size={18} />
          <Text style={styles.primaryActionText}>Save vendor</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.secondaryActionButton}>
          <Ionicons color={colors.rose} name="trash-outline" size={18} />
          <Text style={styles.secondaryActionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VendorEditorModal({
  onClose,
  onDelete,
  onSave,
  vendor,
}: {
  onClose: () => void;
  onDelete: () => void;
  onSave: (vendor: VendorRecord) => void;
  vendor: VendorRecord | null;
}) {
  if (!vendor) return null;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(vendor)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Add vendor</Text>
              <Text style={styles.hubDetail}>Create a vendor with contact, status, and budget details.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>
          <VendorEditorPanel onDelete={onDelete} onSave={onSave} vendor={vendor} />
        </View>
      </View>
    </Modal>
  );
}

function AddPaymentModal({
  budgetItems,
  form,
  onChange,
  onClose,
  onSave,
  open,
}: {
  budgetItems: LocalBudgetRecord[];
  form: { amount: string; date: string; itemId: string; label: string };
  onChange: (form: { amount: string; date: string; itemId: string; label: string }) => void;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Add payment</Text>
              <Text style={styles.hubDetail}>Schedule another vendor or budget payment milestone.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.formStack}>
            <View>
              <Text style={styles.formLabel}>Budget line</Text>
              <View style={styles.eventTypeRow}>
                {budgetItems.map((item) => {
                  const active = form.itemId === item.id;
                  return (
                    <Pressable key={item.id} onPress={() => onChange({ ...form, itemId: item.id })} style={[styles.eventTypePill, active && styles.eventTypePillActive]}>
                      <Text style={[styles.eventTypeText, active && styles.eventTypeTextActive]}>{item.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <FormInput label="Payment label" onChangeText={(value) => onChange({ ...form, label: value })} placeholder="Second payment, final payment..." value={form.label} />
            <FormInput label="Amount" onChangeText={(value) => onChange({ ...form, amount: value })} placeholder="1200" value={form.amount} />
            <FormInput label="Due date" onChangeText={(value) => onChange({ ...form, date: value })} placeholder="2026-06-15" value={form.date} />
          </View>

          <View style={styles.websiteActions}>
            <Pressable onPress={onSave} style={styles.primaryActionButton}>
              <Ionicons color={colors.surface} name="add" size={18} />
              <Text style={styles.primaryActionText}>Add payment</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.secondaryActionButton}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddMiscExpenseModal({
  form,
  onChange,
  onClose,
  onSave,
  open,
}: {
  form: { category: string; nextAmount: string; nextDate: string; notes: string; paid: string; receiptName: string; title: string; total: string };
  onChange: (form: { category: string; nextAmount: string; nextDate: string; notes: string; paid: string; receiptName: string; title: string; total: string }) => void;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Add misc expense</Text>
              <Text style={styles.hubDetail}>Track attire, license, tips, decor, gifts, travel, and other costs.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.formStack}>
            <FormInput label="Expense name" onChangeText={(value) => onChange({ ...form, title: value })} placeholder="Marriage license" value={form.title} />
            <FormInput label="Category" onChangeText={(value) => onChange({ ...form, category: value })} placeholder="Attire, Tips, Decor..." value={form.category} />
            <FormInput label="Total cost" onChangeText={(value) => onChange({ ...form, total: value })} placeholder="525" value={form.total} />
            <FormInput label="Already paid" onChangeText={(value) => onChange({ ...form, paid: value })} placeholder="0" value={form.paid} />
            <FormInput label="Next due amount" onChangeText={(value) => onChange({ ...form, nextAmount: value })} placeholder="325" value={form.nextAmount} />
            <FormInput label="Next due date" onChangeText={(value) => onChange({ ...form, nextDate: value })} placeholder="2026-06-22" value={form.nextDate} />
            <FormInput label="Notes" onChangeText={(value) => onChange({ ...form, notes: value })} placeholder="Optional details or reminder context" value={form.notes} />
            <FormInput label="Receipt" onChangeText={(value) => onChange({ ...form, receiptName: value })} placeholder="Receipt or invoice name" value={form.receiptName} />
          </View>

          <View style={styles.websiteActions}>
            <Pressable onPress={onSave} style={styles.primaryActionButton}>
              <Ionicons color={colors.surface} name="add" size={18} />
              <Text style={styles.primaryActionText}>Add misc expense</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.secondaryActionButton}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FormInput({
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  value,
}: {
  keyboardType?: 'default' | 'url';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.formInput}
        value={value}
      />
    </View>
  );
}

function VendorInfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.vendorInfoRow}>
      <View style={styles.financeRowIcon}>
        <Ionicons color={colors.rose} name={icon} size={18} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={styles.photoDropControlLabel}>{label}</Text>
        <Text style={styles.hubLabel}>{value}</Text>
      </View>
    </View>
  );
}

function Section({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const compactValue = value.length > 5;

  return (
    <View style={[styles.summaryCard, wide && styles.summaryCardWide]}>
      <Text
        adjustsFontSizeToFit
        allowFontScaling={false}
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.summaryValue, compactValue && styles.summaryValueCompact]}
      >
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function HubRow({ detail, icon, label, onPress }: { detail: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.hubRow}>
      <View style={styles.hubIcon}>
        <Ionicons color={colors.rose} name={icon} size={20} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={styles.hubLabel}>{label}</Text>
        <Text style={styles.hubDetail}>{detail}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function CalendarEventRow({ event, onPress }: { event: CalendarEvent; onPress?: () => void }) {
  const meta = event.time ? `${event.time} - ${event.detail}` : event.detail;

  return (
    <Pressable onPress={onPress} style={styles.calendarEventRow}>
      <View style={[styles.calendarEventIcon, calendarTypeStyle(event.type)]}>
        <Ionicons color={colors.rose} name={calendarTypeIcon(event.type)} size={18} />
      </View>
      <View style={styles.calendarEventCopy}>
        <Text style={styles.taskTitle}>{event.title}</Text>
        <Text style={styles.taskMeta}>{meta}</Text>
        {event.link ? (
          <View style={styles.eventLinkPill}>
            <Ionicons color={colors.blue} name="link-outline" size={12} />
            <Text style={styles.eventLinkText}>Link attached</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.eventDateLabel}>{formatShortDate(event.date).replace(', 2026', '')}</Text>
    </Pressable>
  );
}

function WebsitePageRow({ detail, onPress, status, title }: { detail: string; onPress?: () => void; status: string; title: string }) {
  return (
    <Pressable onPress={onPress} style={styles.websitePageRow}>
      <View style={styles.websitePageIcon}>
        <Ionicons color={colors.rose} name={websiteStatusIcon(status)} size={18} />
      </View>
      <View style={styles.hubCopy}>
        <View style={styles.websitePageTitleRow}>
          <Text style={styles.hubLabel}>{title}</Text>
          <Text style={[styles.websiteStatusPill, websiteStatusStyle(status)]}>{status}</Text>
        </View>
        <Text style={styles.hubDetail}>{detail}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function GuestListRow({ guest, onPress }: { guest: (typeof samplePlanningData.guests)[number]; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.guestListRow}>
      <View style={styles.guestListIcon}>
        <Ionicons color={colors.rose} name="people-outline" size={18} />
      </View>
      <View style={styles.hubCopy}>
        <View style={styles.websitePageTitleRow}>
          <Text style={styles.hubLabel}>{guest.name}</Text>
          <Text style={[styles.websiteStatusPill, guestStatusStyle(guest.rsvp)]}>{guest.rsvp}</Text>
        </View>
        <Text style={styles.hubDetail}>{guest.mealPreference} - {guest.table}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function PhotoDropControl({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.photoDropControl}>
      <View style={styles.photoDropControlIcon}>
        <Ionicons color={colors.rose} name={icon} size={17} />
      </View>
      <Text style={styles.photoDropControlLabel}>{label}</Text>
      <Text style={styles.photoDropControlValue}>{value}</Text>
    </View>
  );
}

function PaymentActionRow({
  item,
  onMarkPaid,
  onPaidFull,
  onPress,
  payment,
}: {
  item: LocalBudgetRecord;
  onMarkPaid: () => void;
  onPaidFull: () => void;
  onPress?: () => void;
  payment: ScheduledPayment;
}) {
  const remaining = Math.max(0, item.total - item.paid);
  const isPaidFull = remaining <= 0;

  return (
    <View style={styles.paymentActionRow}>
      <Pressable onPress={onPress} style={styles.paymentActionMain}>
        <View style={styles.financeRowIcon}>
          <Ionicons color={colors.rose} name={isPaidFull ? 'checkmark-circle-outline' : 'card-outline'} size={18} />
        </View>
        <View style={styles.hubCopy}>
          <Text style={styles.hubLabel}>{item.title}</Text>
          <Text style={styles.hubDetail}>
            {isPaidFull
              ? 'Paid in full'
              : `${payment.label}: ${formatCurrency(payment.amount)} due ${formatShortDate(payment.date)} - ${formatCurrency(remaining)} remaining`}
          </Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={18} />
      </Pressable>
      {!isPaidFull ? (
        <View style={styles.paymentActionButtons}>
          <Pressable onPress={onMarkPaid} style={styles.paymentSmallPrimary}>
            <Ionicons color={colors.surface} name="checkmark-outline" size={15} />
            <Text style={styles.paymentSmallPrimaryText}>Paid scheduled payment</Text>
          </Pressable>
          <Pressable onPress={onPaidFull} style={styles.paymentSmallSecondary}>
            <Text style={styles.paymentSmallSecondaryText}>Paid full balance</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.paymentPaidPill}>
          <Ionicons color={colors.green} name="checkmark-circle-outline" size={15} />
          <Text style={styles.paymentPaidText}>Paid in full</Text>
        </View>
      )}
    </View>
  );
}

function VendorContactRow({
  onMessage,
  onOpen,
  vendor,
}: {
  onMessage: () => void;
  onOpen: () => void;
  vendor: VendorRecord;
}) {
  return (
    <View style={styles.vendorContactCard}>
      <Pressable onPress={onOpen} style={styles.vendorContactMain}>
        <View style={styles.financeRowIcon}>
          <Ionicons color={colors.rose} name="storefront-outline" size={18} />
        </View>
        <View style={styles.hubCopy}>
          <Text style={styles.hubLabel}>{vendor.name}</Text>
          <Text style={styles.hubDetail}>{vendor.category} - {vendor.contactName ?? 'No contact'} - {formatCurrency(vendor.remaining)} remaining</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={18} />
      </Pressable>
      <View style={styles.vendorContactActions}>
        <Pressable onPress={onMessage} style={styles.vendorMessageButton}>
          <Ionicons color={colors.surface} name="chatbubble-outline" size={15} />
          <Text style={styles.vendorMessageText}>Message</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.vendorDetailsButton}>
          <Text style={styles.vendorDetailsText}>Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VendorTrackerCard({
  data,
  onContract,
  onMessage,
  onOpen,
  vendor,
}: {
  data: typeof samplePlanningData;
  onContract: () => void;
  onMessage: () => void;
  onOpen: () => void;
  vendor: VendorRecord;
}) {
  const progress = vendor.committed ? Math.round((vendor.paid / vendor.committed) * 100) : 0;
  const paidInFull = vendor.remaining <= 0;
  const hasContract = vendorHasUploadedContract(data, vendor);

  return (
    <View style={styles.vendorTrackerCard}>
      <Pressable onPress={onOpen} style={styles.vendorTrackerMain}>
        <View style={styles.financeRowIcon}>
          <Ionicons color={colors.rose} name="storefront-outline" size={18} />
        </View>
        <View style={styles.hubCopy}>
          <View style={styles.websitePageTitleRow}>
            <Text style={styles.hubLabel}>{vendor.name}</Text>
            <Text style={[styles.websiteStatusPill, vendorStatusStyle(vendor.status)]}>{vendor.status}</Text>
          </View>
          <Text style={styles.hubDetail}>{vendor.category} - {vendor.contactName ?? 'No contact'} - {vendor.arrivalTime ?? 'Arrival TBD'}</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={18} />
      </Pressable>

      <View style={styles.vendorPaymentStrip}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.vendorPaymentText}>{paidInFull ? 'Paid in full' : `${formatCurrency(vendor.remaining)} remaining`}</Text>
          <Text style={styles.vendorPaymentText}>{progress}% paid</Text>
        </View>
        <Progress value={progress} />
        <Text style={styles.hubDetail}>
          {vendor.nextPaymentDate && !paidInFull ? `Next payment ${formatShortDate(vendor.nextPaymentDate)}` : 'No upcoming payment due'}
        </Text>
      </View>

      {!hasContract ? (
        <Pressable onPress={onContract} style={styles.noContractStrip}>
          <Ionicons color={colors.rose} name="document-attach-outline" size={17} />
          <View style={styles.hubCopy}>
            <Text style={styles.noContractTitle}>No contract uploaded</Text>
            <Text style={styles.hubDetail}>Upload it here under Contract so Aria can track terms and payment dates.</Text>
          </View>
          <Ionicons color={colors.rose} name="cloud-upload-outline" size={18} />
        </Pressable>
      ) : null}

      <View style={styles.vendorQuickGrid}>
        <Pressable onPress={onMessage} style={styles.vendorQuickButton}>
          <Ionicons color={colors.rose} name="chatbubble-outline" size={15} />
          <Text style={styles.vendorQuickText}>Message</Text>
        </Pressable>
        <Pressable onPress={onContract} style={styles.vendorQuickButton}>
          <Ionicons color={colors.rose} name="document-text-outline" size={15} />
          <Text style={styles.vendorQuickText}>Contract</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.vendorQuickButton}>
          <Ionicons color={colors.rose} name="folder-open-outline" size={15} />
          <Text style={styles.vendorQuickText}>Files</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VendorMessageRow({ onMessage, vendor }: { onMessage: () => void; vendor: VendorRecord }) {
  return (
    <Pressable onPress={onMessage} style={styles.vendorMessageRow}>
      <Image resizeMode="cover" source={ariaAvatar} style={styles.aiDraftAvatar} />
      <View style={styles.hubCopy}>
        <Text style={styles.hubLabel}>{vendor.name}</Text>
        <Text style={styles.hubDetail}>SMS, email, or both - Aria can draft the follow-up.</Text>
      </View>
      <Ionicons color={colors.rose} name="send-outline" size={18} />
    </Pressable>
  );
}

function BudgetLineCard({
  item,
  onAddPayment,
  onDelete,
  onManageSchedule,
  onPaidFull,
}: {
  item: LocalBudgetRecord;
  onAddPayment: () => void;
  onDelete?: () => void;
  onManageSchedule: () => void;
  onPaidFull: () => void;
}) {
  const remaining = Math.max(0, item.total - item.paid);
  const percent = item.total ? Math.round((item.paid / item.total) * 100) : 0;
  const nextPayment = [...item.scheduledPayments].sort(
    (a, b) => (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0),
  )[0];

  return (
    <View style={styles.budgetLineCard}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.hubCopy}>
          <Text style={styles.hubLabel}>{item.title}</Text>
          <Text style={styles.hubDetail}>
            {item.source === 'misc' ? 'Misc expense' : 'Vendor'} - {item.category} - {formatCurrency(remaining)} remaining
          </Text>
        </View>
        <View style={styles.budgetHeaderActions}>
          <View style={[styles.budgetStatusPill, remaining <= 0 && styles.budgetStatusPillPaid]}>
            <Text style={[styles.budgetStatusText, remaining <= 0 && styles.budgetStatusTextPaid]}>
              {remaining <= 0 ? 'Paid full' : `${percent}% paid`}
            </Text>
          </View>
          {onDelete ? (
            <Pressable onPress={onDelete} style={styles.miscIconDeleteButton}>
              <Ionicons color={colors.rose} name="trash-outline" size={15} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Progress value={percent} />
      <View style={styles.budgetLineMoneyRow}>
        <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.76} numberOfLines={1} style={styles.budgetLineMoney}>{formatCurrency(item.paid)} paid</Text>
        <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.76} numberOfLines={1} style={styles.budgetLineMoney}>{formatCurrency(item.total)} total</Text>
      </View>
      {item.notes ? <Text style={styles.miscNoteText}>{item.notes}</Text> : null}
      {item.receiptName ? (
        <View style={styles.receiptPill}>
          <Ionicons color={colors.blue} name="attach-outline" size={13} />
          <Text style={styles.receiptPillText}>{item.receiptName}</Text>
        </View>
      ) : null}
      <View style={styles.nextPaymentStrip}>
        <Ionicons color={nextPayment ? colors.rose : colors.muted} name={nextPayment ? 'calendar-outline' : 'alert-circle-outline'} size={16} />
        <Text style={styles.nextPaymentStripText}>
          {remaining <= 0
            ? 'No balance remaining'
            : nextPayment
              ? `${nextPayment.label}: ${formatCurrency(nextPayment.amount)} due ${formatShortDate(nextPayment.date)}`
              : 'No next payment scheduled'}
        </Text>
      </View>
      <View style={styles.paymentActionButtons}>
        <Pressable onPress={onManageSchedule} style={styles.paymentSmallSecondary}>
          <Text style={styles.paymentSmallSecondaryText}>Manage schedule</Text>
        </Pressable>
        {remaining > 0 ? (
          <Pressable onPress={nextPayment ? onPaidFull : onAddPayment} style={styles.paymentSmallPrimary}>
            <Text style={styles.paymentSmallPrimaryText}>{nextPayment ? 'Paid full balance' : 'Add payment'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PaymentScheduleModal({
  item,
  onAddPayment,
  onClose,
  onDeletePayment,
  onMarkPaid,
  onPaidFull,
}: {
  item: LocalBudgetRecord | null;
  onAddPayment: (itemId: string) => void;
  onClose: () => void;
  onDeletePayment: (itemId: string, paymentId: string) => void;
  onMarkPaid: (item: LocalBudgetRecord, payment: ScheduledPayment) => void;
  onPaidFull: (item: LocalBudgetRecord) => void;
}) {
  const remaining = item ? Math.max(0, item.total - item.paid) : 0;
  const scheduledOpen = item?.scheduledPayments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.vendorPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Payment schedule</Text>
              <Text style={styles.hubDetail}>{item?.title}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.vendorMetricGrid}>
            <SummaryCard label="Open" value={formatCurrency(scheduledOpen)} />
            <SummaryCard label="Paid" value={formatCurrency(item?.paid ?? 0)} />
            <SummaryCard label="Remaining" value={formatCurrency(remaining)} />
          </View>

          <View style={styles.calendarList}>
            {item?.scheduledPayments.length ? (
              item.scheduledPayments.map((payment) => (
                <View key={payment.id} style={styles.schedulePaymentCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.hubCopy}>
                      <Text style={styles.hubLabel}>{payment.label}</Text>
                      <Text style={styles.hubDetail}>{formatCurrency(payment.amount)} due {formatShortDate(payment.date)}</Text>
                    </View>
                    <Pressable onPress={() => onDeletePayment(item.id, payment.id)} style={styles.deletePaymentButton}>
                      <Ionicons color={colors.rose} name="trash-outline" size={17} />
                    </Pressable>
                  </View>
                  <View style={styles.paymentActionButtons}>
                    <Pressable onPress={() => onMarkPaid(item, payment)} style={styles.paymentSmallPrimary}>
                      <Text style={styles.paymentSmallPrimaryText}>Paid scheduled payment</Text>
                    </Pressable>
                    <Pressable onPress={() => onPaidFull(item)} style={styles.paymentSmallSecondary}>
                      <Text style={styles.paymentSmallSecondaryText}>Paid full balance</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.mutedText}>No scheduled payments yet. Add each installment with its own due date.</Text>
            )}
          </View>

          {item ? (
            <View style={styles.websiteActions}>
              <Pressable onPress={() => onAddPayment(item.id)} style={styles.primaryActionButton}>
                <Ionicons color={colors.surface} name="add" size={18} />
                <Text style={styles.primaryActionText}>Add payment</Text>
              </Pressable>
              {remaining > 0 ? (
                <Pressable onPress={() => onPaidFull(item)} style={styles.secondaryActionButton}>
                  <Text style={styles.secondaryActionText}>Paid full balance</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function FinanceRow({ detail, icon, label, onPress }: { detail: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.financeRow}>
      <View style={styles.financeRowIcon}>
        <Ionicons color={colors.rose} name={icon} size={18} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={styles.hubLabel}>{label}</Text>
        <Text style={styles.hubDetail}>{detail}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function TaskRow({
  completed,
  meta,
  onPress,
  onToggle,
  title,
}: {
  completed?: boolean;
  meta: string;
  onPress?: () => void;
  onToggle?: () => void;
  title: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.taskRow}>
        <Pressable
          accessibilityLabel={completed ? `Mark ${title} incomplete` : `Mark ${title} complete`}
          onPress={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          style={[styles.checkIcon, completed && styles.checkIconComplete]}
        >
          <Ionicons color={completed ? colors.surface : colors.rose} name={completed ? 'checkmark' : 'ellipse-outline'} size={18} />
        </Pressable>
        <View style={styles.taskCopy}>
          <Text style={[styles.taskTitle, completed && styles.taskTitleComplete]}>{title}</Text>
          <Text style={styles.taskMeta}>{meta}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

async function mobileApiFetch(path: string, init: RequestInit = {}) {
  try {
    const response = await mobileAuthFetch(path, init);
    if (!response) return null;
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

async function loadBudgetItemsFromApi(): Promise<LocalBudgetRecord[]> {
  const [financialsResponse, manualResponse] = await Promise.all([
    mobileApiFetch('/api/vendors/financials'),
    mobileApiFetch('/api/manual-expenses'),
  ]);

  const financials = financialsResponse ? ((await financialsResponse.json()) as ApiVendorFinancials) : null;
  const manualExpenses = manualResponse ? ((await manualResponse.json()) as ApiManualExpense[]) : [];
  const vendorItems: LocalBudgetRecord[] = (financials?.vendors ?? []).map((vendor) => ({
    category: vendor.category,
    id: `api-vendor-${vendor.id}`,
    nextPayment: vendor.nextPaymentDue && vendor.nextPaymentAmount
      ? { amount: vendor.nextPaymentAmount, date: vendor.nextPaymentDue }
      : undefined,
    paid: vendor.totalPaid,
    payments: [],
    scheduledPayments: vendor.nextPaymentDue && vendor.nextPaymentAmount
      ? [{ amount: vendor.nextPaymentAmount, date: vendor.nextPaymentDue, id: String(vendor.nextPaymentId ?? `api-next-${vendor.id}`), label: vendor.nextPaymentLabel ?? 'Scheduled payment' }]
      : [],
    source: 'vendor',
    title: vendor.name,
    total: vendor.totalCost,
    vendorId: vendor.id,
  }));
  const miscItems: LocalBudgetRecord[] = manualExpenses.map(manualExpenseToBudgetRecord);

  return [...vendorItems, ...miscItems];
}

async function createPaymentInApi(item: LocalBudgetRecord, payment: ScheduledPayment) {
  type ApiPaymentResponse = { amount?: number; description?: string | null; dueDate?: string | null; id?: number; label?: string | null };
  if (item.manualExpenseId) {
    const response = await mobileApiFetch(`/api/manual-expenses/${item.manualExpenseId}/payments`, {
      body: JSON.stringify({ amount: payment.amount, description: payment.label, dueDate: payment.date, isPaid: false }),
      method: 'POST',
    });
    if (!response) return null;
    const created = (await response.json()) as ApiPaymentResponse;
    return {
      amount: created.amount ?? payment.amount,
      date: created.dueDate ?? payment.date,
      id: created.id ? String(created.id) : payment.id,
      label: created.description || payment.label,
    };
  }
  if (!item.vendorId) return null;
  const response = await mobileApiFetch(`/api/vendors/${item.vendorId}/payments`, {
    body: JSON.stringify({ amount: payment.amount, dueDate: payment.date, isPaid: false, label: payment.label }),
    method: 'POST',
  });
  if (!response) return null;
  const created = (await response.json()) as ApiPaymentResponse;
  return {
    amount: created.amount ?? payment.amount,
    date: created.dueDate ?? payment.date,
    id: created.id ? String(created.id) : payment.id,
    label: created.label || created.description || payment.label,
  };
}

async function markPaymentPaidInApi(item: LocalBudgetRecord, payment: ScheduledPayment) {
  if (item.manualExpenseId) {
    const paymentId = Number(payment.id);
    const path = Number.isFinite(paymentId)
      ? `/api/manual-expenses/${item.manualExpenseId}/payments/${paymentId}`
      : `/api/manual-expenses/${item.manualExpenseId}/mark-paid`;
    await mobileApiFetch(path, {
      body: Number.isFinite(paymentId) ? JSON.stringify({ isPaid: true }) : undefined,
      method: Number.isFinite(paymentId) ? 'PUT' : 'POST',
    });
    return;
  }
  if (!item.vendorId) return;
  const paymentId = Number(payment.id);
  const path = Number.isFinite(paymentId)
    ? `/api/vendors/${item.vendorId}/payments/${paymentId}`
    : `/api/vendors/${item.vendorId}/payments/mark-next-paid`;
  await mobileApiFetch(path, {
    body: Number.isFinite(paymentId) ? JSON.stringify({ isPaid: true }) : undefined,
    method: Number.isFinite(paymentId) ? 'PATCH' : 'POST',
  });
}

async function markPaidInFullInApi(item: LocalBudgetRecord) {
  if (item.manualExpenseId) {
    await mobileApiFetch(`/api/manual-expenses/${item.manualExpenseId}`, {
      body: JSON.stringify({ amountPaid: item.total, nextPaymentAmount: null, nextPaymentDue: null }),
      method: 'PUT',
    });
    return;
  }
  if (!item.vendorId) return;
  await mobileApiFetch(`/api/vendors/${item.vendorId}/payments/mark-paid-in-full`, { method: 'POST' });
}

async function createManualExpenseInApi(payload: {
  amountPaid: number;
  category: string;
  cost: number;
  name: string;
  nextPaymentAmount?: number;
  nextPaymentDue?: string;
  notes?: string;
  receiptName?: string;
}) {
  const response = await mobileApiFetch('/api/manual-expenses', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
  return response ? manualExpenseToBudgetRecord((await response.json()) as ApiManualExpense) : null;
}

async function deleteBudgetPaymentInApi(item: LocalBudgetRecord, paymentId: string) {
  const numericPaymentId = Number(paymentId);
  if (!Number.isFinite(numericPaymentId)) return;
  if (item.manualExpenseId) {
    await mobileApiFetch(`/api/manual-expenses/${item.manualExpenseId}/payments/${numericPaymentId}`, { method: 'DELETE' });
    return;
  }
  if (item.vendorId) {
    await mobileApiFetch(`/api/vendors/${item.vendorId}/payments/${numericPaymentId}`, { method: 'DELETE' });
  }
}

async function deleteManualExpenseInApi(item: LocalBudgetRecord) {
  if (!item.manualExpenseId) return;
  await mobileApiFetch(`/api/manual-expenses/${item.manualExpenseId}`, { method: 'DELETE' });
}

function manualExpenseToBudgetRecord(expense: ApiManualExpense): LocalBudgetRecord {
  const unpaidPayments = (expense.payments ?? []).filter((payment) => !payment.isPaid && payment.dueDate);
  const scheduledPayments = unpaidPayments.length
    ? unpaidPayments.map((payment) => ({
        amount: payment.amount,
        date: payment.dueDate ?? dateKey(new Date()),
        id: String(payment.id),
        label: payment.description || 'Scheduled payment',
      }))
    : expense.nextPaymentDue && expense.nextPaymentAmount
      ? [{ amount: expense.nextPaymentAmount, date: expense.nextPaymentDue, id: String(expense.nextPaymentId ?? `api-misc-payment-${expense.id}`), label: 'Scheduled payment' }]
      : [];

  return {
    category: expense.category,
    id: `api-misc-${expense.id}`,
    manualExpenseId: expense.id,
    nextPayment: expense.nextPaymentDue && expense.nextPaymentAmount
      ? { amount: expense.nextPaymentAmount, date: expense.nextPaymentDue }
      : undefined,
    notes: expense.notes ?? undefined,
    paid: expense.amountPaid,
    payments: [],
    receiptName: expense.receiptName ?? undefined,
    scheduledPayments,
    source: 'misc',
    title: expense.name,
    total: expense.cost,
  };
}

function buildCalendarEvents(data: typeof samplePlanningData): CalendarEvent[] {
  const events: CalendarEvent[] = [
    {
      id: 'wedding-date',
      title: `${data.profile.coupleName} wedding`,
      date: dateKey(parseDate(data.profile.weddingDate) ?? new Date()),
      type: 'wedding',
      detail: data.profile.venue,
      time: '5:00 PM',
    },
  ];

  data.tasks.forEach((task) => {
    events.push({
      id: `task-${task.id}`,
      title: task.title,
      date: task.dueDate,
      type: 'task',
      detail: `${task.category} - ${formatDeadlineLabel(task.dueDate)}`,
    });
  });

  data.budget.forEach((item) => {
    if (!item.nextPayment) return;
    events.push({
      id: `budget-${item.id}`,
      title: `${item.title} payment`,
      date: item.nextPayment.date,
      type: 'payment',
      detail: `${formatCurrency(item.nextPayment.amount)} due`,
    });
  });

  data.vendors.forEach((vendor) => {
    if (!vendor.nextPaymentDate) return;
    events.push({
      id: `vendor-${vendor.id}`,
      title: `${vendor.name} follow-up`,
      date: vendor.nextPaymentDate,
      type: 'vendor',
      detail: `${vendor.category} - ${vendor.status}`,
    });
  });

  data.hotels.forEach((hotel) => {
    events.push({
      id: `hotel-${hotel.id}`,
      title: `${hotel.name} block deadline`,
      date: hotel.deadline,
      type: 'hotel',
      detail: `${hotel.roomsBooked}/${hotel.roomsTotal} rooms booked`,
    });
  });

  const weddingDate = dateKey(parseDate(data.profile.weddingDate) ?? new Date());
  data.dayOf.forEach((item) => {
    events.push({
      id: `dayof-${item.id}`,
      title: item.title,
      date: weddingDate,
      type: 'dayof',
      detail: `${item.owner} at ${item.location}`,
      time: item.time,
    });
  });

  return events.sort(sortCalendarEvents);
}

function sortCalendarEvents(a: CalendarEvent, b: CalendarEvent) {
  const aTime = parseDate(a.date)?.getTime() ?? 0;
  const bTime = parseDate(b.date)?.getTime() ?? 0;
  return aTime - bTime || (a.time ?? '').localeCompare(b.time ?? '');
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCalendarMonth(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function calendarTypeIcon(type: CalendarEvent['type']): keyof typeof Ionicons.glyphMap {
  const icons: Record<CalendarEvent['type'], keyof typeof Ionicons.glyphMap> = {
    dayof: 'time-outline',
    hotel: 'bed-outline',
    payment: 'card-outline',
    task: 'checkbox-outline',
    vendor: 'storefront-outline',
    wedding: 'heart-outline',
    custom: 'calendar-outline',
  };
  return icons[type];
}

function calendarTypeStyle(type: CalendarEvent['type']) {
  const stylesByType: Record<CalendarEvent['type'], object> = {
    dayof: { backgroundColor: '#E6EEF4' },
    hotel: { backgroundColor: '#E6EFE5' },
    payment: { backgroundColor: colors.goldSoft },
    task: { backgroundColor: colors.roseSoft },
    vendor: { backgroundColor: '#E6EEF4' },
    wedding: { backgroundColor: colors.roseSoft },
    custom: { backgroundColor: colors.surfaceWarm },
  };
  return stylesByType[type];
}

function websiteStatusIcon(status: string): keyof typeof Ionicons.glyphMap {
  if (status === 'Published' || status === 'Sent') return 'checkmark-circle-outline';
  if (status === 'Ready' || status === 'Scheduled') return 'sparkles-outline';
  return 'create-outline';
}

function websiteStatusStyle(status: string) {
  if (status === 'Published' || status === 'Sent') {
    return { backgroundColor: '#E6EFE5', color: colors.green };
  }
  if (status === 'Ready' || status === 'Scheduled') {
    return { backgroundColor: colors.goldSoft, color: colors.gold };
  }
  return { backgroundColor: colors.roseSoft, color: colors.rose };
}

function guestStatusStyle(status: string) {
  if (status === 'Confirmed') {
    return { backgroundColor: '#E6EFE5', color: colors.green };
  }
  if (status === 'Pending') {
    return { backgroundColor: colors.goldSoft, color: colors.gold };
  }
  return { backgroundColor: colors.roseSoft, color: colors.rose };
}

function vendorStatusStyle(status: string) {
  if (status === 'Completed' || status === 'Signed') {
    return { backgroundColor: '#E6EFE5', color: colors.green };
  }
  if (status === 'Ongoing') {
    return { backgroundColor: colors.goldSoft, color: colors.gold };
  }
  return { backgroundColor: colors.roseSoft, color: colors.rose };
}

function documentIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'Receipt') return 'receipt-outline';
  if (type === 'Timeline') return 'calendar-outline';
  if (type === 'Mood Board') return 'images-outline';
  if (type === 'Contract') return 'document-text-outline';
  return 'folder-open-outline';
}

function photoUploadStatusStyle(status: string) {
  if (status === 'Approved') return { backgroundColor: '#E6EFE5', color: colors.green };
  if (status === 'Pending') return { backgroundColor: colors.goldSoft, color: colors.gold };
  return { backgroundColor: colors.roseSoft, color: colors.rose };
}

function vendorHasUploadedContract(data: typeof samplePlanningData, vendor: VendorRecord) {
  return data.contracts.some((contract) => contract.vendorName === vendor.name);
}

function invitationPreviewColors(background: 'blush' | 'ivory' | 'sage'): [string, string] {
  if (background === 'ivory') return ['#FFFCF7', '#F4DEBE'];
  if (background === 'sage') return ['#F6F8F1', '#E6EFE5'];
  return ['#FFF8F4', '#F8DDE5'];
}

function invitationPaperColor(background: 'blush' | 'ivory' | 'sage') {
  if (background === 'ivory') return '#FFFCF7';
  if (background === 'sage') return '#F6F8F1';
  return '#FFF7F2';
}

function invitationFontFamily(font: 'playfair' | 'cormorant') {
  // Website uses Playfair Display and Cormorant Garamond. The app bundles
  // Playfair locally; Cormorant maps to the closest bundled serif weight.
  if (font === 'cormorant') return 'PlayfairDisplay_700Bold';
  return 'PlayfairDisplay_600SemiBold';
}

function invitationFontScale(size: number) {
  return Math.max(10, Math.min(28, size)) / 16;
}

function softenTextColor(textColor: string) {
  if (textColor === '#3B1C2B') return '#6F3E54';
  if (textColor === '#2F3F37') return '#637B59';
  if (textColor === '#4B5563') return '#6B7280';
  return textColor;
}

function formatInvitationDate(value: string) {
  const date = parseDate(value);
  if (!date) return formatShortDate(value);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
}

function buildInvitationMessageDraft({
  coupleNames,
  isRsvp,
  tone,
  venue,
  weddingDate,
}: {
  coupleNames: string;
  isRsvp: boolean;
  tone: 'warm' | 'formal' | 'fun';
  venue: string;
  weddingDate: string;
}) {
  if (isRsvp) {
    if (tone === 'formal') {
      return `Together with their families, ${coupleNames} request the honor of your presence on ${weddingDate} at ${venue}. Kindly RSVP and share your meal selection by the date listed.`;
    }
    if (tone === 'fun') {
      return `${coupleNames} are making it official, and the celebration will not be the same without you. Tell us if you are in, choose your meal, and get ready to celebrate.`;
    }
    return `We are so excited to celebrate with you. Please RSVP for ${coupleNames}'s wedding at ${venue} and choose your meal by the date listed.`;
  }

  if (tone === 'formal') {
    return `Please save ${weddingDate} for the wedding of ${coupleNames} at ${venue}. Formal invitation to follow.`;
  }
  if (tone === 'fun') {
    return `Mark your calendar. ${coupleNames} are getting married at ${venue}, and we cannot wait to celebrate under the sun with you. Formal invitation to follow.`;
  }
  return `Mark your calendar. ${coupleNames} are getting married on ${weddingDate} at ${venue}, and we would love to celebrate with you. Formal invitation to follow.`;
}

function photoDropModeLabel(mode: string) {
  if (mode === 'website') return 'Website only';
  if (mode === 'portal') return 'Portal only';
  return 'Portal + website';
}

function cleanActionDetail(detail: string) {
  return detail
    .replace(/This would /g, '')
    .replace(/This will /g, '')
    .replace(/would /g, '')
    .replace(/ with editable details, saved changes, and related planning data\./g, ' with editable details, saved changes, and related planning data.')
    .trim();
}

function workspaceRoleValue(role: string) {
  if (role === 'Partner') return 'partner';
  if (role === 'Vendor') return 'vendor';
  return 'planner';
}

function workspaceRoleLabel(role: string): 'Planner' | 'Partner' | 'Family' | 'Vendor' {
  if (role === 'partner') return 'Partner';
  if (role === 'vendor') return 'Vendor';
  if (role === 'family') return 'Family';
  return 'Planner';
}

function targetTabForFeature(label: string): TabId | null {
  const planner = new Set(['Guided setup', 'Checklist', 'Timeline', 'Mood board', 'Wedding party', 'Day-of command']);
  const guestHub = new Set(['Guest list', 'Invitations', 'Wedding website', 'Seating chart', 'Hotels', 'Photo drop']);
  const vendors = new Set(['Vendors', 'Vendor messages']);
  const finance = new Set(['Budget', 'Contracts', 'Documents']);

  if (planner.has(label)) return 'plan';
  if (guestHub.has(label)) return 'website';
  if (vendors.has(label)) return 'vendors';
  if (finance.has(label)) return 'money';
  return null;
}

function openFeatureMock(openMockAction: (action: MockAction) => void, label: string) {
  openMockAction({
    title: label,
    detail: `${label} includes editable details, saved changes, and related planning data.`,
    primaryLabel: 'Save details',
  });
}

function Progress({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, value))}%` }]} />
    </View>
  );
}

async function readStoredJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  browserPreviewRoot: {
    alignItems: 'center',
    backgroundColor: '#F4ECE8',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  phoneShadow: {
    maxHeight: 820,
    shadowColor: '#271B22',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.28,
    shadowRadius: 42,
    width: 420,
  },
  phoneFrame: {
    backgroundColor: '#111114',
    borderColor: '#2B2B30',
    borderRadius: 54,
    borderWidth: 8,
    flex: 1,
    overflow: 'hidden',
    padding: 10,
  },
  phoneSpeaker: {
    alignSelf: 'center',
    backgroundColor: '#050506',
    borderRadius: 999,
    height: 30,
    position: 'absolute',
    top: 14,
    width: 118,
    zIndex: 3,
  },
  phoneScreen: {
    backgroundColor: colors.bg,
    borderRadius: 40,
    flex: 1,
    overflow: 'hidden',
    paddingTop: 28,
  },
  root: {
    backgroundColor: colors.bg,
    flex: 1,
    position: 'relative',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: 'center',
  },
  loadingLogo: {
    height: 150,
    width: 150,
  },
  authRoot: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  authLogo: {
    alignSelf: 'center',
    height: 88,
    marginBottom: 16,
    width: 126,
  },
  authCard: {
    borderColor: colors.faint,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
  },
  authTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    lineHeight: 38,
    marginTop: 12,
  },
  authSubtitle: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  authSwitch: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 18,
    padding: 5,
  },
  authSwitchButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10,
  },
  authSwitchButtonActive: {
    backgroundColor: colors.rose,
  },
  authSwitchText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  authSwitchTextActive: {
    color: colors.surface,
  },
  authPrimaryButton: {
    marginTop: 18,
    width: '100%',
  },
  authProviderButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  authNote: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
    padding: 12,
  },
  onboardingRoot: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  onboardingContent: {
    alignItems: 'center',
    padding: 22,
    paddingBottom: 40,
  },
  onboardingLogo: {
    height: 86,
    marginBottom: 12,
    width: 120,
  },
  onboardingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#552636',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    width: '100%',
  },
  onboardingIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 22,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  onboardingTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 36,
    marginTop: 18,
  },
  onboardingSubtitle: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  onboardingFields: {
    gap: 10,
    marginTop: 18,
  },
  onboardingField: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  onboardingFieldLabel: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  onboardingFieldValue: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
  },
  onboardingAria: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 12,
  },
  onboardingDots: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  onboardingDot: {
    backgroundColor: colors.faint,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  onboardingDotActive: {
    backgroundColor: colors.rose,
    width: 24,
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  onboardingBackButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  onboardingNextButton: {
    flex: 1,
    marginTop: 0,
  },
  scrollContent: {
    alignSelf: 'center',
    paddingBottom: 132,
    paddingHorizontal: 18,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingTop: 14,
  },
  headerGreeting: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerMark: {
    height: 48,
    width: 58,
  },
  headerHello: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
    lineHeight: 28,
  },
  headerSubtext: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  userAvatarButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.goldSoft,
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  userAvatarImage: {
    height: '100%',
    width: '100%',
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
  },
  homeWelcomeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  homeWelcomeTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
    lineHeight: 29,
    marginTop: 4,
  },
  homeWelcomeSubtitle: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    backgroundColor: colors.green,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  liveText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 36,
    marginTop: 16,
  },
  heroMeta: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  homeHeroTop: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    height: 168,
    overflow: 'hidden',
    position: 'relative',
  },
  homeHeroCopy: {
    left: 0,
    minWidth: 0,
    paddingLeft: 0,
    paddingTop: 0,
    position: 'absolute',
    top: 0,
    width: '54%',
    zIndex: 2,
  },
  homeHeroTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 27,
  },
  homeHeroMeta: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    marginTop: 2,
  },
  homeHeroVenue: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  homeHeroLocation: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    lineHeight: 12,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  homeHeroPhoto: {
    height: '100%',
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  homeHeroPhotoWash: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderColor: colors.faint,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  statValue: {
    color: colors.rose,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 24,
  },
  statLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  homeProgressCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  homeProgressLabel: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    lineHeight: 22,
  },
  homeProgressValue: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  homeTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  homeTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '47.8%',
    minHeight: 88,
    padding: 10,
  },
  homeTileIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  homeTileLabel: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    marginTop: 8,
  },
  homeTileValue: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  nextMoveCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: colors.faint,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  nextMoveHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  nextMoveIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 21,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  nextMoveTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  nextMoveDetail: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  nextMoveActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  nextMovePrimary: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nextMovePrimaryText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  nextMoveSecondary: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextMoveSecondaryText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  homeShortcutRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  homeShortcut: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  homeShortcutText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  continueButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.rose,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    width: '100%',
  },
  continueButtonText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 26,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  actionAvatar: {
    height: '100%',
    width: '100%',
  },
  actionCopy: {
    flex: 1,
  },
  overline: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
    lineHeight: 30,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  sectionBody: {
    gap: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#552636',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  checkIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 14,
    borderColor: colors.roseSoft,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  checkIconComplete: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  taskTitleComplete: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  timelineRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  timelineTime: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    minWidth: 70,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 23,
  },
  mutedText: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  ariaCalendarCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  addEventButton: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addEventButtonText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  calendarHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  calendarControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  iconControl: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  todayButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  todayButtonText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  weekHeader: {
    flexDirection: 'row',
    marginTop: 18,
  },
  weekLabel: {
    color: colors.muted,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  dayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: colors.surfaceWarm,
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '13.15%',
    justifyContent: 'center',
    minHeight: 44,
  },
  dayCellMuted: {
    opacity: 0.36,
  },
  dayCellToday: {
    borderColor: colors.gold,
  },
  dayCellSelected: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  dayNumber: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  dayNumberMuted: {
    color: colors.muted,
  },
  dayNumberSelected: {
    color: colors.surface,
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    height: 5,
    marginTop: 4,
  },
  eventDot: {
    backgroundColor: colors.rose,
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  eventDotSelected: {
    backgroundColor: colors.surface,
  },
  calendarList: {
    gap: 10,
    marginTop: 12,
  },
  calendarEventRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  calendarEventIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  calendarEventCopy: {
    flex: 1,
  },
  eventDateLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textAlign: 'right',
    width: 54,
  },
  eventLinkPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E6EEF4',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventLinkText: {
    color: colors.blue,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  websiteHero: {
    borderColor: colors.faint,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
  },
  websiteTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 34,
    marginTop: 18,
  },
  websiteMeta: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  websiteStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  websiteStatusBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  websiteStatusBadgeConnected: {
    borderColor: '#CFE3CD',
  },
  websiteStatusBadgeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  websiteStatusBadgeTextConnected: {
    color: colors.green,
  },
  accountSyncCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 16,
    padding: 14,
  },
  previewMiniButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  previewMiniButtonText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  mobileEditorGuidance: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF9EA',
    borderColor: '#E9C978',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    padding: 12,
  },
  mobileEditorGuidanceIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  mobileEditorGuidanceTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    lineHeight: 18,
  },
  desktopStudioNotice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF9EA',
    borderColor: '#E9C978',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
  websiteEditorPreviewGrid: {
    gap: 14,
    marginTop: 16,
  },
  websiteEditorTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 16,
  },
  websiteEditorTab: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '31.4%',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  websiteEditorTabActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  websiteEditorTabText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  websiteEditorTabTextActive: {
    color: colors.surface,
  },
  websiteEditorControls: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 12,
    padding: 12,
  },
  websiteEditorToolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  websiteEditorToolButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  websiteEditorToolText: {
    color: colors.rose,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    lineHeight: 14,
  },
  websiteEditorThemeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  websiteEditorThemeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  websiteEditorThemeButtonActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  websiteEditorThemeSwatch: {
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    borderWidth: 1,
    height: 14,
    width: 14,
  },
  websiteEditorToggleRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  mockSwitch: {
    backgroundColor: '#E9DDE1',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 44,
  },
  mockSwitchActive: {
    backgroundColor: colors.rose,
  },
  mockSwitchThumb: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 18,
    width: 18,
  },
  mockSwitchThumbActive: {
    alignSelf: 'flex-end',
  },
  websiteEditorRail: {
    gap: 8,
  },
  websiteEditorRailItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 10,
  },
  websiteEditorRailDot: {
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  websiteEditorRailDotLive: {
    backgroundColor: colors.green,
  },
  websiteEditorRailTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  websiteEditorRailMeta: {
    color: colors.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    marginTop: 2,
  },
  websitePreviewDevice: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: 34,
    maxWidth: 282,
    padding: 8,
    paddingTop: 14,
    width: '84%',
  },
  websitePreviewIsland: {
    alignSelf: 'center',
    backgroundColor: '#050405',
    borderRadius: 999,
    height: 18,
    marginBottom: 7,
    width: 82,
  },
  websitePreviewScreen: {
    backgroundColor: '#FFF8F5',
    borderRadius: 24,
    height: 410,
    overflow: 'hidden',
  },
  websitePreviewScreenContent: {
    paddingBottom: 16,
  },
  websitePreviewHeroPhoto: {
    height: 142,
    width: '100%',
  },
  websitePreviewHeroCopy: {
    alignItems: 'center',
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  websitePreviewKicker: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  websitePreviewNames: {
    color: colors.ink,
    fontFamily: 'GreatVibes_400Regular',
    fontSize: 38,
    lineHeight: 43,
    marginTop: 5,
    textAlign: 'center',
  },
  websitePreviewMeta: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  websitePreviewLocation: {
    color: colors.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  websitePreviewRsvpButton: {
    backgroundColor: colors.rose,
    borderRadius: 999,
    marginTop: 13,
    paddingHorizontal: 28,
    paddingVertical: 9,
  },
  websitePreviewRsvpText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  websitePreviewNav: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  websitePreviewNavText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  websitePreviewBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
  },
  websitePreviewBlockTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 17,
  },
  websitePreviewBlockText: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  websitePreviewHomeIndicator: {
    alignSelf: 'center',
    backgroundColor: '#EBE1DE',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 90,
  },
  websiteLivePreviewWrap: {
    alignSelf: 'center',
    gap: 10,
    width: '100%',
  },
  websitePreviewModeRow: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  websitePreviewModeButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  websitePreviewModeButtonActive: {
    backgroundColor: colors.rose,
  },
  websitePreviewModeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  websitePreviewModeTextActive: {
    color: colors.surface,
  },
  websitePreviewDeviceHint: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  websiteLivePreviewFrame: {
    alignSelf: 'center',
    width: 288,
  },
  websiteLivePreviewFrameDesktop: {
    backgroundColor: '#F7ECE8',
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  websiteDesktopChrome: {
    alignItems: 'center',
    backgroundColor: '#F1E4E0',
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  websiteDesktopDots: {
    flexDirection: 'row',
    gap: 4,
  },
  websiteDesktopDot: {
    backgroundColor: '#CDA8A0',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  websiteDesktopUrl: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.muted,
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  websiteLivePreviewPage: {
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    maxHeight: 520,
    overflow: 'hidden',
  },
  websiteLivePreviewPageMobile: {
    alignSelf: 'center',
    width: 288,
  },
  websiteLivePreviewPageDesktop: {
    borderRadius: 0,
    borderWidth: 0,
    maxHeight: 560,
    width: '100%',
  },
  websiteLiveAnnouncement: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  websiteLiveAnnouncementText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  websiteLiveNav: {
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  websiteLiveNavDesktop: {
    gap: 9,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  websiteLiveNavCouple: {
    fontSize: 28,
    lineHeight: 31,
    textAlign: 'center',
  },
  websiteLiveNavCoupleDesktop: {
    fontSize: 34,
    lineHeight: 37,
    textAlign: 'center',
  },
  websiteLiveNavItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  websiteLiveNavItemsDesktop: {
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  websiteLiveNavText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  websiteLiveHero: {
    alignItems: 'center',
    height: 330,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  websiteLiveHeroDesktop: {
    height: 340,
  },
  websiteLiveHeroImage: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  websiteLiveHeroOverlay: {
    backgroundColor: 'rgba(39,27,34,0.36)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  websiteLiveHeroCopy: {
    alignItems: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  websiteLiveHeroCopyDesktop: {
    maxWidth: 340,
    paddingHorizontal: 18,
  },
  websiteLiveKicker: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
  },
  websiteLiveHeroNames: {
    color: colors.surface,
    fontSize: 50,
    lineHeight: 56,
    marginTop: 8,
    textAlign: 'center',
  },
  websiteLiveHeroNamesDesktop: {
    fontSize: 46,
    lineHeight: 52,
  },
  websiteLiveHeroMeta: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  websiteLiveHeroDetailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  websiteLiveCountdownRow: {
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 13,
  },
  websiteLiveCountdownPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 45,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  websiteLiveCountdownNumber: {
    color: colors.surface,
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 12,
    lineHeight: 15,
  },
  websiteLiveCountdownLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'Inter_700Bold',
    fontSize: 7,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  websiteLiveCalendarButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.36)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  websiteLiveCalendarButtonText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  websiteLiveHeroButton: {
    borderRadius: 999,
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  websiteLiveHeroButtonText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  websiteLiveSection: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
    width: '100%',
  },
  websiteLiveSectionDesktop: {
    maxWidth: 300,
    paddingVertical: 28,
  },
  websiteLiveSectionTitle: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  websiteLiveSectionText: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  websiteLiveSectionTextDesktop: {
    fontSize: 12,
    lineHeight: 19,
  },
  websiteLiveScheduleList: {
    gap: 8,
    marginTop: 14,
  },
  websiteLiveScheduleListDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  websiteLiveScheduleItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  websiteLiveScheduleTime: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    width: 62,
  },
  websiteLiveScheduleLabel: {
    color: colors.ink,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  websiteLiveRsvpButton: {
    alignSelf: 'center',
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  websiteLiveFooter: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  websiteLiveFooterText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  guestHubSwitch: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
  },
  guestHubSwitchButton: {
    alignItems: 'center',
    borderRadius: 15,
    flexBasis: '31.8%',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 6,
    paddingVertical: 9,
  },
  guestHubSwitchButtonActive: {
    backgroundColor: colors.rose,
  },
  guestHubSwitchText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  guestHubSwitchTextActive: {
    color: colors.surface,
  },
  websiteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  primaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  disabledActionButton: {
    opacity: 0.5,
  },
  primaryActionText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  secondaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallStatus: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  websitePageRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  websitePageIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  guestListRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  guestListIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  websitePageTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  websiteStatusPill: {
    borderRadius: 999,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  inviteStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  invitationStudioPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginTop: 14,
    padding: 14,
  },
  studioToolbar: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  studioSegmentGroup: {
    gap: 8,
  },
  studioSegmentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  studioSegmentButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  studioSegmentButtonActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  studioSegmentText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  studioSegmentTextActive: {
    color: colors.surface,
  },
  studioFinishGroup: {
    gap: 8,
  },
  studioSendButton: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  invitationPreviewShell: {
    gap: 12,
  },
  studioPreviewHeader: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  studioPreviewEyebrow: {
    color: colors.rose,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  studioPreviewTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  studioPreviewWorkspace: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  studioToolRail: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 6,
  },
  studioToolButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 7,
    width: 58,
  },
  studioToolButtonActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  studioToolText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    textAlign: 'center',
  },
  studioToolTextActive: {
    color: colors.surface,
  },
  invitationDeviceFrame: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderColor: '#141014',
    borderRadius: 32,
    borderWidth: 3,
    maxWidth: 272,
    padding: 9,
    paddingTop: 14,
    shadowColor: '#271B22',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '82%',
  },
  iphoneIsland: {
    alignSelf: 'center',
    backgroundColor: '#050405',
    borderRadius: 999,
    height: 20,
    marginBottom: 8,
    width: 86,
  },
  iphoneScreen: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    height: 378,
    overflow: 'hidden',
  },
  invitationPreviewScrollContent: {
    flexGrow: 1,
  },
  invitationCanvas: {
    alignItems: 'center',
    minHeight: 378,
    overflow: 'hidden',
    padding: 16,
    paddingTop: 20,
  },
  websiteSaveDateCanvas: {
    backgroundColor: '#FFF7F2',
    padding: 0,
    paddingTop: 0,
  },
  websiteSaveDateCard: {
    backgroundColor: '#FFF7F2',
    borderColor: 'rgba(230,166,183,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  websiteSaveDateTop: {
    alignItems: 'center',
    backgroundColor: '#FFF7F2',
    overflow: 'hidden',
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    position: 'relative',
  },
  dottedPaper: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dottedPaperDot: {
    borderRadius: 999,
    height: 2,
    position: 'absolute',
    width: 2,
  },
  websiteSaveDateKicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 3.1,
    lineHeight: 15,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  websiteSaveDatePhotoWrap: {
    backgroundColor: '#FFF7F2',
    height: 132,
    overflow: 'hidden',
    width: '100%',
  },
  websiteSaveDatePhoto: {
    height: '100%',
    width: '100%',
  },
  websiteRsvpPhotoWrap: {
    backgroundColor: '#FFF7F2',
    height: 132,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  websiteSaveDateBody: {
    alignItems: 'center',
    backgroundColor: '#FFF7F2',
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 24,
    paddingTop: 16,
    position: 'relative',
    width: '100%',
  },
  websiteSaveDateNames: {
    fontFamily: 'GreatVibes_400Regular',
    fontSize: 37,
    lineHeight: 43,
    marginBottom: 12,
    textAlign: 'center',
  },
  websiteSaveDateDivider: {
    backgroundColor: 'rgba(230,166,183,0.55)',
    height: 1,
    marginBottom: 14,
    width: '84%',
  },
  websiteSaveDateDate: {
    color: '#3B1C2B',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.1,
    lineHeight: 15,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  websiteSaveDateLocation: {
    color: '#3B1C2B',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  websiteSaveDateMessage: {
    color: '#3B1C2B',
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
    marginTop: 14,
    textAlign: 'center',
  },
  websiteSaveDateHotel: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: '100%',
  },
  websiteSaveDateHotelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginBottom: 7,
  },
  websiteSaveDateHotelTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  websiteSaveDateHotelQuestion: {
    color: '#3B1C2B',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  websiteSaveDateSelect: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: 'rgba(230,166,183,0.55)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  websiteSaveDateSelectText: {
    color: '#3B1C2B',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  websiteSaveDateHotelButton: {
    borderRadius: 8,
    color: '#FFF7F2',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    marginTop: 8,
    overflow: 'hidden',
    paddingVertical: 8,
    textAlign: 'center',
  },
  websiteSaveDateFormal: {
    color: '#6F3E54',
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 14,
    textAlign: 'center',
  },
  websiteSaveDateDownload: {
    backgroundColor: 'rgba(141,41,77,0.10)',
    borderRadius: 6,
    borderWidth: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 16,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  websiteSaveDateFooter: {
    alignItems: 'center',
    borderTopColor: 'rgba(230,166,183,0.55)',
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 12,
    width: '100%',
  },
  websiteSaveDateLogo: {
    height: 24,
    marginBottom: 6,
    width: 82,
  },
  websiteSaveDateFooterText: {
    color: '#6F3E54',
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    textAlign: 'center',
  },
  websiteSaveDateFooterLink: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    marginTop: 2,
    textAlign: 'center',
  },
  websiteRsvpBody: {
    alignItems: 'center',
    backgroundColor: '#FFF7F2',
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 24,
    paddingTop: 16,
    position: 'relative',
    width: '100%',
  },
  websiteRsvpBadge: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
    width: 52,
  },
  websiteRsvpKicker: {
    marginTop: 0,
  },
  websiteRsvpDetails: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderBottomColor: 'rgba(230,166,183,0.55)',
    borderBottomWidth: 1,
    borderTopColor: 'rgba(230,166,183,0.55)',
    borderTopWidth: 1,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: '100%',
  },
  websiteRsvpVenueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  websiteRsvpVenue: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  websiteRsvpAddress: {
    color: '#3B1C2B',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  websiteRsvpCity: {
    color: '#6F3E54',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  websiteRsvpTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 9,
  },
  websiteRsvpTimePill: {
    borderRadius: 999,
    borderWidth: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 0.6,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  websiteRsvpBy: {
    borderRadius: 6,
    color: '#FFF7F2',
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 0.8,
    marginTop: 10,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  websiteRsvpGuestLine: {
    color: '#6F3E54',
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
    textAlign: 'center',
  },
  websiteRsvpGuestName: {
    color: '#3B1C2B',
    fontFamily: 'Inter_600SemiBold',
  },
  websiteRsvpDivider: {
    backgroundColor: 'rgba(230,166,183,0.55)',
    height: 1,
    marginVertical: 14,
    width: '94%',
  },
  websiteRsvpButton: {
    borderRadius: 8,
    color: '#FFF7F2',
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    overflow: 'hidden',
    paddingVertical: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
  },
  websiteRsvpButtonPressable: {
    width: '100%',
  },
  iphoneHomeIndicator: {
    alignSelf: 'center',
    backgroundColor: '#F6EEF0',
    borderRadius: 999,
    height: 4,
    marginTop: 10,
    width: 92,
  },
  invitationPreviewPhoto: {
    borderColor: colors.surface,
    borderRadius: 18,
    borderWidth: 3,
    height: 140,
    marginBottom: 14,
    width: '100%',
  },
  invitationSaveDatePhoto: {
    borderRadius: 8,
    height: 132,
    marginBottom: 18,
    marginTop: 14,
    width: '100%',
  },
  invitationHeartBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    marginBottom: 8,
    width: 36,
  },
  invitationPreviewKicker: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  invitationPreviewNames: {
    color: colors.ink,
    fontFamily: 'GreatVibes_400Regular',
    fontSize: 40,
    lineHeight: 46,
    marginTop: 10,
    textAlign: 'center',
  },
  invitationDivider: {
    backgroundColor: colors.gold,
    height: 1,
    marginBottom: 14,
    marginTop: 14,
    opacity: 0.6,
    width: 84,
  },
  invitationDateLine: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  invitationPreviewMeta: {
    color: colors.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  invitationDetailsPanel: {
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderBottomColor: colors.goldSoft,
    borderBottomWidth: 1,
    borderTopColor: colors.goldSoft,
    borderTopWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: '100%',
  },
  invitationVenue: {
    color: colors.rose,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  invitationPreviewMessage: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'center',
  },
  invitationRsvpBy: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  invitationGuestLine: {
    color: colors.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
    textAlign: 'center',
  },
  invitationFormalLine: {
    color: colors.muted,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  invitationPreviewButton: {
    backgroundColor: colors.rose,
    borderRadius: 999,
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  invitationPrintQr: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderColor: colors.goldSoft,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  invitationHotelBox: {
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderColor: colors.goldSoft,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
    width: '100%',
  },
  invitationBackPreview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  qrMock: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  colorSwatchButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  colorSwatchButtonActive: {
    borderColor: colors.rose,
    borderWidth: 2,
  },
  colorSwatch: {
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  colorSwatchLabel: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  studioSettingsCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  studioMessageMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resetTemplateText: {
    color: colors.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  aiMessageBox: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  aiMessageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  aiMessageAvatar: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 42,
  },
  aiMessageAvatarImage: {
    height: 42,
    width: 42,
  },
  studioPhotoPreview: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 150,
    overflow: 'hidden',
  },
  studioPhotoOverlayTools: {
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    right: 10,
    top: 10,
  },
  photoOverlayButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(39,27,34,0.72)',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  photoOverlayDangerButton: {
    backgroundColor: '#D94B56',
  },
  studioPhotoImage: {
    height: 150,
    width: '100%',
  },
  studioPhotoTools: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 10,
    width: '100%',
  },
  iconMiniButton: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  fontStepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  fontSizeValueBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 76,
    paddingHorizontal: 12,
  },
  fontSizeValue: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  plannerSwitch: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    padding: 5,
    width: '100%',
  },
  plannerSwitchButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  plannerSwitchButtonActive: {
    backgroundColor: colors.rose,
  },
  plannerSwitchText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  plannerSwitchTextActive: {
    color: colors.surface,
  },
  registryPreview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 12,
  },
  registryIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 15,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  registryProviderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  registryProvider: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  registryProviderText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  photoDropControlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  photoDropControl: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    minHeight: 118,
    padding: 12,
  },
  photoDropControlIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    marginBottom: 10,
    width: 34,
  },
  photoDropControlLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  photoDropControlValue: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  photoDropMobileCard: {
    gap: 14,
  },
  photoDropTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  photoDropTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  photoDropHeroIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  photoDropTabRow: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 5,
  },
  photoDropTab: {
    alignItems: 'center',
    borderRadius: 13,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 38,
  },
  photoDropTabActive: {
    backgroundColor: colors.rose,
  },
  photoDropTabText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  photoDropTabTextActive: {
    color: colors.surface,
  },
  photoDropPanel: {
    gap: 12,
  },
  photoDropShareCard: {
    alignItems: 'center',
    borderColor: colors.roseSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  photoDropQrBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  photoDropQuickStats: {
    flexDirection: 'row',
    gap: 8,
  },
  photoDropMiniStat: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 70,
    padding: 10,
  },
  photoDropUploadList: {
    gap: 10,
  },
  photoDropUploadRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  photoDropThumb: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  photoDropSettingRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  hotelBlockRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  hotelIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  partyMemberRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  partyAvatar: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderColor: '#DFA6B8',
    borderRadius: 18,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  partyAvatarText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  partyTaskWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  partyTaskPill: {
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  progressTrack: {
    backgroundColor: colors.roseSoft,
    borderRadius: 999,
    height: 10,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.rose,
    borderRadius: 999,
    height: '100%',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  budgetSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  summaryCardWide: {
    flexBasis: '47%',
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    lineHeight: 30,
  },
  summaryValueCompact: {
    fontSize: 23,
    lineHeight: 28,
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  moneyRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  moneyValue: {
    color: colors.ink,
    flexShrink: 1,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    lineHeight: 39,
  },
  moneyMeta: {
    color: colors.muted,
    flexShrink: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginBottom: 8,
  },
  financeHero: {
    borderColor: colors.faint,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
  },
  financeTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 29,
    lineHeight: 34,
    marginTop: 4,
    maxWidth: 240,
  },
  financeBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  financeBadgeText: {
    color: colors.green,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  vendorHero: {
    borderColor: colors.faint,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
  },
  vendorHeroTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 29,
    lineHeight: 34,
    marginTop: 16,
  },
  vendorHeroText: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  financeRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  financeRowIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  financeSwitch: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    padding: 5,
  },
  financeSwitchButton: {
    alignItems: 'center',
    borderRadius: 15,
    flexBasis: '31.8%',
    flexGrow: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 6,
    paddingVertical: 9,
  },
  contractReviewRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  contractRiskIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  contractRiskLow: {
    backgroundColor: '#E6EFE5',
  },
  contractRiskMedium: {
    backgroundColor: colors.goldSoft,
  },
  contractRiskHigh: {
    backgroundColor: '#F7D7D2',
  },
  documentLibraryRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  documentIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  financeSwitchButtonActive: {
    backgroundColor: colors.rose,
  },
  financeSwitchText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  financeSwitchTextActive: {
    color: colors.surface,
  },
  addPaymentMiniButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addPaymentMiniText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  budgetFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  budgetFilterChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  budgetFilterChipActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  budgetFilterText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  budgetFilterTextActive: {
    color: colors.surface,
  },
  budgetLineCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
  },
  budgetStatusPill: {
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  budgetStatusPillPaid: {
    backgroundColor: '#E6EFE5',
  },
  budgetHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  miscIconDeleteButton: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 14,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  budgetStatusText: {
    color: colors.gold,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  budgetStatusTextPaid: {
    color: colors.green,
  },
  budgetLineMoneyRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetLineMoney: {
    color: colors.muted,
    flexShrink: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  nextPaymentStrip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    padding: 10,
  },
  nextPaymentStripText: {
    color: colors.ink,
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 17,
  },
  miscNoteText: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 9,
  },
  receiptPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E6EEF4',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  receiptPillText: {
    color: colors.blue,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  paymentActionRow: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  paymentActionMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  paymentActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  paymentSmallPrimary: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 15,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    paddingVertical: 10,
  },
  paymentSmallPrimaryText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  paymentSmallSecondary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingVertical: 10,
  },
  paymentSmallSecondaryText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  paymentPaidPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E6EFE5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  paymentPaidText: {
    color: colors.green,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  vendorContactCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  vendorContactMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  vendorContactActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  vendorMessageButton: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 15,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  vendorMessageText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  vendorDetailsButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  vendorDetailsText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  vendorTrackerCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  vendorTrackerMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  vendorPaymentStrip: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 12,
    padding: 11,
  },
  vendorPaymentText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  noContractStrip: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderColor: colors.rose,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    padding: 11,
  },
  noContractTitle: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  vendorQuickGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  vendorQuickButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  vendorQuickText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  vendorMessageRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 12,
  },
  aiDraftCard: {
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  aiDraftHeader: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  aiDraftAvatar: {
    borderRadius: 19,
    height: 38,
    width: 38,
  },
  aiBadge: {
    backgroundColor: colors.roseSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  aiBadgeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  aiToneRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
  },
  aiTonePill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  aiTonePillActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  aiToneText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  aiToneTextActive: {
    color: colors.surface,
  },
  aiPromptGrid: {
    gap: 8,
    marginTop: 12,
  },
  aiPromptButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  aiPromptButtonText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  schedulePaymentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  deletePaymentButton: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 15,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  groupBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hubRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  hubIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  hubCopy: {
    flex: 1,
  },
  hubLabel: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  hubDetail: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  tabShell: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 30,
    borderWidth: 1,
    bottom: 18,
    flexDirection: 'row',
    gap: 0,
    justifyContent: 'space-between',
    left: 14,
    maxWidth: 540,
    padding: 7,
    position: 'absolute',
    right: 14,
    shadowColor: '#552636',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  tabIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 38,
  },
  tabIconActive: {
    backgroundColor: colors.roseSoft,
  },
  tabLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  tabLabelActive: {
    color: colors.rose,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    backgroundColor: 'rgba(39,27,34,0.28)',
    flex: 1,
  },
  containedModalBackdrop: {
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  containedModalScrim: {
    backgroundColor: 'rgba(39,27,34,0.28)',
    flex: 1,
  },
  ariaPanel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '78%',
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#271B22',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  ariaPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  ariaPanelAvatar: {
    borderColor: colors.roseSoft,
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  ariaHeaderActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ariaHeaderActionText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  ariaMessage: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  ariaMessageText: {
    color: colors.ink,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
  },
  ariaWorkspace: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    minHeight: 292,
    padding: 14,
  },
  ariaChatPane: {
    flex: 1,
    minWidth: 0,
  },
  ariaActiveTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  ariaHistoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  ariaConversationList: {
    gap: 8,
    marginTop: 10,
  },
  ariaConversationCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  ariaConversationIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  ariaConversationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  ariaConversationTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  ariaConversationTime: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  ariaConversationSummary: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  ariaMessageThread: {
    gap: 5,
    marginTop: 8,
  },
  ariaThreadBubble: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: 10,
    color: colors.ink,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ariaThreadBubbleUser: {
    backgroundColor: colors.roseSoft,
  },
  ariaPromptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 7,
  },
  ariaPrompt: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '47%',
    padding: 9,
  },
  ariaPromptText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    lineHeight: 14,
  },
  ariaInputMock: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ariaComposerBlock: {
    marginTop: 10,
  },
  ariaComposerLabel: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  ariaTextInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    maxHeight: 76,
    minHeight: 34,
    paddingRight: 10,
  },
  ariaSendButton: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  ariaSendButtonDisabled: {
    backgroundColor: colors.roseSoft,
  },
  mockModalBackdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  mockModalScrim: {
    backgroundColor: 'rgba(39,27,34,0.3)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  mockModalCard: {
    backgroundColor: colors.bg,
    borderColor: colors.faint,
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#271B22',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    width: '100%',
  },
  actionWorkspace: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    padding: 12,
  },
  workspaceRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  guestFlowStep: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  guestFlowStepIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  saveDateGuestPreview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  saveDateGuestNames: {
    color: colors.rose,
    fontFamily: 'GreatVibes_400Regular',
    fontSize: 34,
    lineHeight: 39,
    textAlign: 'center',
  },
  savedStrip: {
    alignItems: 'center',
    backgroundColor: '#E6EFE5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  savedStripText: {
    color: colors.green,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  accountHeader: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  accountAvatar: {
    borderColor: colors.goldSoft,
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    width: 56,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: colors.rose,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  mockModalIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    marginBottom: 14,
    width: 48,
  },
  vendorPanel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '84%',
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#271B22',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  vendorMetricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  vendorInfoList: {
    gap: 10,
    marginTop: 16,
  },
  vendorInfoRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  seatingGeneratorCard: {
    gap: 14,
    marginTop: 14,
  },
  seatingTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  seatingSparkIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  seatingControlsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  seatingStepper: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  seatingStepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seatingStepButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  seatingStepValue: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
  },
  seatingCapacityCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
  },
  seatingCapacityValue: {
    color: colors.rose,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 35,
  },
  seatingNotesInput: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  seatingResultBlock: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 14,
  },
  seatingInsightRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  seatingInsightText: {
    color: colors.muted,
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  seatingWarningRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    marginTop: 6,
  },
  seatingWarningText: {
    color: colors.rose,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 17,
  },
  seatingFloorPlan: {
    borderColor: colors.roseSoft,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 13,
  },
  seatingFloorTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    lineHeight: 27,
  },
  seatingCapacityBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seatingCapacityBadgeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  seatingOverviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seatingOverviewBubble: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 66,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  seatingOverviewBubbleActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  seatingOverviewNumber: {
    color: colors.rose,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 27,
  },
  seatingOverviewNumberActive: {
    color: colors.surface,
  },
  seatingOverviewMeta: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  seatingOverviewMetaActive: {
    color: colors.surface,
  },
  seatingOverviewTag: {
    color: colors.gold,
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 0.7,
    marginTop: 2,
  },
  seatingOverviewTagActive: {
    color: colors.surface,
  },
  seatingSelectedNav: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  seatingNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  seatingNavButtonDisabled: {
    opacity: 0.48,
  },
  seatingNavText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  seatingNavTextDisabled: {
    color: colors.muted,
  },
  seatingSelectedLabel: {
    color: colors.muted,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  seatingTableList: {
    gap: 12,
    marginTop: 4,
  },
  seatingPreviewCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 11,
    shadowColor: '#8D294D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
  },
  seatingPreviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  seatingPreviewEyebrow: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  seatingPreviewName: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginTop: 4,
  },
  seatingPreviewTheme: {
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  seatingTableBadge: {
    backgroundColor: colors.roseSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  seatingTableBadgeWarning: {
    backgroundColor: '#F7D7D2',
  },
  seatingTableBadgeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  seatingTableBadgeTextWarning: {
    color: '#B42318',
  },
  seatingPreviewBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  seatingRoundStage: {
    flexShrink: 0,
    position: 'relative',
  },
  seatingRoundTable: {
    alignItems: 'center',
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#8D294D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  seatingDashedRing: {
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1,
    bottom: 18,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 18,
  },
  seatingRoundTableNumber: {
    color: colors.rose,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 34,
  },
  seatingRoundTableSeats: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  seatingRoundSeat: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#8D294D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  seatingRoundSeatFilled: {
    backgroundColor: colors.roseSoft,
    borderColor: '#DFA6B8',
  },
  seatingRoundSeatText: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  seatingRoundSeatTextFilled: {
    color: colors.rose,
  },
  seatingGuestRoster: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: colors.roseSoft,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  seatingRosterHeader: {
    backgroundColor: colors.roseSoft,
    borderBottomColor: colors.roseSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  seatingRosterHeaderAlt: {
    backgroundColor: colors.goldSoft,
  },
  seatingRosterRow: {
    borderTopColor: colors.roseSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  seatingRosterRowFilled: {
    backgroundColor: 'rgba(248,221,229,0.3)',
  },
  seatingRosterNumber: {
    borderRightColor: colors.roseSoft,
    borderRightWidth: 1,
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    paddingHorizontal: 7,
    paddingVertical: 7,
    width: 30,
  },
  seatingRosterGuest: {
    color: colors.muted,
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  seatingRosterGuestFilled: {
    color: colors.ink,
  },
  seatingRosterMoveIcon: {
    alignSelf: 'center',
    marginRight: 7,
  },
  seatingOverflowText: {
    backgroundColor: '#F7D7D2',
    color: '#B42318',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  seatingDragHint: {
    color: colors.rose,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  seatingMoveSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  seatingMoveTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  seatingMoveClose: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  seatingMoveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seatingMoveOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.roseSoft,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  seatingMoveOptionCurrent: {
    backgroundColor: colors.roseSoft,
  },
  seatingMoveOptionFull: {
    borderColor: colors.goldSoft,
  },
  seatingMoveOptionNumber: {
    color: colors.rose,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    lineHeight: 25,
  },
  seatingMoveOptionNumberCurrent: {
    color: colors.muted,
  },
  seatingMoveOptionMeta: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  formStack: {
    gap: 12,
    marginTop: 16,
  },
  formLabel: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabledInput: {
    backgroundColor: '#F7F1EF',
    color: colors.muted,
  },
  messageInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  eventTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventTypePill: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventTypePillActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  eventTypeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  eventTypeTextActive: {
    color: colors.surface,
  },
});
