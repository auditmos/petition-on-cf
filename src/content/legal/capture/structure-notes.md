# Reference site — structure notes

Captured 2026-09-06 from the live site. Structure only: **no campaign copy is
recorded here** (PRD #1 copyright assumption), and no identity value from the
reference campaign either — see `README.md`. Legal wording lives tokenized in
`../tokenized/`; this file describes the shapes around it.

## Signature form

Section `#petycja`. There is **no `<form>` element** anywhere on the page — the
whole thing is React-controlled `div`s, so field identity comes from element
ids rather than input names.

`Podpisuję jako:` toggles two buttons, `osoba prywatna` (default) and
`organizacja`. Note the wording: **organizacja**, not "firma".

| Order | Label | Element id | Required marker | Mode |
|-------|-------|-----------|-----------------|------|
| — | *(none — honeypot)* | `p-hp`, `name="website"` | — | both |
| 1 | `NAZWA ORGANIZACJI *` | `p-orgn` | `*` | organizacja only |
| 2 | `TWOJA FUNKCJA W ORGANIZACJI` | `p-orgf` | none | organizacja only |
| 3 | `IMIĘ *` | `p-imie` | `*` | both |
| 4 | `NAZWISKO *` | `p-nazwisko` | `*` | both |
| 5 | `E-MAIL *` | `p-email` (`type="email"`) | `*` | both |
| 6 | `KOD POCZTOWY *` | `p-kod` (placeholder `00-000`) | `*` | both |
| 7 | `MIEJSCOWOŚĆ *` | `p-miasto` | `*` | both |

Switching to `organizacja` **prepends** the two organisation fields and keeps
all five personal fields; it does not replace them.

No checkbox or input carries the HTML `required` attribute — validation is
JavaScript-side only.

Below the fields, in order: the Cloudflare Turnstile widget (hidden input
`cf-chl-widget-<id>_response`, rendered as a visible success box), the
`Podpisuję` submit button, then the inline clause toggle.

### Consent checkboxes

Three checkboxes in both modes, but **four distinct texts** across the two
modes — the public-list consent is rewritten for organisations:

| Fixture | Position | Mode |
|---------|----------|------|
| `consent-rodo-acknowledgment.md` | 1 | identical in both |
| `consent-public-list-person.md` | 2 | osoba prywatna |
| `consent-public-list-organization.md` | 2 | organizacja |
| `consent-updates.md` | 3 | identical in both |

Only the first carries links, and both point at PDFs under a `/dokumenty/`
path — the RODO clause and the privacy policy. The template serves its own
routes instead, so those hrefs are tokenized; see `../tokens.ts`.

### Inline "Klauzula informacyjna"

A toggle rendered **below** the submit button, labelled `Klauzula informacyjna +`
when collapsed and `Klauzula informacyjna ×` when open. It expands in place —
it is not a modal, not a popup, and does not trap focus. Its text is identical
in both signer modes (`../tokenized/inline-klauzula-informacyjna.md`).

### Signature preview

A panel headed `TAK BĘDZIE WYGLĄDAŁ TWÓJ PODPIS` previews the public list entry
live: `Imię N., Miejscowość` for a person, `Nazwa organizacji` for an
organisation. Confirms the public-list format PRD story 15 assumes, and shows
that an organisation appears under its name alone.

## Share channels

A header button (`Udostępnij`) opens a dropdown with five entries:

| Entry | Target |
|-------|--------|
| `Udostępnij na X` | `twitter.com` |
| `Facebook` | `www.facebook.com` |
| `LinkedIn` | `www.linkedin.com` |
| `WhatsApp` | `wa.me` |
| `Kopiuj wiadomość` | clipboard (`aria-label="Kopiuj pełną wiadomość o petycji"`) |

The fifth copies a **full prepared message**, not a bare link — PRD story 16
says "copy-link".

## FAQ

Section `#faq`. Eight items. Each is a `<button aria-expanded="true|false">`
with a trailing `+`, and the accordion is **single-open**: opening one collapses
the one already open. Questions and answers are campaign copy and are not
recorded.

## Page anatomy

Section ids top to bottom: `hero`, `dowod`, `problem`, `mech`, `petycja`,
`podpisy`, `glosy`, `faq`, `blog`.

The hero counter panel shows a total, a goal, a progress bar and
a relative `ostatni podpis` timestamp; a ticker of recent signatures runs across
the top of the page. The header carries a `PL / EN` language switcher.
