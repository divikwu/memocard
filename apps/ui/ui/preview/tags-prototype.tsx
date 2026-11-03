import "./environment";
import { createRoot } from "react-dom/client";
import { WebAppearanceProvider } from "../web/WebAppearance";
import { TagsCapsulesPrototype } from "../business/TagsCapsules.prototype";
import "../styles.css";

// Throwaway, memory-only preview. Run: pnpm --filter @memocard/ui dev:states
if (import.meta.env.DEV) createRoot(document.getElementById("root")!).render(<WebAppearanceProvider><TagsCapsulesPrototype /></WebAppearanceProvider>);
