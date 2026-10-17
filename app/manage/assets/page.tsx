import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetLibraryRoute } from "./components/AssetLibraryRoute";

export const metadata: Metadata = { title: "素材库" };

export default function AssetLibraryPage() {
  return <Suspense><AssetLibraryRoute /></Suspense>;
}
