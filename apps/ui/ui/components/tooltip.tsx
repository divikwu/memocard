// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
"use client"

import { ThemeScope, themeScopeForElement, useThemeScopeProps, type ThemeScopeValue } from "./theme-scope"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react"
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
  const scope = useThemeScopeProps()
  return (
    <TooltipPrimitive.Portal {...scope}>
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
            "duration-fast ease-standard z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-full bg-inverted px-3 py-1 text-sm text-tooltip-text data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
          {...props}
        >
          {children}
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
  const [open, setOpenState] = useState(false)
  const openRef = useRef(false)
  const setOpen = useCallback((value: boolean) => { openRef.current = value; setOpenState(value) }, [])
  const [hint, setHint] = useState<{ anchor: HTMLElement; target: HTMLElement; text: string; side: "left" | "right" | "top" | "bottom"; scope?: ThemeScopeValue } | null>(null)

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
      if (text && anchor && target) {
        const side = anchor.closest<HTMLElement>("[data-ui-tooltip-side]")?.dataset.uiTooltipSide
        setHint({ anchor, target, text, side: (side === "left" || side === "right" || side === "bottom") && window.matchMedia("(min-width: 768px)").matches ? side : "top", scope: themeScopeForElement(anchor) })
      }
      setOpen(!!text && !!anchor && !!target)
    }
    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      if (popup(event.target)) { clearTimeout(closeTimer); return }
      const anchor = find(event.target)
      hovered = anchor?.hasAttribute("data-ui-tooltip-focus-only") ? null : anchor
      if (!hovered) return
      if (hovered === current) clearTimeout(closeTimer)
      else { dismissed = false; show(hovered) }
    }
    const out = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !current) return
      if (!popup(event.target) && !(event.target instanceof Node && current.contains(event.target))) return
      if (find(event.relatedTarget) === current || popup(event.relatedTarget)) return
      hovered = null
      clearTimeout(closeTimer)
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
  }, [id, setOpen])

  useEffect(() => {
    if (!open || !hint) return
    const { anchor, target } = hint
    const previous = target.getAttribute("aria-describedby")
    target.setAttribute("aria-describedby", [previous, id].filter(Boolean).join(" "))
    const observer = new MutationObserver(records => {
      if (!anchor.isConnected || !anchor.getAttribute("data-ui-tooltip")) setOpen(false)
      else if (records.some(record => record.target === anchor.closest("[data-appearance-scope]"))) setHint(value => value ? { ...value, scope: themeScopeForElement(anchor) } : null)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ui-tooltip", "data-ui-theme", "data-interface-theme", "data-workspace-layout", "data-web-palette", "data-web-neutral", "style"] })
    return () => {
      observer.disconnect()
      if (previous === null) target.removeAttribute("aria-describedby")
      else target.setAttribute("aria-describedby", previous)
    }
  }, [hint, id, open, setOpen])

  // Keep the anchor, text and scope until Base UI finishes the closing animation.
  return <ThemeScope value={hint?.scope ?? {}}><Tooltip open={open} onOpenChange={setOpen} onOpenChangeComplete={completedOpen => { if (!completedOpen && !openRef.current) setHint(null) }}>
    <TooltipContent id={id} anchor={hint?.anchor} side={hint?.side} className="break-all">{hint?.text}</TooltipContent>
  </Tooltip></ThemeScope>
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipHints }
