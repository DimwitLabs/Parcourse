import { useEffect } from "react";
import type { ReactNode } from "react";

function useDotGlow() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let lastX = -999;
    let lastY = -999;

    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--mouse-x", `${lastX}px`);
        root.style.setProperty("--mouse-y", `${lastY}px`);
        root.style.setProperty("--scroll-x", `${13 - (window.scrollX % 26)}px`);
        root.style.setProperty("--scroll-y", `${13 - (window.scrollY % 26)}px`);
      });
    }

    function onMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      update();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);
}

export default function Root({ children }: { children: ReactNode }) {
  useDotGlow();
  return (
    <>
      <div className="canvas-glow" />
      {children}
    </>
  );
}
