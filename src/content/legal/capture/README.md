# Legal text capture

Provenance for the fixtures in `../tokenized/`, per
[issue #3](https://github.com/auditmos/petition-on-cf/issues/3). Captured
**2026-09-06** from the reference site, <https://150proc.pl/>.

Nothing here is wired into the application. Issue #9 (full legal layer) is what
consumes it.

## What this repository stores, and what it deliberately does not

The PRD copies legal *wording* verbatim by design. It does not copy the
reference campaign's *identity*, and nothing derived from that campaign's own
data is committed here:

| Not committed | Why |
|---------------|-----|
| Raw, untokenized fixtures | They inline the organizer's legal name, address, KRS/NIP/REGON, contact address and domain |
| The source PDFs and their text extractions | They are the reference organizer's own documents, carrying the same identity data |
| Screenshots of the live site | The page's recent-signatures sidebar shows **real signers' first names, surname initials and towns** — third-party personal data |
| The full privacy policy | See "What was dropped" below |

`../tokens.ts` holds only honestly-generic placeholder identity values, and
`../tokens.test.ts` fails if an e-mail address, a registration-number-shaped
digit run or a bare domain ever appears in a fixture again. That check is
shape-based rather than a denylist, precisely so that guarding against the data
does not require storing it.

## What was captured

| Fixture | Source |
|---------|--------|
| `consent-rodo-acknowledgment.md` | live DOM, signature form |
| `consent-public-list-person.md` | live DOM, *osoba prywatna* mode |
| `consent-public-list-organization.md` | live DOM, *organizacja* mode |
| `consent-updates.md` | live DOM, signature form |
| `inline-klauzula-informacyjna.md` | live DOM, expanded inline clause |
| `klauzula-rodo-podpisanie-petycji.md` | §1 of the linked RODO clause PDF |

Form field set, share channels and the FAQ pattern are in `structure-notes.md`.

## What was dropped, and why

- **The whole privacy policy.** Eight pages, of which the scam-reporting
  operation runs through §1, §3.2, §3.3, §3.6, §4.2–§4.5, §4.7, §5, §6, §7, §9
  and §12. Excising it cleanly would mean rewriting a legal document paragraph
  by paragraph, which needs legal review, not a capture pass. This template
  needs its own privacy policy authored in #9 anyway.
- **RODO clause §2 and §3**, covering the "Zgłoś scam" form and personal data
  obtained from third-party sources. Same reason; §1 is the petition-signing
  clause and generalizes cleanly.
- **The RODO document's title page**, which named the reference service.
- **One clause from the updates consent**, naming the reference campaign's
  scam-watch feature. The rest of that sentence is unchanged.

## Method

`curl` gets a 403 from the reference site — it is behind bot protection and
renders client-side — so the page texts were read out of the live DOM in a real
browser rather than crawled. Consent and clause strings are `innerText` of the
label and panel elements, not accessibility names, because accessible-name
computation reorders and drops punctuation.

The RODO clause was a linked PDF. It was converted with `pdftotext -layout` and
reflowed to Markdown by `scripts/reflow.py`; `scripts/verify.py` then compared
the whitespace-normalised word sequence of the extraction against the Markdown
and reported no divergence across all 1 207 words. The scripts are kept so a
re-capture is reproducible; their inputs are not, per the table above.

### Normalisations the reflow applies

Words, punctuation and ordering are untouched. Only these change:

- **Line breaks.** PDF soft wrapping is re-joined into paragraphs; blank lines
  in the extraction (real paragraph breaks) are preserved.
- **U+200B zero-width spaces.** The PDF uses them both as heading/bullet markers
  and as end-of-line hard breaks. They are removed; hard breaks became Markdown
  two-space line breaks, markers became Markdown headings and `-` bullets.
- **Missing spaces after two section numbers**, a defect in the source PDF.
  `verify.py` knows about this and normalises for it.

## Findings that change downstream scope

Recorded rather than acted on, because #3 is capture-only. Also mirrored against
Phase 7 of `plans/petition-template.md`.

1. **The reference legal documents are PDFs.** Issue #3 and PRD story 19 both
   assume HTML pages. Serving them as real routes stays right; the source is
   just a PDF rather than a page scrape.
2. **There are four consent texts, not three.** The public-list consent is
   rewritten for organisations. One stored flag still suffices, but the rendered
   wording has to switch with the signer type.
3. **The toggle is `organizacja`, not `firma`, and it adds two fields** —
   entity name (required) and the signer's role in it (optional). *Resolved
   2026-09-06:* the deployment picks the noun, and picks whether the role field
   is collected at all — on by default for *organizacja*, off for *firma*, and
   never required when shown. See the durable decisions in
   `plans/petition-template.md`; #9 carries the additive nullable column, since
   the schema from #2 has `company_name` only.
4. **The form asks for a postal code**, required, before the town. The PRD's
   data model has no such field and attributes region from Cloudflare geo-IP
   instead. Worth reconsidering in #6 — a postal code is a far better
   voivodeship signal than geo-IP.
5. **Polish declension defeats naive tokenization.** The organizer's short name
   appears in four grammatical cases. A single token cannot decline a noun, so
   the vocabulary carries one token per case and the site config has to supply
   each form. Anything that generates legal text from these fixtures must use
   the right case, not the nominative everywhere.
6. **Legal wording absorbs campaign-specific processing.** This is what forced
   the drops above, and it is the general lesson for #9: a clause describing
   processing the deployment does not perform is worse than no clause. Whatever
   #9 authors has to match what this template actually does.
7. **No addressee token was needed.** Issue #3 lists "addressee" in the token
   vocabulary, but the reference site never names its addressee in legal text —
   it only refers to *"the petition's addressee"* generically.
8. **Turnstile is confirmed in use** on the reference form, alongside a honeypot
   field.

## HITL gate — what @tkowalczyk needs to check

The last acceptance criterion on #3 is a human confirming the captured wording
is verbatim. Everything else is enforced by `pnpm test`.

Because no raw fixture is committed, the comparison is against the tokenized
files with the tokens read as their slots:

1. Open <https://150proc.pl/>, scroll to the signature form.
2. In *osoba prywatna* mode compare `consent-rodo-acknowledgment.md`,
   `consent-public-list-person.md` and `consent-updates.md` — the last one with
   the scam-watch clause removed, as noted above.
3. Switch to *organizacja* and compare `consent-public-list-organization.md`.
4. Expand the inline clause toggle and compare
   `inline-klauzula-informacyjna.md`.
5. Open the linked RODO clause PDF and compare §1 against
   `klauzula-rodo-podpisanie-petycji.md`.

Then decide findings 3, 4, 5 and 6, since they set scope for #4 and #9.
