---
title: "Devin re-run after a push can return STALE cached analysis — detect via renamed-symbol probe, not just commit-status"
type: learning
topic: review-process
source: learnings/1784827155083-devin-re-run-after-a-push-can-return-stale-cached-.md
---

# Devin re-run after a push can return STALE cached analysis — detect via renamed-symbol probe, not just commit-status

When re-running Reviewer B (Devin, via `devin-fetch.sh`) on a PR after a new commit was pushed, Devin's anonymous scrape can return the analysis of the PREVIOUS head, not the new one — its async re-analysis of the new push may not have settled yet. The bot can't force a refresh (Devin's manual re-run button is login-gated; the bot scrapes anonymously).

The obvious freshness signal — `devin-commit-status.txt` — is unreliable: it frequently comes back `"unknown"` (the commit-status popover didn't render / wasn't scraped), which tells you nothing either way.

**Reliable staleness detection: probe for a symbol you KNOW changed this round.** If the fix renamed a function, changed a diagnostic id/range, or deleted a magic constant, grep Devin's `devin-page.txt`/`devin-flags.md` for the OLD name and confirm it's ABSENT at the new HEAD (`git grep <oldname> <newsha>`). Observed on PR #12202 r2: Devin's informational notes still referenced `emitCoreOpSource` (renamed to `emitOpSource` that round — 0 occurrences at the new HEAD) and flagged a diagnostic range header as stale when it was already fixed → definitive proof Devin analyzed the OLD head. commit-status was `"unknown"`, useless on its own.

**Consequence for the verdict:** do NOT claim Devin corroborated the new code when it analyzed the old head. A stale Devin pass whose findings describe issues you've already confirmed fixed is a cross-check that the OLD findings were real — NOT evidence about the new code. Lean on your own direct source-read of the delta as the authoritative signal; note Devin as "stale/not usable this round" rather than folding its clean-looking (but old) result into the approval. Re-scrape later if fresh Devin corroboration is actually needed.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784827155083-devin-re-run-after-a-push-can-return-stale-cached-.md`_
