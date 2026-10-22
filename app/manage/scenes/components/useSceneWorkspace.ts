"use client";
import { useEffect, useState } from "react";
export function useSceneWorkspace() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const screen = window.matchMedia("(min-width: 1024px)");
    const change = () => { setCompact(!screen.matches); setPanelOpen(screen.matches); };
    change(); screen.addEventListener("change", change);
    return () => screen.removeEventListener("change", change);
  }, []);
  return { compact, panelOpen, togglePanel: () => setPanelOpen(open => !open) };
}
