# Visual Design System

Shared visual rules for generated MVPs. Every MVP should look like "an early-stage SaaS product built by a small, design-conscious team" — trustworthy enough that users engage honestly with the experiment.

## Section A: Visual Identity Rules

Three anti-patterns to eliminate:
1. **Gray-on-gray hero** with default shadcn slate primary — every MVP looks identical
2. **No max-width constraint** on content — text spans full viewport, feels like dev mode
3. **Default component sizing everywhere** — tiny buttons in hero, no visual hierarchy

### One-Decision Principle

Derive the primary hue from the product domain:
- Invoicing / productivity → slate-blue
- Fitness / health → green
- Finance / fintech → indigo
- Education → amber
- Social / community → violet

Fallback (when the domain has no obvious hue): `hsl(221, 83%, 53%)` — professional blue.

One font: **Inter** via `next/font/google` (zero-dependency, ships with Next.js).

Anti-pattern: do NOT pick multiple fonts, add decorative typefaces, or import font files manually.

## Section B: Theme Defaults

After `shadcn init`, override these CSS custom properties in `globals.css`:

```css
/* In :root block — after shadcn-generated values */
--primary: 221 83% 53%;           /* or domain-appropriate hue */
--primary-foreground: 0 0% 100%;
--radius: 0.5rem;
```

Match the `.dark` block with a lighter primary variant if dark mode is present.

Derive `--primary` from idea.yaml's domain when possible (see Section A hue table). When the domain is ambiguous, use the blue fallback.

Anti-pattern: do NOT add custom gradients, animation tokens, or shadow scales. Rule 4 applies — ship the simplest thing that works.

## Section C: Page-Level Conventions

Specific Tailwind classes per page type — mobile-first:

| Page type | Mobile (default) | Desktop override |
|-----------|-----------------|------------------|
| Landing hero | `py-16 px-4 text-center` | `md:py-32 md:px-6` |
| Landing sections | `py-12 px-4`, `max-w-5xl mx-auto` | `sm:px-6 sm:py-16` |
| Auth pages | `min-h-screen flex items-center justify-center px-4`, card `w-full max-w-md` | (no override needed) |
| App pages | `max-w-5xl mx-auto px-4 py-6`, heading `mb-4` | `sm:py-8 sm:mb-6` |

> Mobile is the base. Desktop classes use `sm:` / `md:` prefixes. Never write mobile styles with a breakpoint prefix — that inverts the cascade.

These constraints prevent the "full-viewport text wall" anti-pattern while keeping layout simple.

### Grid Layout for Feature / Benefit Cards

- `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`
- Single column on mobile → 2-col on tablet → 3-col on desktop
- Anti-pattern: do NOT use `flex flex-wrap` for card grids — inconsistent widths on odd counts.

## Section D: Component Conventions

### Typography Scale

| Element | Classes |
|---------|---------|
| Hero headline | `text-4xl md:text-5xl font-bold tracking-tight` |
| Subheadline | `text-xl text-muted-foreground` |
| Section heading | `text-2xl font-semibold` |
| Body | `text-base` |

Use `text-base` explicitly for body text — prevent agents defaulting to `text-sm`.

### Button Sizing

- Primary CTA in hero / CTA-repeat: `<Button size="lg">` — always large
- Secondary actions: `<Button variant="outline">`
- In-page actions (forms, cards): default size is fine

### Touch Targets

- Primary CTA on mobile: add `w-full sm:w-auto` — full-width on small screens, auto on desktop
- Minimum interactive element height: `h-11` (44px) on mobile — matches Apple HIG minimum tap target
- Spacing between stacked interactive elements: `gap-3` minimum — prevent mis-taps

### Form Inputs

- All `<Input>` and `<Select>` elements: `text-base` (16px) — prevents iOS Safari auto-zoom on focus (triggered at < 16px)
- Input height: `h-11` on mobile for comfortable tap targets
- Stack form fields vertically on mobile (`space-y-4`), side-by-side only at `sm:` and above

### Cards

Use `<Card>` with proper sub-components (`CardHeader`, `CardTitle`, `CardContent`) — never raw `<div>` with manual borders.

Anti-pattern: do NOT wrap the entire page in a single `<Card>`. Cards are for discrete content units (feature cards, pricing tiers, form containers).

Anti-pattern: do NOT add hamburger menus, bottom navigation bars, swipe gestures, or app-shell chrome. MVPs have few pages — a simple inline nav or single CTA per page is sufficient.
