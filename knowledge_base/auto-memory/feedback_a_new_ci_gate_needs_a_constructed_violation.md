---
name: feedback_a_new_ci_gate_needs_a_constructed_violation
description: "A newly-added CI gate that shows GREEN proves only that it ran, never that it GATES. Verify by CONSTRUCTING a violation and confirming exit 1 — a passing check on a clean tree is indistinguishable from a check that fails open."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2176ef69-5e07-45c5-bd89-d7d78bbe2efa
---

Measured 2026-08-06 on slang-coworkers/nanoclaw#1129, a PR whose entire purpose was to
kill the ambiguity between "no CI job ran" and "the jobs ran and passed" (both render as
a green PR).

**The trap:** the PR adds `.github/workflows/pr-guard.yml`. At head `3111274a` the guard
was RED; the author pushed `83203b86` and it went GREEN. Green-after-fix is exactly the
evidence that feels conclusive and isn't: a gate that has been broken to fail *open*
also shows green on a clean tree. The check's own output ("No whitespace/EOF errors
introduced") is what a working gate AND a no-op gate both print.

**Why:** the whole class of bug this PR fixes is *a green tick with nothing behind it*.
Accepting the green tick as proof would have reviewed the change with the same blind spot
the change exists to remove.

**How to apply:** reconstruct the step and run it under the runner's real shell
(`bash -e` — GitHub uses `shell: /usr/bin/bash -e {0}`, and `-e` changes control flow),
against a tree you deliberately dirtied. Three states, not one:

| tree | expected |
|---|---|
| violation in an ENFORCED path | `exit 1`, each diagnostic named |
| clean | `exit 0` |
| violation in a REPORTED-only path (`knowledge_base/**`) | warning, `exit 0` |

All three reproduced; the gate genuinely gates. The clean-tree run is the control that
tells you the exit 1 came from the violation and not from a broken script.

**Second finding, same review:** `bash -e` aborts a step the instant
`git diff --check` reports a finding, so `CODE_RC=$?` on the next line never executes.
A `cmd > f; RC=$?` idiom is silently unreachable under `-e` — the first real violation
would surface as an infra error, not a whitespace failure. Reproduced directly:
`bash -e` → rc=1 with the echo never printed; `bash` (no `-e`) → `REACHED cat; CODE_RC=1`.
⇒ **When reading any CI shell step, check the shell's flags before reasoning about its
control flow.** Related: `git fetch --depth=0` is `fatal: depth 0 is not a positive
number` — `--depth` is meaningful for clone, and 0 is not a valid fetch depth.

⭐ Generalization of [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]'s
core rule — **a control that fires by luck is not a control** — applied to CI: a gate you
never saw reject anything has not been observed to be a gate.
