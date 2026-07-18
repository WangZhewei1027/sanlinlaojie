"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  TypographyH1,
  TypographySmall,
} from "@/components/ui/typography";
import { stories, storyGroups } from "./stories";

export default function DesignSystemPage() {
  const [activeId, setActiveId] = useState(stories[0].id);
  const active = stories.find((s) => s.id === activeId) ?? stories[0];
  const ActiveStory = active.component;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <aside className="flex w-56 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-4">
          <p className="text-sm font-semibold">Design System</p>
          <TypographySmall>components/ui</TypographySmall>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {storyGroups.map((group) => (
            <div key={group.title}>
              <TypographySmall className="block px-3 pb-1 pt-2 font-semibold">
                {group.title}
              </TypographySmall>
              <div className="space-y-0.5">
                {group.items.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => setActiveId(story.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                      story.id === activeId
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {story.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-8 p-8">
          <div className="space-y-1">
            <TypographyH1>{active.name}</TypographyH1>
            <TypographySmall className="block">
              {active.path ?? `components/ui/${active.id}.tsx`}
            </TypographySmall>
          </div>
          <ActiveStory />
        </div>
      </main>
    </div>
  );
}
