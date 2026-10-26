// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readIOSPalette } from "./ios-palette";

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it("samples the fixed native key set as RGBA and skips undefined CSS tokens",()=>{
  vi.stubGlobal("CanvasRenderingContext2D",class {});
  const clearRect=vi.fn(),fillRect=vi.fn();
  const context={clearRect,fillRect,fillStyle:"",getImageData:()=>({data:new Uint8ClampedArray([10,20,30,128])})};
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const getPropertyValue=vi.fn((key:string)=>key === "--color-background-body" || key === "--tag-blue-fg" ? "rgb(10 20 30 / 50%)" : "");
  vi.spyOn(window,"getComputedStyle").mockReturnValue({getPropertyValue} as unknown as CSSStyleDeclaration);

  expect(readIOSPalette()).toEqual({background:[10,20,30,128],"tag-blue-fg":[10,20,30,128]});
  expect(getPropertyValue).toHaveBeenCalledWith("--color-background-body");
  expect(getPropertyValue).toHaveBeenCalledWith("--color-accent");
  expect(getPropertyValue).toHaveBeenCalledWith("--color-background-sidebar");
  expect(getPropertyValue).toHaveBeenCalledWith("--tag-blue-fg");
  expect(clearRect).toHaveBeenCalledTimes(2);
  expect(fillRect).toHaveBeenCalledTimes(2);
});

it("does not publish an empty palette when canvas rendering is unavailable",()=>{
  vi.stubGlobal("CanvasRenderingContext2D",undefined);
  expect(readIOSPalette()).toBeUndefined();
});
