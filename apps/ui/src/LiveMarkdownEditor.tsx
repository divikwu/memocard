import { imageSource, openVaultLink } from "./vault-links";
import { forwardRef, useLayoutEffect, useRef } from "react";
import { Annotation, Compartment, EditorState, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, placeholder, WidgetType, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { decodeString } from "micromark-util-decode-string";
import { request } from "./bridge";
import { externalUrl, internalTarget } from "./urls";
import { bindNoteImage } from "./note-image";

type Props = {
  value: string;
  onChange: (value: string) => void;
  notePath: string;
  disabled: boolean;
  onSave: () => void;
  onError: (message: string) => void;
};

const externalChange = Annotation.define<boolean>();
const notePathChanged = StateEffect.define<string>();
const focusChanged = StateEffect.define<boolean>();
const imageCleanup = new WeakMap<HTMLElement, () => void>();

class ImagePreview extends WidgetType {
  constructor(readonly src: string, readonly alt: string) { super(); }
  eq(other: ImagePreview) { return this.src === other.src && this.alt === other.alt; }
  toDOM() {
    const image = document.createElement("img");
    image.className = "mc-live-image";
    image.alt = this.alt;
    image.draggable = false;
    imageCleanup.set(image, bindNoteImage(image, this.src));
    return image;
  }
  destroy(dom: HTMLElement) { imageCleanup.get(dom)?.(); imageCleanup.delete(dom); }
  ignoreEvent() { return false; }
}

function liveDecorations(state: EditorState, notePath: string, focused: boolean): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const selection = state.selection.main;
  const activeFrom = state.doc.lineAt(selection.from).from;
  const activeTo = state.doc.lineAt(selection.to).to;
  const active = (from: number, to: number) => focused && from <= activeTo && to >= activeFrom;
  const mark = (from: number, to: number, className: string) => {
    if (to > from) ranges.push(Decoration.mark({ class: className }).range(from, to));
  };
  const hide = (from: number, to: number) => {
    if (to > from && state.doc.lineAt(from).number === state.doc.lineAt(to).number) ranges.push(Decoration.replace({}).range(from, to));
  };
  const tree = ensureSyntaxTree(state, Math.min(state.doc.length, 10000), 50) ?? syntaxTree(state);
  tree.iterate({ enter(reference) {
    const node = reference.node;
    const { from, to, name } = node;
    const editing = active(from, to);
    const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
    if (heading) ranges.push(Decoration.line({ class: `mc-live-heading mc-live-heading-${heading[1]}` }).range(state.doc.lineAt(from).from));
    if (name === "StrongEmphasis") mark(from, to, "mc-live-strong");
    if (name === "Emphasis") mark(from, to, "mc-live-emphasis");
    if (name === "Strikethrough") mark(from, to, "mc-live-strike");
    if (name === "InlineCode") mark(from, to, "mc-live-inline-code");
    if (name === "FencedCode" || name === "CodeBlock") {
      for (let line = state.doc.lineAt(from); line.from < to; line = state.doc.line(line.number + 1)) {
        ranges.push(Decoration.line({ class: "mc-live-code-line" }).range(line.from));
        if (line.number === state.doc.lines) break;
      }
    }
    if (name === "QuoteMark") mark(from, to, "mc-live-quote");
    if (name === "ListMark" || name === "CodeInfo") mark(from, to, "mc-live-marker");
    if (name === "Image" || name === "Link") {
      const url = node.getChild("URL");
      // Reference-style and unfamiliar syntax stay editable as written.
      if (!url) return false;
      const raw = decodeString(state.doc.sliceString(url.from, url.to).replace(/^<|>$/g, ""));
      const closing = node.getChildren("LinkMark").find((child) => state.doc.sliceString(child.from, child.to) === "]");
      if (!closing) return false;
      if (name === "Image") {
        const src = imageSource(raw, notePath);
        if (!src) { mark(from, to, "mc-live-blocked"); return false; }
        const widget = new ImagePreview(src, state.doc.sliceString(from + 2, closing.from));
        if (!editing && state.doc.lineAt(from).number === state.doc.lineAt(to).number) {
          ranges.push(Decoration.replace({ widget }).range(from, to));
        } else ranges.push(Decoration.widget({ widget, side: 1 }).range(to));
      } else {
        const href = externalUrl(raw) ?? (internalTarget(raw) ? `memocard-internal:${encodeURIComponent(raw)}` : null);
        if (href) ranges.push(Decoration.mark({
          class: "mc-live-link", tagName: "a", attributes: { href, "data-memocard-link": href, title: "⌘ / Ctrl + 单击打开链接", tabindex: "-1" },
        }).range(from + 1, closing.from));
        if (!editing && href) { hide(from, from + 1); hide(closing.from, to); }
      }
      return false;
    }
    if ((name === "EmphasisMark" || name === "StrikethroughMark" || (name === "CodeMark" && node.parent?.name === "InlineCode")) && !editing) hide(from, to);
    if (name === "HeaderMark" && node.parent?.name.startsWith("ATXHeading") && !editing) {
      hide(from, to + (state.doc.sliceString(to, to + 1) === " " ? 1 : 0));
    }
  } });
  for (const match of state.doc.toString().matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
    const from = match.index!, to = from + match[0].length;
    let node = tree.resolveInner(from, 1);
    let code = false;
    while (node.parent) { if (["InlineCode", "FencedCode", "CodeBlock", "Link", "Image"].includes(node.name)) code = true; node = node.parent; }
    if (code) continue;
    const [target, label] = match[2].split("|");
    if (match[1]) {
      if (!/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(target)) continue;
      const src = imageSource(target, notePath, true);
      if (!src) continue;
      const widget = new ImagePreview(src, label ?? target);
      if (!active(from, to)) ranges.push(Decoration.replace({ widget }).range(from, to));
      else ranges.push(Decoration.widget({ widget, side: 1 }).range(to));
    } else ranges.push(Decoration.mark({ class: "mc-live-link", tagName: "a", attributes: { "data-memocard-wiki": target, title: "⌘ / Ctrl + 单击打开笔记", tabindex: "-1" } }).range(from, to));
  }
  return Decoration.set(ranges, true);
}

