import type { Metadata } from "next";
import { Suspense } from "react";
import { CollectionsRoute } from "./components/CollectionsRoute";

export const metadata: Metadata = { title: "合集" };

export default function CollectionsPage() {
  return <Suspense><CollectionsRoute /></Suspense>;
}
