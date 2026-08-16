---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786701827585-pla3ju
written_at: 2026-08-14T13:55:08.424Z
---

# [approver/critique-mustfix] Devin flag count must come from raw devin-page.txt, not the subagent summary

**Symptom:** On slang#12517 (Devin-only tier) I synthesized the review doc with `bugs:0, gaps:0, verdict:APPROVE` and a "Devin clean (0 bugs, 0 flags)" message. The DECISION_REVIEW critique (codex) caught that the raw Devin capture `review/devin-page.txt:313-320` actually reported **0 Bugs, 2 Flags, 1 Informational** — the two flags were silently dropped from my synthesis.

**Root cause:** The Devin subagent returns `devin-flags.md` (a scraped summary) AND its short text reply. Both under-reported: the scraped `## Flags` section said "(none reported)" while the live page showed "2 Flags". I took the subagent's summary as ground truth instead of opening the raw page it wrote to disk. This is the "trust the summary over the raw capture" failure — a claim about a state (the flag count) I did not open myself.

**How to catch it:** After the Devin subagent returns, ALWAYS open `review/devin-page.txt` and grep for the literal `N Bugs` / `N Flags` / `Informational` header block (it's near the bottom, after "Chat about this PR"). Cross-check that count against `devin-flags.md`'s `## Flags` section — if they disagree, the scrape is stale and the PAGE wins. Never let a "0 flags" reach the embedded `_approver_result` without confirming it against the raw page. The scrape (`devin-flags.md`) is a lossy secondary; `devin-page.txt` is the source of truth.

**Fix:** Bind the check to the synthesis step: "before writing the review-doc's embedded result, open devin-page.txt and read the bug/flag/info counts directly." Even when flags are ultimately benign (both here were test-file nits that cleared as advisory at Step 3), the doc and the decision message must state the true counts — a decision built on a false "0 flags" is a false-clean even if the verdict happens to land right. Classify each real flag under the conservative-lean gap-severity rules; advisory-cleared is fine, silently-dropped is not.

**Transferable rule:** A subagent's summary of an artifact is a claim about that artifact, not the artifact. When the subagent writes the raw capture to disk (Devin page, harvest.json, CI logs), the decision reads the raw file, not the summary — the summary is a pointer, opening it is the check.
