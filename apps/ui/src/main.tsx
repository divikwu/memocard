import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { WebAppearanceProvider } from "../ui-next/web/WebAppearance";
import "../ui-next/styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><WebAppearanceProvider><App /></WebAppearanceProvider></StrictMode>);
