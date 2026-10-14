"use client";
import { use } from "react";
import dynamic from "next/dynamic";
const SceneEditor = dynamic(() => import("./SceneEditor"), { ssr: false });
export function SceneEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SceneEditor assetId={id} />;
}
