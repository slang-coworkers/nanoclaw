---
title: "[approver/challenger] A synchronize that is a pure master-merge does NOT close a held coverage gap — re-decide from the PR's own diff, not the maintainer's approve"
type: learning
topic: review-approval
source: learnings/1784077537602-approver-challenger-a-synchronize-that-is-a-pure-m.md
---

# [approver/challenger] A synchronize that is a pure master-merge does NOT close a held coverage gap — re-decide from the PR's own diff, not the maintainer's approve

**Symptom:** slang#12064 rev1 held ABSTAIN_POLICY/OPEN_GAP on a coverage gap (composite uint4-mask + non-fragment negative test untested). The fixer offered a ready-to-add regression test (`wave-lane-mask-fragment-flat.slang`) and orchestrator flagged the incoming `synchronize` as "likely the author adding that test — may close your gap." It did NOT: the new head `95f1ebf2d272` was a "Merge branch 'master'" commit; the PR's OWN diff (vs base) was byte-identical to rev1 (same source hunk + same 16-line test). The composite-mask test was never added.

**Root cause / how to catch it:** a `synchronize` event only means "head moved" — it does NOT mean the PR's substance changed. A master-merge (very common when an author refreshes a stale branch) moves the head and changes the diff_hash's surrounding-context bytes, but the PR's effective change can be byte-identical. Before assuming a gap closed, diff the PR's OWN change: `gh pr diff <pr> --name-only` (did the flagged file/test appear?) and compare the changed hunk to the prior revision. Don't infer gap-closure from an orchestrator hint or a maintainer approval — verify the file is present in THIS head's diff.

**Fix (procedure):** re-run the full procedure on the new head (fresh clauses/harvest/Devin/challenger/critique, one ledger row per revision). If the PR diff is byte-identical, the prior challenger logic carries as reasoning context but the gap's OPEN/CLOSED status is re-judged from THIS head's artifacts — a held coverage gap stays held until a test is actually present in the PR. Note: diff_hash can differ across a master-merge (rev1 d5f48c76a779 → rev2 d5f48c76a77a) even when the PR hunk is identical — that's expected, it hashes the full unified diff including context lines.

**Calibration (repeat of #12037/#12041 pattern):** the maintainer (jkwak-work) APPROVED @ the exact held head with the coverage gap unaddressed — the fixer's local-build verification of the composite path being correct was enough for the human, who accepted the missing test as follow-up. My shadow ABSTAIN stays conservative and never rounds up to match; the join records human_verdict=APPROVED = agreement in the withhold-on-SAFE direction, NOT a false-safe. When correctness is independently corroborated (head-current review + Devin + fixer local build) but a low-severity test is simply absent, expect human-approve-over-abstain — frame the abstain as conservative-by-design, not a risk signal.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784077537602-approver-challenger-a-synchronize-that-is-a-pure-m.md`_
