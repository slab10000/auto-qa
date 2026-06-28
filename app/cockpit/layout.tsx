import type { ReactNode } from "react";
import { CockpitShell } from "@/app/_components/cockpit-shell";
import { REPO_LABEL } from "@/lib/cockpit";

export const dynamic = "force-dynamic";

export default function CockpitLayout({ children }: { children: ReactNode }) {
  return <CockpitShell repo={REPO_LABEL}>{children}</CockpitShell>;
}
