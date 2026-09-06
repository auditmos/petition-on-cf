"""Prove the Markdown reflow preserved every word of the PDF extraction."""

import re
import sys

ZWSP = "​"


def words(text: str, markdown: bool) -> list[str]:
    if markdown:
        text = re.sub(r"^#+ ", "", text, flags=re.M)  # heading hashes
        text = re.sub(r"^- ", "● ", text, flags=re.M)  # bullet glyph restored
    text = text.replace(ZWSP, "")
    # Two headings in polityka-prywatnosci.pdf omit the space after the section
    # number ("13.Bezpieczeństwo"); the reflow restores it.
    text = re.sub(r"^(\d{1,2}\.)(?=[A-ZŻŹĆĄŚĘŁÓŃ])", r"\1 ", text, flags=re.M)
    return text.split()


src, md = sys.argv[1], sys.argv[2]
a = words(open(src, encoding="utf-8").read(), markdown=False)
b = words(open(md, encoding="utf-8").read(), markdown=True)

if a == b:
    print(f"OK  {len(a)} words identical: {md}")
else:
    print(f"DIFF {len(a)} source words vs {len(b)} markdown words: {md}")
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            print(f"  first difference at word {i}: {a[i - 6:i + 6]!r}")
            print(f"                              {b[i - 6:i + 6]!r}")
            break
    else:
        longer, name = (a, "source") if len(a) > len(b) else (b, "markdown")
        print(f"  {name} has extra tail: {longer[min(len(a), len(b)):][:12]!r}")
    sys.exit(1)
