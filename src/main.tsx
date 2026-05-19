import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Sync dark class with OS preference and watch for changes.
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}
const mq = window.matchMedia("(prefers-color-scheme: dark)");
applyTheme(mq.matches);
mq.addEventListener("change", (e) => applyTheme(e.matches));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
