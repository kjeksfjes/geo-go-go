# Design audit — Pocket atlas

Date: 2026-10-06. Baseline: 0.9.0 (`50a375d`). Release: 0.10.0 — Pocket Atlas. Status: Implemented; desktop adjustments guided by the user, with mobile visual acceptance remaining with the user. This audit covers application controls, cards, menus, typography, loading presentation, and responsive layout. It does not change country geometry, map detail, country names, or quiz policies.

## Findings

The interface had accumulated separate styling decisions across otherwise related controls. Navigation and actions used pills, settings mixed pill and rectangular cards, and menus and inputs used several unrelated corner sizes. Three close navy values and several gray text colors had no shared roles. Shadows, borders, text sizes, and weights differed between settings, quiz cards, dropdowns, and country cards. TreeSelect selected rows used a warm orange treatment while the country combobox used a blue highlight and segmented settings used a third navy. The native scale selector retained a separate browser appearance. Ordinary text actions turned error-red on hover. Inter was declared without an application-provided font asset.

Headless layout checks also exposed mode-selector overlap with language/settings controls at 700–800px widths. Small caption text and partially transparent keyboard outlines weakened hierarchy. Flags had several unrelated heavy shadows. The initial loading shell used a cool gradient and dark browser theme color that did not match the intended paper interface.

## Direction

Use the character of a modern pocket atlas: warm paper, dark ink, restrained coral for enabled switches, and distinctive display headings above straightforward sans-serif controls. Keep the map as the dominant visual element. Familiar interaction affordances and existing individual control shadows remain; no decorative textures, runtime font services, new dependencies, additional settings, or animated embellishments are needed.

The initial Georgia variant was accepted as a direction. The final heading treatment uses self-hosted Bricolage Grotesque at weight 600 and width 84 for the brand. Explore country names and quiz headings share card-heading tokens at weight 400 and width 100, with a 22px desktop size ceiling and the existing smaller mobile size. The font uses its real variable width applied through `font-stretch` and automatic optical sizing. The desktop tagline uses the shared Geist UI family at weight 400 and 10px, with 0.15em letter spacing. UI text, controls, and other uppercase captions use self-hosted Geist at weight 480 for small text and compact controls, and weight 380 for larger body text and answer inputs. Font provenance and original licenses are recorded beside the assets. `font-display: swap` retains readable fallback text while local fonts load.

## Shared roles

Canonical UI tokens live in `src/styles.css`. Components consume the same roles rather than selecting new near-equivalent literal values.

| Role | Treatment |
| --- | --- |
| Brand | Bricolage Grotesque variable, self-hosted, at weight 600 and width 84; system sans-serif fallbacks |
| Explore country names and quiz headings | Bricolage Grotesque at weight 400 and width 100; responsive size capped at 22px on desktop, 1.05rem on mobile |
| Desktop tagline | Shared Geist UI family at weight 400 and 10px, with 0.15em letter spacing |
| Labels, controls, body, map text | Geist variable, self-hosted, at weight 480 for small text and compact controls, and weight 380 for larger body text and answer inputs |
| Answer emphasis | Shared weight 600 for revealed country names and submitted answers; editable input keeps its ordinary UI weight |
| Primary actions and selected segments | Dark ink with a light foreground |
| Ordinary text and help | Separate dark text and secondary text roles, both readable on paper and tinted surfaces |
| Surfaces | Warm paper for the header, raised paper for controls and menus, one translucent paper panel style |
| Enabled switches | Restrained coral; position and accessibility state still identify on/off |
| Feedback | Green for correct answers, rust-red for wrong answers; ordinary hover does not borrow error color |
| Corners | 6px inset items, 12px controls and menus, 20px overlay panels, 4px flags; circles and switch tracks retain their functional shapes |
| Elevation | One control shadow, one panel/menu shadow, one lighter flag shadow |
| Spacing | A shared quarter-rem scale for control and panel padding and common section gaps |
| Focus | One opaque teal outline and a matching input halo |
| Dropdowns | Shared paper, selected/hover treatments, and chevrons across TreeSelect, country suggestions, and the native scale selector |

Map colors have a separate responsibility. Ocean, bathymetry, terrain, geographic selection, violet question highlighting, and answer highlights keep their established palette and shared canvas/SVG presentation. The debug panel deliberately retains a separate diagnostic monospace treatment.

## Implemented changes

- Consolidated the application chrome, settings cards, inputs, portaled menus, quiz actions, country cards, loading indicators, flags, and helper text around shared tokens. Retained the approved settings sections and individual control shadows.
- Shared overlay heading, uppercase caption, flag, and responsive spacing styles across Explore and both quiz modes. Explore now uses the same compact flag column and top-aligned header as Find; Name retains a full-width header until a correct guess, when it joins the shared flag layout. Revealed answers after wrong guesses or skips show a smaller flag in the feedback beside the country name. Removed the reserved desktop hint height and kept component flags in the compact flag column.
- Added decorative flags to country suggestions using the existing curated country flag identities; translated names remain the accessible option labels.
- Consolidated Find and Name question hints in the quiz panel with shared 13px control-text sizing, UI weight, and separator-style instructions in both languages; narrow and touch layouts hide the desktop guidance.
- Added a consistent heading family and removed the unbundled Inter declaration. Mobile input text remains at 1rem; help and labels have explicit shared sizes.
- Aligned selector arrows and menu states; added a consistent keyboard outline to the native scale select and floating map action. Disabled buttons now have a shared visual state.
- Replaced the header gradient with paper and matched the initial loading shell and browser theme color to the interface. The shell retains small inline fallback values so initial rendering does not require another stylesheet request.
- Moved the header to two rows at 900px to resolve intermediate-width collisions. Language controls remain in the header above 680px and in settings below it.
- Removed nested backdrop filters from opaque settings controls; the outer translucent panels retain their existing blur. No performance gain has been claimed or benchmarked.

## Validation and acceptance

Subsequent focused checks verified reversible reveal preferences and keyboard focus, first-question region switching, hidden-answer flag visibility, Turkey search aliases, and disjoint Western/Eastern Europe membership at both map detail levels. Geography and quiz identities remain unchanged.

The production build and whitespace checks passed. The initial implementation’s headless DOM checks covered 36 mode layouts and 12 settings layouts across English/Norwegian, desktop/touch, portrait/landscape, and narrow viewports. These checks verify panel bounds and horizontal overflow rather than judging appearance. Additional functional checks cover region-menu selection, native scale units and focus, answer-scope radios, portaled menu surfaces and bounds, keyboard country submission, and clearing suggestions. Solid UI text/surface combinations were checked numerically for at least 4.5:1 contrast; this does not establish contrast for translucent compositing, disabled states, or geographic overlays.

The user supplied desktop screenshots and iterated on typography and card styling. No automated screenshots or mobile visual acceptance testing were performed. The user should review the heading direction, paper warmth, density, and shadows on desktop and iPhone, including long Norwegian labels and answer feedback. Subsequent adjustments should change the shared roles rather than introducing a new component-specific palette.
