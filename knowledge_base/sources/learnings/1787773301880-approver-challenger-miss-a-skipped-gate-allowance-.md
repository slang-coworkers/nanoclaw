---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787746972796-17ghki
written_at: 2026-08-26T19:41:41.880Z
---

# [approver/challenger-miss] A skipped-gate allowance must be scoped to the event that skips it — else the security gate fails open

## Symptom
A CI security/approval gate is intentionally skipped on one event (e.g. `merge_group`), and the fix
that lets the dependent job survive that skip is written as an **unconditional** result check:
`always() && needs.<other>.outputs.x == 'true' && (needs.<gate>.result == 'success' || needs.<gate>.result == 'skipped')`.
This LOOKS correct (it's the pattern for "proceed after a skip") but **fails OPEN**: it accepts a
skipped gate on *every* event, not only the one where the skip is legitimate.
(Instance: shader-slang/slang #12770 R2 @8e1fd9dc, BLOCKed 2026-08-26. The `merge_group` fix let the
Falcor approval gate be bypassed on `pull_request`.)

## Root cause
The gate job itself is skipped by MORE than the intended event. In #12770 the gate's `if:` was
`should-run == 'true' && github.event_name != 'merge_group'` — **no status function**, so it carries
an implicit `success()` over its own upstream (`filter`). ⇒ the gate is skipped whenever `filter` is
non-successful, on ANY event including `pull_request`. The downstream job's `gate.result == 'skipped'`
disjunct then fires on a first-look PR, running the protected job WITHOUT approval. The
`always()`+`gate.result=='skipped'` acceptance and the gate's own skip conditions have to be reasoned
about TOGETHER: "the gate is skipped" is not synonymous with "we are on the event where skipping is
safe."

Also verified (corrects a common wrong instinct): **job outputs can persist even when the producing
job later becomes non-successful** — a post-step failure or cancellation *after* the shell step wrote
`x=true` to `$GITHUB_OUTPUT` leaves `needs.<job>.outputs.x == 'true'` readable. So "a failed/cancelled
upstream yields empty outputs, so the guard is harmless" is FALSE and must never carry a security
argument. A security boundary must fail **closed by construction**.

## How to catch it
When a PR skips a gate and adds a downstream "proceed after skip" allowance:
1. Read the GATE job's own `if:` — enumerate EVERY way it can be skipped (its event condition AND
   any implicit `success()` over its needs). If it skips on more than the intended event, the
   downstream `result=='skipped'` acceptance leaks to those events too.
2. The `skipped`-result acceptance MUST be scoped: `... || (github.event_name == '<the-skip-event>' && needs.<gate>.result == 'skipped')`.
3. `always()` disables implicit `success()` for ALL needs — so re-assert the other needs' success
   explicitly (`needs.<filter>.result == 'success'`), and prefer `!cancelled()` over `always()` so a
   cancelled run doesn't still dispatch an expensive job.
   Correct form: `!cancelled() && needs.<filter>.result == 'success' && needs.<filter>.outputs.x == 'true' && (needs.<gate>.result == 'success' || (github.event_name == '<skip-event>' && needs.<gate>.result == 'skipped'))`.

## Meta (re-review after a fix; stale reviewer signals)
- **A fix for one failure direction can open the other.** #12770 R1 was fail-CLOSED (gate skip →
  build skip → check-ci fail, wedges merge_group); the R2 fix repaired that but opened a fail-OPEN
  bypass on pull_request. On a revision that fixes your prior BLOCK, trace the NEW `if:` in full for
  BOTH directions — don't just confirm the old symptom is gone.
- **On a synchronize, reviewer signals go stale silently.** Devin was launched on the new head but
  its *analysis* quoted only the R1 change and flagged the (now-fixed) R1 bug; CodeRabbit's formal
  review was pinned to the old commit (harvest exit 10). Tell "ran at head X" from "analyzed head X":
  a reviewer that never mentions the revision's actual change is not a head-current signal. The R2
  BLOCK here was purely challenger-originated — no bot reviewer found it.
