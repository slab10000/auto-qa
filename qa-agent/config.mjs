// Shared agent configuration.
export const MODEL = "gemini-3.5-flash";
export const VIEWPORT = { width: 1280, height: 800 };

// The QA target lives on GitHub — the agent clones it for onboarding and review.
// Override with AUTOQA_REPO=owner/name.
export const TARGET_REPO = process.env.AUTOQA_REPO || "slab10000/test-app";

// Pages of the target app: file → cockpit screen id + friendly name.
// onboard/review iterate these (filtered to the files that actually exist).
export const TARGET_PAGES = [
  { file: "index.html", id: "home", name: "Home" },
  { file: "products.html", id: "store", name: "Store" },
  { file: "dashboard.html", id: "dashboard", name: "Dashboard" },
  { file: "tasks.html", id: "tasks", name: "Tasks" },
  { file: "contact.html", id: "contact", name: "Contact" },
];
// The behavior contract learned on onboarding (a nav the agent re-verifies on PRs).
export const CONTRACT_NAV = {
  fromFile: "index.html",
  screen: "Home",
  goal: "Click the “Store” link in the top navigation bar to open the Store page.",
  action: "Click the Store link in the top nav",
};

// The Computer Use tool, attached to every interaction in a browse loop.
export const CU_TOOL = {
  type: "computer_use",
  environment: "browser",
  enable_prompt_injection_detection: true,
};

// Safety cap so a confused agent can't loop (or bill) forever.
export const MAX_STEPS = 16;
