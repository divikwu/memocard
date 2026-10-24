# Luma showcase design QA

Scope: UI-next on 6016. This report is kept in the UI-next project directory to preserve the repository root's existing, unrelated gallery/editor QA report.

## Source and implementation

- Source: official shadcn/ui preset b5F2gjwQRE, preview-02. Source commit 25af02b1b467fcd53b63e0c6d6d324c57c16ef18.
- Source visual: `build/verification/luma-showcase/reference/desktop-full-current.png` (3000×2565 pixels), `reference/mobile-top-current.png` (390×844).
- Implementation: `http://127.0.0.1:6016/iframe.html?id=ui-next-luma--docs&viewMode=docs`.
- First implementation capture: `build/verification/luma-showcase/local-first.png` (3000×2929).
- CSS viewport: desktop 3000×1200, mobile 390×844, deviceScaleFactor 1. Full-height captures use the actual canvas bounds; no density scaling before comparison.
- State: light, default form values, General FAQ, October 2026 calendar. Source and local full captures were opened together in one comparison input.

## First comparison

- [P1] Storybook Docs styles override the gallery's utility styles: card and description text become 16px instead of 14px, titles lose Noto Serif, sidebar menus gain bullets, tables gain Docs borders, and links turn blue. The first card is 597px high instead of 508px, changing the overall canvas density. Fix: mark the gallery as sb-unstyled and scope any required resets to this gallery.
- [P1] The source cards consume --gap while the layout defines only --showcase-gap. The central Savings Targets / Buy Investment cards touch and expand to 399px instead of about 375px. Fix: bind --gap to --showcase-gap within the gallery.
- [P2] The Docs root adds a 9px vertical offset. First card begins y53 instead of y44. Fix: remove the gallery-specific wrapper offset.

## Required fidelity surfaces

- Fonts/typography: awaiting the scoped Storybook reset fix and repeat capture.
- Spacing/layout rhythm: correct seven tracks and horizontal positions; inner card gaps and vertical density require fixes above.
- Colors/tokens: preserve current Astryx roles and Tailwind palette references, including stronger text/control contrast. The 8px radius base intentionally differs from the official preset's 10px base.
- Assets: use actual Hugeicons, Recharts and react-qr-code. Cover Art remains the original source upload placeholder; no substitute imagery.
- Copy/content: all 33 named source cards are present. Financial/account controls are local component examples, with no services.

## Fixes and repeat comparison

All first-pass findings were fixed and the implementation was captured again at the same viewport and default state. Source and final desktop images, and source and final 390px images, were opened together in comparison inputs.

- `sb-unstyled` restores the utility-driven type, link, list and table styles. First card: x44/y44, width374.8516px, height508px; canvas:3000×2565px. These match the source measurements.
- The source card `--gap` is bound to the layout gap. Central nested cards are separated correctly; no cards touch.
- Gallery root margin is zero. Its content begins at y0 with the expected 40px padding plus4px column gutter.
- User feedback identified shadows being clipped at column bounds. Removing column `content-visibility:auto` and intrinsic-size containment restores complete shadows without changing their tokens. `shadow-fixed.png` shows the complete Syncing card and surrounding shadow; computed column containment is none.
- The selected holdings search uses `bg-muted border-border`; actual light values are neutral-100 and neutral-200, and dark values are neutral-800 and the existing10% white semantic border. `search-colors-fixed.png` shows the result. Keyboard focus keeps the shared token.
- Undefined shadcn role/scale references were corrected: ring-chart foreground/secondary fills, Calendar cell radius, Sidebar local radii and runtime font family. Recharts3.8's actual axis tick class now receives semantic secondary fill in both modes. The roller-shade fill reads the track role and responds to its slider/presets.

## Final fidelity surfaces

- Fonts/typography: Noto Serif titles16/24px, Noto Sans card descriptions14/20px. Docs body16px and table/code14px remain. Chinese uses current SC fallbacks.
- Spacing/layout rhythm:33 named cards, source order,7 tracks, central2-track span and nested groups. At390px the first card is x20/y20, width316.5703px, height622px, matching source. The document remains390px wide; the gallery alone scrolls its2400px canvas.
- Colors/tokens: unchanged theme.css SHA256; current Astryx semantics and Tailwind references retained. Dark ring labels and chart axes are readable. The stronger text/control borders and8px base are deliberate existing project constraints; generated card radius is20.8px versus the source26px. Shadows deliberately extend fully after user feedback.
- Assets: genuine Hugeicons, Recharts SVG data graphics, QR code generated from the original sample payload. Original upload placeholder retained; no stock substitutions or remote image dependencies.
- Copy/content: all33 source cards and their content preserved. Financial/account CTAs provide local preview feedback only. Calendar uses the current month by default.

