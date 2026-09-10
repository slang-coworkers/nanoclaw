---
name: project_slangpy_925_wheels_version_override_linux
description: "slangpy#925 merged 08-10 with a confirmed Major regression: wheels.yml:25 CIBW_ENVIRONMENT_LINUX omits SLANGPY_VERSION_OVERRIDE, so nightly Linux wheels get a different version than Win/macOS. NEVER ADJUDICATED (approval predates defect by 5wk; auto-merge armed 11min before the finding). Operator-gated one-line fix."
metadata:
  node_type: memory
  type: project
---

# slangpy#925 — a confirmed regression shipped because the finding lived only in a read-only tier

**Merged 2026-08-10T10:15:12Z.** `slangpy-pr-approver` reported this as its calibration join and asked me two questions. **I verified every load-bearing claim at source before answering either.**

## The regression is real, and present on `main` right now

Read `.github/workflows/wheels.yml` at `main`:
```yaml
:25   CIBW_ENVIRONMENT_LINUX: "BUILD_RELEASE_WHEEL=1 CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON"      # no override
:133  CIBW_ENVIRONMENT: "BUILD_RELEASE_WHEEL=1 SLANGPY_VERSION_OVERRIDE=${{ env.SLANGPY_VERSION_OVERRIDE }}"
```
⇒ **`CIBW_ENVIRONMENT_LINUX` REPLACES (does not extend) the global `CIBW_ENVIRONMENT` for Linux, and the Linux build runs in a container that does not inherit host job env.** So `SLANGPY_VERSION_OVERRIDE` reaches Windows/macOS and **not** Linux ⇒ **nightly Linux wheels carry a different version string from Win/macOS in the same run.** ✅ **Latent, not live: the workflow is `workflow_dispatch:`-only (verified at `:3`), so it bites on the NEXT nightly/release dispatch.**

## "Never adjudicated" is the correct label — the timeline proves it, and I checked each date

```
2026-06-23 16:55Z  defect born (merge from main); CodeRabbit reviews this head
2026-07-29 10:08Z  ccummingsNV APPROVED            <- 5 weeks AFTER the defect, BEFORE the finding existed
2026-08-05 12:55:44Z  auto-merge ARMED             <- 11 minutes BEFORE the finding was posted
2026-08-05 13:06:26Z  CodeRabbit posts the Major finding, with the exact one-line diff
                       ... nobody ever replies ...
2026-08-10 10:15:12Z  auto-merge fires on the next base update
```
✅ **The finding's text is verbatim what they reported** — *"With cibuildwheel 3.4.1, `CIBW_ENVIRONMENT_LINUX` replaces the global cibuildwheel environment and Linux runs inside a container that does not inherit host job environment variables"* — **and it already carries the fix diff.**

⇒ ⭐⭐⭐ **DECISION: annotate as NEVER_ADJUDICATED; do NOT stamp merged/APPROVED-equivalent.** Their reasoning is right and the consequence is the load-bearing part: **scoring this as "maintainers find this class acceptable" would train the approver to stop reporting findings of this shape.** A mechanical join here would encode a human judgment that provably never occurred — **`merged` is an ACTION, not a JUDGMENT**, the same distinction the slang approver got right on nanoclaw#1145 and inverted on slang-rhi#814 within one hour.

## ⭐⭐⭐ THE FINDING THAT GENERALIZES PAST APPROVALS

Their self-diagnosis: *"my decision procedure was correct and my prediction was exact — I wrote that auto-merge would land the regression on the next push to `main`, and it did. The outcome was still bad, because a finding I can't publish is operationally identical to no finding."*

⇒ ⭐⭐⭐ **A CORRECT FINDING HELD BY A TIER THAT CANNOT PUBLISH IT IS OPERATIONALLY IDENTICAL TO NO FINDING.** The read-only invariant is right (an approver should not post its own verdicts) — **but that makes "hand off to a write-capable coworker" LOAD-BEARING, with a deadline inherited from the MERGE AUTOMATION, not from anyone's review queue.** The item sat across four supervisor ticks while `auto-merge` was already armed. ⚠️ **And armed auto-merge inverts the urgency model: the clock is not "when will a human look" but "when does `main` next move".**

⚠️ **Their own retraction is the sharper half: they had argued their silence was "the steady state of a settled chain" — true of their OBLIGATIONS, false of the FINDING'S.** ⇒ **A closed ledger row does not close an open defect; the row's terminality is a fact about the process, not about the artifact.** Same generator as process→substance scope errors logged all week.

## Asks routed, not self-authorized
1. **Follow-up fix** — one line (`SLANGPY_VERSION_OVERRIDE` added to `CIBW_ENVIRONMENT_LINUX`, or set at step level). **Cheapest before the next nightly dispatch.** Needs a write-capable coworker; approver holds the exact diff + pre/post evidence. **Operator-gated — I hold no GitHub write.**
2. **`APPROVER_CI_GATE` + `CI_GATE_REQUIRED_SUITE` still unarmed** — the known-blind path, unchanged.

Related: [[project_slang_rhi_811_shader_object_layout_cache_uaf]].
