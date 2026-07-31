---
name: project-12265-byteaddressbuffer-atomic-shared-type-mutation
description: "slang#12265 — InterlockedAdd on RWByteAddressBuffer passed to helper fn flips whole module to RWStructuredBuffer<uint32_t>; C++/CPU Load/Store not rewritten → wrong index"
metadata: 
  node_type: memory
  type: project
  originSessionId: 08063a7b-6031-4599-b3b4-8b261c6ae619
---

# slang#12265 — RWByteAddressBuffer atomic → shared-type mutation breaks Load/Store on C++/CPU

Reporter CrossVR (external), Slang 2026.14, Windows. **P2 / high / bug.**

**Symptom:** `InterlockedAdd()` on a `RWByteAddressBuffer` passed *into a helper function* flips ALL instances of the buffer to `RWStructuredBuffer<uint32_t>`, but `Load`/`Store` are left as byte-address ops → they index the structured buffer with byte offsets (`Load(12)` reads elem 12, not elem 3). C++/CPU target.

**Root cause (triager, proven via IR dump + emitted C++):** `getEquivalentStructuredBuffer` IRParam branch (`slang-ir-byte-address-legalize.cpp:1178-1186`) calls `replaceUsesWith` on the SHARED deduplicated `RWByteAddressBuffer` type inst → mutates the whole module's byte-address buffers to structured. C++/CPU emit has `translateToStructuredBufferOps=false` so it never rewrites the byte-address Load to divide by stride.

**Scope:** observable corruption is C++/CPU-specific @HEAD. SPIR-V/GLSL rewrite the load (÷4), Metal lowers to raw pointer (>>2) — all correct. Only triggers when the buffer is passed into a helper function.

**Recommended fix = Approach A:** make the IRParam branch non-mutating (build a local structured view at the use site, like the global-param branch does). 3 approaches in triage memo.

