import { Children, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import {
  Carousel, CarouselContent, CarouselItem, useCarousel,
} from "../components/carousel";

function GallerySlides({ children }: { children: ReactNode }) {
  const { api, selectedIndex } = useCarousel();
  const count = Children.count(children);
  const current = Math.min(selectedIndex, count - 1);
  const visibleDots = Math.min(count, 7);
  const firstDot = Math.max(0, Math.min(current - 3, count - visibleDots));
  const dots = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (dots.current?.contains(document.activeElement)) {
      dots.current.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
    }
  }, [current]);
  return <>
    <CarouselContent className="h-full select-none">
      {Children.map(children, (child, index) => <CarouselItem inert={index !== current} aria-hidden={index !== current || undefined} aria-roledescription="幻灯片">{child}</CarouselItem>)}
    </CarouselContent>
    <div ref={dots} className="ui-gallery-dots" role="group" aria-label="选择图片">
      {Array.from({ length: visibleDots }, (_, offset) => {
        const index = firstDot + offset;
        const edge = (offset === 0 && index > 0) || (offset === visibleDots - 1 && index < count - 1);
        return <button key={offset} type="button" tabIndex={index === current ? 0 : -1} aria-label={`切换到第 ${index + 1} 张图片`}
          aria-current={index === current || undefined} data-edge={edge || undefined}
          onClick={() => api?.scrollTo(index)} />;
      })}
    </div>
    <span className="sr-only" aria-live="polite" aria-atomic="true">{current + 1} / {count}</span>
  </>;
}

export default function NoteCardGallery({ children }: { children: ReactNode }) {
  const plugins = useMemo(() => [WheelGesturesPlugin()], []);
  return <Carousel className="ui-card-gallery" role="group" aria-label="笔记图片" aria-roledescription="轮播"
    opts={{ loop: true, breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } } }} plugins={plugins}>
    <GallerySlides>{children}</GallerySlides>
  </Carousel>;
}
