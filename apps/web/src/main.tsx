import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { Settings } from "./pages/Settings.js";
import { DesignGallery } from "./pages/DesignGallery.js";
import "./tokens.css";
import "./global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const path = window.location.pathname;

function renderAt(node: Element, element: React.ReactElement) {
  createRoot(node).render(<StrictMode>{element}</StrictMode>);
}

if (path === "/__design") {
  renderAt(rootElement, <DesignGallery />);
} else if (path === "/settings") {
  renderAt(rootElement, <Settings />);
} else {
  renderAt(rootElement, <App />);
}
