import Link from "next/link";
import ContribGrid from "./_components/contrib-grid";

export default function LandingPage() {
  return (
    <main className="lp-root">
      <Link href="/cockpit" className="lp-canvaslink" aria-label="Enter the auto·qa cockpit">
        <ContribGrid className="lp-canvas" />
      </Link>

      <div className="lp-overlay">
        <div className="lp-hero">
          <div className="lp-word">
            auto<span>·</span>qa
          </div>
          <p className="lp-sub">forget about QA, just keep the grind</p>
          <Link href="/cockpit" className="lp-enter">
            ENTER THE COCKPIT <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
