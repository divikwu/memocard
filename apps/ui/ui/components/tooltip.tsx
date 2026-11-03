// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react"
import { cnState } from "../lib/utils"
import { useInputModality } from "../input-modality"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  anchor,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          role="tooltip"
          className={cnState(
            className,
            "duration-fast ease-standard z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-xl bg-inverted px-3 py-1.5 text-xs text-on-dark dark:text-on-light has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-inverted fill-inverted data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:translate-x-[1.5px] data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:translate-x-[-1.5px] data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:translate-x-[-1.5px] data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:translate-x-[1.5px] data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

// Delegation also covers editor node views that create their controls outside React.
// Explicit attributes keep note metadata (for example abbr titles) out of UI hints.
const TooltipHintsContext = createContext(false)

function TooltipHints({ children }: { children?: ReactNode }) {
  const inherited = useContext(TooltipHintsContext)
  return inherited ? children : <TooltipHintsContext value={true}><TooltipHintController />{children}</TooltipHintsContext>
}

function TooltipHintController() {
  useInputModality()
  const id = useId()
  const [hint, setHint] = useState<{ anchor: HTMLElement; target: HTMLElement; text: string } | null>(null)

  useEffect(() => {
    let current: HTMLElement | null = null
    let hovered: HTMLElement | null = null
    let dismissed = false
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const find = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest<HTMLElement>("[data-ui-tooltip]") : null
      const text = anchor?.hasAttribute("data-ui-tooltip-overflow") ? anchor : anchor?.querySelector<HTMLElement>("[data-ui-tooltip-overflow]")
      return text && text.scrollWidth <= text.clientWidth && text.scrollHeight <= text.clientHeight ? null : anchor
    }
    const popup = (target: EventTarget | null) => target instanceof Element && !!target.closest(`[id="${id}"]`)
    const show = (anchor: HTMLElement | null) => {
      clearTimeout(closeTimer)
      const text = anchor?.getAttribute("data-ui-tooltip")
      current = text ? anchor : null
      const target = anchor?.closest<HTMLElement>('button, a[href], [tabindex], [role="menuitem"], [role="button"]') ?? anchor
      setHint(text && anchor && target ? { anchor, target, text } : null)
    }
    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      if (popup(event.target)) { clearTimeout(closeTimer); return }
      const anchor = find(event.target)
      hovered = anchor
      if (anchor && anchor !== current) { dismissed = false; show(anchor) }
    }
    const out = (event: PointerEvent) => {
      if (find(event.relatedTarget) === current || popup(event.relatedTarget)) return
      hovered = null
      closeTimer = setTimeout(() => show(null), 80)
    }
    const focus = (event: FocusEvent) => {
      const target = event.target
      if (dismissed || !(target instanceof HTMLElement) || document.documentElement.dataset.uiInputModality !== "keyboard") return
      show(find(target) ?? find(target.querySelector<HTMLElement>("[data-ui-tooltip]")))
    }
    const close = () => show(null)
    const blur = () => { if (!hovered || hovered !== current) close() }
    const key = (event: KeyboardEvent) => { dismissed = event.key === "Escape"; if (dismissed) close() }
    document.addEventListener("pointerover", over)
    document.addEventListener("pointerout", out)
    document.addEventListener("focusin", focus)
    document.addEventListener("focusout", blur)
    document.addEventListener("pointerdown", close, true)
    document.addEventListener("keydown", key, true)
    document.addEventListener("scroll", close, { capture: true, passive: true })
    window.addEventListener("blur", close)
    return () => {
      clearTimeout(closeTimer)
      document.removeEventListener("pointerover", over)
      document.removeEventListener("pointerout", out)
      document.removeEventListener("focusin", focus)
      document.removeEventListener("focusout", blur)
      document.removeEventListener("pointerdown", close, true)
      document.removeEventListener("keydown", key, true)
      document.removeEventListener("scroll", close, true)
      window.removeEventListener("blur", close)
    }
  }, [id])

  useEffect(() => {
    if (!hint) return
    const { anchor, target } = hint
    const previous = target.getAttribute("aria-describedby")
    target.setAttribute("aria-describedby", [previous, id].filter(Boolean).join(" "))
    const observer = new MutationObserver(() => {
      if (!anchor.isConnected || !anchor.getAttribute("data-ui-tooltip")) setHint(null)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ui-tooltip"] })
    return () => {
      observer.disconnect()
      if (previous === null) target.removeAttribute("aria-describedby")
      else target.setAttribute("aria-describedby", previous)
    }
  }, [hint, id])

  return <Tooltip open={!!hint} onOpenChange={open => { if (!open) setHint(null) }}>
    <TooltipContent id={id} anchor={hint?.anchor} className="break-all">{hint?.text}</TooltipContent>
  </Tooltip>
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipHints }
