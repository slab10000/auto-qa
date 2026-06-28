import Link from "next/link";
import { getMainMemory, listPRReports, getScreenshotHistory, evidence } from "@/lib/memory";

export const dynamic = "force-dynamic";

const vClass = (v: string) => (v === "FAIL" ? "fail" : v === "WARN" ? "warn" : v === "PASS" ? "pass" : "blocked");

export default async function Home() {
  const mem = await getMainMemory();
  const prs = await listPRReports();
  const history = await getScreenshotHistory();

  return (
    <main className="wrap">
      <h1>Product memory</h1>
      <p className="lede">
        auto-qa explored this app the way a new QA engineer would — learning its screens, how to navigate
        them, and what each action is supposed to do. That knowledge becomes the baseline every pull request
        is measured against.
      </p>

      <section className="section">
        <h2>Main — {mem.screens.length} screens learned</h2>
        <div className="grid-3">
          {mem.screens.map((s) => (
            <div className="card" key={s.id}>
              <img className="thumb" src={evidence(s.screenshot)} alt={s.name} />
              <div className="body">
                <div className="name">{s.name}</div>
                <div className="url">{s.url}</div>
                <div className="desc">{s.purpose}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {mem.behaviors.length > 0 && (
        <section className="section">
          <h2>Behavior contracts</h2>
          {mem.behaviors.map((b) => (
            <div className="panel" key={b.id}>
              <h3>
                {b.action} <span style={{ color: "var(--faint)" }}>on {b.screen}</span>
              </h3>
              <div className="kv">
                <div>
                  <div className="k">expected</div>
                  {b.expected_result.type}
                  {b.expected_result.destination_url ? ` → ${b.expected_result.destination_url}` : ""}
                </div>
                <div>
                  <div className="k">anchor</div>
                  {b.expected_result.visual_anchor}
                </div>
                <div>
                  <div className="k">confidence</div>
                  {Math.round((b.confidence ?? 0) * 100)}%
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {mem.skills.length > 0 && (
        <section className="section">
          <h2>Learned skills</h2>
          {mem.skills.map((sk) => (
            <details className="panel" key={sk.name}>
              <summary style={{ cursor: "pointer", fontFamily: "var(--mono)", color: "var(--accent)" }}>
                {sk.name}
              </summary>
              <pre className="skill">{sk.body}</pre>
            </details>
          ))}
        </section>
      )}

      <section className="section">
        <h2>Pull requests</h2>
        {prs.length === 0 && <p className="lede">No PR reviews yet. Run <code>npm run review -- pr-1</code>.</p>}
        {prs.map((r) => (
          <Link className="pr-row" href={`/pr/${r.pr.id}`} key={r.pr.id}>
            <span className={`badge dot ${vClass(r.verdict)}`}>{r.verdict}</span>
            <div>
              <div className="title">{r.pr.title}</div>
              <div className="meta">
                {r.pr.branch} → {r.pr.base} · {r.scope_analysis?.classification}
              </div>
            </div>
            {r.merged && <span className="badge pass" style={{ marginLeft: "auto" }}>merged → main</span>}
          </Link>
        ))}
      </section>

      {history.length > 0 && (
        <section className="section">
          <h2>Screenshot history · merged branches</h2>
          {history.map((h) => (
            <div className="panel" key={h.branch}>
              <h3 style={{ fontFamily: "var(--mono)", color: "var(--accent)", fontSize: 13 }}>{h.branch}</h3>
              <div className="grid-3">
                {h.shots.map((s) => (
                  <img className="thumb" key={s} src={evidence(s)} alt={s} style={{ borderRadius: 10, border: "1px solid var(--line)" }} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
