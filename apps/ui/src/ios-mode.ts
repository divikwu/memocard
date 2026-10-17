declare global {
  interface Window { __memocardNativeChrome?: boolean }
}
export const isIOSNative = typeof window !== "undefined" && window.__memocardNativeChrome === true;
