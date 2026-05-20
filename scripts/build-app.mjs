import { buildApi, buildFrontend, copyFrontendDist } from "./render-utils.mjs";

await buildApi();
await buildFrontend();
await copyFrontendDist();