function previewExtension(initialPath: string) {
  return StateField.define<{ decorations: DecorationSet; path: string; focused: boolean }>({
    create(state) { return { decorations: liveDecorations(state, initialPath, false), path: initialPath, focused: false }; },
    update(previous, transaction) {
      let { path, focused } = previous;
      for (const effect of transaction.effects) {
        if (effect.is(notePathChanged)) path = effect.value;
        if (effect.is(focusChanged)) focused = effect.value;
      }
      if (!transaction.docChanged && !transaction.selection && !transaction.effects.length) return previous;
      return { path, focused, decorations: liveDecorations(transaction.state, path, focused) };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });
}

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--foreground)", fontFamily: "inherit", fontSize: "16px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit", lineHeight: "2", overscrollBehavior: "contain" },
  ".cm-content": { minHeight: "100%", padding: "12px 24px 24px", caretColor: "var(--foreground)", overflowWrap: "anywhere" },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--accent)" },
  ".mc-live-heading": { fontWeight: "600", lineHeight: "1.6" },
  ".mc-live-heading-1": { fontSize: "1.5em" },
  ".mc-live-heading-2": { fontSize: "1.3em" },
  ".mc-live-heading-3": { fontSize: "1.15em" },
  ".mc-live-strong": { fontWeight: "700" },
  ".mc-live-emphasis": { fontStyle: "italic" },
  ".mc-live-strike": { textDecoration: "line-through" },
  ".mc-live-marker, .mc-live-quote, .mc-live-blocked": { color: "var(--muted-foreground)" },
  ".mc-live-inline-code, .mc-live-code-line": { fontFamily: "ui-monospace, SFMono-Regular, monospace", backgroundColor: "var(--muted)", borderRadius: "4px" },
  ".mc-live-inline-code": { padding: "0.1em 0.2em", fontSize: "0.9em" },
  ".mc-live-code-line": { padding: "0 8px" },
  ".mc-live-link": { color: "var(--accent-text)", textDecoration: "underline", textUnderlineOffset: "3px" },
  ".mc-live-image": { display: "block", maxWidth: "100%", height: "auto", maxHeight: "440px", objectFit: "contain", objectPosition: "left", borderRadius: "var(--radius)", margin: "8px 0" },
  "@media (max-width: 639px)": { ".cm-content": { paddingLeft: "20px", paddingRight: "20px" } },
});

