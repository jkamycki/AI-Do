import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Guests from "./Guests";
import InvitationCustomization from "./InvitationCustomization";
import WeddingParty from "./WeddingParty";
import { useRoute } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useGetProfile } from "@workspace/api-client-react";

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="guest-list">Guest List</TabsTrigger>
          <TabsTrigger value="invitation-customization">Invitation Customization</TabsTrigger>
          <TabsTrigger value="wedding-party">Wedding Party</TabsTrigger>
        </TabsList>

        <TabsContent value="guest-list" forceMount className="mt-6 data-[state=inactive]:hidden">
          <Guests />
        </TabsContent>

        <TabsContent value="invitation-customization" forceMount className="mt-6 data-[state=inactive]:hidden">
          <InvitationCustomization profileId={profileId} />
        </TabsContent>

        <TabsContent value="wedding-party" forceMount className="mt-6 data-[state=inactive]:hidden">
          <WeddingParty />
        </TabsContent>
      </Tabs>
    </div>
  );
}
