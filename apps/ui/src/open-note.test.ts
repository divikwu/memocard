import { expect, it, vi } from "vitest";
import { subscribeToOpenNotes } from "./open-note";

it("accepts a native note event, normalizes its id, and removes its listener", () => {
  const target = new EventTarget();
  const open = vi.fn();
  const unsubscribe = subscribeToOpenNotes(target, open);
  const detail = { id: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE" };
  target.dispatchEvent(new CustomEvent("memocard:open-note", { detail }));
  expect(open).toHaveBeenCalledWith("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  unsubscribe();
  target.dispatchEvent(new CustomEvent("memocard:open-note", { detail }));
  expect(open).toHaveBeenCalledTimes(1);
});

it.each([null, "notes/id", {}, { id: 42 }, { id: "../../note" }, { id: "';alert(1)//" }, { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?other=1" }])("ignores malformed note identifiers: %j", (detail) => {
  const target = new EventTarget();
  const open = vi.fn();
  const unsubscribe = subscribeToOpenNotes(target, open);
  target.dispatchEvent(new CustomEvent("memocard:open-note", { detail }));
  expect(open).not.toHaveBeenCalled();
  unsubscribe();
});
