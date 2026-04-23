import { Router, type IRouter } from "express";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const router: IRouter = Router();

const SCENE_NARRATION: string[] = [
  "Meet A.I.Do — your AI wedding planning operating system.",
  "Build your timeline and budget in minutes, not months.",
  "Vendor emails, checklists, contracts, seating charts, guests, and collaboration — all in one place.",
  "And meet Aria, your A.I planner — ready around the clock to answer anything.",
  "Plan smarter. Stress less. Start your wedding journey with A.I.Do today.",
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
