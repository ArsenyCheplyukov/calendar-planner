import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { DesignGallery } from "./pages/DesignGallery.js";
import "./tokens.css";
import "./global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const isDesignGallery = window.location.pathname === "/__design";

createRoot(rootElement).render(
  <StrictMode>
    {isDesignGallery ? <DesignGallery /> : <App />}
  </StrictMode>,
);
