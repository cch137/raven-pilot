---
name: modern-premium-ui-ux-design
description: Rules and standards for building compact, flat, dark-themed, production-quality interfaces using Tailwind CSS and Lucide Icons.
---

# SKILL: Modern Premium UI/UX Design

## Stack

- **Styling**: Tailwind CSS — all spacing, color, radius, and typography via utility classes only; no inline styles or raw px values.
- **Icons**: Lucide Icons — consistent style, semantic usage, `size-4` as default.

---

## Design Principles

- **Compact & flat**: minimize container nesting; use spacing, borders, and background contrast to group content instead of wrapping elements. Before adding a container, ask: does removing it break the structure? If not, remove it.
- **Visual hierarchy**: establish via font weight, brightness, size, and spacing — not color count.
- **Calm dark aesthetic**: use softened dark backgrounds (never pure black); reserve accent color for focus, CTA, and selected states only.
- **Consistency**: all interactive elements share the same radius, height, border, and state rules across the entire interface.
- **Restrained interaction**: animations must be short and functional — `duration-150` to `duration-200`, `ease-out`. Prioritize smoothness over flair.

---

## Color System

Base palette: **Tailwind zinc series**. Minimize total color count — only introduce colors that serve hierarchy or semantics.

| Role                  | Tailwind Class                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| App background        | `bg-zinc-950`                                                                                            |
| Surface               | `bg-zinc-900`                                                                                            |
| Elevated              | `bg-zinc-800`                                                                                            |
| Text primary          | `text-zinc-100`                                                                                          |
| Text secondary        | `text-zinc-400`                                                                                          |
| Text muted            | `text-zinc-500`                                                                                          |
| Border subtle         | `border-zinc-800`                                                                                        |
| Border strong / focus | `border-zinc-600`                                                                                        |
| Accent                | Single cool-toned color; focus, CTA, selected states only                                                |
| Destructive           | `text-red-500`, `bg-red-500/10`, `border-red-500/30` — danger actions, errors, delete confirmations only |

---

## Typography

All via Tailwind classes. Maximum 3 levels of hierarchy.

| Role           | Class                                                |
| -------------- | ---------------------------------------------------- |
| Title          | `text-sm font-semibold` or `text-base font-semibold` |
| Body           | `text-sm`                                            |
| Caption / Meta | `text-xs text-zinc-500`                              |

- Differentiate importance via `font-medium` / `font-semibold` and `text-zinc-100`, not larger font sizes.
- Use `leading-normal` or `leading-relaxed` to prevent visual crowding on dark backgrounds.

---

## Shape & Depth

**Border radius** — uniform across component types:

| Component      | Class        |
| -------------- | ------------ |
| Badge / Tag    | `rounded-md` |
| Button / Input | `rounded-lg` |
| Card / Panel   | `rounded-xl` |

**Border**: `border border-zinc-800` or `border-zinc-700` — low visual weight, used for layer separation.

**Shadow**: `shadow-sm` or `shadow-md` maximum. Prefer background contrast (zinc-950 → zinc-900 → zinc-800) over shadows for depth.

---

## Spacing

| Context                    | Class               |
| -------------------------- | ------------------- |
| Compact component padding  | `p-2` / `px-2 py-1` |
| Standard component padding | `p-3` / `px-3 py-2` |
| Card / panel padding       | `p-4`               |
| Component gaps             | `gap-4` / `gap-6`   |
| Section separation         | `gap-8` / `mt-8`    |

Outer spacing must exceed inner padding to create clear grouping. Whitespace should be intentional, not loose.

---

## Layout

- Single primary focus per page — one task, one visual anchor.
- Preferred structure: top status bar → main content area → fixed bottom input/action bar; secondary controls as inline toolbars or compact panels.
- Use `flex` / `grid` for alignment; never rely on arbitrary margins to position elements.
- Separate regions with background contrast or `border-t border-zinc-800`, not added wrapper elements.
- Content width must be constrained — avoid full-width stretching of main content.

---

## Components

**Buttons**

- Fixed height: `h-8` or `h-9`; radius: `rounded-lg`.
- Default: low-key; hover: `hover:bg-zinc-700`; press: `active:scale-95`.
- Lucide icon + label: `gap-2`, icon at `size-4`.
- No gradients.

**Inputs**

- `bg-zinc-900 border border-zinc-700 rounded-lg h-9 px-3`
- Focus: `focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500`
- Placeholder: `placeholder:text-zinc-500`

**Tags / Pills / Status**

- `rounded-full text-xs px-2 py-0.5`; low-contrast background.
- State differentiation via brightness, not saturation.
- Destructive states use red color tokens.

**Icons**

- Default size: `size-4`.
- Decorative / secondary: `text-zinc-500`.
- Actionable: wrap in a button with sufficient tap target (`p-1.5`).

**Message / Content Blocks**

- Separate with spacing or `border-t`, not individual card wrappers.
- Primary content: `text-zinc-100`; metadata (timestamp, role): `text-xs text-zinc-500`.

---

## UX Rules

- **Reduce cognitive load**: expose only necessary controls; collapse advanced options by default; defaults must be sensible.
- **Micro-interactions**: hover → `hover:bg-zinc-800`; focus → `focus:ring-1 focus:ring-zinc-500`; press → `active:scale-95`; transition → `transition-colors duration-150`.
- **Accessibility**: sufficient text contrast (zinc-100 on zinc-900+); full keyboard navigation; visible focus states; color is never the sole signal.

---

## Avoid

- Pure `black` background or pure `white` text
- Gradients, glassmorphism, `shadow-xl`+
- Inconsistent radius or height across similar components
- Unnecessary container nesting or decorative wrappers
- Multiple accent colors or overuse of destructive red
- Loose, unfocused layouts that feel like assembled templates
- Animations exceeding `duration-200` or serving no functional purpose

---

## Design Keywords

`premium` · `compact` · `flat` · `calm` · `minimal` · `modern` · `focused` · `high signal, low noise`

---

## Output Checklist

- [ ] Clear visual hierarchy with ≤3 levels
- [ ] No unnecessary container nesting; flat structure
- [ ] Consistent radius / height / border classes throughout
- [ ] Background uses zinc-950 / zinc-900 (not pure black)
- [ ] Lucide icons used consistently at `size-4`
- [ ] Color limited to zinc + single accent + destructive
- [ ] Destructive color applied correctly and sparingly
- [ ] All interactive states covered: hover / focus / active / disabled
- [ ] All Tailwind classes — no inline styles or raw px values
- [ ] Output feels like a production tool, not a template
