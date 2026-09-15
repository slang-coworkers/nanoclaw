---
name: project_12099_profile_capability_conflict_diag
description: "slang#12099 reject conflicting -profile/-capability CLI args. PR #12122 MERGED 07-23 (E00046 check across 4 target families). Arc: WOULD_APPROVE→BLOCK(RED_BUG)→family-match fix→APPROVED."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0b8447c6-ce65-4af5-9a41-633ac235ab25
---

slang#12099 — "Reject conflicting `-profile` and `-capability` command-line arguments." Enhancement, P2, frontend (options parsing + capability/target). Reporter **jkwak-work self-filed + self-assigned**; fix authorized when jkwak later commented "Please make a PR for this issue" (owner authorization overrides the self-assigned stand-down, cf. [[feedback_deadpromise_check_assignee_before_rewake]]).

**What:** `-profile spirv_1_4` + `-capability spvShaderInvocationReorderNV` silently emits SPIR-V **1.5** instead of erroring. Both constraints explicit on the CLI ⇒ should be a hard, order-independent error without `-restrictive-capability-check`. A capability satisfiable via extension while keeping the selected core version must still be **accepted** (not a conflict).

**Root cause:** `TargetRequest::getTargetCaps()` folds `-capability` atoms via `if (!isIncompatibleWith(toAdd)) join(toAdd)`. `CapabilitySet::isIncompatibleWith` returns "compatible" whenever the sets share any target abstract node — `spirv_1_4` & `spirv_1_5` are the same SPIR-V target ⇒ the join proceeds and takes MAX version. A version *raise* is a *compatible* join, never flagged. Missing prerequisite: nothing records that the profile's concrete version was **user-explicit**.

**Fix — PR #12122, Approach B (parse-time CLI diagnostic, code 46 / E00046), `Closes #12099`:** derive the version pin from the profile's **explicit** family+version (`profile.getFamily()` → SPIRV/METAL/DX/GLSL), gated by target format family (`isSPIRV`/`isMetalTarget`/`isD3DTarget`), and flag only when folding the capability raises the emitted target version. **Extension-inclusive** (no hard-coded "SER needs 1.5"), version bounds read from capdef aliases `_sm_latest`/`_GLSL_latest` (like `_spirv_latest`), `spv[A-Z]` extension spelling handled. Covers all 4 target-version families (SPIR-V / HLSL-sm / Metal / GLSL); **CUDA excluded** (no CUDA profile family). Capabilities folded **one-at-a-time** with the same `!isIncompatibleWith` guard `getTargetCaps()` uses — a pre-join of all atoms let a target-incompatible atom mask a genuine conflict.

**Review arc (why it took 5 rounds):** WOULD_APPROVE @`9fe3de9e` (false-safe, recorded on **incomplete** CI) → **BLOCK / RED_BUG @`1499ff68`**: the new diagnostic **false-positived on pre-existing valid command lines** (29 test-slang failures — e.g. `glsl_450+spirv_1_5`, `sm_6_5 -capability spvShaderInvocationReorderNV`), because `_parseProfile` records `+`-appended profile atoms as capabilities and the check flagged any version raise → family-match narrowing fix → jkwak-work **APPROVED** → **MERGED 07-23** (merge commit `7e65d59665`).

**Lessons (both shared):**
- **Never record WOULD_APPROVE while CI is pending on a behavior-changing PR** — Devin-clean ≠ test-clean; Devin does not run the suite. A new **rejection** diagnostic's blast radius is *every existing invocation* of the guarded surface. The BLOCK predicted the exact required fix; shadow validation clean. (Agreement-scoring caveat: the `9fe3de9e` WOULD_APPROVE→APPROVED join is **coincidental** — that row was a false-safe on buggy code; shipped code is a different, fixed version.)
- **Merge-queue stranding ~88h:** enqueued 07-19, evicted 05:33Z by the #12145 D3D12 Falcor flake (not a head check), bot can't self-enqueue (#11675/#11833 — token lacks push to the protected queue branch), human hand-requeued 07-22. CI-flake classification held (same-platform windows-**debug** passed while windows-release GPU job failed on unrelated dynamic-dispatch cases; job log showed infra distress). Cf. [[feedback_signature_grep_passed_vs_failed]], [[feedback_verify_branch_in_env_where_it_fires]].

**Design constraint satisfied end-to-end:** because the check is extension-inclusive, with #12097/#12115 merged (SER SPIR-V floor lowered 1.5→1.4) the original example **auto-flips to success at 1.4 with zero edit**. Related: #12097 (complementary, self-assigned jkwak), #4165 (shader-code-implied capability diagnostics — the analog for the CLI-explicit case). Documented non-blocking follow-up: Metal version-family branch untested locally (no toolchain; symmetric to SPIR-V, approved by inspection).

**State: MERGED — terminal.** Re-open only on a substantive follow-up comment on #12099 / #12122.
