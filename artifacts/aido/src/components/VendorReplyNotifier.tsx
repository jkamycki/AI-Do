import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useListConversations } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

export function VendorReplyNotifier() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const seenUnread = useRef<Map<number, number>>(new Map());
  const initialized = useRef(false);

  const { data: conversations } = useListConversations({
    query: {
      enabled: !!isSignedIn,
      refetchInterval: 20000,
      refetchIntervalInBackground: true,
    },
  });

  useEffect(() => {
    if (!conversations) return;
    if (!initialized.current) {
      conversations.forEach((c) => seenUnread.current.set(c.id, c.unreadCount ?? 0));
      initialized.current = true;
      return;
    }
    conversations.forEach((c) => {
      const previous = seenUnread.current.get(c.id) ?? 0;
      const current = c.unreadCount ?? 0;
      if (current > previous) {
        const newCount = current - previous;
        toast({
          title: `New reply from ${c.vendorName}`,
          description: c.lastMessagePreview
            ? c.lastMessagePreview.slice(0, 120)
            : `${newCount} new message${newCount === 1 ? "" : "s"}`,
          action: (
            <button
              onClick={() => navigate(`/vendors?open=${c.vendorId}`)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Mail className="h-3 w-3" /> Open
            </button>
          ) as never,
        });
      }
      seenUnread.current.set(c.id, current);
    });
  }, [conversations, navigate, toast]);

  return null;
}
