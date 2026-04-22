// Cloudflare Email Worker — forwards inbound vendor emails to the A.IDO API.
// Paste this whole file into the Cloudflare dashboard worker editor — no npm
// install needed. The API does the email parsing.
//
// Required worker secrets (set via dashboard → Settings → Variables):
//   API_URL         = https://aidowedding.net
//   INBOUND_SECRET  = (same value as CLOUDFLARE_INBOUND_SECRET in Replit)

export default {
  async email(message, env) {
    try {
      // Read the full raw MIME message as text
      const reader = message.raw.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total > 25 * 1024 * 1024) break; // 25 MB cap
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      const rawMime = new TextDecoder("utf-8").decode(merged);

      const res = await fetch(`${env.API_URL}/api/webhooks/cloudflare/inbound`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.INBOUND_SECRET}`,
        },
        body: JSON.stringify({
          to: message.to,
          from: message.from,
          rawMime,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("inbound forward failed", res.status, txt.slice(0, 500));
      }
    } catch (err) {
      console.error("worker error", err);
    }
  },
};
