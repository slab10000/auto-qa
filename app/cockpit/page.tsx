import { getMetrics, getAnalyses, buildTreeData, REPO_LABEL } from "@/lib/cockpit";
import { getMainMemory, getRoutes } from "@/lib/memory";
import { CockpitTabs } from "@/app/_components/cockpit-tabs";
import { OverviewTab } from "@/app/_components/overview-tab";
import { TreeView } from "@/app/_components/tree-view";

export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const [m, mem, analyses, routes] = await Promise.all([getMetrics(), getMainMemory(), getAnalyses(), getRoutes()]);
  const treeData = buildTreeData(REPO_LABEL, mem, routes, analyses);

  return (
    <CockpitTabs
      overview={<OverviewTab m={m} mem={mem} analyses={analyses} />}
      tree={<TreeView data={treeData} />}
    />
  );
}
