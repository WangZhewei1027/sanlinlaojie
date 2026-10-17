import { Suspense } from "react";
import { redirect } from "next/navigation";

export default function ManagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense><ManageEntry searchParams={searchParams} /></Suspense>;
}

async function ManageEntry({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.organizationId === "string") query.set("organizationId", params.organizationId);
  return redirect(`/manage/assets${query.size ? `?${query}` : ""}`);
}
