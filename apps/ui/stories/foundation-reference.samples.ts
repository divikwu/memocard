import { useEffect, useState } from "react";
import productCSS from "../src/styles.css?inline";
import tagCSS from "../src/tag-colors.css?inline";
import calloutCSS from "../src/import-layout.tokens.css?inline";
import captureCSS from "../src/features/theme/capture.tokens.css?inline";
import { applyAppearance } from "../src/features/theme/apply-appearance";
import { parseAppearance } from "../src/features/theme/preferences";
import { catalog } from "./foundation-reference.data";

export type FoundationSamples = { mode: "light" | "dark"; values: Record<string, string> };

// An isolated, script-free document resolves the current appearance without changing the Docs theme.
export function useFoundationValues() {
  const [samples, setSamples] = useState<FoundationSamples>({ mode: "light", values: {} });
  useEffect(() => {
    const frame = document.createElement("iframe");
    frame.title = "Token value resolver";
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    document.body.append(frame);
    const content = frame.contentDocument!;
    const style = content.createElement("style");
    style.textContent = `${productCSS}\n${tagCSS}\n${calloutCSS}\n${captureCSS}`;
    content.head.append(style);
    const sample = content.createElement("span");
    content.body.append(sample);
    const canvas = content.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
    let previous = "";
    const update = () => {
      const root = document.documentElement;
      const mode = root.classList.contains("dark") ? "dark" : "light";
      const { palette, neutralPalette, radius, headingFont, bodyFont } = root.dataset;
      const appearance = parseAppearance(JSON.stringify({ palette, neutralPalette, radius, headingFont, bodyFont }));
      const signature = JSON.stringify([mode, appearance]);
      if (signature === previous) return;
      previous = signature;
      applyAppearance(content.documentElement, appearance, mode);
      const computed = content.defaultView!.getComputedStyle(content.documentElement);
      const values: Record<string, string> = {};
      for (const token of catalog.css.filter(token => token.layer !== "adapter")) {
        if (token.category === "shape") {
          // Tailwind may inline these aliases instead of emitting their custom properties.
          sample.style.borderRadius = token.declarations[0].value;
          values[token.name] = content.defaultView!.getComputedStyle(sample).borderTopLeftRadius;
          continue;
        }
        if (token.type !== "color") {
          values[token.name] = computed.getPropertyValue(token.name).trim();
          continue;
        }
        sample.style.color = `var(${token.name})`;
        const color = content.defaultView!.getComputedStyle(sample).color;
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const rgba = [...context.getImageData(0, 0, 1, 1).data];
        values[token.name] = `#${rgba.slice(0, rgba[3] === 255 ? 3 : 4).map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
      }
      setSamples({ mode, values });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-palette", "data-neutral-palette", "data-radius", "data-heading-font", "data-body-font"] });
    return () => { observer.disconnect(); frame.remove(); };
  }, []);
  return samples;
}
