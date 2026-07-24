# PORT-NOTES — Pass 1 (mechanical port)

Design source: `~/Downloads/handoff/CalcShore Landing.dc.html` (2,740 lines).
Target: Next.js 14 App Router repo, branch `landing-v2`.
Scope: markup, styles, fonts, behaviour. **Copy is verbatim** — no headline, CTA,
figure, PASS result, or reassurance line was edited. Copy revision is a later pass.

Build: `npm run build` passes clean (no warnings, no type errors). See §9.

---

## 1. Font replacement counts (STEP 2)

Literal font-family stacks in `app/landing.css` were replaced with the
`next/font/google` CSS variables. Counts are exact; **0 literals remain**.

| Family | Literal stack replaced | → var() replacement | Count |
|---|---|---|---|
| Playfair Display | `'Playfair Display', serif` | `var(--font-playfair), serif` | **31** |
| JetBrains Mono | `'JetBrains Mono', monospace` | `var(--font-jetbrains-mono), monospace` | **45** |
| Inter (a) | `'Inter', -apple-system, sans-serif` | `var(--font-inter), -apple-system, sans-serif` | **1** |
| Inter (b) | `'Inter', sans-serif` | `var(--font-inter), sans-serif` | **4** |
| **Inter total** | | | **5** |
| **Grand total** | | | **81** |

Verification: before replacement, the raw token counts (`Playfair Display` = 31,
`'Inter'` = 5, `JetBrains Mono` = 45) exactly matched the counted stacks, so no
stack was missed and none was over-matched. After replacement: `'Playfair Display'`
= 0, `'Inter'` = 0, `'JetBrains Mono'` = 0 remaining. The generic fallback keyword
(`serif` / `sans-serif` / `monospace`) was preserved on every replacement.

The three families are declared in `app/layout.tsx` via `next/font/google` with the
`variable` option (Playfair 700/800/900, Inter 400/500/600/700, JetBrains Mono
400/500), applied as variable classNames on `<html>`, and mirrored into
`tailwind.config.ts` `fontFamily` (serif/sans/mono). The Google Fonts `<link>` tags
from the design's `<helmet>` were **not** carried over.

**Note — SVG `font-family` attributes were NOT touched.** Three decorative seal
SVGs (`nav-seal`, `final-cta-seal`, `footer-logo-seal`) carry
`font-family="Playfair Display, serif"` as an *attribute* in the markup, and the two
data charts carry `font-family="monospace"` / `"Helvetica, Arial, sans-serif"`.
STEP 2 scoped replacement to `landing.css` only, so these markup attributes remain
verbatim. The seal "S" glyphs therefore fall back to a system serif rather than the
webfont — matching the design source's own behaviour (it did the same).

---

## 2. Stylesheet rules removed (STEP 3)

**None.** The `<style>` block (source lines 15–2197) was extracted verbatim into
`app/landing.css` (2,183 lines). It was grepped for `x-dc`, `sc-if`, `support.js`,
`[data-dc`, `dc-script` selectors — **zero matches**. There was no design-tool
runtime chrome inside the stylesheet to strip.

Two things that are *not* stylesheet rules and were intentionally left out:
- the `<script src="./support.js">` runtime and the `<script type="text/x-dc">`
  logic block (the latter reimplemented as hooks — see §4);
- the `<helmet>` Google Fonts `<link>` tags (replaced by `next/font`).

**Retained but currently unused:** the extracted CSS still contains full rules for
sections that are **not** in the shipped markup — `.personas*`, `.proof*`,
`.testimonial*`, `.advisor*`, `.partners*`, `.numbers-strip*`, `.hero-watermark`.
These are design rules, not tool chrome, so per "extract essentially verbatim" they
were kept. They are dead weight today but harmless; flag for a later cleanup pass if
those sections never ship.

---

## 3. Chart SVG byte-diff verification (STEP 4)

Both data charts were copied byte-for-byte into `app/charts.tsx` as exported raw
template-literal strings and rendered via `dangerouslySetInnerHTML` — no JSX
transformation, no formatter, ever touches their path/point data. Verified safe:
the chart ranges contain no backtick or `${`, so a raw template literal is exact.

Extracted-back-out vs. source diff:

| Chart | Source lines | `diff` result | md5 (source) | md5 (extracted) |
|---|---|---|---|---|
| PEAK TEMPERATURE scatter (~4.6 KB) | 2467–2508 | **IDENTICAL (0 diffs)** | `3a07eeaf81f85dfb2e14c40f3f215ee6` | `3a07eeaf81f85dfb2e14c40f3f215ee6` |
| CORE AND SURFACE TEMPERATURE envelope (~17.7 KB) | 2515–2559 | **IDENTICAL (0 diffs)** | `1ce5f2fcba751c1f23a3ef84e1870f6a` | `1ce5f2fcba751c1f23a3ef84e1870f6a` |

Runtime confirmation: on the dev server the scatter polygon
`points="110.0,491.0 516.0,85.0 530.0,99.0 124.0,505.0"` appears verbatim in the
served HTML, and both charts render at their intended CSS widths (scatter 440 px,
envelope 760 px). Labels `N = 14`, `±1°F band`, `n = 13`, `Silica-fume mix`,
`+3°F, conservative`, `Peak 141°F`, `RMSE 0.4°F` all present and unmodified.

---

## 4. Where verbatim conversion was NOT possible, and what I did

Every item below is a mechanical/JSX necessity, not a copy or design change.

1. **Two data charts** → raw strings via `dangerouslySetInnerHTML` (see §3). Each is
   wrapped in `<div style={{ display: "contents" }}>`, which generates no box, so
   the `<svg>` remains the direct flex child of `.validation-fig` and the layout is
   identical to the original (verified: widths 440/760 px).
2. **`<sc-if value="{{ demoOpen }}">`** → `{demoOpen && ( … )}`.
3. **`onClick="{{ handler }}"`** → `onClick={handler}` (openDemo / closeDemo / stop).
4. **Demo `<form onSubmit="{{ submitDemo }}">`** → per STEP 6, the `<form>` element was
   replaced with `<div className="demo-form">` (no native submit), the submit
   `<button>` became `type="button"` with `onClick={submitDemo}`. The `required`
   attributes were left on the inputs verbatim (inert without a form; harmless).
5. **`DCLogic` class** → React hooks in `app/page.tsx` (`'use client'`):
   `state.demoOpen` → `useState`; `componentDidMount`/`componentWillUnmount` scroll
   reveal → `useEffect` with cleanup that calls `io.disconnect()` and
   `clearTimeout(t)`. Reveal semantics preserved exactly: `.reveal` is visible by
   default, below-fold elements get `.pending` on mount, `.pending` is removed on
   intersect, and a 1600 ms safety timeout clears all `.pending`. Content stays
   visible if JS never runs.
6. **`submitDemo`** reads field values via `useRef` instead of
   `document.getElementById` — same mailto build (`subject`, `body`) and same
   `setState({demoOpen:false})` close. The mailto stopgap is kept as-is.
7. **~26 small icon SVGs** hand-converted to JSX: `class`→`className`,
   `stroke-width`→`strokeWidth`, `stroke-linecap`→`strokeLinecap`,
   `stroke-linejoin`→`strokeLinejoin`, `text-anchor`→`textAnchor`,
   `font-family`→`fontFamily`, `font-weight`→`fontWeight`, `font-size`→`fontSize`;
   `<br>`→`<br />`; `rows="3"`→`rows={3}`. Path/point data unchanged.
8. **Root wrapper:** the design's top-level siblings (`.grid-bg`, `nav`, sections,
   `footer`, modal) were wrapped in a single `<div ref={rootRef}>` because JSX needs
   one root and the reveal effect needs a scope root. No CSS uses `body > *`
   selectors, so layout is unaffected.
