import { getScreenshotHistory, evidence } from "@/lib/memory";
import { ScreenShot } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const history = await getScreenshotHistory(true);

  return (
    <div>
      <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, letterSpacing: "-.02em", margin: 0 }}>
        Screenshot gallery
      </h2>
      <p style={{ color: "var(--muted-2)", fontSize: 15, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "64ch" }}>
        A visual changelog. Every merged branch leaves a snapshot of each screen, so you can see exactly how the product
        evolved.
      </p>

      {history.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          No screenshots captured yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 24 }}>
          {history.map((g) => (
            <div key={g.branch}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent-2)" }}>{g.branch}</span>
                <span style={{ fontSize: 13, color: "var(--muted-3)" }}>
                  {g.branch === "main" ? "current baseline" : g.branch}
                </span>
                <span style={{ flex: 1 }} />
                {g.branch === "main" && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>live</span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {g.shots.map((shot) => (
                  <ScreenShot key={shot} src={evidence(shot)} url="test-app" height={158} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)", marginTop: 24 }}>
        More branches appear here as PRs merge — only the main baseline exists today.
      </div>
    </div>
  );
}
