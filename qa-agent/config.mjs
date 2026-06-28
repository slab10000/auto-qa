// Shared agent configuration.
export const MODEL = "gemini-3.5-flash";
export const VIEWPORT = { width: 1280, height: 800 };

// The Computer Use tool, attached to every interaction in a browse loop.
export const CU_TOOL = {
  type: "computer_use",
  environment: "browser",
  enable_prompt_injection_detection: true,
};

// Safety cap so a confused agent can't loop (or bill) forever.
export const MAX_STEPS = 16;
