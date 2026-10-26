# shadcn/ui preview-02 and base-luma sources

MIT license: [shadcn-ui.txt](./shadcn-ui.txt).

Official repository snapshot for the 33 showcase cards and composition:
https://github.com/shadcn-ui/ui/tree/25af02b1b467fcd53b63e0c6d6d324c57c16ef18/apps/v4/registry/bases/base/blocks/preview-02

Official base-luma component registry:
https://ui.shadcn.com/r/styles/base-luma/preview-02.json

The preview-02 registry contains only its index. Its 30 direct component
registry dependencies resolve to 33 base UI components and the use-mobile
hook. The source audit snapshots all 33 cards, registry responses, extracted
component source, fetch times and SHA256 hashes in
`build/verification/luma-showcase/source/manifest.json`.

This integration adds 23 components to `apps/ui/ui/components`, retaining
the 12 existing components. Luma layout, sizes and component composition are
preserved. Color utilities map to the existing Astryx semantic roles; radius
utilities use the current 8px foundation; keyboard focus uses focus-ring.

The preview icon placeholders map to direct Hugeicons imports in
`apps/ui/ui/showcase-icons.tsx`. Six upstream names use verified aliases
(Activity01Icon, ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon,
Coffee01Icon and Shield01Icon). Decorative SVGs are hidden from accessibility;
the source Spinner's status role remains exposed.

Local wrapper adjustments preserve the documented interaction contract:

- CalendarDayButton attaches its focus ref to the actual Button.
- ToggleGroup forwards its orientation to Base UI.
- Slider forwards root aria-label and aria-labelledby to its thumbs.
- Sidebar uses its own ui-sidebar-state cookie and accepts optional
  keyboardShortcut and persistState flags, both true by default. Repeated docs
  previews disable both side effects.
- Grouped inputs use one shared focus outline on the input group; children
  suppress duplicate outlines. Accordion focus is inset to remain visible
  inside its rounded clipping container.
- Chart theme selectors use data-ui-theme rather than the upstream dark class.
  Showcase chart values use existing --color-data-blue-1 through -5 roles.

All other upstream API and accessibility state attributes are retained.
