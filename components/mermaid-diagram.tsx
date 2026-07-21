"use client";

import { useEffect, useRef } from "react";

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("[mermaid-debug] effect run, chart:", JSON.stringify(chart).slice(0, 120));
    if (!ref.current) return;
    import("mermaid").then(({ default: mermaid }) => {
      console.log("[mermaid-debug] module loaded");
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid
        .render(id, chart)
        .then(({ svg }) => {
          console.log("[mermaid-debug] rendered, ref:", !!ref.current);
          if (ref.current) ref.current.innerHTML = svg;
        })
        .catch((err) => {
          console.error("Mermaid render failed:", err);
        });
    });
  }, [chart]);

  return <div ref={ref} className="my-6 flex justify-center" />;
}
