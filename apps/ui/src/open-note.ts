export function subscribeToOpenNotes(target: EventTarget, onOpen: (id: string) => void): () => void {
  const handle = (event: Event) => {
    const detail: unknown = (event as CustomEvent).detail;
    if (!detail || typeof detail !== "object" || !("id" in detail) || typeof detail.id !== "string") return;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(detail.id)) return;
    onOpen(detail.id.toLowerCase());
  };
  target.addEventListener("memocard:open-note", handle);
  return () => target.removeEventListener("memocard:open-note", handle);
}
