import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { MermaidDiagram } from "@/components/mermaid-diagram";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    pre: ({ children, ...props }: ComponentPropsWithoutRef<"pre">) => {
      const child = children as React.ReactElement<
        ComponentPropsWithoutRef<"code">
      >;
      const className = child?.props?.className ?? "";
      if (className.includes("language-mermaid")) {
        const chart = String(child?.props?.children ?? "").trim();
        return <MermaidDiagram chart={chart} />;
      }
      return <pre {...props}>{children}</pre>;
    },
    ...components,
  };
}
