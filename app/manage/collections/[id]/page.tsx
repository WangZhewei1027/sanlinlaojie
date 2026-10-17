import type { Metadata } from "next";
import { Suspense } from "react";
import { CollectionDetailRoute } from "../components/CollectionDetailRoute";

export const metadata: Metadata = { title: "地图合集" };

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><CollectionDetailRoute params={params} /></Suspense>;
}
