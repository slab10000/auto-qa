import { getMainMemory, getPRSkills } from "@/lib/memory";

export const dynamic = "force-dynamic";

type SkillCard = { name: string; body: string; tag: "main" | "pending · pr-1" };

export default async function SkillsPage() {
  const mem = await getMainMemory();
  const prSkills = await getPRSkills("pr-1");

  const skills: SkillCard[] = [
    ...(mem?.skills ?? []).map((s) => ({ name: s.name, body: s.body, tag: "main" as const })),
    ...(prSkills ?? []).map((s) => ({ name: s.name, body: s.body, tag: "pending · pr-1" as const })),
  ];

  return (
    <div>
      <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, letterSpacing: "-.02em", margin: 0 }}>
        Skills
      </h2>
      <p style={{ color: "var(--muted-2)", fontSize: 15, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "64ch" }}>
        Reusable know-how the agent wrote for itself while testing. Skills graduate into the baseline when a PR merges — so
        the agent gets sharper every release.
      </p>

      {skills.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          No skills learned yet.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 24 }}>
            {skills.map((sk, i) => {
              const pending = sk.tag !== "main";
              return (
                <div
                  key={`${sk.name}-${i}`}
                  style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "13px 16px",
                      borderBottom: "1px solid var(--line-soft)",
                    }}
                  >
                    <span style={{ color: "var(--accent-2)" }}>✦</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)" }}>{sk.name}</span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: pending ? "var(--amber)" : "var(--green-ink)",
                        background: "var(--panel-2)",
                        border: `1px solid ${pending ? "rgba(251,191,36,.3)" : "rgba(52,211,153,.3)"}`,
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {sk.tag}
                    </span>
                  </div>
                  <pre
                    className="skill"
                    style={{
                      margin: 0,
                      padding: "15px 16px",
                      fontFamily: "var(--mono)",
                      fontSize: 11.5,
                      lineHeight: 1.65,
                      color: "var(--muted-2)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {sk.body}
                  </pre>
                </div>
              );
            })}
          </div>

          {prSkills.length > 0 && (
            <p style={{ color: "var(--muted-3)", fontSize: 12.5, lineHeight: 1.5, margin: "16px 0 0" }}>
              Pending skills are written against an open PR — they graduate into main when that PR merges.
            </p>
          )}
        </>
      )}
    </div>
  );
}
