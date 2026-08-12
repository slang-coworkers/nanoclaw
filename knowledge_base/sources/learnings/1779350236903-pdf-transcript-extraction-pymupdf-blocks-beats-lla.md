# PDF transcript extraction: pymupdf blocks beats llama-index

# PDF transcript extraction comparison (arxiv-style papers)

Tested on a 69-page arxiv survey (2605.12090, 2.1 MB). All wall-clock numbers are local CPU.

| Tool | Time | Quality notes |
|---|---|---|
| `pymupdf` blocks (`page.get_text("blocks")`, sorted top-down) | 0.16 s | **Winner.** Clean text, paragraph-segmented (`\n\n` between blocks), no whitespace artifacts. |
| `pdftotext` (default) | 0.06 s | Fast, clean prose. Tables flattened to one cell per line. |
| `pdftotext -layout` | 0.15 s | Only one that keeps tables semi-readable. Heavy leading whitespace, less ergonomic for NLP. |
| `llama_index.readers.file.PDFReader` (pypdf backend) | 1.87 s | **Avoid.** Inserts spurious whitespace inside words/ligatures (`V anhoucke`, `Dubey ,`, `model- ing`). 10× slower. |
| `agent-browser` snapshot of `arxiv.org/html/<id>` | n/a here | arxiv has no HTML render for many recent papers (`2605.*` returns "No HTML for ..."). ar5iv fallback also fails. Useful only when HTML render exists. |

## Practical recipe

For arxiv PDFs without an HTML render:
1. **Text extraction:** `pymupdf` blocks mode for downstream NLP / chunking.
2. **Hyperlink recovery:** flat-text extractors lose URLs. Use `pypdf` to walk page `/Annots` and pull `/A /URI` — gave 351 unique URIs / 326 unique arxiv refs on this paper.
3. **Tables:** layer `pdftotext -layout` or a dedicated tool (`camelot`, `tabula`) on top.

```python
# pymupdf blocks
import pymupdf
doc = pymupdf.open(path)
text = "\n\n".join(
    "\n\n".join(b[4] for b in sorted(page.get_text("blocks"), key=lambda b: (b[1], b[0])))
    for page in doc
)

# pypdf annotation hyperlink recovery
from pypdf import PdfReader
uris = set()
for page in PdfReader(path).pages:
    for annot in page.get('/Annots', []) or []:
        obj = annot.get_object()
        if obj.get('/Subtype') == '/Link' and '/A' in obj and '/URI' in obj['/A']:
            uris.add(str(obj['/A']['/URI']))
```

## When agent-browser is the right tool

- Paper has an arxiv HTML render (`arxiv.org/html/<id>` resolves).
- Target is OpenReview / blog / project page (HTML, JS-rendered).
- You need a screenshot or visual layout, not just text.

Otherwise stick with local PDF parsing.
