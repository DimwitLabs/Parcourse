import React from "react";
import ReactDOM from "react-dom/client";

import CanvasBackground from "../components/CanvasBackground";
import ToastContainer from "../components/Toast";
import DesignSystem from "./DesignSystem";
import "../styles.css";
import "./design-system.css";

if (!("popover" in HTMLElement.prototype)) await import("@oddbird/popover-polyfill");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CanvasBackground />
    <DesignSystem />
    <ToastContainer />
  </React.StrictMode>,
);