## Verification

-35 component Docs pass70 browser checks: desktop light1280px, narrow dark390px. No document overflow, duplicate IDs, missing tabs or table-font mismatches.
-23 metadata code snippets compile against actual wrappers and Base UI types. Each new example rendered3times without SSR errors, duplicate IDs or broken label/description/control references.
- Browser interactions passed: slider keyboard2550, currency selectionEUR, notification select-all, PayPal radio selection, Billing tab, accordion expansion, next-month calendar, searchable tickerAAPL, shade preset driving slider100.
- Light and dark gallery screenshots: `local-desktop-light.png`, `local-desktop-dark.png`, `local-mobile-light.png`, `local-mobile-dark.png`. Full-view and readable focused card comparisons inspected.
- Typecheck, focused UI-next ESLint, Storybook static build and scoped diff whitespace checks pass. No gallery browser errors.
- Recharts emits zero-size warnings for a hidden, kept-mounted Chart Properties preview; visible charts render correctly. This is a development-log limitation, not a visible rendering failure.
- Range Slider thumbs currently share their root label; documentation states this limitation. This showcase and all Slider examples use one thumb. Real account/payment services and backend persistence are outside this local component showcase.

final result: passed

## Detail-review follow-up — 2026-10-22

The later detail review in `build/verification/luma-review/review.md` identified five P2 gaps that the earlier showcase checks did not cover. Those review findings are now addressed:

- Slider defaults to one thumb at min, forwards each thumb index for correct range SSR values, and shows the shared focus outline when its internal range input receives keyboard focus. Default and Range Canvas stories expose both contracts.
- Combobox built-in trigger, clear and chip-remove actions have overridable names. The Font and Ticker examples explicitly associate their visible labels, preserving the input name while the modal popup hides surrounding content.
- Indeterminate Progress shows a nonzero segment with a pulse. Reduced-motion keeps the segment visible without animation.
- Badge Properties declares the actual string className contract. Separator supports its inherited state callback and merges the returned classes.
- The final user reference uses preset b5F2gjwQRE with Subtle emphasis. Dropdown, checkbox/radio/submenu, Select and Combobox use the muted accent background and full-radius menu items; popup shells retain the 8px-derived radius scale. Select groups contribute padding once, without duplicate list padding.

The user requested the source control appearance while retaining system tokens. Input, InputGroup, Textarea, Select, NativeSelect and ComboboxChips now use the dedicated `--color-background-control` role with transparent default boundaries. Slider tracks retain their semantic role with source-like palette mixtures. Focus and invalid feedback remain separate. Colors displays 155 Astryx roles, six project extensions and one pending brand; there are 226 base definitions and 161 color roles in total.

Live desktop measurements found identical x/y/width/height for all 37 Card nodes in both modes after restoring source label line heights and the Receiving Method's explicit bottom padding. No fixed card heights were added. At 390px the first card is x20/y20, 316.5703×622px and the document width remains390px. The 8px base and fully visible shadows remain intentional project choices. Secondary text now follows the final reference: neutral-500 light and neutral-400 dark, including supporting labels, descriptions and chart axes.

Focused regression tests:16 passed. UI-next typecheck, UI-next/Storybook ESLint and the static Storybook build pass. Browser verification covers keyboard step/focus for default and range Sliders, Combo select/clear/expanded names, light/dark Subtle menus, indeterminate Progress and reduced-motion. This does not extend the old contrast sampling result to the newly softened default control boundaries.

Fresh comparison images, browser measurements and test/build logs are in `build/verification/luma-fixes/`. No production UI migration or Git commit was performed.

## Token application review follow-up — 2026-10-22

The review found that ordinary secondary text on the soft control fill needs a separate foreground role. `--color-text-control-secondary` now maps to neutral-600 light and neutral-400 dark, exposed as `text-control-secondary`; the global secondary roles remain neutral-500/400 and the control fill and transparent default boundaries remain unchanged. The current catalog has 227 base definitions and 162 color roles: 155 Astryx roles (including the pending brand) and seven project extensions. These counts supersede the preceding historical snapshot.

