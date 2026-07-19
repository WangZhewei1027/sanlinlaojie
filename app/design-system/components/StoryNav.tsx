"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TypographySmall } from "@/components/ui/typography";
import { storyGroups } from "../stories";

export function StoryNav() {
  const pathname = usePathname();

  return (
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
              {group.items.map((story) => {
                const href = `/design-system/${story.id}`;
                return (
                  <Link
                    key={story.id}
                    href={href}
                    className={cn(
                      "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                      pathname === href
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {story.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
