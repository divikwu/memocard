export const desktopViewport = { width: 1024, height: 900 };
export const mobileViewport = { width: 390, height: 844 };

export const viewportOptions = {
  desktop: { name: "桌面 · 1024 × 900", styles: { width: `${desktopViewport.width}px`, height: `${desktopViewport.height}px` }, type: "desktop" },
  mobile: { name: "H5 · 390 × 844", styles: { width: `${mobileViewport.width}px`, height: `${mobileViewport.height}px` }, type: "mobile" },
};

export const desktopGlobals = { viewport: { value: "desktop", isRotated: false } };
