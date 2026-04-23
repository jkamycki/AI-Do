import { Router, type IRouter } from "express";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const router: IRouter = Router();

const SCENE_NARRATION: string[] = [
  "Meet A.I.Do... your A.I wedding planning partner.",
  "Track every dollar with smart categories, real time totals... and gentle nudges before you go over budget.",
  "Aria writes thoughtful vendor emails for you... and keeps every reply right here, in one tidy inbox.",
  "Drop in any contract... and Aria flags red flags, hidden fees, and the clauses worth negotiating.",
  "Manage every R.S.V.P, plus one, and meal preference... in one beautifully organized list.",
  "Build your seating chart visually... or let Aria arrange it around families, friends... and old grudges.",
  "All powered by Aria... your A.I planner, on call any time. Start planning today, at A dot I do dot app.",
];

const cache = new Map<number, Buffer>();
const inflight = new Map<number, Promise<Buffer>>();

async function getOrGenerate(scene: number): Promise<Buffer> {
  const cached = cache.get(scene);
  if (cached) return cached;
  const pending = inflight.get(scene);
  if (pending) return pending;

  const text = SCENE_NARRATION[scene];
  if (!text) throw new Error("Invalid scene");

  const promise = (async () => {
    const buf = await textToSpeech(text, "shimmer", "mp3");
    cache.set(scene, buf);
    inflight.delete(scene);
    return buf;
  })();
  inflight.set(scene, promise);
  return promise;
}

router.get("/tts/narration/:scene", async (req, res) => {
  const scene = parseInt(req.params.scene ?? "", 10);
  if (Number.isNaN(scene) || scene < 0 || scene >= SCENE_NARRATION.length) {
    return res.status(400).json({ error: "Invalid scene" });
  }
  try {
    const buf = await getOrGenerate(scene);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Content-Length", String(buf.length));
    return res.send(buf);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
