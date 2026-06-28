// Learned navigation routes: the action sequences Computer Use discovered, cached so repeat
// passes can replay them instead of re-exploring. Stored under .autoqa/main/routes/.
import path from "node:path";
import { paths, readJSON, writeJSON } from "./memory.mjs";

const ROUTES_DIR = path.join(paths.mainDir, "routes");

export const routeKey = (goal) =>
  goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

const routeFile = (key) => path.join(ROUTES_DIR, `${key}.json`);

export async function loadRoute(key) {
  return readJSON(routeFile(key), null);
}
export async function saveRoute(key, data) {
  await writeJSON(routeFile(key), data);
}
