"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Text } from "@/components/ui/typography";
import { ContentNav } from "./ContentNav";

export interface TeamFrameProps {
  organizationId: string | null;
  teamName?: string;
  showSettings: boolean;
  aside?: ReactNode;
  children: ReactNode;
}

/** Shared library frame, independent of auth and data loading. */
export function TeamFrame({ organizationId, teamName, showSettings, aside, children }: TeamFrameProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigation = (onNavigate?: () => void) => <ContentNav organizationId={organizationId} showSettings={showSettings} onNavigate={onNavigate} />;
  const teamLabel = teamName || t("contentModel.library.team");

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] bg-muted/20">
      <aside className="hidden w-56 shrink-0 border-e bg-background md:block">
        <div className="sticky top-0 space-y-6 px-4 py-7">
          <div className="flex min-w-0 items-center gap-3 px-3">
            <Building2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <Text as="p" variant="bodySm" fontWeight="semibold" truncate title={teamLabel}>{teamLabel}</Text>
          </div>
          {navigation()}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="mb-5 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline"><Menu aria-hidden />{t("contentModel.library.browse")}</Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined}>
              <SheetHeader><SheetTitle>{teamLabel}</SheetTitle></SheetHeader>
              <div className="px-4">{navigation(() => setOpen(false))}</div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5">
          {aside && <div className="flex flex-wrap items-center justify-end gap-2">{aside}</div>}
          {children}
        </div>
      </main>
    </div>
  );
}