Semantic motion utilities now set transition and animation durations together with tw-animate's runtime duration variables; `ease-standard` covers both timing interfaces. Interaction durations map from the source's 100/150/200/300ms to existing fast-min 95ms, fast-max 165ms, medium-min 225ms and medium 300ms values. Spinner and Skeleton keep their loading cadence; indeterminate Progress retains twice the slow duration. Reduced-motion overrides remain in place.

Standard control sizing uses the existing element roles (`h-element-*`, or `size-element-*` for square icon controls), independently of layout spacing. Tailwind class merging recognizes these sizes and the semantic duration/easing classes, preserving both string and state-callback overrides. Base UI wrappers resolve className callbacks against the primitive state; native string-only contracts remain unchanged. Checkbox and Radio consume data-disabled for their visible disabled state, and mixed Checkbox uses a minus indicator with accent fill. Sheet explicitly consumes the semantic border color across all four portal directions.

Current follow-up verification:

- UI-next typecheck, focused ESLint (including the newly enabled Hooks rules), 27 regression tests across three files and the static Storybook build pass. The static index contains 96 entries and excludes the temporary verification story.
- 35 component Docs and ten foundation Docs pass 90 rendering/layout checks: desktop light at 1280px, narrow dark at 390px. This is rendering/layout coverage, not a claim of exhaustive interaction or accessibility testing for every component.
- Browser token override checks change default Button and Input height from 36px to 48px, with square Button width/height following 48px; small/large roles also follow their overrides. Menu animation changes from 95ms to 400ms and Sheet transition from 225ms to 500ms, with easing following the override. Reduced-motion makes the relevant token and transition durations zero; the global animation clamp remains effective.
- All eight Sheet direction/mode combinations use the same border color as an ordinary semantic-border surface. Checkbox/Radio disabled roots have opacity 0.5 and a not-allowed cursor. Mixed Checkbox exposes aria-checked=mixed with a distinct minus and changes to the check indicator after selection. Real Checkbox and Toggle interactions update callback classes.
- Light Input placeholder foreground changes from neutral-500 to neutral-600 on the unchanged soft fill; computed-color contrast increases from about 4.23:1 to 6.97:1 on a white surface. This result is scoped to the measured pairing and does not certify every system color pairing or default control boundary.
- All 37 desktop Card rectangles match the preceding baseline (3000×2565 canvas). At 390px, the first Card remains x20/y20, 316.5703×622px, and document width remains 390px.

Logs, runtime measurements, layout checks and screenshots are in `build/verification/token-system-fixes/`. The local verification fixture remains there as evidence; its temporary Storybook entry was removed. No production UI migration, Git commit or publishing was performed.

## Typeset integration and fresh review — 2026-10-22

Typeset is now part of the isolated UI-next stylesheet and has a native div wrapper, a real Markdown/GFM preview, a Content story and a foundation Docs page. The official CSS is pinned to shadcn/ui commit `25af02b1b467fcd53b63e0c6d6d324c57c16ef18`; its source hash, local hashes, license and adaptations are recorded in `design/themes/ui-next-typeset.sources.json`.

The MemoCard preset maps body, heading and mono to existing font roles, and base size to `--font-size-base`. Text, muted text, code surfaces, marks, borders, focus and radii use existing semantic roles. Two reading-only definitions, `--text-reading-leading: 1.75` and `--spacing-reading-flow: 1.25em`, keep content rhythm independent of compact UI typography. The current catalog has 229 base definitions and 162 color roles. All tokens and Typography list each reading definition once; the pending brand remains the only unassigned color.

Fresh review identified and fixed three concrete issues:

- ItemSeparator dropped its inherited state className callback. It now uses `cnState`, preserving orientation state and caller margin/color overrides.
- Docs bullet-list selectors affected embedded Sidebar/Breadcrumb lists. The selectors now cover only document-owned `section > ul` and its direct items. Real Sidebar menus keep no markers, zero padding and zero item top margin; Breadcrumb items keep zero top margin. Anatomy lists retain disc markers and 24px padding.
- Upstream Typeset opt-out selectors protected descendants but root declarations could still apply to an opted-out or nested Typeset root. Both root rules and the MemoCard preset now exclude `.not-typeset`, `[data-not-typeset]` and their descendants at unchanged specificity. The preview-specific inheritance workaround was removed before verification.

