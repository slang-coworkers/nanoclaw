---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787746972796-17ghki
written_at: 2026-08-27T11:01:11.238Z
---

# [approver/human-disagreement] BLOCK on a narrow-reachability fail-open CI-gate path — maintainer merged it unchanged

## Outcome
shader-slang/slang #12770 "Skip the Falcor approval gate on merge-queue runs". I decided **BLOCK
@8e1fd9dc** (reason `RED_BUG:falcor-build-skipped-gate-accepted-off-merge_group`). The author
(jkiviluoto-nv) **merged it UNCHANGED at exactly that head** on 2026-08-27 (no intervening commits:
the branch is only 63d60f52 → 8e1fd9dc, merged head = 8e1fd9dc). Merged ⇒ APPROVED-equivalent ⇒ my
BLOCK disagrees with the human outcome.

## Was the BLOCK wrong? (honest calibration — do NOT round up)
The defect is **real, not a false positive**: the falcor build's
`always() && should-run=='true' && (gate.result=='success' || gate.result=='skipped')` accepts a
skipped gate on ANY event, and the gate CAN be skipped on `pull_request` (its `if:` carries an
implicit `success()` over `filter`), which would run the protected self-hosted build without
approval. What I flagged accurately is the *reachability*: it requires `filter` to be **non-successful
while `should-run` still reads `'true'`** — an abnormal mode (the filter shell step has no `set -e`
and writes its output last, so it normally exits 0; the bypass needs a post-action failure or a
cancellation *after* the output was written). On a normal code change, filter succeeds → gate runs →
approval is required. So this is a **narrow-reachability** fail-open path, and I BLOCKed on the
principle "a security gate must fail closed by construction."

The maintainer merged it anyway. Two readings, both plausible: (a) they judged the narrow reachability
an acceptable residual risk on an internal-CI convenience change; (b) the path is subtle and
challenger-only (no bot reviewer — Devin/CodeRabbit — found it) so it may not have been weighed. The
merge does NOT prove my analysis wrong; it shows the **maintainer's blocking bar for a
narrow-reachability fail-open on an internal CI gate is higher than mine.**

## Transferable lesson (severity calibration, not correctness)
For a CI-gate change whose only defect is a fail-open path reachable **only under an abnormal upstream
failure mode** (upstream job non-success with a retained truthy output), weigh BLOCK vs
ABSTAIN_POLICY(OPEN_GAP) deliberately:
- The finding is worth surfacing either way — it's real and the fix is trivial (`!cancelled()` +
  `needs.<filter>.result=='success'` + scope the `skipped` acceptance to the intended event).
- But "fail closed by construction" as a BLOCK rationale competes with a maintainer's practical
  read that the trigger is near-unreachable in normal operation. When reachability requires an
  abnormal/rare failure and the blast radius is internal-CI compute (not correctness of shipped
  code, not a public-facing security boundary), a maintainer may reasonably ship it.
- I still lean toward flagging it (a security/approval gate that fails open is exactly what this
  approver exists to catch), but I should present the reachability honestly up front and consider
  whether ABSTAIN (hand to a human with the finding) fits better than BLOCK when the trigger is an
  abnormal failure mode. Here the challenger-originated finding was correct; the calibration gap is
  BLOCK-vs-ABSTAIN, not right-vs-wrong.

## Note for Step-0 recall
Falcor/`falcor-ci`/merge_group CI-gate PRs: the fail-open-vs-fail-closed analysis is the crux (see
also `[approver/challenger-miss] A skipped-gate allowance must be scoped to the event that skips it`).
The prior "rank CI-gate changes by failure DIRECTION" lesson holds — but ADD: also rank by the
*reachability of the bad direction* when choosing BLOCK vs ABSTAIN.
