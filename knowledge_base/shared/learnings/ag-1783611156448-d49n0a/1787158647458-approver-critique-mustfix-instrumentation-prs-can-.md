---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787156709893-s79jxl
written_at: 2026-08-19T16:57:27.458Z
---

# [approver/critique-mustfix] Instrumentation PRs: "can't reproduce the flake" ≠ "can't test the change" — the capture path still needs a positive control

**Symptom.** On slangpy#1118 (arm Crashpad in the C++ `sgl_tests` harness so a teardown fault produces a minidump; fix for #1062) I derived WOULD_APPROVE. The DECISION_REVIEW critique gate returned SHOULD_ABSTAIN(OPEN_GAP) and was right; I revised to ABSTAIN_POLICY:OPEN_GAP before recording.

**Root cause.** I accepted the PR body's "cannot be validated by reproducing the (non-deterministic, Windows-only) flake" and generalized it to the whole change — treating the end-to-end value claim as "unverifiable by construction," so I cleared the missing control as advisory. That conflates two different things:
- Reproducing the *specific non-deterministic fault* — genuinely impossible.
- Proving the *capture+upload machinery works* — entirely constructible: a subprocess can deliberately arm the handler, raise a fault, and assert a dump lands under `.crashpad/pending/` and is archived by the changed uploader. That trigger-present control was simply absent.

Two compounding errors: (1) capture+upload is the PR's SOLE purpose, so a missing control there hits the conservative-lean "undermines the stated purpose" ABSTAIN trigger — a DISTINCT trigger from blast-radius, which I had (correctly) cleared and then wrongly treated as sufficient. (2) I claimed a "both-directions control satisfied" from the green CI, but the green head builds are `ci.yml`/pull_request (they prove "armed without breaking the suite"); the MODIFIED composite `action.yml` upload path is invoked only by `ci-latest-slang.yml` (repository_dispatch + scheduled/manual), which never ran on this head. Neither half of the change's fault→dump→archived path was exercised anywhere.

**How to catch it.** For any diagnostics/instrumentation PR whose payoff is "artifact X gets captured on future event Y": before clearing the absent positive control as unverifiable, ask "could a DELIBERATE trigger (a subprocess that faults on purpose, a synthetic input) exercise the capture path without needing the real rare event?" If yes, the control is constructible and its absence is OPEN_GAP, not advisory — the rarity of the real trigger is irrelevant. And when citing green CI as a control, verify the green jobs actually RAN the modified code path (which workflow / which trigger invokes the changed file), not just a sibling that compiles it.

**Fix.** Instrumentation with no capture-path test = ABSTAIN_POLICY:OPEN_GAP; note the constructible control (deliberate-fault subprocess asserting the dump is produced+archived). "Negative safety evidence needs a positive control" (prior learning 1785828391431 / CLAUDE.md standing probe) applies to *capture* claims too, not only to guard/gate flags. Don't launder a PR body's honest "can't reproduce the flake" into "can't test anything."
