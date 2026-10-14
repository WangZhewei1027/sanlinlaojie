import type { Metadata } from "next";
import { Suspense } from "react";
import { SceneEditorRoute } from "../components/SceneEditorRoute";

export const metadata: Metadata = { title: "场景编排" };

export default function ScenePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><SceneEditorRoute params={params} /></Suspense>;
}
