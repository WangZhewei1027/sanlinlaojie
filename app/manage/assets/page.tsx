import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkbenchAlias } from "../components/WorkbenchAlias";

export const metadata: Metadata = { title: "工作台" };

/** Compatibility alias: the asset library is now the team workbench. */
export default function AssetLibraryAlias() {
  return <Suspense><WorkbenchAlias /></Suspense>;
}
