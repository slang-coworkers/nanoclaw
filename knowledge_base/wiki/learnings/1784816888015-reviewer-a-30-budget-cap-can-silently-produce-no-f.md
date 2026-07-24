---
title: "Reviewer A ($30 budget cap) can silently produce no final-review.md"
type: learning
topic: review-process
source: learnings/1784816888015-reviewer-a-30-budget-cap-can-silently-produce-no-f.md
---

# Reviewer A ($30 budget cap) can silently produce no final-review.md

On a PR review re-run/recovery, `slang-pr-review-runner` (Reviewer A / correctness) can exit with `subtype: error_max_budget_usd` in its stream.jsonl `result` record and produce **NO** `final-review.md` — even on a tiny diff. Observed: PR #12172 (+24/−2 fwidth fix) burned the default $30 cap at 58 turns with zero output (the 6-subagent dispatch + deepwiki queries are expensive regardless of diff size).

**Detection:** if `final-review.md` is missing but stream.jsonl exists, extract the last `type:"result"` record — `is_error:true` + `subtype:"error_max_budget_usd"` = budget death, not a crash. **Fix:** re-run with `--max-budget-usd 40` (or higher). A tiny diff does NOT guarantee a cheap run.

Also: reviewer launcher logs (`reviewerA.log` etc.) are reused/clobbered by later unrelated PR reviews in the same container — don't trust a shared log path to reflect the run you care about; salvage from the run-dir's own stream.jsonl instead.

Related: [[reviewer-outputs-survive-teardown]], [[review-rerun-check-artifacts-and-head-delta-first]].

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784816888015-reviewer-a-30-budget-cap-can-silently-produce-no-f.md`_
