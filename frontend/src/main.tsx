import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import CanvasBackground from "./components/CanvasBackground";
import ToastContainer from "./components/Toast";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CanvasBackground />
    <AuthProvider>
      <App />
    </AuthProvider>
    <ToastContainer />
  </React.StrictMode>,
);
