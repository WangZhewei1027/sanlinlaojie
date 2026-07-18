"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { stories } from "./stories";

export default function DesignSystemPage() {
  const [activeId, setActiveId] = useState(stories[0].id);
  const active = stories.find((s) => s.id === activeId) ?? stories[0];
  const ActiveStory = active.component;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <aside className="flex w-56 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-4">
          <h1 className="text-sm font-semibold">Design System</h1>
          <p className="text-xs text-muted-foreground">components/ui</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {stories.map((story) => (
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
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-8 p-8">
          <div>
            <h2 className="text-2xl font-bold">{active.name}</h2>
            <p className="text-sm text-muted-foreground">
              components/ui/{active.id}.tsx
            </p>
          </div>
          <ActiveStory />
        </div>
      </main>
    </div>
  );
}
