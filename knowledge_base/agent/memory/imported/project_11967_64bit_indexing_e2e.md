---
name: project_11967_64bit_indexing_e2e
description: "slang#11967 64-bit indexing E2E test (follow-up to #11541). Bot PR #12081 (test-only static SPIR-V guard) MERGED 07-13; issue REOPENED 07-17 out of a team meeting and reassigned to @jvepsalainen-nv. Bot's runtime COMPARE_COMPUTE slice committed on fix/issue-11967-runtime @ 5433246218 but never pushed (cred outage). Interface-path IArray/IRWArray truncation = parked design decision #11990; new candidate: Buffer/RWBuffer Load((int)index) truncation (hlsl.meta.slang:19387)."
metadata:
  node_type: memory
  type: project
  originSessionId: 6e58fdce-57cd-4316-a9bc-670e8d6c3adb
---

# slang#11967 — 64-bit indexing E2E test

shader-slang/slang, author skiminki-nv, label `spirv_vulkan`. E2E-test follow-up to #11538 / PR #11541
(capability bit, merged) [[project_11538_bc_build_pending]]. Thread `gh-issue-shader-slang/slang-11967`;
triager owns the fixer edge — no double-dispatch [[feedback_no_double_dispatch_peer_wired]].

## What is actually broken (empirical, not the triage memo's static read)

- The **direct concrete-buffer** 64-bit path works untruncated (reaches `OpAccessChain`); SPIR-V emit is
  correct.
- Only the **interface-constrained path** truncates: a >2³² index through a generic `IArray`/`IRWArray`
  `__subscript(int index)` constraint (warning E30081). Needs both a >8GB buffer and generic-interface
  access — niche.
- **Widening the interface subscript to generic `TIndex` (Approach A) fails to build**: magic types throw
  **E38100** (no generic-subscript witness), so it means conformance/witness-synthesis surgery that
  skiminki already hesitated on. An additive overload (B) hits the same wall. ⇒ Approach **(c)**: ship
  the test, document the limitation.
- That limitation is tracked as its own **needs-maintainer-decision** issue **#11990**
  [[project_11990_iarray_subscript_64bit_pending]] — parked; do not attempt widening without maintainer
  sign-off.
- **New candidate (verified by triager, not yet filed/widened):** Buffer/RWBuffer
  `__subscript(uint index)` getter does `Load((int)index)` at `hlsl.meta.slang:19387` — uint→int
  truncation on the *concrete* path, distinct from #11990.

## Shipped — PR #12081 (merged 2026-07-13, `fd4bd25314`)

Test-only `tests/spirv/shader-64bit-indexing-functional.slang`: pins the ≥2³² `OpConstant %ulong
4294967296` through `OpIAdd %ulong` to the same id at `OpAccessChain` (truncation would insert a convert).
Revert-drill discriminates. jkwak-work approved ("a static test like this will do fine"), flipped it
ready himself, and merged over an unrelated infra-flake red. Bot flipped/merged nothing
[[feedback_drafts_only_guardrail]].

## Reopened 2026-07-17 — runtime slice (bot work stranded)

jkwak reopened out of a team meeting and reassigned to **@jvepsalainen-nv** (cmt 4994726033), then asked
@nv-slang-bot for a NEW PR with a **COMPARE_COMPUTE runtime test**, assigned to him (4994845920). Scope
inputs: jkwak — coop vec/mat out of scope (4995203110), extension-name coverage already exists
(4995173817); skiminki (5000287042) — GPU-in-the-loop is what "e2e" means, survey other stdlib indexable
types, coopvec/mat = determine disposition (note + postpone if they can't work with 64-bit), exit
condition deliberately exploratory.

Fixer state (07-17 08:29Z):
- Runtime test committed **`5433246218`** on `fix/issue-11967-runtime`:
  `tests/spirv/shader-64bit-indexing-runtime.slang` (Vulkan `COMPARE_COMPUTE`, `uint64_t` index under
  `[Shader64BitIndexing]`). SPIR-V validation passes; codex approve. `[Shader64BitIndexing]` is
  Vulkan/SPIR-V-only (other targets → E36107), so it can only execute on CI GPU runners.
- ⚠️ The fixer's "no NVIDIA Vulkan ICD in-container despite L40S" is **suspect** — the same claim from
  another coworker was a bad probe (looked only at `/usr/share/vulkan/icd.d`, real ICD at
  `/etc/vulkan/icd.d/nvidia_icd.json`) [[feedback_published_negative_env_claims_need_rederivation]].
  Re-derive with `vkEnumeratePhysicalDevices` before calling it unrunnable.
- **Blocked on the env-wide GitHub cred expiry** [[project_github_actions_graphql_401_outage]] — never
  pushed. Resume artifacts were on the fixer's fs: patch `/workspace/agent/patches/fix-11967-runtime.patch`,
  PR body `/workspace/agent/critique-11967/pr-body-runtime.md`.
- **Assignee:** triager ruled draft PR with **no assignee**, @-mentioning jkwak in the body (cites a
  standing [MUST NOT] on bot-PR assignee mutations — triager's reading; not indexed here). Operator
  override offered, non-urgent.

As of 08-04 the issue is human-owned and stale-reopened; not ours to drive
[[project_fixer_restart_tripwire]].

## Durable lessons from this chain

- **Never background a long build in a fixer session** — the 148h stall was the fixer backgrounding the
  build and losing the completion signal across container reaps (shared learning). Foreground builds
  resume incrementally under ninja.
- **Drift vs churn:** restart a context-drifting fixer when it produces wrong artifacts (it nearly
  shipped the rejected Approach B + a duplicate of #11990 via a stale fallback task), not when it merely
  churns tokens on correct work. The standing tripwire lives in [[project_fixer_restart_tripwire]]; the
  07-08 prod rebuild restarted the fixer involuntarily anyway (local commits survived; only gitignored
  build output was cleared). See also [[project_fleet_disk_capacity_wall_11969]].
