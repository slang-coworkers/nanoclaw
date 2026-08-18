---
title: "Reading Papers, Transcripts & Research Workflow"
type: concept
group: review-process
tags: [research, papers, arxiv, pdf, transcript, pymupdf, poppler, agent-browser]
source_count: 6
---

# Reading Papers, Transcripts & Research Workflow

How to read research papers (arXiv/HuggingFace) and extract text from PDFs end-to-end inside a Slang coworker container.

## TL;DR

- The `Read` tool renders PDFs by rasterizing pages with `pdftoppm`, which the base container image lacks. Request `poppler-utils` once via `install_packages` (~2MB, standard Debian repo); files under `/workspace/agent/` survive the rebuild, so downloads are not lost.
- Enter a paper through its HuggingFace page rather than hunting arXiv directly — one page links the PDF, project page, and code repo, and a cheap `WebFetch` extracts the PDF URL and metadata.
- Download with `curl -sL`. The `-L` is mandatory: some arXiv PDF URLs 302 through a CDN and a non-following fetch yields an HTML body.
- Always sanity-check a downloaded PDF with `pdfinfo` before reading. It confirms the file is a real PDF rather than an HTML 404 wearing the extension, and gives the page count you need because `Read` errors if `pages:` is omitted on anything longer than 10 pages.
- Read in chunks of about 9 pages. The hard cap is 20, but smaller batches are safer, and tables, equations, and figure captions all come through legibly at default rasterization.
- `file` is not installed in containers. Verify magic bytes with `pdfinfo` or `head -c 8 <file> | od -c`.
- Never substitute an arXiv HTML render for the PDF in real analysis — WebFetch summarizes lossily and figures and tables are lost entirely.
- For downstream NLP or chunking, extract with pymupdf in blocks mode, sorting blocks top-down and joining with blank lines. It is fast, paragraph-segmented, and free of whitespace artifacts.
- Avoid pypdf-backed document readers for bulk text: they insert spurious whitespace inside words and ligatures and run an order of magnitude slower.
- Layer a layout-preserving extractor (or a dedicated table tool) on top of pymupdf when tables matter — flat extraction collapses a table to one cell per line.
- Recover hyperlinks and citations separately via the PDF's link annotations; flat-text extractors drop URLs entirely.
- Reach for `agent-browser` only when an HTML render actually exists, when the target is an OpenReview/blog/project page, or when you need a screenshot or visual layout rather than text.
- A review runner can exit 0 and still fail to produce its deliverable. Check the output artifact's size and content, never the exit code alone.
- An external review service may never settle on a DRAFT PR and will burn its full timeout. Budget for that, and prefer running it against a non-draft when the choice exists.
- When a documented delegate path and the deployed skill disagree, the contradiction itself is usually the root cause of a contract gap — resolve which one is authoritative before treating downstream symptoms.

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


## Recent operational learnings (incremental fold 2026-07-17)

**slang-pr-review Reviewer A can complete analysis but fail to write final-review.md** — **Symptom:** `slang-pr-review-runner compose-and-run.sh` (Reviewer A) exits 0 but `final-review.md` is tiny (e.g. [slang-pr-review Reviewer A can complete analysis but fail to write final-review.md](../learnings/1784148145296-slang-pr-review-reviewer-a-can-complete-analysis-b.md)

**Devin (Reviewer B) may time out on DRAFT PRs — anonymous analysis never settles** — On slang#12131 (a DRAFT PR), `devin-fetch.sh` hit its 30m timeout (exit 3) with `devin-error.txt: "Devin did not reach a stable done state within 30m"` — the anonymous scrape of app.devin.ai/review never reached a settled commit-status. [Devin (Reviewer B) may time out on DRAFT PRs — anonymous analysis never settles](../learnings/1784173916549-devin-reviewer-b-may-time-out-on-draft-prs-anonymo.md)

**Devin's done-detector races the AI-analysis text render — a settled page can still contain "Generating…"** — The opposite failure to a timeout: `devin-fetch.sh` can declare Devin *done* too early. Its `DONE_EXPR` (`scripts/devin-fetch.sh:64-69`) treats the page as complete when three predicates go true — not "PR analysis in progress", contains "Devin's AI analysis", and matches one of `\d+ Flags?` / "No flags" / "All checks passed" / "checks failed". On shader-slang/slang#11218 (captured 2026-05-20) all three settled — the "37/37 All checks passed" banner, the "2 Flags" toggle, and the right-rail "Analysis complete" — while the middle-pane analysis paragraph was still rendering the literal string `"Generating..."`, so `devin-flags.md`'s `## AI Analysis` captured "Devin's AI analysis\nGenerating..." instead of the narrative [Devin's done-detector races the AI-analysis text render](../learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md). The checks pipeline and Devin's analysis hydrate independently, so "All checks passed" alone is not a done signal — the detector should additionally require that the paragraph following the "Devin's AI analysis" heading is not `Generating...` (`const idx = t.indexOf("Devin's AI analysis"); if (/Generating\.\.\./.test(t.slice(idx, idx+600))) return false;`) and that the right-rail reads `Analysis complete`. Practical guard: when a run's `## AI Analysis` shows only "Generating..." or a short stub, do not trust the Flags section as exhaustive — re-scrape via agent-browser (click "View results", open the `^\d+\s+Flags?$` toggle, expand each flag's `cursor-pointer` ancestor, re-read `document.body.innerText`) before reporting upstream. On #11218 this didn't change the verdict (the fully-extracted Devin report still aligned with Reviewer A: 0 bugs, 2 flags, no blockers) — it only affects the runner's reliability.

**[approver/infra-abstain] Verity delegate-path vs deployed harvest+Devin skill contradiction — the real root of the contract-block gap** — **Builds on** the earlier `[approver/infra-abstain] reviewer-coworker review-doc omits commit_id/_approver_result` atom (slang#12055). [[approver/infra-abstain] Verity delegate-path vs deployed harvest+Devin skill contradiction — the real root of the contract-block gap](../learnings/1784187372743-approver-infra-abstain-verity-delegate-path-vs-dep.md)

---
**Source learnings (6):**
- [Reading arXiv/HF papers end-to-end with the Read tool](../learnings/1778494512351-reading-arxiv-hf-papers-end-to-end-with-the-read-t.md)
- [PDF transcript extraction: pymupdf blocks beats llama-index](../learnings/1779350236903-pdf-transcript-extraction-pymupdf-blocks-beats-lla.md)
- [slang-pr-review Reviewer A can complete analysis but fail to write final-review.md](../learnings/1784148145296-slang-pr-review-reviewer-a-can-complete-analysis-b.md)
- [Devin (Reviewer B) may time out on DRAFT PRs — anonymous analysis never settles](../learnings/1784173916549-devin-reviewer-b-may-time-out-on-draft-prs-anonymo.md)
- [[approver/infra-abstain] Verity delegate-path vs deployed harvest+Devin skill contradiction — the real root of the contract-block gap](../learnings/1784187372743-approver-infra-abstain-verity-delegate-path-vs-dep.md)
- [Devin's done-detector races the AI-analysis text render (false positive on "All checks passed")](../learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md)
_Catalog: [[wiki/index.md]]_
