---
title: "[approver/critique-mustfix] Approver artifacts: cite line refs at pinned head + count check-runs paginated"
type: learning
topic: review-approval
source: learnings/1784288128413-approver-critique-mustfix-approver-artifacts-cite-.md
---

# [approver/critique-mustfix] Approver artifacts: cite line refs at pinned head + count check-runs paginated

**Symptom:** The OUTPUT_REVIEW critique gate repeatedly returned must-fix on shader-slang/slang#12011's decision artifacts (5 rounds total) for two recurring factual-accuracy classes — the WOULD_APPROVE decision itself was sound from round 1, but supporting facts outran the evidence.

**Root cause:**
1. **Stale source line refs.** The challenger cited `file.cpp:NNNN` from the LOCAL clone, which is at base master and does NOT contain the PR. The ledger row is about the pinned head; a helper inserted above a function (here #12011's +19-line `isHostProvidedGlobal`) shifts every downstream line ~16-33 lines. Base-clone refs are silently wrong.
2. **Non-paginated check-run count.** `gh api "repos/.../commits/<sha>/check-runs"` returns only page 1 (default 30). The real count was 46 (master-merges re-trigger + add matrix legs). Reported "30/29/1" vs actual "46/44/2". Also the paginated aggregate double-counts re-runs — a gating check (`check-ci`, `wait-for-human-priority`) can show an early `failure` AND a later `success`; and "non-success" wrongly includes skipped jobs (say "failure entries").

**How to catch it:** Before synthesizing the challenger/decision artifacts —
- Fetch the changed file at the pinned ref: `gh api "repos/OWNER/REPO/contents/PATH?ref=<head-sha>" --jq .content | base64 -d`, grep the anchors, cite from THAT (say "at pinned head <sha>").
- Count check-runs with `gh api --paginate ".../check-runs?per_page=100" | jq -s 'map(.check_runs)|add|...'`. State the head run as authoritative; baseline is corroboration only. Distinguish failure vs non-success vs skipped.

**Fix:** Bake both into the review-doc synthesis step for every decision. These are the two highest-frequency OUTPUT_REVIEW must-fixes; getting them right on first synthesis saves 3-4 critique rounds. (Note: the gate-critique-on-deliver.sh Bash regex `gh api [^|]*pulls\b` also false-positives on read-only GET of `/pulls/...` — do PR-metadata reads via a python subprocess helper, as the skill's own scripts do, not a bare `gh api .../pulls` Bash call. And create `/workspace/.claude/` if absent — the gate hook errors without its state dir.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784288128413-approver-critique-mustfix-approver-artifacts-cite-.md`_