export const LiveMarkdownEditor = forwardRef<HTMLDivElement, Props>(function LiveMarkdownEditor(props, forwardedRef) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  const initial = useRef(props);
  const editable = useRef(new Compartment());

  useLayoutEffect(() => { callbacks.current = props; });
  useLayoutEffect(() => {
    const current = initial.current;
    const editor = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: current.value,
        extensions: [
          // Split only LF: existing CRLF or mixed line endings remain source bytes.
          EditorState.lineSeparator.of("\n"),
          markdown({ base: markdownLanguage, addKeymap: false }), history(),
          keymap.of([...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"), ...historyKeymap]), EditorView.lineWrapping,
          placeholder("有什么想记下来的？"), theme,
          editable.current.of([EditorView.editable.of(!current.disabled), EditorState.readOnly.of(current.disabled)]),
          EditorView.contentAttributes.of({ role: "textbox", "aria-label": "笔记内容", "aria-multiline": "true", spellcheck: "false" }),
          previewExtension(current.notePath),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.every((transaction) => transaction.annotation(externalChange))) {
              callbacks.current.onChange(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            focus: (_event, editor) => { editor.dispatch({ effects: focusChanged.of(true) }); },
            blur: (_event, editor) => { editor.dispatch({ effects: focusChanged.of(false) }); },
            keydown: (event, editor) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                if (event.isComposing || event.keyCode === 229 || editor.composing) return false;
                event.preventDefault();
                if (!callbacks.current.disabled) callbacks.current.onSave();
                return true;
              }
              return false;
            },
            click: (event) => {
              const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-memocard-link], a[data-memocard-wiki]") : null;
              if (!link) return false;
              event.preventDefault();
              const raw = link.dataset.memocardLink ?? "";
              const internal = link.dataset.memocardWiki ?? (raw.startsWith("memocard-internal:") ? decodeURIComponent(raw.slice("memocard-internal:".length)) : undefined);
              if (internal !== undefined && (event.metaKey || event.ctrlKey)) void openVaultLink(internal, callbacks.current.notePath, link.dataset.memocardWiki !== undefined).catch((error: unknown) => callbacks.current.onError(error instanceof Error ? error.message : "无法打开笔记链接。"));
              const url = externalUrl(raw);
              if (url && (event.metaKey || event.ctrlKey)) void request("openExternal", { url }).catch(() => callbacks.current.onError("无法打开链接，请在 App 中重试。"));
              return false;
            },
          }),
        ],
      }),
    });
    view.current = editor;
    if (typeof forwardedRef === "function") forwardedRef(editor.contentDOM as HTMLDivElement);
    else if (forwardedRef) forwardedRef.current = editor.contentDOM as HTMLDivElement;
    return () => {
      if (typeof forwardedRef === "function") forwardedRef(null);
      else if (forwardedRef) forwardedRef.current = null;
      editor.destroy(); view.current = null;
    };
  }, [forwardedRef]);

  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const old = editor.state.doc.toString();
    if (old !== props.value) {
      let from = 0, oldEnd = old.length, newEnd = props.value.length;
      while (from < oldEnd && from < newEnd && old[from] === props.value[from]) from++;
      while (oldEnd > from && newEnd > from && old[oldEnd - 1] === props.value[newEnd - 1]) { oldEnd--; newEnd--; }
      const appendingAtCursor = from === old.length && editor.state.selection.main.empty && editor.state.selection.main.head === old.length;
      editor.dispatch({
        changes: { from, to: oldEnd, insert: props.value.slice(from, newEnd) },
        ...(appendingAtCursor ? { selection: { anchor: props.value.length } } : {}),
        annotations: externalChange.of(true),
      });
    }
  }, [props.value]);
  useLayoutEffect(() => { view.current?.dispatch({ effects: notePathChanged.of(props.notePath) }); }, [props.notePath]);
  useLayoutEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure([EditorView.editable.of(!props.disabled), EditorState.readOnly.of(props.disabled)]) });
    view.current?.contentDOM.setAttribute("aria-disabled", String(props.disabled));
  }, [props.disabled]);

  return <div ref={container} className="h-full min-h-0" />;
});
