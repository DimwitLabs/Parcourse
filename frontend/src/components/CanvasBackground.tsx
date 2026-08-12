import { useEffect } from "react";
import { createPortal } from "react-dom";

function CanvasLayer() {
  useEffect(() => {
    let frame = 0;
    function update(x: number, y: number) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--mouse-x", `${x}px`);
        document.documentElement.style.setProperty("--mouse-y", `${y}px`);
        const sx = window.scrollX % 26;
        const sy = window.scrollY % 26;
        document.documentElement.style.setProperty("--scroll-x", `${13 - sx}px`);
        document.documentElement.style.setProperty("--scroll-y", `${13 - sy}px`);
      });
    }
    let lastX = -999, lastY = -999;
    function onMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      update(lastX, lastY);
    }
    function onScroll() {
      update(lastX, lastY);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="canvas-grid" />
      <div className="canvas-glow" />
    </>
  );
}

export default function CanvasBackground() {
  return createPortal(<CanvasLayer />, document.body);
}
