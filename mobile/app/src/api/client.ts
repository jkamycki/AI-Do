import { samplePlanningData } from '../data/sampleData';
import { PlanningData } from '../types';
import { mobileAuthFetch } from './mobileAuth';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await mobileAuthFetch(path);
    if (!response) return null;

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getPlanningData(): Promise<PlanningData> {
  const bundled = await getRemotePlanningData();
  return mergePlanningData(bundled ?? {});
}

export function mergePlanningData(partial: Partial<PlanningData>): PlanningData {
  return {
    profile: {
      ...samplePlanningData.profile,
      ...partial.profile,
      priorities: {
        ...samplePlanningData.profile.priorities,
        ...partial.profile?.priorities,
      },
    },
    vendors: partial.vendors ?? samplePlanningData.vendors,
    budget: partial.budget ?? samplePlanningData.budget,
    guests: partial.guests ?? samplePlanningData.guests,
    tasks: partial.tasks ?? samplePlanningData.tasks,
    documents: partial.documents ?? samplePlanningData.documents,
    contracts: partial.contracts ?? samplePlanningData.contracts,
    weddingParty: partial.weddingParty ?? samplePlanningData.weddingParty,
    hotels: partial.hotels ?? samplePlanningData.hotels,
    seating: partial.seating ?? samplePlanningData.seating,
    dayOf: partial.dayOf ?? samplePlanningData.dayOf,
    dayOfChecklist: partial.dayOfChecklist ?? samplePlanningData.dayOfChecklist,
    websiteSections: partial.websiteSections ?? samplePlanningData.websiteSections,
    invitations: partial.invitations ?? samplePlanningData.invitations,
    ariaMessages: partial.ariaMessages ?? samplePlanningData.ariaMessages,
    workspaceInvites: partial.workspaceInvites ?? samplePlanningData.workspaceInvites,
    helpResources: partial.helpResources ?? samplePlanningData.helpResources,
    settings: {
      ...samplePlanningData.settings,
      ...partial.settings,
    },
    activityLog: partial.activityLog ?? samplePlanningData.activityLog,
    guestPhotoDrop: {
      ...samplePlanningData.guestPhotoDrop,
      ...partial.guestPhotoDrop,
    },
    guestPhotoUploads: partial.guestPhotoUploads ?? samplePlanningData.guestPhotoUploads,
  };
}

export async function getRemotePlanningData(): Promise<Partial<PlanningData> | null> {
  const bundled = await readJson<Partial<PlanningData>>('/api/mobile/planning');
  if (bundled?.profile) {
    return bundled;
  }

  const [
    profile,
    vendors,
    budget,
    guests,
    tasks,
    documents,
    contracts,
    weddingParty,
    hotels,
    seating,
    dayOf,
    dayOfChecklist,
    websiteSections,
    invitations,
    workspaceInvites,
    activityLog,
    guestPhotoDrop,
    guestPhotoUploads,
  ] = await Promise.all([
    readJson<PlanningData['profile']>('/api/mobile/profile'),
    readJson<PlanningData['vendors']>('/api/mobile/vendors'),
    readJson<PlanningData['budget']>('/api/mobile/budget'),
    readJson<PlanningData['guests']>('/api/mobile/guests'),
    readJson<PlanningData['tasks']>('/api/mobile/tasks'),
    readJson<PlanningData['documents']>('/api/mobile/documents'),
    readJson<PlanningData['contracts']>('/api/mobile/contracts'),
    readJson<PlanningData['weddingParty']>('/api/mobile/wedding-party'),
    readJson<PlanningData['hotels']>('/api/mobile/hotels'),
    readJson<PlanningData['seating']>('/api/mobile/seating'),
    readJson<PlanningData['dayOf']>('/api/mobile/day-of'),
    readJson<PlanningData['dayOfChecklist']>('/api/mobile/day-of-checklist'),
    readJson<PlanningData['websiteSections']>('/api/mobile/website-sections'),
    readJson<PlanningData['invitations']>('/api/mobile/invitations'),
    readJson<PlanningData['workspaceInvites']>('/api/mobile/workspace-invites'),
    readJson<PlanningData['activityLog']>('/api/mobile/activity-log'),
    readJson<PlanningData['guestPhotoDrop']>('/api/mobile/guest-photo-drop'),
    readJson<PlanningData['guestPhotoUploads']>('/api/mobile/guest-photo-uploads'),
  ]);

  if (
    !profile &&
    !vendors &&
    !budget &&
    !guests &&
    !tasks &&
    !documents &&
    !contracts &&
    !weddingParty &&
    !hotels &&
    !seating &&
    !dayOf &&
    !dayOfChecklist &&
    !websiteSections &&
    !invitations &&
    !workspaceInvites &&
    !activityLog &&
    !guestPhotoDrop &&
    !guestPhotoUploads
  ) {
    return null;
  }

  return {
    profile: profile ?? undefined,
    vendors: vendors ?? undefined,
    budget: budget ?? undefined,
    guests: guests ?? undefined,
    tasks: tasks ?? undefined,
    documents: documents ?? undefined,
    contracts: contracts ?? undefined,
    weddingParty: weddingParty ?? undefined,
    hotels: hotels ?? undefined,
    seating: seating ?? undefined,
    dayOf: dayOf ?? undefined,
    dayOfChecklist: dayOfChecklist ?? undefined,
    websiteSections: websiteSections ?? undefined,
    invitations: invitations ?? undefined,
    workspaceInvites: workspaceInvites ?? undefined,
    activityLog: activityLog ?? undefined,
    guestPhotoDrop: guestPhotoDrop ?? undefined,
    guestPhotoUploads: guestPhotoUploads ?? undefined,
  };
}