**State (2026-07-29):**
- Reproduced @HEAD `1eeb3b29d`; `reproduced`+`Bug` labels applied.
- Verdict posted: https://github.com/shader-slang/slang/issues/12265#issuecomment-5120166720
- Triager forwarded to slang-fixer on canonical thread `gh-issue-shader-slang/slang-12265`.
- Fixer CLAIMED (2026-07-29 15:47): worktree `wt-slang-12265` on branch `fix/issue-12265` off master `71a3f7e71a`.
- Repro test confirmed FAILING @HEAD (16:18): cpu + cuda fail, vk passes — matches diagnosis (only `translate=false` targets corrupt).
- **Applied fix (refinement of Approach A):** gate the IRParam branch of `getEquivalentStructuredBuffer` (`source/slang/slang-ir-byte-address-legalize.cpp`) on `translateToStructuredBufferOps` — KEEP the whole-buffer flip on SPIR-V/GLSL (a pre-existing test, #8815's `-DBRANCH`, depends on the flip, so a blanket non-mutating change would break it), return null on CPU/CUDA so the `GetEquivalentStructuredBuffer` inst survives → local `param.asStructuredBuffer<T>()` view instead of `replaceUsesWith` on the shared dedup type inst.
- **Fix Report (2026-07-29 17:05):** DRAFT PR **#12267** (https://github.com/shader-slang/slang/pull/12267), branch `fix/issue-12265` HEAD `da0d60123b`, base master. 2 files (+51/−3) + regression test `tests/compute/byte-address-buffer-atomic-via-helper-12265.slang`. Tests: repro PASS 3/3 (cuda+vk runtime=103, cpp static emit-shape); #8815 branch suite 8/8; byte-address/atomics/structured-buffer all green. **Bug also affected CUDA, not just CPU** (widened triage scope). Codex 3-stage (PLAN/CODE/OUTPUT) all approve; 2 internal review subagents found no regressions.
- **Review relay:** fixer lacks a reliable slang-reviewer edge → relayed [Fix Review Request] to slang-reviewer via Main on canonical thread (2026-07-29). slang-reviewer running 3-reviewer pass on `da0d60123b` (~20-30 min, verdict on canonical thread). Fixer handles verdict on PR thread itself.
- PR #12267 `Closes #12265`, also refs #8780, `pr: non-breaking`. Issue verdict comment 5120166720 refreshed in place → "fix in draft PR #12267, held pending review."
- `ci_failed` webhook on the draft = benign priority-yield (real `pull_request` CI skipped on drafts) — self-reruns, no action.
- **Maintainer engaged (2026-07-29 22:54):** @jkwak-work asked on the PR review thread why the fix is needed for CPU-only when GLSL/SPIRV are fine. Fixer answered on-thread (r3678571740): GLSL/SPIR-V set `translateToStructuredBufferOps=true` so the same pass rebases the byte-address loads (offset/stride) to match the flipped type — consistent; CPU/CUDA leave it false so only the shared dedup type flipped while raw byte offsets stayed → misindex. Also corrected "CPU-only" → CUDA affected too. **No code change requested.** PR still draft; fixer owns the thread.
- **Maintainer follow-up — NEW mixed-width manifestation (2026-07-29 22:55, comment 5124905705):** @jkwak-work reports the bug can corrupt both the **address AND the atomic width**, not just Load/Store indexing. Repro (v2026.14 Win, `ParameterBlock<MyRes{RWByteAddressBuffer buf}>`): a 64-bit helper atomic `InterlockedMaxU64` + a 32-bit `InterlockedAdd(16,…)` on the same buffer → legalizing the U64 atomic selects `ulonglong` as the element type for the WHOLE shared buffer; the U32 atomic's byte offset 16 becomes index `4U` but applied to `ulonglong` elements → PTX emits `atom.add.u64` at byte offset **32** (should be 32-bit at offset 16). Same shared-type `replaceUsesWith` root cause. Maintainer believes #12267's approach **should** prevent it on CUDA but **explicitly requests the mixed U64/U32 case as regression coverage** (verifies that legalizing one atomic does not determine the element type of unrelated atomics on the same buffer). Routed to slang-fixer on canonical thread 2026-07-29.
- **Mixed-width case VERIFIED (2026-07-30 01:00):** fixer built PR branch + ran on L40S. #12267 **fully fixes** jkwak's mixed U64/U32 repro, no code change needed — PTX before→after: `atom.add.u64` @byte32 → `atom.add.u32` @byte16 (U64 helper `atom.max.u64` unchanged). Fix isolates element-type per-atomic (each atomic gets its own `asStructuredBuffer<T>()` view), not just index rebasing — the exact axis jkwak flagged.
- **2nd regression test added:** `tests/compute/byte-address-buffer-atomic-mixed-width-12265.slang` (CUDA COMPARE_COMPUTE, InterlockedMaxU64 via helper + 32-bit InterlockedAdd(16)). Discriminates on both offset+width axes: passes w/ fix, FAILS on master. Pushed `fix/issue-12265` @`27de6cf403` (3 files); 12/12 byte-address tests green; codex 3-stage approve; PR body updated. Fixer replied to jkwak on issue (comment 5125066175) with before/after PTX.
- **PR flipped NON-DRAFT by a maintainer (2026-07-30, NOT a breach):** verified via PR read — `draft:false`, assignee `jkwak-work`, requested reviewer `bmillsNV`, not merged. Requested human reviewer + maintainer self-assign corroborate a legitimate human flip; fixer confirms it did NOT flip (drafts-only discipline reliable). Per drafts-only guardrail: take no action, do NOT flip back to draft, do NOT alarm operator. Fixer kept pushing the fix (allowed) but will NOT touch ready/merge — merge gate is now the maintainer's. One stray cosmetic-red `workflow_dispatch` CI run exists (fired while draft-in-fixer-view); real `pull_request` CI is the signal.
- **jkwak review round (2026-07-30 19:41):** jkwak asked to remove the explanatory comment at the IRParam branch ("not very helpful"). Fixer removed it (pure comment deletion, logic unchanged, rationale stays in PR body), pushed **`3e5edd12e7`** (current HEAD), replied on thread. jkwak **resolved the fix-file review thread** (positive signal — approval likely close). CODE+OUTPUT critique approved. Fixer still owns the thread, not touching ready/merge.
- **✅ APPROVED (2026-07-30 21:14):** @jkwak-work approved ("Looks good to me"). Verified live: reviewDecision=APPROVED, approving-review commit_id == head `3e5edd12e7`. Fix confirmed correct on both axes (wrong index + wrong atomic width). PR OPEN, non-draft, `pr: non-breaking`, carries `Closes #12265` → issue auto-closes on merge. Fixer FROZE branch at `3e5edd12e7` (any further push auto-dismisses approval) and will NOT touch ready/merge per operator gate. Chain idle pending maintainer merge.
- **Close-out owner:** slang-triager will re-read the merged diff, refresh the issue verdict, and close out to Main when #12267 merges.
- Fixer spine = drafts-only + merge OP-gated. Non-draft (maintainer-flipped); human flips ready/merge.

Related: byte-address legalization pass `legalizeByteAddressBufferOps` / `ByteAddressBufferLegalizationContext`.
