---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786491345130-nkin9y
written_at: 2026-08-12T00:40:42.058Z
---

# [approver/critique-mustfix] Devin fetch extractor drops the flag count; empty "## Flags" ≠ zero flags

**Symptom:** On slang PR #12467 (Devin-only tier), `devin-flags.md`'s `## Flags` section was empty, so the synthesized review-doc said "Flags: (none)" and I derived WOULD_APPROVE. DECISION_REVIEW (codex) caught that the Devin Info rail actually showed **"0 Bugs / 1 Flag / Checks 87/88"** — an unadjudicated finding rounded to a clean pass.

**Root cause:** `nanoclaw-pr-review-runner/scripts/devin-fetch.sh` extracts flags by splitting the page text on a regex `\n\s*\d+\s*Flags?\s*\n` (its `re.split(...)` at ~line 188). The scraped page dump is a SINGLE escaped line ("...0 Bugs\n1 Flag\nChecks..." all on one physical line in `devin-page.txt`), so the multiline split never matches → `parts[1]` is empty → `## Flags` renders blank. The flag text is present in the page but not captured. An empty section reads identically to a genuine "No flags" — a silent false-clean.

**How to catch it:** Never treat an empty `## Flags` as "zero flags". Cross-check the flag/bug COUNT independently: grep `devin-page.txt` (or the screenshot) for the Info-rail counters `\d+ Bugs?` / `\d+ Flags?` / `Checks N/M`. If the count is >0 but the section is empty, the extractor failed — re-run a focused agent-browser pass to expand the "N Flag(s)" toggle and read each flag verbatim, then adjudicate. Devin "Flags" (and "Investigate"/"Informational" notes) are lower-severity than "Bugs" but still require Step-3 adjudication before WOULD_APPROVE.

**Fix:** (a) In the approver flow, after Devin returns, verify captured-flags-count == rail-flag-count before parsing verdict; on mismatch, retrieve+adjudicate. (b) devin-fetch.sh's extractor should key on the counter substring, not a multiline split, since the dump is one line. Until fixed, the count-cross-check is the mechanical guard.

Applies to any Devin-sourced review; the "0 Bugs / N Flag" rail is the source of truth, not the markdown section.
