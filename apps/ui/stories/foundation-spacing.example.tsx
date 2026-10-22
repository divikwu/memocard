import { useLayoutEffect, useRef, useState } from "react";
import spacingCatalog from "../../../design/spacing-usage.generated.json";

export function SpacingPreview({ value, onMeasure }: { value: string; onMeasure?: (value: number) => void }) {
  const root = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!onMeasure) return;
    const element = root.current!;
    const measure = () => {
      onMeasure(Math.round(element.getBoundingClientRect().width * 1000) / 1000);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, onMeasure]);
  return <span ref={root} className="foundation-spacing-preview" aria-hidden="true" data-zero={value === "0px" || undefined} style={{ width: value }} />;
}

function WebSpacingRow({ step, value }: { step: string; value: string }) {
  const [pixels, setPixels] = useState<number>();
  return <tr data-token-kind="upstream-spacing" data-token-name={`spacing-${step}`} data-spacing-expression={value}>
    <th scope="row"><code>{step === "px" ? "px" : `--spacing × ${step}`}</code></th>
    <td><span className="foundation-spacing-value"><SpacingPreview value={value} onMeasure={setPixels} /><code>{pixels === undefined ? "…" : `${pixels}px`}</code></span></td>
  </tr>;
}

export function WebSpacingRows() {
  return spacingCatalog.scale.map(row => <WebSpacingRow key={row.step} {...row} />);
}

export function WebSpacingBase() {
  return <p className="foundation-note">上游基准：<code>{spacingCatalog.upstream.name} = {spacingCatalog.upstream.value}</code>。数值按当前根字号换算；横条宽度等于该档间距。</p>;
}
