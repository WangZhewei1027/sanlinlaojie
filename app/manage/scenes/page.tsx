import type { Metadata } from "next";
import { Suspense } from "react";
import { ScenesPage } from "./components/ScenesPage";

export const metadata: Metadata = { title: "场景" };

export default function Page() {
  return <Suspense><ScenesPage /></Suspense>;
}
