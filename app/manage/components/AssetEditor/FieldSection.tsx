"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldSectionProps {
  /** Section heading (already translated) */
  title: string;
  /** Optional one-line helper shown under the heading (already translated) */
  hint?: string;
  icon?: LucideIcon;
  /** Whether the section starts expanded. Defaults to true. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * 编辑器中的字段分组容器（模仿 Unity Inspector 的折叠组）。
 *
 * 视觉层级（从强到弱，全编辑器统一）：
 *   分组标题 text-sm/semibold  >  字段标签 text-xs/medium  >  数值 text-sm
 *
 * 结构：可点击的折叠标题（披露箭头 + 图标 + 标题）+ 缩进的内容区。
 * 内容区以左侧导轨（border-l）+ 左内边距形成 Inspector 式的层级缩进，
 * 让子字段在视觉上明确从属于其分组。
 * 新增分组时直接复用此组件即可，无需重复样式。
 */
export function FieldSection({
  title,
  hint,
  icon: Icon,
  defaultOpen = true,
  children,
}: FieldSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-md border border-border/60 bg-muted/20">
      <div className="flex items-center rounded-t-md transition-colors hover:bg-muted/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 rounded-t-md px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          {Icon && (
            <Icon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </button>
        {hint && (
          <span
            tabIndex={0}
            role="note"
            aria-label={hint}
            className="group/tip relative mr-2.5 flex shrink-0 items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground" />
            <span className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-max max-w-[16rem] rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/tip:opacity-100 group-focus/tip:opacity-100">
              {hint}
            </span>
          </span>
        )}
      </div>
      {open && (
        <div className="px-2.5 pb-3 pt-1">
          <div className="ml-1.5 space-y-4 pl-3">{children}</div>
        </div>
      )}
    </section>
  );
}
