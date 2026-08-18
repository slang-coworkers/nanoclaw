---
title: "Reading arXiv/HF papers end-to-end with the Read tool"
type: learning
topic: review-process
source: learnings/1778494512351-reading-arxiv-hf-papers-end-to-end-with-the-read-t.md
---

# Reading arXiv/HF papers end-to-end with the Read tool

# Reading arXiv / HF papers end-to-end

The `Read` tool natively supports PDFs — it rasterizes pages via `pdftoppm` and feeds them to the multimodal model. This means you can analyze research papers directly, no custom PDF parser, no text-extraction tool. But **the base container image does not include `poppler-utils`**, so `Read` on a PDF fails with a clear error:

> `pdftoppm is not installed. Install poppler-utils...`

## One-time setup (per agent)

Request once with `install_packages`:

```json
{ "apt": ["poppler-utils"], "reason": "Enable Read tool PDF rendering" }
```

~2MB, standard Debian repo. After approval + rebuild, `/usr/bin/pdftoppm` and `/usr/bin/pdfinfo` are available.

## Pipeline that works

```bash
# 1. Resolve the arxiv PDF URL from the HF paper page (cheap, reliable)
WebFetch https://huggingface.co/papers/<ID> → extract arxiv PDF URL + metadata

# 2. Download
mkdir -p /workspace/agent/papers
curl -sL -o /workspace/agent/papers/<slug>.pdf https://arxiv.org/pdf/<ID>

# 3. Inspect before reading (cheap sanity check)
pdfinfo /workspace/agent/papers/<slug>.pdf | head -20
#   - Confirms it's a valid PDF (not an HTML error page)
#   - Gives page count — needed because Read requires `pages:` for >10 pages

# 4. Read in chunks of ≤9 pages (Read tool hard cap is 20, but 9 is a safer batch)
Read pages=1-9
Read pages=10-17
```

## Why this matters

- HF paper pages are often the better entry point than arxiv listings — they link the PDF, project page, and code repo in one place, and `WebFetch` resolves them cheaply.
- `pdfinfo` first avoids wasting a `Read` call on a corrupted/truncated download or an HTML 404 masquerading as a PDF.
- Splitting into ≤9-page batches gives the multimodal model a manageable chunk per call. Tables, equations, and figure captions all come through legibly at default rasterization.
- Everything under `/workspace/agent/` persists across container rebuilds, so downloaded papers survive package installs.

## Gotchas

- `file` is not installed; use `head -c 8 <file> | od -c` or `pdfinfo` to verify PDF magic bytes.
- The Read tool errors if you omit `pages:` on a PDF >10 pages. Always check page count first.
- Some arxiv URLs 302 through a CDN — `curl -L` is mandatory.
- The HTML version of an arxiv paper (`https://arxiv.org/html/<ID>`) is **not** a good substitute — WebFetch summarizes lossy; figures and tables are lost. Always go to the PDF for real analysis.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1778494512351-reading-arxiv-hf-papers-end-to-end-with-the-read-t.md`_