9. **`&amp;`** kept verbatim (6 occurrences, matching source line-for-line).
   Apostrophes are literal `'` (matching the source; this repo has no ESLint, so
   unescaped apostrophes are valid and byte-verbatim).
10. **`app/favicon.ico` deleted** (see §6) — not on the explicit DELETE list, but
    required by STEP 7's "do not leave both a file-convention icon and an explicit
    `metadata.icons` entry." Called out here for your review.

Confirmed single favicon link in the served head: `<link rel="icon" href="/favicon.svg"/>`.

---

## 5. Sample PDF link (STEP 8) — RESOLVED in Pass 2

Pass 1 pointed the Deliverable "See the full 12-page sample TCP" link at
`/sample-tcp.pdf`, which 404'd (the file does not exist and is not coming). **Pass 2
(branch `landing-v2-copy`) removed the anchor entirely** — the
`<a href="/sample-tcp.pdf">…See the full 12-page sample TCP</a>` and its icon are gone.
The now-empty `.deliverable-actions` wrapper `<div>` was retained (renders nothing) to
avoid restructuring markup. Surrounding deliverable copy, the contents list, the result
chips, and the cover-page mockup are intact. **No occurrence of `sample-tcp.pdf` remains
in `app/`** (verified).

---

## 6. OG image — RESOLVED (branch `landing-v2-og`)

A purpose-built **`public/og-image.png`** now exists at exactly **1200×630** (RGB PNG,
~83 KB). Composition: solid `#F4F4F1` (--paper) background; `public/logo-horizontal.png`
scaled to 800×231 (LANCZOS) and centered; tagline "Thermal Control Plans for mass
concrete" in Inter Regular ~38px, `#4A5876` (--ink-soft), centered below with a generous
gap; the logo+tagline group is optically centered ~26px above true center.
`app/layout.tsx` `openGraph.images` and `twitter.images` were repointed from the interim
`/logo-horizontal.png` to `/og-image.png` (og width 1200 / height 630, alt
"CalcSHore: Thermal Control Plans for mass concrete"); `twitter.card` remains
`summary_large_image`. The source logo has a **real alpha channel** (transparent
background, navy-toned anti-aliased edges — not opaque white), so compositing onto paper
produced no white box and no edge halo (verified: 0 pixels brighter than paper around the
logo). Inter was obtained from Google Fonts into a temp dir for rendering only; **the font
file is not committed**.

Favicon: the `<link rel="icon">` is single-sourced to `/favicon.svg` via
`metadata.icons`. The competing icon *design* `app/icon.svg` stays removed.

**Correction pass update:** deleting `app/favicon.ico` in Pass 1 was wrong — the
`.ico` is a format fallback (browsers/crawlers/unfurlers hit `/favicon.ico` directly),
not a competing design. The **original CalcShore mark was recovered from git history**
and installed byte-for-byte at **`public/favicon.ico`** (25,931 bytes, 4 icons:
16×16 + 32×32 + 48×48 + 256×256 at 32 bpp; md5 `c30c7d42707a47a3f4591831641e50dc`; served HTTP 200). It
carries no `<link>` or `metadata.icons` entry, so `<head>` stays single-sourced to
`/favicon.svg`, with the `.ico` serving only direct `/favicon.ico` requests. (This
supersedes the interim `.ico` an earlier pass had rasterized from `public/favicon.svg`;
the original recovered file is authoritative.) It goes in `public/`, not `app/` —
`app/favicon.ico` is an App Router file convention that would auto-inject its own
`<link>` and recreate the double-icon conflict.

---

## 7. Copy inconsistencies flagged in Pass 1

