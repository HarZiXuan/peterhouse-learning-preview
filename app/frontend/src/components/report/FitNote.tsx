"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The teachers' note fills its box: the type grows (or shrinks) until the words reach the bottom, so a page never ends
 * in an empty band. The PDF printer waits for data-fit="done".
 */
export function FitNote({ className, text, children }: { className: string; text: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let live = true;
    const set = (size: number) => {
      box.style.setProperty("--fit-size", `${size}px`);
      box.style.setProperty("--fit-lh", `${Math.round(size * 1.7)}px`);
    };
    const fit = () => {
      if (!live) return;
      // Largest size, in half pixels, whose words still fit (scrollHeight counts the bottom padding).
      let lo = 24;
      let hi = 48;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        set(mid / 2);
        if (box.scrollHeight <= box.clientHeight) lo = mid;
        else hi = mid - 1;
      }
      set(lo / 2);
      box.dataset.fit = "done";
    };
    fit();
    document.fonts.ready.then(fit);
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <section ref={ref} className={className} data-fit="pending">
      {children}
    </section>
  );
}
