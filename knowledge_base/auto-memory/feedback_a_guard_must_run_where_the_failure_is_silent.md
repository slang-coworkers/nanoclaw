---
name: feedback_a_guard_must_run_where_the_failure_is_silent
description: "A new check's VALUE is set by WHERE it runs, not by what it detects. nanoclaw#1150 built a provably-sensitive guard for the silent deploy path and wired it only into the loud one. Audit placement separately from sensitivity."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a5b972af-7843-4f33-bba2-5d5f162f197f
---

# A guard's worth is its PLACEMENT, and sensitivity testing cannot measure placement

**Measured 2026-08-09, nanoclaw#1150.** The PR's rationale was explicit and correct: `ci.yml` fails
**loudly** (`ERR_PNPM_OUTDATED_LOCKFILE`), `merge-train.sh` fails **silently** (dep discarded, install
green, deploy green, cost panel dead forever), and *"only a resolution assertion catches the silent
one."* The guard it added was well-built and **provably sensitive** — I confirmed all three of its
claimed states by execution, with the healthy case re-run as a control each time, and both of its
failure diagnoses classified correctly.

⭐⭐⭐**And it was wired into `ci.yml` only — the loud path. `compose-check.yml`, which runs the actual
deploy compose, had 0 hits** (control `frozen-lockfile`: 2 hits in the same file). The guard was
written *for* the silent path and installed *in* the loud one.

## Why sensitivity testing is blind to this

Every test I ran on the script — hide the package, hide only the entry point, restore — asks
**"does it detect the failure?"** All passed. Not one of them asks **"does it run where the failure
happens?"** ⇒ ⭐⭐⭐**A sensitivity suite and a placement audit are different measurements, and a
perfect score on the first says nothing about the second.** The check's own header text is where the
gap shows: it *names* the path it does not run on.

✅**The audit that finds it, in one line each — enumerate producers and consumers of the mechanism
separately:**
```
grep -rln "<the mechanism>"   .github/workflows/   # who is EXPOSED to the failure
grep -rln "<the new check>"   .github/workflows/   # who is PROTECTED
```
The set difference is the finding. Here: exposed = {`ci.yml`, `compose-check.yml`}, protected =
{`ci.yml`}. **Always pair with a positive control** (a step known present in both) so an empty
result is distinguishable from a broken grep.

## The compounding leg: a file that cannot protect itself

⭐⭐⭐**`ci.yml` is the one owned file that CANNOT COMPOSE ITSELF** — GitHub Actions has read and
started the workflow before the compose step runs, so a leaf PR runs **its own** `ci.yml`, never the
parent's. A check added to `ci.yml` on a parent branch therefore reaches **zero** leaf PRs — the very
PRs that commit this class of mistake.

⭐⭐**Confirmed by NATURAL EXPERIMENT on a step that already existed, not by assertion:**
`check-release-age-policy` lives only on nv-main's copy; a leaf PR's run (#1122, base `nv-dashboard`)
listed 19 steps with **no** release-age step, going `setup-bun` → `pnpm install` directly. ⇒ **when a
mechanism's reach is in question, find a step already subject to it and read a real run — cheaper and
stronger than reasoning about the platform.** See
[[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]].

⇒ **Placement fix beats detection fix:** put the assertion where the tree is already composed and
push-triggered (`compose-check.yml`), which sidesteps self-composition entirely.

## Generalization

⇒ ⭐⭐**For any newly-added guard, gate, assertion, or lint, ask THREE questions, not one:**
1. Does it detect the fault? *(sensitivity — test by construction, with controls)*
2. **Does it execute on every path where the fault occurs?** *(placement — set difference over greps)*
3. Does the fault it detects match the fault that actually bit you? *(#1150's 🟡: the guard asserted
   **resolvability** while the consumer needed **executability** — resolution succeeded and the spawn
   failed, which is exactly the state that produced the original silent `$0.00`.)*

Question 2 is the one a diff read and a passing test suite both miss, because both operate inside the
file that changed. Related: [[feedback_a_green_checker_that_excludes_the_changed_file]],
[[feedback_a_correct_rule_with_an_unvisited_boundary]],
[[project_nanoclaw_1150_ccusage_own_nvmain]].
