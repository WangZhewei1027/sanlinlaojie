import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkbenchAlias } from "../components/WorkbenchAlias";

export const metadata: Metadata = { title: "工作台" };

/** Compatibility alias: scenes live in the team workbench under the 场景 filter. */
export default function ScenesAlias() {
  return <Suspense><WorkbenchAlias type="scene" /></Suspense>;
}
