import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Guests from "./Guests";
import InvitationCustomization from "./InvitationCustomization";
import { useRoute } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useGetProfile } from "@workspace/api-client-react";
import { RsvpPagePreview } from "@/components/InvitationCustomization/RsvpPagePreview";
import { authFetch } from "@/lib/authFetch";
import type { ColorPalette, InvitationCustomization as InvitationCustomizationType, WeddingProfileData } from "@/types/invitations";

interface RouteParams {
  profileId?: string;
}

export default function GuestListAndInvitations() {
  const [, params] = useRoute("/guests/:profileId");
  const { activeWorkspace } = useWorkspace();
  const { data: profile } = useGetProfile();

  const profileId = params?.profileId
    ? parseInt(params.profileId)
    : activeWorkspace?.profileId || profile?.id;

  const [activeTab, setActiveTab] = useState("guest-list");

  const { data: weddingProfile } = useQuery<WeddingProfileData>({
    queryKey: ["wedding-profile", profileId],
    queryFn: async () => {
      const r = await authFetch("/api/profile");
      if (!r.ok) throw new Error("Failed to fetch profile");
      return r.json();
    },
    enabled: !!profileId,
  });

  const { data: customization } = useQuery<InvitationCustomizationType>({
    queryKey: ["invitation-customizations", profileId],
    queryFn: async () => {
      const r = await authFetch(`/api/invitation-customizations?profileId=${profileId}`);
      if (!r.ok) throw new Error("Failed to fetch customizations");
      return r.json();
    },
    enabled: !!profileId,
  });

  const rsvpColors: ColorPalette = {
    primary: customization?.primaryColor ?? "#D4A017",
    secondary: customization?.colorPalette?.secondary ?? "#F5E6D3",
    accent: customization?.colorPalette?.accent ?? "#8B6914",
    neutral: customization?.colorPalette?.neutral ?? "#9E9E9E",
  };
  const rsvpFont = customization?.digitalInvitationFont ?? customization?.selectedFont ?? "Playfair Display";
  const rsvpBg = customization?.digitalInvitationBackground ?? "#1E1A2E";
  const rsvpPhoto = customization?.digitalInvitationPhotoUrl ?? null;

  if (!profileId) {
    return <div className="p-4 text-center">Loading profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold">Guest List & Invitations</h1>
        <p className="text-muted-foreground mt-1">
          Manage your guests and customize your invitation designs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guest-list">Guest List</TabsTrigger>
          <TabsTrigger value="invitation-customization">Invitation Customization</TabsTrigger>
        </TabsList>

        <TabsContent value="guest-list" className="mt-6">
          <div className="flex gap-6 items-start">
            <div className="min-w-0 flex-1">
              <Guests />
            </div>
            <div className="hidden xl:flex flex-col items-center gap-2 flex-shrink-0 sticky top-4">
              <p className="text-xs font-medium text-muted-foreground">RSVP Page Preview</p>
              <RsvpPagePreview
                scale={0.62}
                colors={rsvpColors}
                font={rsvpFont}
                backgroundColor={rsvpBg}
                partner1Name={weddingProfile?.partner1Name ?? ""}
                partner2Name={weddingProfile?.partner2Name ?? ""}
                weddingDate={weddingProfile?.weddingDate ?? ""}
                venue={weddingProfile?.venue ?? ""}
                photoUrl={rsvpPhoto}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="invitation-customization" className="mt-6">
          <InvitationCustomization profileId={profileId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