Final verification:

- UI-next typecheck, focused ESLint with Hooks rules, 32 tests across five files, and static Storybook build pass. The static index has 98 entries, including Typeset Docs/Content and no temporary fixture. Two local CSS hashes match the provenance manifest. One Slider SSR test initially hit its 5-second limit while tests and build ran concurrently; the original log is retained. An independent run with two workers passes all 32 tests in 4.02 seconds without changing timeouts.
- 35 component Docs and 11 foundation Docs pass 92 rendering/layout checks at desktop light 1280px and narrow dark 390px: no document overflow, duplicate component IDs, duplicate token definitions or Docs table font mismatches. This covers rendering/layout, not every interaction or every accessibility requirement.
- Typeset desktop text computes to 16px/28px and mobile text to 18px/31.5px. Headings use Noto Serif/SC and code uses the current mono role. Light/dark and 320px checks preserve document width. Body size, leading and flow overrides take effect.
- Embedded and external Cards, titles, labels, Buttons and Inputs retain matching computed fonts, sizes, colors, radii and control heights. Their explicit layout margins may differ. Removing the explicit Card opt-out still preserves its data-slot-protected styles. Root and nested class/attribute opt-outs were checked without a local root-font fallback.
- The semantic table remains a table within a named, focusable local scroll region. ArrowRight changes scrollLeft and retains the shared visible focus outline. Appending content preserves the preceding paragraph's rectangle and the embedded Input's entered value; the unit regression also checks DOM identity and focus retention.
- All 37 desktop Card rectangles match the preceding Luma baseline; canvas height remains 2565px. At 390px, the first Card remains x20/y20, 316.5703×622px and document width remains 390px.

Evidence is in `build/verification/typeset-integration/`: browser measurements, list isolation, gallery geometry, test/build/hash logs and screenshots. Browser checks use desktop Chromium with viewport emulation; native H5 devices and production business pages are not yet verified. Typeset supplies content styles; parsing and sanitization remain the renderer's responsibility. No production UI migration, Git commit or publishing was performed.

## Preview radius and font controls — 2026-10-22

UI-next now exposes radius, heading font and body font alongside light/dark in the Storybook toolbar. Defaults remain project 8px, Noto Serif headings and Noto Sans body. Default resolves to the project override; None/Small/Medium/Large resolve to 0/.45rem/.625rem/.875rem, respectively. Full-circle/pill and the independent 28px chat role remain unchanged. The menu contains 25 locally installed Web fonts plus System Mono, and headings additionally support inheriting the selected body font. Fonts load local Fontsource CSS on demand; the loader waits for the actual family, with correct SC fallbacks and an independent code role.

Three private preview variables override the existing semantic roles on both HTML and each `.ui-next-theme` root. This avoids nested roots masking the settings and keeps Portals aligned. The base theme, preset and catalog definitions are unchanged. Docs consumes user globals; Canvas consumes its effective globals. TokenPage remeasures after appearance changes and font loading. Cross-page links preserve the complete selection.

Browser review reproduced an additional state-loss bug: Storybook 10.6's default Docs renderer gives the ErrorBoundary a random key on repeated globals renders. Typeset inputs reset despite the provider itself retaining DOM. All UI-next Docs now reuse the existing `componentDocsRenderer` deduplication, which the component Docs already used. Repeated same-context renders preserve the subtree, while the existing globals channel updates appearance. Actual Docs and Canvas checks preserve input IDs and entered values across changes; the appended Typeset paragraph also remains present during font changes.

Verification:

- Typecheck, Hooks-enabled ESLint, 35 tests across six files and static Storybook build pass. The static index retains 98 entries.
- Ten radius/mode combinations produce the expected Card radius: Default 20.8px, None 0, Small 18.72px, Medium 26px and Large 36.4px. These Cards use the existing 2.6× base mapping.
- All 26 font menu options render the intended Latin font in the browser, confirmed through platform-font glyph data; the system option renders Monaco on this machine. Chinese continues to use the configured SC fallback. This is stronger evidence than merely comparing the configured font-family string.
- Independent body/heading choices, heading inheritance, live Shape/Typography token values and sample fonts, Docs/Canvas navigation, and a dark Dialog Portal were checked. Code font stays unchanged.
- At 320px, dark Typeset with Inter body, Lora heading and Large radius stays within the viewport; wide tables scroll inside their own 288px region. In the default configuration, all 37 Luma Card rectangles match the previous baseline in both modes and the canvas remains 3000×2565.

