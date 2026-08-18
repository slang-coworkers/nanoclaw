---
title: "Devin Review done-detector races AI-analysis text render"
type: learning
topic: review-process
source: learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md
---

# Devin Review done-detector races AI-analysis text render

`slang-pr-review-runner`'s `devin-fetch.sh` polls Devin Review (app.devin.ai/review) for completion. The detector treats "All checks passed" + "Devin's AI analysis" + flag count as done — but Devin's middle-pane analysis paragraph can still render `Generating...` while right-rail status reads `Analysis complete` and the flag toggle is populated. The script breaks out, saves `devin-page.txt`, and produces a `devin-flags.md` whose `## AI Analysis` contains "Devin's AI analysis\nGenerating..." rather than the actual analysis.

## What goes wrong

In `scripts/devin-fetch.sh:64-69`, the polling loop declares the page "done" when `document.body.innerText` matches:

- not "PR analysis in progress"
- contains "Devin's AI analysis"
- contains one of `\d+ Flags?` / "No flags" / "All checks passed" / "checks failed"

On at least one real run (shader-slang/slang#11218, captured 2026-05-20 22:50–22:57 IST), all three predicates went true while the middle-pane AI-analysis paragraph was still rendering as the literal string `"Generating..."`. The right-pane "Analysis complete" status, the "Checks 37/37 All checks passed" banner, and the "2 Flags" toggle all settle before the middle-pane analysis paragraph hydrates. So the page is structurally complete (you can read flags) but the analysis text isn't.

## Manual recovery

After `devin-fetch.sh` exits 0, drive `agent-browser`:
1. Click "View results" (button text exact)
2. Click "N Flags" toggle (regex `^\d+\s+Flags?$` on button textContent)
3. For each flag — find span text starting with the flag title, walk up to the nearest BUTTON or `cursor-pointer` ancestor, click it
4. Re-scrape `document.body.innerText` — the open-flag panel now exposes the full Devin narrative inline

Capture `devin-screenshot.png` and per-modal screenshots for audit. Rebuild `devin-flags.md` from page text.

## Suggested skill fix

Extend `DONE_EXPR` to also require the "Devin's AI analysis" heading to be followed by a non-`Generating...` paragraph before declaring done:

```js
const idx = t.indexOf("Devin's AI analysis");
const tail = idx >= 0 ? t.slice(idx, idx + 600) : "";
if (/Generating\.\.\./.test(tail)) return false;
```

Better detector signal: wait for the middle pane to drop the `Generating...` placeholder AND the right-rail to read `Analysis complete` (not just `All checks passed` — checks finishing is a separate pipeline from Devin's analysis). Both conditions need to be true.

## How to apply

When invoking `slang-pr-review-runner devin-fetch` and the resulting `devin-flags.md` shows the `## AI Analysis` paragraph as "Generating..." or any short stub, do not trust the Flags section as exhaustive — it may also have missed late-rendered flag detail. Re-scrape via the agent-browser sequence above before reporting upstream.

Doesn't affect the fix's verdict on the original PR — the fully extracted Devin report still aligned with Reviewer A on PR 11218 (0 bugs, 2 flags, no merge blockers). It only affects the runner's reliability.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md`_
