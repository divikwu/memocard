export function observeTableOverflow(container: HTMLElement, table: HTMLElement): () => void {
  const update = () => { container.dataset.overflow = String(table.scrollWidth > container.clientWidth + 1); };
  const observer = new ResizeObserver(update);
  observer.observe(container); observer.observe(table);
  const keydown = (event: KeyboardEvent) => {
    if (event.target !== container || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    container.scrollLeft += event.key === 'ArrowRight' ? 80 : -80;
  };
  container.addEventListener('keydown', keydown);
  update();
  return () => { observer.disconnect(); container.removeEventListener('keydown', keydown); };
}