Logs, runtime results and screenshots are in `build/verification/preview-appearance/`. An initial live-input failure is retained in the runtime record before the renderer fix; subsequent labeled fixed-renderer and Canvas results show state preservation. This is Storybook preview configuration; production settings and native-device verification remain outside this change. No Git commit or publishing was performed.

## Business views and Web/H5 migration

Business views now use UI-next primitives, semantic tokens, Hugeicons and Typeset. Shared controllers/factories retain save/version checks, draft recovery, search epochs/session/pagination, attachments, property conversion/undo and Markdown sanitization. The native wrappers keep their existing views. App exposes one typed view projection for the new Web/H5 shell.

Fixed during integration:

- Luma GroupLabel requires a DropdownMenuGroup; property option menus now supply it.
- H5 capture-to-editor navigation restores focus through the existing stable entry hook.
- The skip link focuses the content region without changing the hash route.
- H5 detail labels identify a return to search results when applicable.
- Keyboard tag-suggestion highlighting has an explicit semantic CSS mapping independent of legacy Tailwind scanning.
- New property views use the actual new Checkbox primitive, semantic typography/radii/spacing and 16px mobile text inputs.
- Web build chunk inspection found legacy property/editor styles attached to a shared chunk. The explicit UI-next build style boundary excludes native view CSS; final entry CSS no longer contains the legacy editor inset/parent selectors.

Final verification: 194 tests in 20 suites pass, including five real App + new-view integration tests. Legacy App/trash 120 and Editor/Rich 213 pass, with additional capture/property/search regressions recorded by their owners. Both typechecks, scoped lint, standalone Web build and the 144-entry Storybook build pass. One initial cold lazy-link lookup exceeded its 1s test wait; the lookup waits up to 5s, and the full suite subsequently passes.

Browser evidence covers desktop edit/save/search, H5 capture save, H5 search/detail/return with preserved query and results, property/date controls, note pinning and trash preview/restore. At 320px the dark settings page has no horizontal document overflow and its selects compute to 16px. The standalone Web entry retains theme/radius/heading/body choices after reload. Evidence/logs: `build/verification/web-h5-migration/`.

Native UI rebuilds, real-phone keyboard/gesture/safe-area acceptance, and real-vault writes are outside this local verification. The existing installed application and native build output were not replaced. The Web/H5 build and preview have separate entry points; the preview uses disposable in-memory notes.

The final standalone production build was also served separately on loopback and checked in the browser: its CSP meta tag is present, the None Card radius computes to 0px, the configured body font resolves, and the tab reports no console errors. This temporary production preview was stopped after verification. Development entries remain on 5180 (real browser storage contract) and 6016 (in-memory examples).

## Legacy interaction parity review — 2026-10-23

The follow-up review and evidence matrix are in [design/ui-next-review.md](../../../design/ui-next-review.md). It covers the entire business/Web/H5 scope and records the resolved navigation, draft recovery, disabled editing, image, Mermaid, appearance and bootstrap findings. Final verification passes 240 next tests, 307 selected legacy tests, both typechecks, scoped lint, the standalone Web build and a 152-entry Storybook build. Browser evidence includes 320/390px layouts, draft focus, semantic tag colors, image geometry/drop/undo, diagram dismissal and production startup/settings. Native OS drag cancellation, real-phone keyboard/safe-area behavior and native Mac/iOS adaptation remain explicitly outside this local acceptance.

## Sidebar surface role correction — 2026-10-23

The stored Luma registry defines the sidebar separately from the body and card surfaces: light `oklch(0.985 0 0)` / Tailwind neutral-50, dark `oklch(0.205 0 0)` / neutral-900. Mapping the Sidebar primitive to `bg-surface` collapsed the light sidebar into the white page. The dedicated project role `--color-background-sidebar` and `bg-sidebar` alias preserve those stored preset values without changing body, surface, muted, hover or the palette. The catalog now has 230 source definitions, 163 color roles, eight project extensions and one pending brand. A focused contract test compares both sidebar palette references to the stored registry and checks catalog discovery. This proves the source mapping; actual rendered sidebar, hover, active and trigger appearance still require the current browser acceptance pass and are not established by unit tests.
