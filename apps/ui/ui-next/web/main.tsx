import { createRoot } from "react-dom/client";
import { App } from "../../src/App";
import { WebAppearanceProvider } from "./WebAppearance";
import { preloadWebEditor, renderWebApp } from "./WebAppView";
import "../styles.css";

createRoot(document.getElementById("root")!).render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
