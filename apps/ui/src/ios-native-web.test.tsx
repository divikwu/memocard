// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const bridge=vi.hoisted(()=>({request:vi.fn()}));
vi.mock("./bridge",()=>({request:bridge.request}));
import { useIOSSurface, type NativeSurface } from "./ios-native";
afterEach(cleanup);
it("does not build or publish native view models for Web and Mac clients",()=>{
  const model=vi.fn(():NativeSurface=>({kind:"chrome",title:"主页"}));
  function Panel(){useIOSSurface("chrome",model,()=>{});return null;}
  const page=render(<Panel/>);page.rerender(<Panel/>);
  expect(model).not.toHaveBeenCalled();expect(bridge.request).not.toHaveBeenCalled();
});
