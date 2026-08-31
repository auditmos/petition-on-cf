# Decision: editorial-civic visual language, blue accent

**Status:** accepted · **Applies to:** `src/styles.css`, `src/routes/__root.tsx`,
every component built in Phases 1–9

## Decision

The template's default look and feel follows the visual language of Polish civic
data journalism sites — the reference the owner picked is
[openbooks.pl](https://openbooks.pl/) — with the accent hue rotated from crimson
to blue. Concretely:

**Type.** A display serif for headlines and figures ([Newsreader]), a humanist
sans for body copy, form fields and navigation ([IBM Plex Sans]). Both are
variable, both are self-hosted, both declare only the `latin` and `latin-ext`
subsets. Numbers that carry the argument — the live signature count, statistics —
are set in the display serif, not the sans: that single choice does most of the
work of making the page read as journalism rather than as a SaaS landing page.

**Colour.** Semantic tokens, not palette scales:

| Token | Light | Role |
| ----- | ----- | ---- |
| `ink` | `#0f1419` | Body text and headlines |
| `paper` | `#ffffff` | Primary surface |
| `ground` | `#fafafa` | Alternating section surface |
| `quiet` | `#6b7280` | Secondary text, captions, sources |
| `divider` | `#e5e7eb` | Hairlines and card borders |
| `brand` | `#216ed4` | Identity, primary CTA, links, focus ring |
| `brand-dark` | `#1c5cb0` | Hover, and the light end of the hero gradient |
| `brand-deep` | `#0e4da0` | The dark end of the hero gradient |
| `brand-soft` / `brand-soft-border` | `#f0f6ff` / `#d9e8fc` | Tinted panels, quiet callouts |
| `positive` / `negative` | `#15803d` / `#c8152c` | Outcome only, never identity |

The blue is the reference's crimson rotated to hue 214° at matched saturation
and lightness, which is why it carries the same weight on the page rather than
reading as generic link-blue. Contrast is AA at minimum:
`brand` on `paper` and white on `brand` are both 4.95:1, `brand-dark` on `paper`
is 6.55:1, and the dark-mode `brand` on the dark surface is 7.28:1.

Moving the identity colour off red buys something the reference does not have:
red and green are then free to mean *only* outcome. A red number on this page is
alarming because it is red, not because it is branded.

`chart-1`…`chart-5` are a sequential light-to-dark blue ramp rather than five
categorical hues, because the only chart surface this template ships is the
voivodeship choropleth (Phase 6).

**Composition.** The grammar every section is built from:

- A small letterspaced uppercase eyebrow in `quiet`, then a serif headline.
- Sections alternate `paper` and `ground`, separated by hairlines rather than
  shadows. Cards are `divider`-bordered on `paper`, `--radius` 0.75rem, flat.
- Generous vertical rhythm; a single readable measure for body copy.
- Primary CTA is a solid `brand` pill; the secondary action beside it is plain
  text with a thin rule, not a second button competing for the click.
- Every figure renders its source underneath it in `quiet` — this is the
  reference's defining habit, and Phase 9 already requires it.
- The hero is the one saturated surface: a `brand-deep` → `brand-dark` gradient
  carrying white text. Everything below it is quiet.

**Shadcn.** The vendored primitives keep working because the shadcn variable
names are aliases onto these tokens, not a parallel palette. `--primary` *is*
`brand`; `--muted-foreground` *is* `quiet`. Adding a component with
`pnpx shadcn add` inherits the theme with no follow-up edit.

## Why

The petition is asking a stranger for their name, e-mail and consent to process
both. Whether that ask succeeds is mostly a trust question, and the visual
register is the first evidence a visitor gets. The civic-data-journalism look —
serif headlines, sourced figures, restrained colour, no gradients on cards, no
stock photography — reads as *someone is accountable for these numbers*. A
conventional startup landing page reads as *someone is running a funnel*.

Self-hosting the fonts is part of the same argument and not only an aesthetic
one. Loading type from a third-party CDN sends every visitor's IP to that CDN
before they have consented to anything, which is the exact objection that has
been litigated against embedded web fonts under the GDPR in the EU. A site whose
entire purpose is collecting personal data lawfully cannot leak an identifier on
first paint. Every subresource here is first-party.

Only the `latin` and `latin-ext` cuts are declared because `latin-ext` is what
carries ą ć ę ł ń ó ś ź ż. The packages also ship cyrillic, greek and vietnamese;
pointing `@font-face` at the two files each family actually needs keeps them out
of the deployed bundle entirely — four files, ~171 KB, of which a Polish visitor
fetches the two `latin` ones eagerly via `<link rel="preload">` and the
`latin-ext` ones on first diacritic.

## Decide differently when

- **The petition is not civic.** A commercial or campaign petition may want its
  own brand colour; change the `brand*` tokens in `src/styles.css` and nothing
  else moves. That is the whole point of the alias layer.
- **The organizer has a brand book.** Replace the tokens, keep the composition
  rules — the grammar survives a palette change, and it is the grammar doing the
  trust work.
- **A language outside latin-ext is added.** i18n today is PL/EN (both covered).
  Adding e.g. Ukrainian means declaring the cyrillic cuts; the `@font-face`
  blocks in `src/styles.css` are where that happens.
- **Dark mode becomes a liability.** The reference ships light-only. This
  template keeps the inherited `ThemeProvider` and defines a coherent dark
  palette, but a deployment that only ever renders light can drop the toggle
  without touching the light tokens.

## How to change the accent colour

1. Edit the five `--brand*` values in the `:root` block of `src/styles.css`, and
   their counterparts in `.dark`.
2. Re-check contrast: `brand` on `paper` and `brand-contrast` on `brand` both
   need ≥ 4.5:1.
3. Nothing else. No component hardcodes a colour, and the shadcn aliases and the
   chart ramp both read through these tokens.

[Newsreader]: https://fonts.google.com/specimen/Newsreader
[IBM Plex Sans]: https://fonts.google.com/specimen/IBM+Plex+Sans
