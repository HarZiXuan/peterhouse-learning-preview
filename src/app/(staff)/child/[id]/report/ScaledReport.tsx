"use client";

import { useEffect, useRef, useState } from "react";

const A4_PX = 794; // 210mm at 96dpi

/** Shrinks the fixed-size A4 preview to fit narrow screens (phones) so the whole page is readable without side-scrolling. */
export function ScaledReport({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / A4_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="report-wrap">
      <div style={{ zoom }}>{children}</div>
    </div>
  );
}
