export default {
  async email(message, env, ctx) {
    try {
      const buf = await new Response(message.raw).arrayBuffer();
      const rawMime = new TextDecoder("utf-8").decode(new Uint8Array(buf));

      console.log("aido-inbound: received email", {
        to: message.to,
        from: message.from,
        size: buf.byteLength,
      });

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
        console.error("aido-inbound: forward failed", res.status, txt.slice(0, 500));
      } else {
        console.log("aido-inbound: forwarded ok");
      }
    } catch (err) {
      console.error("aido-inbound: worker error", err && err.stack ? err.stack : String(err));
    }
  },
};