**Resolved in Pass 2 (branch `landing-v2-copy`, copy + hrefs only):**
- **"Five-section plan" → "Ten-section plan"** (Pillar 02), matching the 10-section
  Deliverable ToC. *Residual:* the sentence still lists five example sections
  ("executive summary, curing, monitoring, contingency, and pre-cooling") after
  "Ten-section plan:" — not reworded (out of Pass 2 scope; no replacement specified).
  Flag for a future copy pass.
- **Time phrasing normalized.** The hero reassurance line was replaced wholesale
  ("No login, no sales call · Sample output in about five minutes" →
  "Pilot access is by request · Book a demo and we will set you up"), removing the
  "about five minutes" instance; the final-CTA chip "Sample output in **5 minutes**" →
  "Sample output in **five minutes**". The final-CTA headline "under five minutes"
  already read "five minutes" and was left as-is (a headline, not a flagged instance).
- **Primary CTA relabeled.** "Try a Sample TCP" → "Open the TCP Generator" in all three
  places (nav, hero, final-CTA); href stays `https://tcp.calcshore.ai`. This drops the
  "sample / instant" implication now that the destination is a pilot sign-in wall.
- **Casing resolved.** "CalcSHore" (capital S+H) is final everywhere; metadata
  title/description/OG/Twitter/`siteName` all use it (fixed in the correction pass).
  Domain and email stay lowercase.

- **Final-CTA reassurance overpromise → RESOLVED (Pass 2 follow-up).** The two chips
  that implied self-serve signup and that pricing exists were replaced (markup and the
  checkmark/separator structure unchanged, strings only): "No credit card required" →
  **"Pilot access is by request"**; "Sample output in five minutes" → **"Built by two
  concrete PhDs"**. Third chip "Talk to a real engineer" unchanged. The chips now read:
  "Pilot access is by request / Built by two concrete PhDs / Talk to a real engineer."
- **Empty `.deliverable-actions` wrapper → RESOLVED (Pass 2 follow-up).** After the
  sample-PDF anchor was removed (§5), the childless `<div className="deliverable-actions">`
  was dropped as cleanup (removing an empty container is not a restructure).
  `landing.css` was not touched to compensate; any margin/padding that div carried
  simply closes a phantom gap, which is intended.

**Still open:**
- **Validation numbers** (13/14 within ±1°F, mean 0.3°F, one silica-fume mix +3°F,
  RMSE 0.4°F) are presented as-is. These are claims — see the validation-claim-framing
  open question in `CLAUDE.md`.
- **Mailto subject em dash.** `submitDemo` builds `"Demo request — "` (em dash) for the
  Book-a-Demo mailto. Reviewed and accepted as-is (it is a mailto subject, not page
  prose); the stopgap stays. Noted only for completeness.

---

## 8. Section order (STEP 5) — preserved exactly

`.grid-bg` → `nav` → `hero` → `scenario` → `pillars`#pillars →
`deliverable`#deliverable → `standards`#standards → `final-cta`#final-cta →
`footer` → demo modal (conditional).

---

## 9. Build / verify (STEP 9)

- `npm run build` → **✓ Compiled successfully**, "Linting and checking validity of
  types" passed, 4/4 static pages generated. Route `/` = 11.5 kB, First Load JS
  98.7 kB. **No warnings emitted.**
- `npm run dev` → HTTP 200; hero, all sections, both charts, fonts (Playfair/Inter/
  JetBrains Mono), navy/gold/paper palette, and grid background all render. Demo
  modal is gated on `demoOpen` and mounts only when opened.

## 10. Files touched

Created/replaced: `app/page.tsx`, `app/layout.tsx`, `app/landing.css`,
`app/charts.tsx`, `app/globals.css`, `tailwind.config.ts`, `PORT-NOTES.md`,
`CLAUDE.md`.
Deleted: `app/fonts/GeistVF.woff`, `app/fonts/GeistMonoVF.woff`, `app/fonts/` (dir),
`app/icon.svg`, `app/favicon.ico` (see §6).
