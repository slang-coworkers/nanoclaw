---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788357755654-80ocrr
written_at: 2026-09-03T10:48:36.069Z
---

# [approver/challenger] confirmed-safe: bot-authored fixer PR co-failing tier_eligible merged unchanged

## Confirmed-safe calibration — slang#12863 (merged unchanged at the exact decision commit)

**Symptom / setup.** slang#12863 (`Fix custom-file-system createSession reference leak and add replay coverage`, author `nv-slang-bot[bot]`, head branch `fix/issue-12470`, base `master`). Approver decided **ABSTAIN_POLICY** at head `57acaf40b63d` on TWO Step-1 policy clause FAILs under bundled `v0-shadow`:
- `author_trust` (CONTRIBUTOR, not in trusted OWNER/MEMBER/COLLABORATOR) — the standing bot-author pattern; and
- `tier_eligible` (437 lines changed > 400 cap).

**Terminal outcome.** MERGED by `jvepsalainen-nv` (a MEMBER, who had also posted "LGTM"/APPROVED) at `head_sha == 57acaf40b63d` — i.e. **the exact commit the approver decided on, with zero human follow-up commits between decision and merge.**

**Root cause / why the abstain was still the correct call.** ABSTAIN_POLICY asserts nothing about the code — it defers to a human — so this is a clean deferral, not a miss: the human looked and shipped it unchanged. Both clause FAILs were *policy conservatism*, not risk signals.

**Transferable calibration (the additive point over the existing bot-author-abstain atom):** the `tier_eligible` 400-line cap co-fires on **test-coverage-heavy fixer PRs**. #12863's 437 lines were dominated by *added regression tests* (three new playback round-trip tests + an in-test `TestFileSystem`) around a small production fix (move one `addRef()`; add a per-call `ReplayNullFileSystem`). Churn from new tests is low blast-radius, but the size clause counts additions+deletions blind to that. So a `tier_eligible` FAIL on a fixer PR whose diff is mostly tests is a weak risk signal — expect merge-unchanged, consistent with the standing bot-author precedent. Do not read a size-cap abstain as "this PR is risky"; it is a shadow-mode conservatism knob.

**How to catch it next time.** When an abstain is driven by `tier_eligible` alone (or `author_trust`+`tier_eligible` on a bot fixer PR), a glance at the diff composition (tests vs. production lines) tells you whether the cap is flagging real churn or coverage. Either way the decision stays ABSTAIN under `v0-shadow` (a human must look), but the calibration expectation is merge-unchanged for the test-heavy shape.

**Fix / rule.** No procedure change. Hold the ABSTAIN, don't re-escalate the mount per-PR, and record the terminal state as a confirmed-safe data point for the size-cap knob.
