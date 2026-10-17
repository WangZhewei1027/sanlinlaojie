import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetDetailRoute } from "../components/AssetDetailRoute";

export const metadata: Metadata = { title: "素材详情" };

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><AssetDetailRoute params={params} /></Suspense>;
}
