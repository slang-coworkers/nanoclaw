---
title: "[approver/challenger] Re-sync on a bot-authored dep bump: give Devin a FRESH attempt — a prior revision's timeout is transient, not structural"
type: learning
topic: review-approval
source: learnings/1784323039030-approver-challenger-re-sync-on-a-bot-authored-dep-.md
---

# [approver/challenger] Re-sync on a bot-authored dep bump: give Devin a FRESH attempt — a prior revision's timeout is transient, not structural

**Symptom:** shader-slang/slang#11892 was decided twice. R1 @0fe0fff91ca7 = ABSTAIN_INFRA/NO_REVIEW_SIGNAL because harvest exit 20 (bot-authored dependabot → production review structurally skips) AND Devin exit 3 (full 30-min timeout) left zero review signal. ~1 min later dependabot re-synchronized (base moved, diff shrank from x/net 0.49.0→0.55.0 / 28 lines to just 0.54.0→0.55.0 / 6 lines). The orchestrator's re-sync tasking suggested short-circuiting a "redundant" 30-min Devin run given the identical no-harvest precondition.

**Root cause of the trap:** On a bot-authored dep bump, harvest exit 20 is *structural* (the primary tier is permanently unavailable for this PR class), so Devin is the SOLE obtainable review signal. It's tempting to reason "harvest will be 20 again and Devin timed out last time, so this is another guaranteed infra-abstain — skip Devin." That reasoning conflates a *transient* Devin-backend timeout with a *structural* property of the PR class. They are different: harvest-20 is structural; a Devin timeout is a flake of that particular run.

**How to catch it / what to do:** Give Devin a genuine fresh attempt on the re-synced head anyway. `devin-fetch.sh` runs in the background (`run_in_background: true` + a Monitor on the pid exit with a ≥30-min window), so the cost to the approver's own context/time is near-zero — there is no good reason to skip it. On #11892 R2, the fresh Devin run returned exit 0, CLEAN (0 bugs / 0 flags, "go.mod/go.sum consistent"), which — with all 6 clauses passing and a clean challenger (go.sum hashes byte-identical to R1's verified release, extras/scaler decoupled from compiler build/ship/ABI: it's a standalone Go GCP-autoscaler deployed out-of-band, no CI job builds it) — yielded **WOULD_APPROVE**. Short-circuiting would have wrongly produced a second infra-abstain on a PR that was actually cleanly approvable, inflating the infra-abstain rate the gate is supposed to drive toward zero.

**Fix / rule:** Never skip the sole obtainable review signal on a re-sync just because a prior revision's Devin timed out. Re-run it fresh (backgrounded). This is the flip side of the sibling learning `[approver/infra-abstain] dependabot bot-authored PR: harvest exit 20 + Devin timeout = guaranteed NO_REVIEW_SIGNAL` — that one is only correct *for the run where Devin actually times out*; it must not become a reason to pre-emptively skip Devin on the next revision. Sibling PR #11975 (same class, Devin ran clean first try → WOULD_APPROVE, since MERGED-agreement) confirms this class is cleanly approvable when the signal is obtained.

**Also (procedure note):** when a codex OUTPUT_REVIEW advisory prompts you to edit a deliverable artifact (e.g. decision.json) *after* it was attested, the delivery gate will (correctly) block on freshness + attested-hash mismatch. Re-run STAGE: OUTPUT_REVIEW on the edited artifacts before calling record_decision — the re-attestation resets the counter and re-binds the hashes.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784323039030-approver-challenger-re-sync-on-a-bot-authored-dep-.md`_
