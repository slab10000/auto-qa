// PR trigger detection. The cockpit's control room polls GET on an interval + the moment
// the tab regains focus; when an open PR on the target repo has a head commit we haven't
// reviewed yet, it shows up as a `candidate` and the control room launches a live review.
//
// Dedup state lives in .autoqa/triggers.json keyed by `pr-<n>`:
//   { reviewedSha, status: "running" | "idle", updatedAt }
// A PR is a candidate when it is NOT a draft, its current head SHA != reviewedSha, AND it isn't
// already running. Drafts are intentionally skipped, so marking a draft "ready for review" makes
// it a candidate (its head SHA was never reviewed) — a clean trigger without needing a new commit.
// POST records claims (status:running) and completions (status:done [+ sha]) so a focus-poll
// 2s later can't double-launch and a page reload can't re-trigger an already-reviewed commit.
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);
export const dynamic = "force-dynamic";

const REPO = process.env.AUTOQA_REPO || "slab10000/test-app";
const AUTOQA = path.join(process.cwd(), ".autoqa");
const STATE_FILE = path.join(AUTOQA, "triggers.json");
// A "running" claim older than this is treated as stale (the tab closed mid-run) so the PR
// becomes reviewable again instead of getting stuck.
const STALE_RUNNING_MS = 10 * 60 * 1000;

type Entry = { reviewedSha?: string; status?: "running" | "idle"; updatedAt?: string };
type State = Record<string, Entry>;

async function readState(): Promise<State> {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8")) as State;
  } catch {
    return {};
  }
}

async function writeState(s: State): Promise<void> {
  await fs.mkdir(AUTOQA, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(s, null, 2));
}

type GhPr = { number: number; title: string; headRefOid: string; updatedAt: string; isDraft: boolean };

async function listOpenPRs(): Promise<GhPr[]> {
  const { stdout } = await pexec(
    "gh",
    ["pr", "list", "--repo", REPO, "--state", "open", "--limit", "20",
     "--json", "number,title,headRefOid,updatedAt,isDraft"],
    { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
  );
  return JSON.parse(stdout) as GhPr[];
}

function isRunning(e: Entry | undefined): boolean {
  if (!e || e.status !== "running" || !e.updatedAt) return false;
  return Date.now() - Date.parse(e.updatedAt) < STALE_RUNNING_MS;
}

// GET — detection. Returns candidates the control room should review. Never mutates state,
// so it is safe to call on every focus/interval tick.
export async function GET() {
  let prs: GhPr[];
  try {
    prs = await listOpenPRs();
  } catch (e: unknown) {
    // gh missing / not authed / offline — report "not watching" instead of 500ing the cockpit.
    return NextResponse.json({
      repo: REPO,
      watching: false,
      candidates: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const state = await readState();
  const candidates = prs
    .filter((p) => {
      if (p.isDraft) return false; // skip drafts; marking one "ready for review" turns it into a candidate
      const e = state[`pr-${p.number}`];
      return e?.reviewedSha !== p.headRefOid && !isRunning(e);
    })
    .map((p) => ({ number: p.number, title: p.title, headSha: p.headRefOid }));

  return NextResponse.json({ repo: REPO, watching: true, openCount: prs.length, candidates });
}

// POST — dedup bookkeeping from the control room.
//   { pr, status:"running" }        → claim (stop other ticks from re-launching)
//   { pr, status:"done", sha }      → reviewed this head SHA (won't retrigger until next push)
//   { pr, status:"done" }           → released without success (retryable)
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    pr?: number | string;
    sha?: string;
    status?: "running" | "done";
  };
  if (body.pr == null) {
    return NextResponse.json({ ok: false, error: "missing pr" }, { status: 400 });
  }
  const id = `pr-${String(body.pr).replace(/^pr-/, "")}`;
  const state = await readState();
  const entry: Entry = state[id] ?? {};

  if (body.status === "running") {
    entry.status = "running";
  } else if (body.status === "done") {
    entry.status = "idle";
    if (body.sha) entry.reviewedSha = body.sha;
  }
  entry.updatedAt = new Date().toISOString();
  state[id] = entry;
  await writeState(state);

  return NextResponse.json({ ok: true, id, entry });
}
