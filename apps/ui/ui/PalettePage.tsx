import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";
import { paletteColors, paletteGroups, paletteVersion } from "./palette-catalog";
import { usePreviewMode } from "./preview-mode";
import "./token-page.css";
import "./palette-page.css";

export function PalettePage() {
  const mode = usePreviewMode();
  const root = useRef<HTMLElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState(paletteGroups[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useLayoutEffect(() => {
    const document = root.current!.ownerDocument;
    const computed = getComputedStyle(root.current!);
    const sample = document.createElement("span");
    sample.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
    root.current!.append(sample);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
    const next: Record<string, string> = {};
    for (const color of paletteColors) {
      if (!computed.getPropertyValue(color.name).trim()) {
        next[color.name] = "";
        continue;
      }
      sample.style.color = `var(${color.name})`;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = getComputedStyle(sample).color;
      context.fillRect(0, 0, 1, 1);
      const rgba = [...context.getImageData(0, 0, 1, 1).data];
      next[color.name] = `#${rgba.slice(0, rgba[3] === 255 ? 3 : 4).map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
    }
    sample.remove();
    setValues(next);
  }, [mode]);

  useEffect(() => {
    const sections = [...root.current!.querySelectorAll<HTMLElement>("section[id]")];
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top > innerHeight * .15) break;
        current = section;
      }
      if (Math.ceil(scrollY + innerHeight) >= root.current!.ownerDocument.documentElement.scrollHeight) current = sections[sections.length - 1];
      setActive(current.id.replace("palette-", ""));
    };
    const schedule = () => { frame ??= requestAnimationFrame(update); };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => { removeEventListener("scroll", schedule); removeEventListener("resize", schedule); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, []);

  async function copyHex(name: string) {
    try {
      await navigator.clipboard.writeText(values[name]);
      setCopied(name);
      setMessage(`已复制 ${name} 的 HEX：${values[name]}`);
    } catch {
      setMessage("复制失败，请选取色值后手动复制。");
    }
  }

  return <main ref={root} data-ui-theme={mode} data-token-category="palette" aria-busy={Object.keys(values).length !== paletteColors.length} className="ui-theme token-document palette-document sb-unstyled">
    <header className="token-header"><h1>Palette</h1><p className="token-lead">Tailwind 默认基础色板。原始值直接来自当前安装的 theme.css，基础颜色保持固定，浅深色切换仅改变文档表面。</p>
      <p className="token-meta">Tailwind CSS {paletteVersion} · {paletteGroups.filter(group => group.id !== "base").length} 个色系 × {paletteGroups[0].colors.length} 阶 ＋ {paletteGroups.find(group => group.id === "base")!.colors.length} 个基础色 · {paletteColors.length} 个基础颜色</p>
      <p className="palette-intro">点击 HEX 复制色值；变量名和原始 OKLCH／HEX 可直接选取。此页基础色与 Colors 页的语义角色分别计数。</p>
      <span className="sr-only" role="status">{message}</span>
    </header>
    <nav className="token-toc" aria-label="本页内容"><span>On this page</span><ul>{paletteGroups.map(group => <li key={group.id}><a href={`#palette-${group.id}`} target="_self" aria-current={active === group.id ? "location" : undefined} onClick={() => setActive(group.id)}>{group.label}</a></li>)}</ul></nav>
    <div className="token-body">{paletteGroups.map(group => <section key={group.id} id={`palette-${group.id}`} aria-labelledby={`palette-title-${group.id}`}><h2 id={`palette-title-${group.id}`}><a href={`#palette-${group.id}`} target="_self">{group.label}</a></h2>
      <div className="token-table-wrap palette-table-wrap"><table className="token-table palette-table" aria-label={`${group.label} palette`}>
        <thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Preview</th></tr></thead>
        <tbody>{group.colors.map(color => <tr key={color.name} data-palette-color={color.name}>
          <th scope="row"><code className="palette-name">{color.name}</code></th>
          <td><code className="palette-source" data-palette-source>{color.value}</code>
            <button type="button" className="palette-copy" disabled={!values[color.name]} aria-label={`复制 ${color.name} 的 HEX ${values[color.name] ?? ""}`} onClick={() => { void copyHex(color.name); }}>
              <code data-palette-hex>{values[color.name] || (Object.keys(values).length ? "未输出" : "读取中…")}</code>{copied === color.name ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            </button>
          </td>
          <td><span aria-hidden="true" className="palette-swatch" style={{ backgroundColor: `var(${color.name})` }} /></td>
        </tr>)}</tbody>
      </table></div>
    </section>)}
      <footer className="token-note">来源：已安装的 <code>tailwindcss/theme.css</code>（Tailwind CSS {paletteVersion}，MIT）。OKLCH 保留原值；HEX 为浏览器转换的 sRGB 近似值。主题语义色与基础色板分别维护。</footer>
    </div>
  </main>;
}
