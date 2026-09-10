---
name: project_12110_nonuniform_descriptorhandle_spirv
description: "#12110 NonUniformResourceIndex dropped on DescriptorHandle/heap SPIR-V — triage root-cause CORRECTED; draft fix authorized"
metadata: 
  node_type: memory
  type: project
  originSessionId: e6be0f17-1845-4a29-809f-865fb7f85b6b
---

shader-slang/slang **#12110** — `NonUniformResourceIndex` dropped on the `DescriptorHandle<T>` / `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` SPIR-V path. Bot-filed **deliberate follow-up split from [[project_12051_descriptor_reuse_pinning]]** (NOT a dup). Correctness bug, medium/P2. HEAD verified a8874f6a1.

**Root cause CORRECTED vs issue body (dump-verified, 87-pass IR dump):** the issue body's hypothesis (wrapper stripped during handle specialization/inlining in `slang-ir-specialize-function-call.cpp`) is REFUTED — `nonUniformResourceIndex` count = 2 in every dumped pass. Peephole (:1220) also innocent. Real cause: `lowerDynamicResourceHeap` (slang-ir-lower-dynamic-resource-heap.cpp:48) buries the wrapper in a `makeVector(NUR(i),0)` round-trip; the SPIR-V float pass `processNonUniformResourceIndex` (slang-ir-float-non-uniform-resource-index.cpp ~242-388) has NO case for `MakeVector`/`CastUInt2ToDescriptorHandle`, so it can't bubble the wrapper to the `getElement` index → `propagateNonUniformDecorations` decorates nothing. Plain resource arrays preserve the decoration end-to-end.

**Scope SMALLER than issue implies** ("separate, larger change"): 2 missing float-pass switch cases (Approach A, RECOMMENDED — mirror MakeCombinedTextureSampler care so only the non-uniform component is decorated) OR producer tweak in lowerDynamicResourceHeap (Approach B). Approach C (peephole/emit special-case) REJECTED = consumer-side masking. GPU-less-testable (spirv-asm + FileCheck). Must cover BOTH `ResourceDescriptorHeap[NUR(i)]` and `.Handle = { uint2(NUR(i),0) }` spellings, with/without `spvDescriptorHeapEXT`. Documented tolerated gap at `tests/language-feature/descriptor-handle/desc-heap-nonuniform.slang:8-12`. Precedent: #6010 CLOSED / PR #6028 (Jan 2025) fixed the plain-array path.

**SCOPE NARROWED by maxime-modulopi comment (#issuecomment-4978990830), empirically firmed by triager read-only at HEAD c5d4d76e6 — the two capability modes lower to DIFFERENT SPIR-V:**
- **WITHOUT `spvDescriptorHeapEXT` (default):** `OpCapability RuntimeDescriptorArray` + `__slang_resource_heap` → VK_EXT_descriptor_indexing runtime-array indexing. NonUniform=0 = THE BUG; decoration REQUIRED + absent. Approach A applies here. This is the path my root-cause dump covered.
- **WITH `spvDescriptorHeapEXT`:** `OpCapability DescriptorHeapEXT` + `UntypedPointersKHR` → heap-native emit. NonUniform=0 is CORRECT-AS-IS (per VK proposal, non-uniform by default; `NonUniform` not required, only `Uniform`/`UniformId` opt-in perf hint). Do NOT assert NonUniform present here.
- Corrected test matrix: fix+assert NonUniform ONLY on without-cap path; with-cap asserts absence-is-acceptable. Both spellings still covered. Open Q handed to fixer: does Approach A's float-pass change even REACH the with-cap path, or does it lower via `SPIRVLoadDescriptorFromHeap` bypassing the makeVector round-trip (making narrowing "free")?

**State (2026-07-15):** triage complete, verified verdict → GitHub (triager owns post, `#issuecomment-4976372131`). Draft fix in-flight THROUGH slang-triager — slang-fixer on branch `fix/issue-12110` (worktree wt-slang-12110), Approach A, fall back B. DRAFT-only; ready/merge operator-gated. GitHub reply to maxime DEFERRED until fixer confirms corrected scope (closest-to-the-state: fixer PR-open trail or triager verdict refresh). Chain OPEN, awaiting fixer [Fix Report]. triage memo: inbox/a2a-1784083905656-cmltm6/triage-12110.md.

## ⛔⭐⭐ 2026-08-04 — MY RESUME TRIGGER WAS BROKEN TWICE, in opposite directions

**v1 (never-fires):** `RESUME = maintainer approve/merge`. A **review-STATE predicate** on a chain
whose only activity is COMMENTS ⇒ **structurally could not fire.** Same defect class the
slang-pr-approver found in its own rhi#803 R4 trigger the same hour.

**v2 (always-fires) — the "fix" was worse:** `RESUME = actionable non-bot feedback in ANY of the
3 endpoints`. That is **ALREADY SATISFIED** by jhelferty-nv's and csyonghe's 07-30 comments ⇒ it
would wake a re-decision on every check, forever, with nothing new to decide.
⇒ ⭐⭐**I widened a never-fires predicate into an always-fires one and didn't notice, because
widening feels like the safe direction.** You cannot under-detect if you detect everything — but a
trigger's entire value is *selectivity*, and a predicate satisfied by the status quo carries **zero
information**. ⭐**Always-fires is the WORSE failure:** never-fires sits inert, always-fires burns a
re-decision every cycle and trains the reader to ignore the signal.

**✅ THE CHEAP CHECK (approver's, adopted):** *after any predicate fix, evaluate it against the
KNOWN CURRENT STATE — if it fires now, with nothing new, it is wrong.* One lookup, catches the class.
Same family as the probe rule: *would this report the same result either way?*

**✅ v3 — the missing discriminator was neither endpoint nor state but the ADDRESSEE.** Fires only
if ALL THREE hold, else it is not a resume trigger:
1. non-bot author (`author_association`), **and**
2. addressed to **us / the decision** — not to the PR author, **and**
3. it changes a **load-bearing input** (LOC total, ABI gate, CI verdict, a standing review state).
(Or: the PR merges.)

**Live state 08-04, so the trigger has a baseline to be tested against:** PR #12116 non-draft
@`5c0e69c0c059`; `pulls/12116/reviews` = **jhelferty-nv COMMENTED 07-30 20:00 + 20:13, csyonghe
COMMENTED 07-30 20:23** (zero APPROVE/CHANGES_REQUESTED); `issues/12110/comments` = 2 non-bot; and
**the thread's LAST word is our own `nv-slang-bot[bot]`** ⇒ **v3 NOT satisfied ⇒ correctly holding.**

⚠️**ENDPOINT TRAP I walked into while testing this:** I queried `issues/12116/comments` — the PR's
*conversation* stream — and got **0 non-bot**, which appeared to contradict this row's own claim that
two maintainers commented. The real feedback lives on **`issues/12110/comments`** (the issue) and
**`pulls/12116/reviews`** (review states). ⇒ ⭐⭐**A PR's number and its issue's number index
DIFFERENT comment streams; `issues/<pr#>/comments` is the PR conversation, NOT the issue's.** My
"0 non-bot" was a defective instrument, not a fact — and it briefly looked like evidence *for*
holding, i.e. a false confirmation of the answer I already had.

RESUME = maintainer approve/merge, or v3-qualifying inbound. See
[[feedback_correction_unapplied_until_every_restatement_fixed]] (the sweep that found this),
[[project_slang_rhi_803_cpu_ray_query]] (the sibling instance).
