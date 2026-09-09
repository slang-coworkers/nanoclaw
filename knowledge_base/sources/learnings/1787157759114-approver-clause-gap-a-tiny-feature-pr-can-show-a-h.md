---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787156579051-3ss1r1
written_at: 2026-08-19T16:42:39.114Z
---

# [approver/clause-gap] A tiny-feature PR can show a huge file count from stale-merge branch drift — size cap abstains correctly; investigate direction before BLOCK

## Symptom
shader-slang/slang#11335 "ci: add /ci slash command" — the genuine feature is ~150 lines across 3 CI workflow files, but GitHub `changedFiles=328` / `+14540 −13278`, and `eval-clauses.py` FAILed `tier_eligible` (300 > cap 150) → ABSTAIN_POLICY. The 300 count looks alarming ("what is a /ci command doing to 328 files?") but is almost entirely benign.

## Root cause
The branch's merge-base with master was `3e85d4c` (master-at-merge-time). Between the branch's last `Merge upstream/master` and current master tip, a **repo-wide markdown/prettier reformat** landed on master (`*Usage:*`→`_Usage:_`, `*`→`-` list bullets across docs/, .claude/skills/, README, CONTRIBUTING, docs/generated/**). The branch predates that reformat, so the three-dot diff master…head shows ~315 non-CI files reverting-looking churn. Verified it is drift, not intended reverts: for the top-churn files, `head` content is IDENTICAL to the branch-side merge parent and DIFFERS from the master-side parent; `-w -B` (ignore-whitespace) still leaves 304 files because the reformat is glyph-level (`*`↔`_`), not pure whitespace.

## How to catch it
1. When a PR's changedFiles wildly exceeds its stated scope, `git clone --filter=blob:none` + fetch head & the TRUE current-master tip (`gh api repos/OWNER/NAME/commits/master --jq .sha`, NOT the possibly-stale `baseRefOid`).
2. `git merge-base --is-ancestor <realmaster> <head>` — NO means the branch is behind; then check the top-churn files' content against each merge parent (`git diff --quiet P1..head` / `P2..head`). If head==branch-side and !=master-side, it's branch/reformat drift, not a revert of master work.
3. `git log MB..realmaster -- <file>` empty ⇒ master didn't change that file since merge-base ⇒ the diff is the branch dragging OLD formatting forward, which a rebase/squash-on-current-master would drop.

## Fix / rule
The `tier_eligible` size cap (150) is the correct gate here regardless of drift — a 300-file diff cannot be auto-approved, and the ABSTAIN hands it to a human with the scope note. Do NOT escalate to BLOCK on the file count alone: BLOCK requires a verified 🔴 bug, and reformat drift is not a bug. Report both facts to the human: (a) the real feature is small and clean; (b) the file count is inflated by stale-branch reformat drift + `mergeStateStatus=BLOCKED` — they should rebase on current master before merge. Note the `/ci` feature design itself was clean (repository_dispatch = trusted base code, env:-var indirection for untrusted inputs = injection-safe, triple-if trust gate, in-flight rate limit, fork secret-gating).
