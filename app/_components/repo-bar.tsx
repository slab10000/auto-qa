"use client";

import { useRef, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

export default function RepoBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const go = () => router.push("/cockpit");
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") go();
  };

  return (
    <div style={{ marginTop: 30 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 7px 7px 16px",
          background: "#13151c",
          border: "1px solid #283047",
          borderRadius: 14,
          boxShadow: "0 14px 40px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.03)",
        }}
      >
        <svg width="19" height="19" viewBox="0 0 16 16" style={{ flex: "0 0 auto" }}>
          <path
            fill="#7c8398"
            d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          onKeyDown={onKey}
          placeholder="github.com/your-org/your-repo"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#eef1f7",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 14.5,
            padding: "8px 0",
          }}
        />
        <button
          onClick={go}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flex: "0 0 auto",
            fontFamily: "'Hanken Grotesk',sans-serif",
            fontSize: 14.5,
            fontWeight: 600,
            color: "#0a0b0f",
            background: "linear-gradient(145deg,#9aa0ff,#7c83ff)",
            border: "none",
            padding: "11px 18px",
            borderRadius: 10,
            cursor: "pointer",
            boxShadow: "0 6px 18px rgba(124,131,255,.4)",
          }}
        >
          Analyze repo <span>→</span>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#5a6176" }}>Try the demo:</span>
        <button
          onClick={go}
          style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 12.5,
            color: "#c7caff",
            background: "rgba(124,131,255,.10)",
            border: "1px solid rgba(124,131,255,.26)",
            padding: "5px 11px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          github.com/slab10000/test-app
        </button>
        <span style={{ fontSize: 13, color: "#5a6176" }}>· onboards in ~40s, no setup</span>
      </div>
    </div>
  );
}
