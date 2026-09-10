---
name: feedback_an_agreed_fix_still_needs_its_cost_measured
description: "Two reviewers agreed on a one-line fix; neither ran the suite against it. It turns 6 of 13 tests red from FIXTURE assumptions, so the correct fix reads as wrong and gets reverted. 'Correct' and 'lands green' are different claims."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d50a620b-426e-4e75-9327-d934db9df48b
---

**Measured 2026-08-06 on `slang-coworkers/nanoclaw#1120`.** A concurrent session and I independently
derived the **identical one-line fix** for a real defect (source the ownership matcher from the ref,
as the allowlist already is: `MATCHER="$WORK/ownership.py"` + `git show "$REF:…"`). Both of us verified
it *fixes the bug*, each with both-direction controls. **Neither of us ran the project's own test
suite against it.** I did, afterward:

```
Tests  6 failed | 7 passed (13)      ← all `expected 2 to be +0` / `expected 2 to be 1`
```

Nothing was wrong with the fix. **Two fixture assumptions**, both explicitly marked deliberate in a
comment (`setup/nv-owned-drift.test.ts:93-96`, *"Left untracked on purpose"*):

1. the fixture's `nv-main` branch **never commits** the matcher ⇒ `git show "$REF:…"` finds nothing ⇒
   the script's own fail-closed preflight exits 2;
2. the untracked worktree copy then **blocks** `git checkout -B tmp-nv-main origin/nv-main`
   (*"untracked working tree files would be overwritten"*) once the ref does carry one.

Both correct for a worktree-sourced matcher, wrong for a ref-sourced one. **Two fixture lines ⇒
`13 passed (13)`**, with the suite provably no weaker (tampered matcher: tip script exit 0 / patched
exit 1 on a real clone).

⇒ ⭐⭐⭐ **"This fix is correct" and "this fix lands green" are DIFFERENT CLAIMS, and the gap between
them is exactly where a correct fix gets reverted.** An implementer who applies an agreed one-liner
and sees 6 red tests has every reason to conclude the reviewers were wrong — the fixture failure is
indistinguishable from a logic failure at the exit-code level.

**The rule:** when you propose a patch, **apply it and run the affected suite**, then report either
"green" or the failures *with their cause localized to fixture-vs-logic*. Especially when a second
reviewer already agreed — ⭐⭐**agreement raises confidence in correctness and says nothing about
integration cost, so consensus is the moment this check is most likely to be skipped by everyone.**

**Diagnostic that separates the two:** a fixture failure changes when you touch only the *fixture*;
a logic failure does not. Two lines of fixture edit taking 6 failures to 0, with the tamper-detection
control still firing, settles it in one run.

Related: [[project_nanoclaw_1120_owned_drift_verifier]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[feedback_my_environment_is_a_scope_claim_needing_enumeration]].
