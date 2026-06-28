import Link from "next/link";
import { Mark, Wordmark, ScreenShot } from "./_components/ui";
import { getFeaturedReview } from "@/lib/cockpit";
import RepoBar from "./_components/repo-bar";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const featured = await getFeaturedReview();
  const beforeShot = featured?.before ?? null;
  const afterShot = featured?.after ?? null;
  const verdict = featured?.verdict ?? "WARN";
  const prTitle = featured?.title ?? "an open pull request";
  const prId = featured?.prId ?? "a PR";
  const headline =
    featured?.headline ??
    "the homepage headline was rewritten in a PR that only mentioned other pages.";
  const vColor = verdict === "FAIL" ? "var(--red)" : verdict === "PASS" ? "var(--green)" : "var(--amber)";
  const vRGB = verdict === "FAIL" ? "248,113,113" : verdict === "PASS" ? "52,211,153" : "251,191,36";

  return (
    <div className="fx-root">
      <div className="fx-glow" />
      <div className="fx-grid" />
      <div className="fx-content">
        {/* nav */}
        <header style={{ display: "flex", alignItems: "center", gap: 18, maxWidth: 1200, margin: "0 auto", padding: "22px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark />
            <Wordmark />
          </div>
          <nav style={{ display: "flex", gap: 6, marginLeft: 18 }}>
            <a href="#how" style={{ color: "var(--muted-3)", fontSize: 14, fontWeight: 500, padding: "7px 12px", borderRadius: 8 }}>How it works</a>
            <a href="#proof" style={{ color: "var(--muted-3)", fontSize: 14, fontWeight: 500, padding: "7px 12px", borderRadius: 8 }}>Evidence</a>
          </nav>
          <span style={{ flex: 1 }} />
          <Link href="/cockpit" className="btn btn-light">
            Open the cockpit <span style={{ fontSize: 13 }}>→</span>
          </Link>
        </header>

        {/* hero */}
        <section
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "36px 28px 20px",
            display: "grid",
            gridTemplateColumns: "minmax(0,1.04fr) minmax(0,.96fr)",
            gap: 54,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 13px 6px 10px", border: "1px solid rgba(124,131,255,.34)", background: "rgba(124,131,255,.10)", borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "pulseG 2.4s infinite" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: ".04em", color: "var(--accent-ink)" }}>
                AUTONOMOUS&nbsp;QA&nbsp;AGENT&nbsp;·&nbsp;COMPUTER&nbsp;USE
              </span>
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 60, lineHeight: 1.02, letterSpacing: "-.03em", margin: "22px 0 0" }}>
              Reviews every PR like your most&nbsp;<span style={{ color: "var(--accent-2)" }}>paranoid</span> QA engineer.
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 18.5, lineHeight: 1.55, maxWidth: "33em", margin: "22px 0 0" }}>
              auto·qa learns your app by actually using it, then drives every pull request in a real browser —
              flagging the out-of-scope changes that slip past code review and tired human eyes.
            </p>

            <RepoBar />
          </div>

          {/* watch-it-think teaser */}
          <div>
            <div style={{ position: "relative", background: "linear-gradient(180deg,#13151c,#101219)", border: "1px solid var(--line-frame)", borderRadius: 18, padding: 14, boxShadow: "0 30px 70px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 6px 12px" }}>
                <span style={{ color: "var(--accent-2)", fontSize: 14 }}>⊙</span>
                <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 13, letterSpacing: "-.01em" }}>
                  cockpit · reviewing {prId}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--green)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulseG 2s infinite" }} />
                  LIVE
                </span>
              </div>
              {/* current frame — the PR build's homepage */}
              <ScreenShot src={afterShot} url="test-app/index.html" height={218} scan style={{ boxShadow: "0 10px 30px rgba(0,0,0,.4)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "13px 2px 4px" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>STEP</span>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Captured the Home page after this PR’s changes</span>
              </div>
              {/* scope callout */}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", background: `rgba(${vRGB},.09)`, border: `1px solid rgba(${vRGB},.34)`, borderRadius: 11 }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 11, color: vColor, letterSpacing: ".04em", padding: "3px 9px", border: `1px solid rgba(${vRGB},.4)`, borderRadius: 7, whiteSpace: "nowrap" }}>
                  ⚠ {verdict}
                </span>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#d8cfb6" }}>
                  Stated scope was <b style={{ color: "#efe9d6" }}>“{prTitle}”</b> — but the homepage changed too, out of scope.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* proof points */}
        <section style={{ maxWidth: 1200, margin: "30px auto 0", padding: "0 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "rgba(18,21,28,.5)" }}>
            <div style={{ padding: "18px 22px", borderRight: "1px solid var(--line)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent-2)" }}>DRIVES REAL CHROMIUM</div>
              <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>Clicks, types and scrolls like a person — no selectors to maintain.</div>
            </div>
            <div style={{ padding: "18px 22px", borderRight: "1px solid var(--line)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--green)" }}>REPLAYS FROM CACHE</div>
              <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>Explores once with Computer Use, then replays the route in milliseconds — 0 model calls.</div>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)" }}>REVIEWS ON EVERY PUSH</div>
              <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>A verdict and visual evidence on every pull request, automatically.</div>
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how" style={{ maxWidth: 1200, margin: "90px auto 0", padding: "0 28px" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".14em", color: "var(--faint)", textTransform: "uppercase" }}>How it works</div>
          <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 36, letterSpacing: "-.025em", margin: "12px 0 0", maxWidth: "18em" }}>
            A QA hire that onboards itself — and gets sharper every release.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 34 }}>
            {[
              { n: "01", c: "var(--accent-2)", t: "Learn", b: "It clones your repo and explores the app like a new hire — capturing every screen and what each action is supposed to do." },
              { n: "02", c: "var(--accent-2)", t: "Review", b: "On every PR it re-drives those flows in a real browser and compares against the accepted baseline." },
              { n: "03", c: "var(--amber)", t: "Catch", b: "It reasons about the PR’s stated scope and flags anything that changed but was never declared." },
              { n: "04", c: "var(--green)", t: "Merge", b: "Approve, and the new behavior becomes the baseline. Skills graduate. The agent compounds." },
            ].map((s) => (
              <div key={s.n} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: s.c }}>{s.n}</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 18, marginTop: 14 }}>{s.t}</div>
                <p style={{ color: "var(--muted-2)", fontSize: 14, lineHeight: 1.55, margin: "9px 0 0" }}>{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* proof / what it caught */}
        {featured && (
          <section id="proof" style={{ maxWidth: 1200, margin: "90px auto 0", padding: "0 28px" }}>
            <div style={{ background: `linear-gradient(180deg, rgba(${vRGB},.06), transparent 40%), #101219`, border: "1px solid var(--line-frame)", borderRadius: 22, padding: 34, boxShadow: "0 30px 80px rgba(0,0,0,.4)" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".14em", color: vColor, textTransform: "uppercase" }}>What it caught</div>
                  <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 34, letterSpacing: "-.025em", margin: "12px 0 0" }}>
                    A “{prTitle}” PR that changed more than it declared.
                  </h2>
                  <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.55, margin: "14px 0 0", maxWidth: "42em" }}>
                    On <b style={{ color: "var(--ink-2)" }}>{featured.repo || "the repo"}</b>, PR #{featured.prNumber} said it would{" "}
                    <i>“{prTitle}.”</i> auto·qa drove every page in a real browser and found that{" "}
                    {headline.charAt(0).toLowerCase() + headline.slice(1)} Code review waved it through — auto·qa
                    flagged it <b style={{ color: vColor }}>{verdict}</b>.
                  </p>
                  {featured.url && (
                    <a href={featured.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ marginTop: 16 }}>
                      see the posted review on GitHub →
                    </a>
                  )}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 11, padding: "14px 18px", borderRadius: 14, background: `rgba(${vRGB},.10)`, border: `1px solid rgba(${vRGB},.36)` }}>
                  <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 26, color: vColor, letterSpacing: ".02em" }}>{verdict}</span>
                  <div style={{ fontSize: 12.5, color: "#cdc3ad", lineHeight: 1.4 }}>
                    out-of-scope
                    <br />
                    change
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, marginTop: 26 }}>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 9 }}>
                    main baseline · Home
                  </div>
                  <ScreenShot src={beforeShot} url="test-app/index.html" height={230} />
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 11, fontSize: 13, color: "var(--muted-2)" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)", padding: "2px 8px", border: "1px solid rgba(52,211,153,.4)", borderRadius: 6 }}>baseline</span>{" "}
                    accepted on main
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 9 }}>
                    this PR · Home
                  </div>
                  <ScreenShot src={afterShot} url="test-app/index.html" height={230} outline={`2px solid rgba(${vRGB},.45)`} />
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 11, fontSize: 13, color: "var(--muted-2)" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: vColor, padding: "2px 8px", border: `1px solid rgba(${vRGB},.4)`, borderRadius: 6 }}>out of scope</span>{" "}
                    changed, but never declared
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* bottom CTA */}
        <section style={{ maxWidth: 1000, margin: "96px auto 0", padding: "0 28px" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 46, letterSpacing: "-.03em", margin: 0 }}>Point it at your repo.</h2>
            <p style={{ color: "var(--muted)", fontSize: 18, margin: "16px 0 0" }}>
              Watch it learn your product in real time, then catch what the next PR forgot to mention.
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
              <Link href="/cockpit" className="btn btn-primary" style={{ fontSize: 16, padding: "15px 26px", borderRadius: 13, gap: 10 }}>
                Open the cockpit <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        <footer style={{ maxWidth: 1200, margin: "90px auto 0", padding: "26px 28px 40px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--accent-2)", fontSize: 14 }}>⊙</span>
          <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 14 }}>auto·qa</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)" }}>
            a self-improving QA agent · Computer Use × cached route replay
          </span>
        </footer>
      </div>
    </div>
  );
}
