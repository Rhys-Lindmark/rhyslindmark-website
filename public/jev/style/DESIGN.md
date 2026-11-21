# Jev design system

*A 1-bit system window on rose paper.* Square ink-ruled windows with black
title bars sit on a near-white page. A single dusty rose marks whole sections,
never small details, and terminal-mono labels tag everything like a
spec sheet.

Derived from [typesafe.ai](https://typesafe.ai), v1, 2026-11-21. It feels like a
research instrument from a 1984 desktop: precise, a little dry, confident
enough not to decorate. Headlines are tight, capitalized grotesk set close to
their own line height. Body copy is plain and readable. Every surface is a
window or a rule; nothing is rounded, nothing glows, nothing floats.

## Color palette

### Brand

| Name | Hex | Role |
|---|---|---|
| Rose | `#f386a1` | The one brand colour. Section fields, hero bands, highlight marks. Never body text, never small UI. |
| Rose Soft | `#fbe1e8` | Selected rows and soft highlights on paper. |

### Status

| Name | Hex | Role |
|---|---|---|
| Signal | `#03aa5c` | Pass, live, and positive numbers. Nothing else. |
| Signal Soft | `#d9f2e6` | Background behind signal states. |
| Alert | `#c8102e` | Errors only. |

### Neutrals

| Name | Hex | Role |
|---|---|---|
| Ink | `#1e1e1e` | Text, 1px rules, title bars, filled buttons. Near-black, never `#000`. |
| Ink 86 | `rgba(30,30,30,.86)` | Display type on rose. |
| Graphite | `#3d3d3d` | Secondary headings. |
| Steel | `#5e5e5e` | Helper text, captions, mono labels. |
| Fog | `#9a9a9a` | Disabled states, placeholders. |
| Ash | `#c4c4c4` | Inactive window panels. |
| Silver | `#dedede` | Panels, quiet borders, table rules. |
| Mist | `#f3f3f3` | Code wells, hover fills. |
| Paper | `#fefefe` | Page canvas and window bodies. |

## Typography

| Role | Family | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Display | Inter Tight | 64px | 500 | 0.8 | -0.03em, capitalized |
| H1 | Inter Tight | 40px | 500 | 0.9 | -0.03em |
| H2 | Inter Tight | 24px | 500 | 1.0 | -0.02em |
| H3 | Inter Tight | 18px | 500 | 1.1 | 0 |
| Body | Inter Tight | 16px | 400 | 1.45 | 0.01em |
| Small | Inter Tight | 14px | 400 | 1.4 | 0.01em |
| Label | JetBrains Mono | 12px | 500 | 1.0 | 0.02em, often uppercase |

**Fonts.** typesafe.ai sets display and body in *Die Grotesk C* and labels in
*LisaTerminal Paper*. Both are licensed, so this system uses the closest free
pair: **Inter Tight** (tight neo-grotesk) and **JetBrains Mono**, which
typesafe.ai also uses for code. Swap the families in `tokens.css` if you hold
the licences.

## Spacing and shape

| Token | Value |
|---|---|
| Base unit | 4px (4, 8, 12, 16, 24, 32, 48, 64) |
| Max width | 1200px |
| Section gap | 64px |
| Window padding | 16px |
| Element gap | 8px |
| Radius | **0 everywhere** |
| Rule | 1px solid Ink (structure); 1px solid Silver (quiet dividers) |
| Elevation | One shadow: `3px 3px 0 Ink`, hard and unblurred, on windows only |
| Title bar | 20px, Ink fill, Paper mono label |
| Texture | 1-bit dot field: Ink dots on a 6px grid, behind figures |

## Components

- **Window.** 1px Ink border, Paper body, hard 3px shadow, an Ink title bar with
  a mono label (`Model Router 1.0`). The default container for anything
  interactive or important.
- **Card.** A window without the shadow, for lists of links.
- **Label.** Mono, 12px, uppercase, Steel. Sits above sections and inside
  title bars.
- **Button.** Ink fill, Paper text, square. Hover: Graphite. Secondary is a
  1px Ink outline that fills Ink on hover.
- **Rule and crop marks.** Separate parts with a 1px rule. Frame display
  headings with small corner crop marks.
- **Rose band.** A full-width Rose field for the one section a page is about.

## Guidelines

### Do

- Keep corners square: windows, buttons, inputs, chips, bars.
- Draw structure with 1px Ink rules, not fills or shadows.
- Use Rose for a whole field at a time: a band, a hero, a section.
- Label things in mono, like a spec sheet: section names, metadata, units.
- Set display type tight (0.8 line height) and capitalized; let it be large.
- Use Signal green only for pass and live states and positive numbers.

### Don't

- Don't round anything, and don't use pills.
- Don't blur shadows or stack more than one; elevation is the 3px hard offset.
- Don't use gradients, glows, orbs or soft colour washes.
- Don't put Rose behind small UI or use it for text.
- Don't add a second brand colour; violet, blue and orange are off-system.
- Don't use pure black; Ink is `#1e1e1e`.

## Files

| File | What it is |
|---|---|
| `tokens.css` | CSS variables (`--jev-*`), the source every /jev page loads |
| `tailwind.css` | Tailwind v4 `@theme` with the same values, plus component classes |
| `tokens.json` | W3C Design Tokens |
| `DESIGN.md` | This file |
