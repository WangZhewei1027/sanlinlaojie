"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Text } from "@/components/ui/typography";
import { useIntegrationText, type IntegrationTexts } from "../lib/integration-text";

const TEXTS: IntegrationTexts = {
  "contentModel.integration.redirect.opening": ["正在打开…", "Opening…"],
};

/** Client-side replace for compatibility URLs; keeps the query the caller built. */
export function RouteRedirect({ to }: { to: string }) {
  const router = useRouter();
  const tx = useIntegrationText(TEXTS);
  useEffect(() => { router.replace(to); }, [router, to]);
  return <Text as="p" variant="bodySm" tone="subdued" role="status" className="px-4 py-6">{tx("contentModel.integration.redirect.opening")}</Text>;
}
