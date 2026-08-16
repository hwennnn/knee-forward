import type { AppTab } from "./exerciseMedia";

const tabs = ["today", "plan", "learn", "progress"] as const satisfies readonly AppTab[];
const tabSet = new Set<string>(tabs);

export function tabFromPathname(pathname: string): AppTab {
  const firstSegment = pathname.split("/").find(Boolean)?.toLowerCase();
  return firstSegment && tabSet.has(firstSegment) ? firstSegment as AppTab : "today";
}

export function pathForTab(tab: AppTab): string {
  return `/${tab}/`;
}

export const staticTabPaths = tabs.map(pathForTab);
