# 2026 AI Engineer World's Fair Hackathon — Context

> Reference doc for our project. Hosted by Cerebral Valley (CV) at the AI Engineer World's Fair.

## Event Logistics

- **Venue:** Shack15 — Ferry Building, 1, Suite 201, San Francisco, CA 94111 (2nd floor, up the elevator, turn left).
- **WiFi:** `SHACK15_Members` / password `M3mb3r$4L!f3`
- **Parking:** Extremely limited near Ferry Building — use Uber/Lyft/public transit.
- **Discord:** [Cerebral Valley](https://discord.com/invite/ypwueBJm6W) — go to `#access`, click 🤖 to unlock hackathon channels.
- **Contact:** aamna@ext-cerebralvalley.ai or Discord.

## Required Themes (must build in ONE)

1. **Continual Learning** — LLM systems that continuously improve from real-world use: memory, user feedback, prompt optimization, self-reflection, toolkit expansion. Adapt in production with minimal user intervention.
2. **The Self-Improvement Stack** — Infrastructure to continuously evaluate, monitor, and upgrade AI systems: eval frameworks, observability, deployment loops, model routing, automated experimentation.
3. **Recursive Intelligence (RSI)** — Models that build/improve themselves: generating pretraining data, optimizing hyperparameters, updating architecture, iterating on training techniques. Early forms of recursive/self-directed intelligence.

## Special Prizes

| Prize | Reward |
|-------|--------|
| Best Usage of DigitalOcean | DO credits |
| Best Usage of LiveKit | Keychron Q3 Max keyboards (per team member) |
| **Best Usage of Gemini 3.5** | **$5,000 Cash** |

### Gemini 3.5 Prize — Required Tech Stack

Must incorporate **at least one** (bonus for combining multiple). No standard wrapper chatbots or basic prompts — must be unprecedented, ideally self-improving over time.

- **🚀 Managed Agents (Interactions API)** — Call Google's hosted agent infra (Antigravity agent, `antigravity-preview-05-2026`). One API call spins up an autonomous agent that reasons, browses the web, and executes code in an isolated ephemeral Google-hosted Linux env. **Stateful memory:** pass the environment ID in follow-up calls to resume with files/code/terminal state intact. Declare persona/skills via local `AGENTS.md` and `SKILL.md` files.
- **🖥️ Computer Use in Gemini 3.5 Flash** — Natively integrated. Model looks at screens via screenshots and generates native UI actions (mouse clicks, drags, keystrokes) across browser, desktop, mobile. Use cases: automate knowledge work across apps, **build continuous software testers**, navigate web on your behalf.
- **🎙️ Live Translate (Gemini Live API)** — `gemini-3.5-live-translate-preview`. Low-latency real-time speech-to-speech translation, 70+ languages, continuous WebSockets stream (a few seconds behind speaker, no awkward pauses).
- **🍌 On-device & GenMedia (encouraged add-ons)** — Nano Banana (fast visual gen, precise text-in-image), Veo (video), Lyria (music); Gemma 4 (lightweight on-device/edge reasoning).

## Key Rules

- **Open source:** repo must be **public**.
- **Team size:** max 4 (solo allowed).
- **New work only:** demo must highlight ONLY what your team built during the event. Judges must clearly identify event contributions — failure = **immediate disqualification**.
- **Banned project types:** mental health advisors, basic RAG apps, Streamlit apps, image analyzers, job application screeners, nutrition coaches, personality analyzers, medical advice bots, **any project where a dashboard is the main feature**, sports analyzers/coaches.

## Judging Criteria

### Round One (in judging-group rooms — ~3 min demo + 1–2 min Q&A)
- **Technicality (40%)** — How hard to recreate? Beyond average hackathon difficulty? Impressive for the time?
- **Live Demo (20%)** — Does the actual demo impress? Well-engineered and working?
- **Creativity & Originality (25%)** — Never seen before?
- **Future Potential & AI Impact (15%)** — Points toward an interesting AI future? Advances autonomy/learning/eval/agentic thinking?

### Round Two (top 6, on stage — same criteria, **equal weighting**)

## Schedule

**Saturday, June 27**
- 9:00 AM — Doors open, breakfast, team formation
- 11:00 AM — Opening presentation (CV + partners)
- 11:30 AM — Hacking begins
- 1:00 PM — Lunch · 6:00 PM — Dinner
- 10:00 PM — Doors close (overnight allowed)

**Sunday, June 28**
- 8:30 AM — Doors open, breakfast
- **12:00 PM — Submissions due**
- 12:30 PM — Round 1 judging · 1:00 PM lunch · 1:45 PM Round 1 ends
- 2:00 PM — Final round · 3:00 PM ends · 3:15 PM winners announced
- 5:00 PM — Doors close

## Submission

- Submit at: https://cerebralvalley.ai/e/aiewf-hackathon-2026/hackathon/submit
- Requires a **~1 minute demo video** highlighting features/code/functionality the team built.
- Double-check: repo is public, demo link accessible, all team members added.

## Prizes (Overall)

- **🥇 1st:** $2,500 cash + $5,000 MiniMax credits + ModCon tickets ($450/member) + $7,500 Atlas credits + 500M Voyage AI tokens
- **🥈 2nd:** $1,500 cash + $2,000 MiniMax credits + $5,000 Atlas credits + 500M Voyage tokens
- **🥉 3rd:** $1,000 cash + $1,000 MiniMax credits + $5,000 Atlas credits + 200M Voyage tokens

## Partner Resources

- **DigitalOcean:** $200 credits — https://do-hacker-guide-uijyg.ondigitalocean.app (claim at DO table)
- **LiveKit:** https://www.livekit.info/aiewf-hackathon-2026
- **MiniMax:** $30 API credits — https://vrfi1sk8a0.feishu.cn/share/base/form/shrcnL6XluHedHm47caMgggpKSg
- **Modular:** MAX LLM Book https://llm.modular.com/ · Mojo https://mojolang.org/ · Skills https://github.com/modular/skills
- **MongoDB:** Atlas Sandbox on GCP (invite-based)
- **Google DeepMind / Gemini:**
  - Interactions API: https://ai.google.dev/gemini-api/docs/get-started
  - Live Translate: https://ai.google.dev/gemini-api/docs/live-api/live-translate
  - What's new in Gemini 3.5 Flash: https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5
  - Gemma: https://ai.google.dev/gemma/docs/get_started
  - API keys: https://aistudio.google.com/api-keys
  - Antigravity download: https://antigravity.google/download

## Notes for "auto-qa" (this project)

- Project name `auto-qa` suggests a **continuous software tester** — strongly aligns with **Computer Use in Gemini 3.5 Flash** ("build continuous software testers") and the **Self-Improvement Stack** theme (eval/monitoring infrastructure).
- Potential angle: a self-improving QA agent that learns from each test run (Continual Learning) — combining Computer Use (eyes/hands on the app) + memory/feedback to get better at finding bugs over time. This would also be eligible for the **$5,000 Gemini 3.5 prize**.
- Avoid banned categories — make sure a dashboard is NOT the main feature; the agent/testing capability must be the star.
