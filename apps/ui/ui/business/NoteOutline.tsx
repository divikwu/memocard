import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { richBlockHighlightPath } from "../../src/rich-block-highlight";
import { useIsMobile } from "../hooks/use-mobile";
import { Button } from "../components/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../components/popover";
import "./NoteOutline.css";

type Heading = { pos: number; level: number; text: string };
type Mount = { host: HTMLElement; scroller: HTMLElement };

export function NoteOutline({ editor }: { editor: Editor }) {
  const [mount, setMount] = useState<Mount | null>(null);
  const headings = useEditorState({ editor, selector: ({ editor }) => {
    const items: Heading[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "heading") return;
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (text) items.push({ pos, level: node.attrs.level, text });
    });
    return items;
  } });
  useLayoutEffect(() => {
    const scroller = editor.view.dom.closest<HTMLElement>(".note-page-scroll");
    const host = scroller?.closest<HTMLElement>(".web-app-main");
    if (host?.closest(".web-app[data-web-client]") && scroller) setMount({ host, scroller });
  }, [editor]);
  if (!mount || headings.length < 2) return null;
  return createPortal(<DesktopOutline editor={editor} headings={headings} {...mount} />, mount.host);
}

function DesktopOutline(props: { editor: Editor; headings: Heading[] } & Mount) {
  return useIsMobile() ? null : <OutlineNavigation {...props} />;
}

function OutlineNavigation({ editor, headings, host, scroller }: { editor: Editor; headings: Heading[] } & Mount) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(headings[0].pos);
  const returningFocus = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const jumpTarget = useRef<{ element: HTMLElement; scrollTop: number } | null>(null);
  const navigation = useRef<HTMLElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const flashTarget = useRef<HTMLElement | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const minLevel = Math.min(...headings.map(item => item.level));
  const targetAt = useCallback((pos: number) => {
    const node = editor.view.nodeDOM(pos);
    return node instanceof HTMLElement ? node : null;
  }, [editor]);
  const drawFlash = useCallback(() => {
    if (!flash.current || !flashTarget.current) return;
    flash.current.querySelector("path")?.setAttribute("d", richBlockHighlightPath(flashTarget.current, host.getBoundingClientRect()));
    flash.current.hidden = false;
  }, [host]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller.getBoundingClientRect().top + (parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 56) + 8;
      const visible = headings.map(item => ({ item, target: targetAt(item.pos) })).filter(({ target }) => target && !target.closest("[hidden]"));
      let current: number | undefined = visible[0]?.item.pos;
      for (const { item, target } of visible) {
        // Native scroll offsets can round a fractional heading position to a device pixel.
        if (target!.getBoundingClientRect().top > top + 1) break;
        current = item.pos;
      }
      const requested = jumpTarget.current;
      const anchored = requested && Math.abs(scroller.scrollTop - requested.scrollTop) <= 1 ? visible.find(({ target }) => target === requested.element) : undefined;
      if (anchored) current = anchored.item.pos;
      else {
        jumpTarget.current = null;
        if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) current = visible.at(-1)?.item.pos;
      }
      if (current !== undefined) setActive(previous => previous === current ? previous : current);
      drawFlash();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resumeReading = () => { jumpTarget.current = null; schedule(); };
    const keyboardScroll = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) resumeReading(); };
    scroller.addEventListener("scroll", schedule, { passive: true });
    scroller.addEventListener("wheel", resumeReading, { passive: true });
    scroller.addEventListener("keydown", keyboardScroll);
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    observer.observe(editor.view.dom);
    update();
    return () => { scroller.removeEventListener("scroll", schedule); scroller.removeEventListener("wheel", resumeReading); scroller.removeEventListener("keydown", keyboardScroll); observer.disconnect(); cancelAnimationFrame(frame); };
  }, [editor, headings, scroller, targetAt, drawFlash]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const nav = navigation.current, item = nav?.querySelector<HTMLElement>("[aria-current]");
      if (!nav || !item) return;
      const bounds = nav.getBoundingClientRect(), target = item.getBoundingClientRect();
      if (target.top < bounds.top) nav.scrollTop += target.top - bounds.top;
      else if (target.bottom > bounds.bottom) nav.scrollTop += target.bottom - bounds.bottom;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, active, headings]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const jump = (heading: Heading) => {
    // Selection-only navigation reveals folded ancestors without changing Markdown or undo history.
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, heading.pos + 1)).setMeta("addToHistory", false));
    const target = targetAt(heading.pos);
    if (!target) return;
    const padding = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 56;
    scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - padding - 8, behavior: "instant" });
    jumpTarget.current = { element: target, scrollTop: scroller.scrollTop };
    setActive(heading.pos);
    flashTarget.current = target;
    drawFlash();
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { flashTarget.current = null; if (flash.current) flash.current.hidden = true; }, 700);
  };
  return <>
    <div className="ui-note-outline">
      <Popover open={open} onOpenChange={(next, details) => {
        returningFocus.current = !next && details.reason === "escape-key";
        // Hover-opened popovers do not enable Base UI's focus manager.
        if (returningFocus.current) trigger.current?.focus({ preventScroll: true });
        setOpen(next);
      }}>
        <PopoverTrigger openOnHover delay={120} closeDelay={180} render={<Button ref={trigger} variant="ghost" className="ui-note-outline-trigger" aria-label="打开笔记目录" />} onFocus={event => {
          if (returningFocus.current) { returningFocus.current = false; return; }
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}>
          <span className="ui-note-outline-marks" aria-hidden="true" style={{ "--outline-count": headings.length } as CSSProperties}>
            {headings.map(item => <span key={item.pos} data-active={item.pos === active || undefined} style={{ "--outline-depth": item.level - minLevel } as CSSProperties} />)}
          </span>
        </PopoverTrigger>
        <PopoverContent className="ui-note-outline-popup" side="left" align="start" sideOffset={0} collisionPadding={16} initialFocus={type => type === "keyboard" ? navigation.current?.querySelector<HTMLElement>("[aria-current]") ?? true : false} finalFocus={type => type === "keyboard"}>
          <PopoverTitle className="sr-only">笔记目录</PopoverTitle>
          <nav ref={navigation} aria-label="笔记目录"><ol>{headings.map(item => <li key={item.pos} style={{ "--outline-depth": item.level - minLevel } as CSSProperties}>
            <Button variant="ghost" className="ui-note-outline-link" aria-current={item.pos === active ? "location" : undefined} onClick={() => jump(item)}>{item.text}</Button>
          </li>)}</ol></nav>
        </PopoverContent>
      </Popover>
    </div>
    <div ref={flash} className="ui-rich-ui ui-note-outline-highlight" hidden aria-hidden="true"><svg className="rich-block-highlights" focusable="false"><path /></svg></div>
  </>;
}
