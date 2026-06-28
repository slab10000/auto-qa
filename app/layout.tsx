import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "auto-qa · evidence cockpit",
  description: "A self-improving QA agent that learns your product and reviews PRs with Gemini Computer Use.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">
            auto<span className="mono">·</span>qa
          </div>
          <nav className="nav">
            <a href="/">Memory</a>
            <a href="/run">Live run</a>
          </nav>
          <div className="spacer" />
          <span className="tagline">Gemini 3.5 · Computer Use</span>
        </header>
        {children}
      </body>
    </html>
  );
}
