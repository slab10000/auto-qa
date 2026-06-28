import Link from "next/link";
import { getPRReport, evidence } from "@/lib/memory";

export const dynamic = "force-dynamic";

const vClass = (v: string) => (v === "FAIL" ? "fail" : v === "WARN" ? "warn" : v === "PASS" ? "pass" : "blocked");

export default async function PRPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getPRReport(id);
  if (!r) return <main className="wrap"><Link className="back" href="/">← back</Link><h1>PR not found</h1></main>;

  const bc = r.behavior_checks?.[0];
  const cmpOf = (screen: string) => r.visual_comparisons?.find((c: any) => c.screen === screen);
  const screens: string[] = Object.keys(r.evidence?.pr ?? {});

  return (
    <main className="wrap">
      <Link className="back" href="/">← product memory</Link>

      <div className={`verdict-banner ${vClass(r.verdict)}`} style={{ marginTop: 16 }}>
        <span className="big">{r.verdict}</span>
        <div>
          <div style={{ fontWeight: 650 }}>{r.pr.title}</div>
          <div className="meta" style={{ color: "var(--muted)", fontSize: 13 }}>
            {r.scope_analysis?.classification} · {r.pr.branch} → {r.pr.base}
          </div>
        </div>
      </div>

      <p className="lede">{r.pr.description}</p>

      {bc && (
        <section className="section">
          <h2>Behavior contract replay</h2>
          <div className="panel">
            <h3>{bc.action} on {bc.screen}</h3>
            <div className="contract">
              <div className="col">
                <div className="lab">main expected</div>
                <div className="val">
                  {bc.expected.type}
                  {bc.expected.destination_url ? ` → ${bc.expected.destination_url}` : ""}
                </div>
              </div>
              <div className="arrow">{bc.match ? "≟" : "≠"}</div>
              <div className="col">
                <div className="lab">pr observed</div>
                <div className="val">
                  {bc.observed.type}
                  {bc.observed.destination_url ? ` → ${bc.observed.destination_url}` : ""}
                </div>
              </div>
            </div>
            <div className="cmp-note">
              {bc.match ? (
                <span className="badge pass">✓ matches main</span>
              ) : (
                <span className="badge fail">✗ behavior mismatch</span>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <h2>Visual evidence — main vs PR</h2>
        {screens.map((s) => {
          const cmp = cmpOf(s);
          const sev = (cmp?.severity ?? "none").toLowerCase();
          return (
            <div className="panel" key={s}>
              <h3 style={{ textTransform: "capitalize", display: "flex", gap: 10, alignItems: "center" }}>
                {s}
                {cmp && <span className={`sev ${sev}`}>{cmp.changed ? `changed · ${sev}` : "no change"}</span>}
              </h3>
              <div className="compare">
                <figure>
                  <figcaption>main baseline</figcaption>
                  <img src={evidence(r.evidence.main[s])} alt={`main ${s}`} />
                </figure>
                <figure>
                  <figcaption>this PR</figcaption>
                  <img src={evidence(r.evidence.pr[s])} alt={`pr ${s}`} />
                </figure>
              </div>
              {cmp?.summary && <div className="cmp-note">{cmp.summary}</div>}
            </div>
          );
        })}
      </section>

      <section className="section">
        <h2>Scope analysis</h2>
        <div className="panel">
          <p className="reason">{r.scope_analysis?.reasoning}</p>
          {r.scope_analysis?.in_scope?.length > 0 && (
            <>
              <div className="k" style={{ marginTop: 14, color: "var(--green)", fontFamily: "var(--mono)", fontSize: 11 }}>IN SCOPE</div>
              <ul className="list in">{r.scope_analysis.in_scope.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </>
          )}
          {r.scope_analysis?.out_of_scope?.length > 0 && (
            <>
              <div className="k" style={{ marginTop: 14, color: "var(--red)", fontFamily: "var(--mono)", fontSize: 11 }}>OUT OF SCOPE</div>
              <ul className="list out">{r.scope_analysis.out_of_scope.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </>
          )}
        </div>
      </section>

      {r.code_review && (
        <section className="section">
          <h2>Code-side review · remote managed agent</h2>
          <div className="panel">
            <div className="kv">
              <div><div className="k">scope</div>{r.code_review.scope_match}</div>
              <div><div className="k">risk</div>{r.code_review.risk}</div>
              <div><div className="k">ran in</div>{r.code_review.ran_in ?? "remote sandbox"}</div>
            </div>
            <p className="reason">{r.code_review.summary}</p>
            {r.code_review.concerns?.length > 0 && (
              <ul className="list out">
                {r.code_review.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Changed files</h2>
        <div className="panel files">
          {r.changed_files?.map((f: string) => <div key={f}><span>M</span> {f}</div>)}
        </div>
      </section>
    </main>
  );
}
