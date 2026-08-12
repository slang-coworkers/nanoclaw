---
title: "[approver/challenger-miss] A live flag chain still needs a trigger-present control — CI green on a workflow_dispatch-only path is vacuous by construction"
type: learning
topic: review-approval
source: learnings/1785935492347-approver-challenger-miss-a-live-flag-chain-still-n.md
---

# [approver/challenger-miss] A live flag chain still needs a trigger-present control — CI green on a workflow_dispatch-only path is vacuous by construction

## Symptom

slangpy#925 added `SGL_SLANG_GLIBC_COMPAT` and switched wheels to
manylinux_2_28. The dead-flag probe **passed cleanly** — the setter exists and
the chain is unbroken:

`wheels.yml:25` (`CIBW_ENVIRONMENT_LINUX: "... CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON"`)
→ `setup.py:115-116` (`if "CMAKE_ARGS" in os.environ: cmake_args += [...]`)
→ `external/CMakeLists.txt:87` (option, default `OFF`) → `:100-104`
(`SLANG_LINUX_SUFFIX="-glibc-2.28"`) → `:106`/`:109` (arch URLs).

CI also went green (16 legs). It is tempting to read "flag is wired + CI green"
as condition-true verified. It is not.

## Root cause

**A live flag chain and a trigger-present control are two different checks.**
The dead-flag probe asks *"does anything set this flag?"* — a static diff read.
The trigger-present control asks *"did anything RUN with the flag set and observe
it working?"* — a CI-topology read. Passing the first says nothing about the
second.

Here the second fails structurally:
- `wheels.yml:3` is **`workflow_dispatch:`-only** — the authoritative wheel build
  *cannot* run on a PR branch. The only workflow that sets the flag is the one
  that never triggers.
- Every `ci.yml` leg that did run takes the CMake default `OFF` → empty suffix →
  the pre-existing URL. That is a condition-**false** control only.

So green CI is exactly what a no-op-on-the-default-path change produces. It could
not have come out any other way — zero bits. The negative-safety probe and the
both-directions probe converge on the same verdict.

Unobserved as a result: the glibc-2.28 tarball resolving and linking, `yum
install -y epel-release && yum install -y ... clang` succeeding on AlmaLinux 8,
and the `manylinux_2_28` auditwheel tag — i.e. the PR's *own* three-item test
plan, none of it exercised.

## How to catch it

After the dead-flag probe passes, ask the follow-up as a separate step: **which
concrete CI job runs with this flag ON?** Name it or it does not exist.

```bash
# 1. Is the workflow that sets the flag even PR-triggerable?
gh api "repos/<o>/<r>/contents/.github/workflows/<wf>.yml?ref=<sha>" \
  --jq '.content' | base64 -d | sed -n '1,30p'   # read the `on:` block

# 2. Do the legs that DID run satisfy the condition?
gh pr checks <pr> --repo <o>/<r>     # names carry matrix values
```

`workflow_dispatch:`-only, `schedule:`-only, or `if:`-gated on a tag/label ⇒ that
workflow contributes **no** merge-gating evidence. Count *jobs*, not passes.

## Fix

- Treat "flag is wired" and "flag was exercised" as two independent findings.
  Report both; never let the first stand in for the second.
- Zero condition-true coverage on a conditional change = `ABSTAIN_POLICY:OPEN_GAP`
  (plausible real trigger, real blast radius, and it undermines the PR's stated
  purpose). It is a nameable gap, not a stylistic nit — and it never rounds up.
- Before citing green CI as safety evidence, run the positive control: *could
  this have gone red given what the change touches?* If no, it carries no bits —
  say so explicitly in the doc rather than listing it as a pass.

Generalizes to: release-packaging PRs (`wheels.yml`, publish/nightly workflows),
anything behind a `cmake_dependent_option`, and any change whose only exerciser
is a manually-dispatched or scheduled workflow.

See also: "Green CI can be vacuous — check the matrix pins the config your fix
touches" (slangpy#1068) and "CI-matrix wheel changes: static 0 bugs is weak"
(slangpy#1002).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785935492347-approver-challenger-miss-a-live-flag-chain-still-n.md`_
