"""Reflow pdftotext -layout output of the 150proc.pl legal PDFs into Markdown.

`-layout` keeps paragraph breaks as blank lines and bullets in reading order.
The PDFs also carry U+200B zero-width spaces, which mean two different things:

* after a leading list number or bullet glyph -> that line starts a heading/bullet
* at the end of a line -> an author-intended hard line break (the address block)

Everything else is soft PDF wrapping and gets re-joined into a paragraph.
Only line breaks, indentation and those markers change; words, punctuation and
ordering stay verbatim.
"""

import re
import sys

ZWSP = "​"
HEADING = re.compile(r"^(\d{1,2}(?:\.\d{1,2})?\.?)" + ZWSP + r"\s*(\S.*)$")
BULLET = re.compile(r"^●" + ZWSP + r"\s*(.*)$")


def reflow(text: str) -> str:
    blocks: list[tuple[str, str | None, list[str]]] = []

    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            blocks.append(("blank", None, []))
            continue

        hard_break = line.endswith(ZWSP)

        if m := HEADING.match(line):
            blocks.append(("heading", m.group(1), [m.group(2)]))
        elif m := BULLET.match(line):
            blocks.append(("bullet", None, [m.group(1)]))
        elif blocks and blocks[-1][0] in ("text", "bullet", "heading"):
            blocks[-1][2].append(line)
        else:
            blocks.append(("text", None, [line]))

        if hard_break and blocks[-1][0] != "blank":
            blocks[-1][2].append("\x00")  # sentinel: hard break after this line

    out: list[str] = []
    for kind, num, lines in blocks:
        if kind == "blank":
            continue
        # Join soft-wrapped lines with a space; keep author hard breaks.
        joined = " ".join(x for x in lines if x)
        joined = re.sub(r"\s*\x00\s*", "\x00", joined)
        joined = re.sub(r"[ \t]+", " ", joined).strip().strip("\x00")
        joined = joined.replace("\x00", "  \n").replace(ZWSP, "")
        if not joined:
            continue
        if kind == "heading":
            level = "###" if re.match(r"\d+\.\d", num or "") else "##"
            out.append(f"{level} {num} {joined}")
        elif kind == "bullet":
            out.append(f"- {joined}")
        else:
            out.append(joined)

    body = "\n\n".join(out)
    # The all-caps first line is the document title.
    first, _, rest = body.partition("\n\n")
    return f"# {first}\n\n{rest}".rstrip() + "\n"


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        text = fh.read()
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write(reflow(text))
    print(f"wrote {dst}")
