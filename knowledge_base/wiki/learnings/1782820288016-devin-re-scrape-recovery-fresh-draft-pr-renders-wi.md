---
title: "Devin re-scrape recovery: fresh draft PR renders with NO flag anchors; escaped-JSON grep gotcha"
type: learning
topic: review-process
source: learnings/1782820288016-devin-re-scrape-recovery-fresh-draft-pr-renders-wi.md
---

# Devin re-scrape recovery: fresh draft PR renders with NO flag anchors; escaped-JSON grep gotcha

When `slang-pr-review-runner`'s `devin-fetch.sh` exits 0 but `devin-flags.md` shows `## AI Analysis` = "Generating…", the documented done-detector race fired. On a **freshly-opened draft PR** (PR #11839, opened minutes earlier) the race is worse than the prior learning describes: the page rendered with the analysis-pane stub AND **zero** flag/bug/checks anchors (no "N Flags", no "No flags", no "All checks passed") — i.e. structurally mid-load, not just the middle pane lagging. The scraped text after "Generating…" was just the PR's own description echoed by Devin, not analysis.

**Recovery that worked (agent-browser, same persistent session):**
1. `agent-browser open <devin-url>` to re-load.
2. Poll `document.body.innerText` until the 600 chars after "Devin's AI analysis" no longer match `/Generating\.\.\./`. It settled within ~30s on the 2nd poll here.
3. Click "View results" if present (was absent here — already on results view), then click toggles whose textContent matches `/^\d+\s+(Bugs?|Flags?)$/i` or `/^(No bugs|No flags)/i`.
4. Re-scrape innerText. The settled tail then exposed "0 Bugs / 0 Flags" plus two `Informational`-severity notes (NaN/Inf already-covered; Double `LF` asymmetry no-op) that the first scrape entirely missed.

**Gotcha that cost a wasted 7-min poll loop:** `agent-browser eval '(() => JSON.stringify({...}))()'` returns the JSON **backslash-escaped** (`"{\"gen\":false,...}"`). A break condition of `grep -q '"gen":false'` never matches `\"gen\":false`, so the loop ran to timeout even though the data showed it had settled on poll 2. Either grep the escaped form (`\\"gen\\":false`) or `python3 -c 'json.loads(...)'` the line before testing.

Net: don't trust an exit-0 Devin run whose flags md has a "Generating…" stub OR no flag-count anchor — re-scrape before reporting. Devin's real verdict here was 0/0, aligning with Reviewer A (0 bugs) — the informational notes (esp. the Double `LF` asymmetry) duplicated Reviewer C's kept clarity candidate, so the re-scrape was worth it for cross-reviewer corroboration.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782820288016-devin-re-scrape-recovery-fresh-draft-pr-renders-wi.md`_
