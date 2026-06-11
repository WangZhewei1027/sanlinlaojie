"use client";

import { cn } from "@/lib/utils";

interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

/**
 * 编辑器中所有字段标签的统一样式。
 * 字段标签始终从属于其所在分组的标题，因此使用比分组标题更小、更弱的字号。
 * 新增字段时请复用此组件，避免字号层级再次错乱。
 */
export function FieldLabel({ children, className, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn("text-xs font-medium text-muted-foreground", className)}
      {...props}
    >
      {children}
    </label>
  );
}
