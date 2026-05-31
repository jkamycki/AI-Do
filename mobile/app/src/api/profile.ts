import { PlanningData } from '../types';
import { mobileAuthFetch } from './mobileAuth';

function mobileProfilePayload(profile: PlanningData['profile'], settings?: PlanningData['settings']) {
  const [partner1Name = profile.partnerOne || 'Partner 1', partner2Name = profile.partnerTwo || 'Partner 2'] =
    profile.coupleName.split(/\s*&\s*|\s+\+\s+/).map((part) => part.trim()).filter(Boolean);

  return {
    accountType: 'couple_individual',
    ariaMemory: settings?.ariaMemory,
    ceremonyAtVenue: true,
    ceremonyTime: '17:00',
    guestCount: profile.guestTarget,
    location: profile.location,
    partner1Name: profile.partnerOne || partner1Name,
    partner2Name: profile.partnerTwo || partner2Name,
    planningPriorities: {
      mustAvoids: profile.priorities.mustAvoid,
      mustHaves: profile.priorities.mustHave,
      niceToHaves: profile.priorities.niceToHave,
    },
    preferredLanguage: 'English',
    receptionTime: '18:00',
    ...(settings
      ? {
          rsvpEmailNotificationsEnabled: settings.rsvpEmailForwardingEnabled,
          rsvpNotificationEmails: settings.rsvpResponseEmails,
          taskEmailRemindersEnabled: settings.emailRemindersEnabled,
          taskReminderDaysBefore: settings.deadlineReminderDays,
        }
      : {
          taskEmailRemindersEnabled: profile.notificationsEnabled,
        }),
    totalBudget: profile.totalBudget,
    venue: profile.venue,
    venueStatus: profile.venueStatus === 'Booked' ? 'booked' : profile.venueStatus === 'Looking' ? 'deciding' : 'not_yet',
    weddingDate: profile.weddingDate.slice(0, 10),
    weddingVibe: 'Classic wedding',
    workstationName: `${profile.partnerOne || partner1Name} & ${profile.partnerTwo || partner2Name}`,
  };
}

async function postMobileProfile(payload: ReturnType<typeof mobileProfilePayload>) {
  const response = await mobileAuthFetch('/api/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response) return { synced: false, reason: 'auth-unavailable' as const };
  if (!response.ok) {
    let message = 'Could not save profile.';
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }
  return { synced: true as const };
}

export async function saveMobileProfile(profile: PlanningData['profile'], settings?: PlanningData['settings']) {
  return postMobileProfile(mobileProfilePayload(profile, settings));
}

export async function saveMobileSettings(profile: PlanningData['profile'], settings: PlanningData['settings']) {
  return postMobileProfile(mobileProfilePayload(profile, settings));
}
