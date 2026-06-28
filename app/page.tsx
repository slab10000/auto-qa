import Link from "next/link";
import ContribGrid from "./_components/contrib-grid";

export default function LandingPage() {
  return (
    <main className="lp-root">
      <Link href="/cockpit" className="lp-canvaslink" aria-label="Enter the auto·qa cockpit">
        <ContribGrid className="lp-canvas" />
      </Link>

      <div className="lp-overlay">
        <div className="lp-word">
          auto<span>·</span>qa
        </div>
        <div className="lp-tag">A QA AGENT THAT LEARNS YOUR PRODUCT AND REVIEWS EVERY COMMIT</div>
        <Link href="/cockpit" className="lp-enter">
          ENTER THE COCKPIT <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}
