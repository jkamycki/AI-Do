// Cloudflare Email Worker — forwards inbound vendor emails to the A.IDO API.
//
// Setup (one-time):
//  1. In Cloudflare dashboard → Email → Email Routing → Email Workers → "Create"
//  2. Paste this whole file as the worker code.
//  3. Add two secrets to the worker:
//        API_URL            = https://aidowedding.net   (your prod API base URL)
//        INBOUND_SECRET     = <same value as CLOUDFLARE_INBOUND_SECRET in Replit>
//  4. Save & Deploy.
//  5. In Email Routing → Routes → Catch-all address → Action: "Send to a Worker"
//     → pick this worker. Enable.
//  6. Vendor replies to messages+123.abc@aidowedding.net are now routed here.
//
// Requires the postal-mime package (npm install postal-mime in the worker if
// using Wrangler, or paste it inline if using the dashboard editor).

import PostalMime from "postal-mime";

export default {
  async email(message, env) {
    try {
      const raw = await new Response(message.raw).arrayBuffer();
      const parsed = await new PostalMime().parse(raw);

      const to = message.to || parsed.to?.[0]?.address || "";
      const from = parsed.from?.address || message.from || "";
      const fromName = parsed.from?.name || "";
      const subject = parsed.subject || "";
      const text = parsed.text || "";
      const html = parsed.html || "";
      const messageId = parsed.messageId || message.headers.get("message-id") || "";

      // Cloudflare Email Workers don't give attachment URLs out of the box; we
      // forward filenames + types only. (Vendors rarely send heavy attachments
      // back; if they do we can extend later via R2 storage.)
      const attachments = (parsed.attachments || []).slice(0, 10).map((a) => ({
        name: a.filename || "attachment",
        type: a.mimeType || "application/octet-stream",
        size: a.content?.byteLength,
      }));

      const body = {
        to,
        from,
        fromName,
        subject,
        text,
        html,
        messageId,
        attachments,
      };

      const res = await fetch(`${env.API_URL}/api/webhooks/cloudflare/inbound`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.INBOUND_SECRET}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("inbound forward failed", res.status, txt.slice(0, 500));
        // Don't reject the email — log and accept so vendors don't get bounces.
      }
    } catch (err) {
      console.error("worker error", err);
      // swallow — accepting the message is better than bouncing
    }
  },
};
