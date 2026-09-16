# Hachi Design Language

Use this file as the source of truth when asked to continue, restore, or remember the Hachi visual style.

## Overall Feel

Hachi should feel friendly, soft, polished, minimal, and modern.

The design combines:

- Apple-inspired structure, spacing, restraint, and interaction polish
- Friendly rounded typography inspired by the Hachi dashboard reference
- Consistent squircle-like corner geometry
- Subtle borders instead of heavy shadows
- Clean hierarchy with generous whitespace

Do not turn the interface into a generic Apple clone. Keep Hachi warm, rounded, and study-focused.

## Typography

Primary font:

```css
font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Nunito should be used globally, including:

- Body text
- Navigation
- Buttons
- Inputs
- Cards
- Badges
- Forms
- Modals

Typography hierarchy:

- Hero headings: `font-weight: 900`
- Page titles: `font-weight: 800`
- Card titles: `font-weight: 800`
- Navigation: `font-weight: 800`
- Buttons: `font-weight: 800`
- Labels, tags, badges: `font-weight: 800`
- Strong text: `font-weight: 800`
- Body text: `font-weight: 600`
- Paragraph text: `font-weight: 600`
- Muted text: `font-weight: 600`

The typography should feel noticeably substantial and rounded, not thin or delicate. Keep Nunito's soft friendliness, but give most readable interface text more weight than standard defaults.

Keep letter spacing at `0` unless there is a strong reason to change it.

## Corners

Use a consistent radius system that visually approximates Apple-style continuous corners.

Use shared radius tokens instead of random values:

```css
--radius-xs: 10px;
--radius-sm: 14px;
--radius-md: 18px;
--radius-lg: 24px;
--radius-xl: 30px;
--radius-2xl: 38px;
--radius-pill: 999px;
```

Avoid `clip-path: inset(0 round ...)` for rounded surfaces. It caused broken/notched corners with borders.

Use `border-radius` and `overflow: hidden` where needed.

## Borders And Shadows

Prefer subtle Apple-style borders for surface separation.

Light mode:

```css
border: 1px solid rgba(0, 0, 0, 0.08);
```

Dark mode:

```css
border: 1px solid rgba(255, 255, 255, 0.1);
```

Do not use the broad card shadow:

```css
box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
```

Avoid heavy floating-card effects.

Only use shadows for surfaces that are semantically elevated:

- Modals
- Drawers
- Popovers
- Dropdowns
- Floating mobile navigation
- Temporary banners or overlays

Regular cards, panels, inputs, stats, answer boxes, and library rows should use borders, background contrast, and spacing instead of shadows.

## Layout

Preserve the current app structure and workflows.

Use:

- Generous page spacing
- Clear content grouping
- Responsive grids
- Comfortable touch targets
- Minimal nesting
- Balanced whitespace

Do not create marketing-style sections unless explicitly asked.

## Components

Buttons should feel rounded, soft, and readable.

Inputs should:

- Use Nunito
- Have subtle borders
- Use comfortable padding
- Keep clear focus states
- Avoid harsh outlines

Cards and panels should:

- Use the shared radius system
- Use subtle neutral borders
- Avoid unnecessary shadows
- Keep content hierarchy clear

Navigation should:

- Stay simple and easy to scan
- Use soft active states
- Preserve mobile behavior

## Accessibility

Maintain:

- Good text contrast
- Visible focus states
- Readable font sizes
- Touch-friendly controls
- Reduced-motion support
- Semantic HTML behavior

## Implementation Notes

Most of the visual system lives in:

```text
src/styles.css
```

Before changing the design, inspect the existing CSS and preserve:

- Current routes
- Current React logic
- Current responsive behavior
- Current color palette
- Current squircle/radius system
- Current Nunito typography system

When the user says "Hachi design language", use this document as the design brief.
