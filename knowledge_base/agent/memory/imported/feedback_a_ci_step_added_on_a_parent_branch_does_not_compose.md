---
name: feedback_a_ci_step_added_on_a_parent_branch_does_not_compose
description: "A FILE added on a parent branch reaches child-branch CI; a STEP added to that branch's ci.yml does not — the workflow executes from the PR head. Pairing a test with a CI-env step on the parent breaks every child PR. Measured on nanoclaw 2026-08-06."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73bc7a6b-93b3-4779-bd6e-12f696b8d2a9
---

# Adding a CI **step** on a parent branch is not the same as adding a **file** on it

Measured 2026-08-06 on `slang-coworkers/nanoclaw` (#1120 → broke #1122 + #1123, fixed by #1134).

**The asymmetry.** Sibling-branch CI *composes*: the job merges `nv-main` into the PR's tree and
tests the composed state. So every nv-main-owned **file** reaches the test run. But GitHub Actions
has already read and started `.github/workflows/ci.yml` **before** the compose step executes, so
`git checkout origin/nv-main -- .github/workflows/ci.yml` rewrites a file on disk and not the job
already running.

⇒ **`ci.yml` is the one owned file that cannot compose itself.** A test added on the parent travels
to child PRs; the CI-environment step it needs does not.

**The instance.** #1120 added `setup/nv-owned-drift.test.ts` *and* the `setup-python` +
`pip install pathspec` steps it needs. On nv-main: green. On every overlay PR: **6 assertions fail**
in tests that have nothing to do with the PR's subject (`expect(r.status).toBe(0)` receiving **2**),
because without `pathspec` the shared `ownership.py` can't import and `check-nv-owned-drift.sh` exits
2 *inside its own hermetic fixtures*.

⭐⭐ **The failure mode that makes this expensive: the red lands on an innocent PR and looks like its
fault.** Two authors' unrelated changes (a ccusage pin; a Discord reply-capacity fix) were each
presumed guilty first.

## The cheap detector — a per-branch census, with a control

```
for b in <parent> <child…>; do
  echo -n "$b: "; git show origin/$b:.github/workflows/ci.yml | grep -c '<the new step>'
done
# CONTROL: a step every branch's ci.yml HAS (else a row of zeros may mean a bad grep)
for b in …; do git show origin/$b:.github/workflows/ci.yml | grep -c 'frozen-lockfile'; done
```
Measured here: new step `1` on nv-main, **`0`** on all four overlays; control present everywhere.
⭐⭐**A census of zeros is worthless without the control** — it cannot distinguish "absent" from
"my pattern never matches".

## The two fixes, and why one is better

- **Sync the step into every child's `ci.yml`** — works, but is per-branch drift you must repeat, and
  it is only correct until the next branch appears.
- ✅ **Make the tool provision its own environment** (#1134): on `ModuleNotFoundError`, create/reuse a
  cached venv under `XDG_CACHE_HOME`, pip-install the dep, extend `sys.path`. No re-exec — one
  consumer *imports* the module while another shells out to its CLI, and `sys.path` serves both.
  ⭐⭐⭐**Reimplementing the matcher was explicitly rejected for the right reason: that module exists
  BECAUSE two readers of one allowlist disagreed, so a hand-rolled third dialect would be the
  original bug wearing a hat.**

Verified locally with `pathspec` absent from the system: clean case exit **0**, drift case exit **1**,
`--allow` exit **0** — i.e. the self-provisioning path restores all three behaviours, not just the
one that was failing.

## The generalization worth carrying

**Before adding a CI step alongside a test on an integration branch, ask which artifact travels.**
Files compose; workflow steps do not. If the test needs an environment the step provides, either the
tool provisions it itself, or the test cannot run anywhere the step is absent — and it will fail
loudly on other people's PRs.

Related: [[project_nanoclaw_1122_ccusage_pin_owned_file]] (where this red surfaced),
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
