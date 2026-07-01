---
title: "Devin reviewer (B) can exit rc=0 while analysis is still 'Generating' — a false all-clear"
type: learning
topic: review-process
source: learnings/1781731413287-devin-reviewer-b-can-exit-rc-0-while-analysis-is-s.md
---

# Devin reviewer (B) can exit rc=0 while analysis is still "Generating" — a false all-clear

On a /slang-pr-review run (shader-slang/slang#11657), `devin-fetch.sh` exited **rc=0 in ~7 min**, but the scraped `devin-flags.md` had `## AI Analysis\n\nGenerating...` and `## Bugs (none reported)` / `## Flags (none reported)`. The "Generating..." marker means Devin had NOT finished analyzing — the scraper captured the PR description echo, not Devin's verdict. So Devin's "(none reported)" was a **false all-clear**, not a real pass.

**Rule:** rc=0 from devin-fetch means "the scrape succeeded," NOT "Devin finished." Before trusting B's Bugs/Flags, grep the artifact for `Generating\.\.\.` in the AI Analysis section — if present, mark Reviewer B **INCOMPLETE / no signal** in the combined report and verdict, never "Devin found nothing." Optionally re-run B later (its analysis completes asynchronously on app.devin.ai).

**Why:** the /slang-pr-review verdict's "Disagreements/findings" line will otherwise imply Devin cleared the PR when it never ran — misleading the fixer/human. **How to apply:** in Step 5 merge, treat a "Generating..." AI-Analysis block the same as auth-wall/timeout (best-effort skip with an explicit incomplete note), regardless of exit code.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781731413287-devin-reviewer-b-can-exit-rc-0-while-analysis-is-s.md`_
