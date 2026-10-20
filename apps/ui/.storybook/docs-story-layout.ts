// Keep isolated Docs previews centered without tying natural height to the viewport.
export function observeDocsStoryLayout(frame: HTMLIFrameElement, { autoHeight, centered }: { autoHeight: boolean; centered: boolean }) {
  let observer: ResizeObserver | undefined;
  let restoreLayout: (() => void) | undefined;
  const observeContent = () => {
    observer?.disconnect();
    restoreLayout?.();
    restoreLayout = undefined;
    const content = frame.contentDocument;
    const root = content?.getElementById("storybook-root");
    const view = content?.defaultView;
    if (!root || !view) return;
    if (centered) {
      const originalStyle = root.style.cssText;
      Object.assign(root.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        width: "100%",
        maxWidth: "100%",
        // Storybook's padded layout adds 1rem on each side after story loading.
        minHeight: autoHeight ? "" : "calc(100vh - 2rem)",
      });
      restoreLayout = () => { root.style.cssText = originalStyle; };
      if (!autoHeight) return;
    }
    const resize = () => {
      const body = view.getComputedStyle(content.body);
      frame.style.height = `${Math.ceil(root.getBoundingClientRect().height + parseFloat(body.paddingTop) + parseFloat(body.paddingBottom))}px`;
    };
    // body/html can fill the iframe; measure the root's natural content height.
    observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
  };
  frame.addEventListener("load", observeContent);
  observeContent();
  return () => {
    observer?.disconnect();
    restoreLayout?.();
    frame.removeEventListener("load", observeContent);
  };
}
