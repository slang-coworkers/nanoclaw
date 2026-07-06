---
title: "Reading Papers, Transcripts & Research Workflow"
type: concept
group: review-process
tags: [research, papers, arxiv, pdf, transcript, pymupdf, poppler, agent-browser]
source_count: 2
---

# Reading Papers, Transcripts & Research Workflow

How to read research papers (arXiv/HuggingFace) and extract text from PDFs end-to-end inside a Slang coworker container.

## Reading arXiv / HuggingFace Papers with the Read Tool

The `Read` tool natively supports PDFs — it rasterizes pages via `pdftoppm` and feeds them to the multimodal model — but the base container image does not include `poppler-utils`. Without it, `Read` on a PDF fails with `pdftoppm is not installed. Install poppler-utils...` [Reading arXiv/HF papers end-to-end with the Read tool](../learnings/1778494512351-reading-arxiv-hf-papers-end-to-end-with-the-read-t.md).

**One-time setup (per agent):** Request once with `install_packages`:

```json
{ "apt": ["poppler-utils"], "reason": "Enable Read tool PDF rendering" }
```

~2MB, standard Debian repo. After approval + rebuild, `/usr/bin/pdftoppm` and `/usr/bin/pdfinfo` are available. Files under `/workspace/agent/` persist across container rebuilds, so downloaded papers survive package installs.

**Pipeline that works:**

1. Resolve the arXiv PDF URL from the HF paper page — `WebFetch https://huggingface.co/papers/<ID>` extracts the arXiv PDF URL and metadata cheaply. HF paper pages are the better entry point: they link the PDF, project page, and code repo in one place.
2. Download: `curl -sL -o /workspace/agent/papers/<slug>.pdf https://arxiv.org/pdf/<ID>` (the `-L` flag is mandatory — some arXiv URLs 302 through a CDN).
3. Sanity-check before reading: `pdfinfo /workspace/agent/papers/<slug>.pdf | head -20` — confirms a valid PDF (not an HTML 404 masquerading as one) and gives page count, which is required because `Read` errors if you omit `pages:` on any PDF longer than 10 pages.
4. Read in chunks of ≤9 pages (Read tool hard cap is 20; 9 is a safer batch). Tables, equations, and figure captions all come through legibly at default rasterization.

**Gotchas:**
- `file` is not installed in containers; use `pdfinfo` or `head -c 8 <file> | od -c` to verify PDF magic bytes.
- The HTML version of an arXiv paper (`https://arxiv.org/html/<ID>`) is **not** a good substitute — WebFetch summarizes lossily and figures/tables are lost. Always use the PDF for real analysis.

## PDF Text Extraction: pymupdf Blocks Beats llama-index

For downstream NLP / chunking of arXiv PDFs, `pymupdf` in blocks mode is the recommended extractor. Benchmarked on a 69-page arXiv survey (2605.12090, 2.1 MB) [PDF transcript extraction: pymupdf blocks beats llama-index](../learnings/1779350236903-pdf-transcript-extraction-pymupdf-blocks-beats-lla.md):

| Tool | Time | Quality |
|---|---|---|
| `pymupdf` blocks (`page.get_text("blocks")`, sorted top-down) | 0.16 s | **Winner.** Clean text, paragraph-segmented (`\n\n` between blocks), no whitespace artifacts. |
| `pdftotext` (default) | 0.06 s | Fast, clean prose. Tables flattened to one cell per line. |
| `pdftotext -layout` | 0.15 s | Only option that keeps tables semi-readable. Heavy leading whitespace. |
| `llama_index.readers.file.PDFReader` (pypdf backend) | 1.87 s | **Avoid.** Inserts spurious whitespace inside words/ligatures (`V anhoucke`, `model- ing`). 10× slower. |
| `agent-browser` on `arxiv.org/html/<id>` | n/a | Useful only when HTML render exists; many recent papers have none. |

**Practical recipe:**

```python
# pymupdf blocks for NLP / chunking
import pymupdf
doc = pymupdf.open(path)
text = "\n\n".join(
    "\n\n".join(b[4] for b in sorted(page.get_text("blocks"), key=lambda b: (b[1], b[0])))
    for page in doc
)

# pypdf for hyperlink / citation recovery (flat-text extractors lose URLs)
from pypdf import PdfReader
uris = set()
for page in PdfReader(path).pages:
    for annot in page.get('/Annots', []) or []:
        obj = annot.get_object()
        if obj.get('/Subtype') == '/Link' and '/A' in obj and '/URI' in obj['/A']:
            uris.add(str(obj['/A']['/URI']))
```

For tables, layer `pdftotext -layout` or a dedicated tool (`camelot`, `tabula`) on top of pymupdf.

**When `agent-browser` is the right tool:** the paper has an arXiv HTML render (`arxiv.org/html/<id>` resolves); or the target is OpenReview / blog / project page (HTML, JS-rendered); or you need a screenshot or visual layout, not just text.

---
**Source learnings (2):**
- [Reading arXiv/HF papers end-to-end with the Read tool](../learnings/1778494512351-reading-arxiv-hf-papers-end-to-end-with-the-read-t.md)
- [PDF transcript extraction: pymupdf blocks beats llama-index](../learnings/1779350236903-pdf-transcript-extraction-pymupdf-blocks-beats-lla.md)
_Catalog: [[wiki/index.md]]_
