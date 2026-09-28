// Only the native loopback server adds this marker to the bundled page.
export const isLocalWeb = typeof document !== "undefined"
  && document.querySelector<HTMLMetaElement>('meta[name="memocard-local-web"]')?.content === "1";

export const isBrowserVault = typeof window !== "undefined" && !isLocalWeb
  && !window.webkit?.messageHandlers?.memocard;
