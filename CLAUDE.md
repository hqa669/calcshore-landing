# CalcShore Landing — project notes for Claude

Next.js 14 App Router · React 18 · TypeScript · Tailwind 3.4. Single route `/`.
This is the marketing landing page that routes visitors to CalcShore's products.
It was ported from a finished design (`~/Downloads/handoff/CalcShore Landing.dc.html`)
in a mechanical pass — see `PORT-NOTES.md` for exactly what was done.

## Architecture (settled decisions — do not silently reverse)

- **Tailwind preflight is OFF** (`corePlugins.preflight = false` in
  `tailwind.config.ts`). The ported stylesheet ships its own reset (`*`, `html`,
  `body`, headings, lists, anchors). Re-enabling preflight would silently fight the
  2,185-line sheet (heading margins, box-sizing, `img/svg` display). `@tailwind base`
  stays in `globals.css` but now emits nothing.
- **The design owns color.** No `colors` extension in Tailwind. Palette lives in
  `app/landing.css` `:root` (`--navy #1A2845`, `--gold #C9A961`, `--paper #F4F4F1`,
  etc.). Note this `--navy` differs from the old repo `--navy #0F1E3D`, which was
  removed to avoid a silent collision.
- **`app/landing.css` is a plain global stylesheet, imported by `app/page.tsx`**
  (not `layout.tsx`). This scopes it to this route without leaking into future ones.
  Kebab-case global class selectors — **no CSS Modules** (Modules would force a
  rewrite of every className). Keep it verbatim; don't "Tailwindify" it.
- **Fonts via `next/font/google`** in `app/layout.tsx`: Playfair Display (700/800/900),
  Inter (400/500/600/700), JetBrains Mono (400/500), exposed as CSS variables
  (`--font-playfair`, `--font-inter`, `--font-jetbrains-mono`) on `<html>` and mapped
  into Tailwind `fontFamily` (serif/sans/mono). `landing.css` references the vars.
  No Google Fonts `<link>`. **Build needs network** (next/font fetches at build time).
- **The two data charts live in `app/charts.tsx`** as exported raw template-literal
  strings, rendered via `dangerouslySetInnerHTML`, each in a `display:contents`
  wrapper. They are **byte-identical** to the design source (verified). Do not
  hand-edit, reformat, or restyle them.
- **`app/page.tsx` is a Client Component** (`'use client'`) — it owns the demo-modal
  state and the scroll-reveal effect. **`export const metadata` must stay in
  `app/layout.tsx`** (a Server Component); it is invalid in the client page.
- **Favicon:** the `<link rel="icon">` is single-sourced to `/favicon.svg` via
  `metadata.icons` — the only icon in `<head>`. `public/favicon.ico` is the original
  CalcShore mark recovered from git history, installed as a separate FORMAT fallback
  served directly at `/favicon.ico` (browsers/crawlers/unfurlers request that path
  regardless of link tags); it has no `<link>` or `metadata.icons` entry. It lives in
  `public/`, NOT `app/` — `app/favicon.ico` is a file convention that would auto-inject
  its own `<link>` and recreate the double-icon conflict. The competing icon *design*
  `app/icon.svg` stays deleted. Don't add a second `<link>` or point `metadata.icons`
  at the `.ico`.

## Copy rule

On-page copy is **verbatim from the design** and a later pass will revise it. Do not
edit headlines, CTAs, figures (±1°F, 13/14, 135.7°F, PASS, RMSE 0.4°F), or reassurance
lines without an explicit request. See `PORT-NOTES.md §7` for copy that looks
inconsistent but was deliberately left alone.

## Open decisions (need Qinang)

1. **CTA path.** Two competing calls to action: self-serve "Try a Sample TCP"
   (→ `https://tcp.calcshore.ai`, no login) vs. "Book a Demo" (opens a modal that
   builds a `mailto:contact@calcshore.ai`). Which is the primary conversion path, and do
   both stay?
2. **Sample PDF.** The Deliverable link points at `/sample-tcp.pdf`, which 404s until
   the regenerated file is dropped into `public/`. Who regenerates it, and is
   `/sample-tcp.pdf` the final path?
3. **Validation-claim framing.** How to present the benchmark numbers (13/14 mixes
   within ±1°F, mean diff 0.3°F, one silica-fume mix ~3°F warmer, RMSE 0.4°F,
   "Validated vs. ConcreteWorks") — wording/substantiation for a reviewer audience.
4. **Where demo/access requests go.** Currently a `mailto:contact@calcshore.ai`
   stopgap. Real destination (form + backend? CRM? scheduling link?) TBD.
5. **Mix Design placement.** Metadata is now TCP-only (title/description/OG/Twitter
   describe Thermal Control Plans; the old Mix Design reference was removed). This page
   has no Mix Design section. Confirm Mix Design is intentionally off this page.
6. **Casing: "CalcSHore" vs "CalcShore".** The body wordmark and all of `app/layout.tsx`
   (title + OG/Twitter title + OG `siteName`) now use "Calc**S**Hore" (capital S+H).
   The domain and email stay lowercase (`calcshore.ai`, `contact@calcshore.ai`). Interim
   choice keeps the deploy internally consistent — pick one canonical brand form.
7. **Naming customers/advisors (e.g. Dolese, Bret).** The design sheet carries CSS for
   testimonial / advisor / partner blocks, but no such content shipped in this pass.
   Decide whether real names can be used before those sections are built.

## Deploy

Vercel, framework auto-detected (no `vercel.json`). Custom domain `calcshore.ai`.
Product subdomains `tcp.calcshore.ai` and `mixdesign.calcshore.ai` are separate apps.
