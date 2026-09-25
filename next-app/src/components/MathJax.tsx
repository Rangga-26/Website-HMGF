"use client";

import { useEffect } from "react";

declare global { interface Window { MathJax?: { typesetPromise?: (elements?: HTMLElement[]) => Promise<void> } } }

export default function MathJax({ children }: { children: React.ReactNode }) {
  useEffect(() => { const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"; script.async = true; script.onload = () => window.MathJax?.typesetPromise?.(); document.head.appendChild(script); return () => script.remove(); }, []);
  return <>{children}</>;
}
