import type { ReactNode } from "react";
import { CockpitFrame } from "@/app/_components/cockpit-frame";
import { REPO_LABEL } from "@/lib/cockpit";

export const dynamic = "force-dynamic";

export default function CockpitLayout({ children }: { children: ReactNode }) {
  return <CockpitFrame repo={REPO_LABEL}>{children}</CockpitFrame>;
}
