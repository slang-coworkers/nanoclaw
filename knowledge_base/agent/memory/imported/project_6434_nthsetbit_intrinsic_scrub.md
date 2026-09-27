---
name: project_6434_nthsetbit_intrinsic_scrub
description: "slang#6434 nthsetbit CUDA intrinsic — scrub ANSWERED 08-05 (cmt 5196133459), decision routed to jkiviluoto-nv. Not implemented; the cited gist never used nthsetbit (ergonomics ask, not a blocker). Approach A (__target_switch + software default) design-settled, NOT staged. RESUME=jkiviluoto-nv decides or natevm confirms interest."
metadata:
  node_type: memory
  type: project
---

# slang#6434 — `nthsetbit` intrinsic (held, awaiting human decision)

Moved out of [[slang-parked-index]] (was an inline row with no child file).

**State:** scrub answered 08-05, verdict comment `5196133459`, decision routed to `jkiviluoto-nv` (who asked still-relevant / reassign / close after the original assignee `mkeshavaNV` left). **Nothing mutated by us.**

**Facts measured on my edge @`b0e43d657`:**
- Not implemented: 4 spellings → 0 hits; controls `countbits`=24, `firstbitlow`=7, `WavePrefixCountBits`=4.
- Parent #7063 CLOSED-completed (`szihs`, 2025-11-12), deliberately superseded by the `optix`/`cuda` labels — and #7063 never listed 6434 (121-B body, 0 task markers). The real gap is that #6434 carries **no labels**, so it is invisible under the successor scheme.
- Milestone "Q4 2025 (Fall)" is closed yet holds 134 open issues ⇒ clear it rather than re-target. ⛔ **Do not re-litigate the milestone as a #6434 defect** — it is a systemic backlog shared with 133 other issues. The stale-assignee half is #6434-specific.
- ⭐⭐⭐ **The verdict-moving finding:** the cited gist never used `nthsetbit` — all 10 revisions (2024-08-11→15) carry a hand-rolled 32-iteration software `__fns`, predating the issue by ~6 months; the body's quote matches the real code except that one line ⇒ written as a wish, not pasted. The ask is ergonomics/perf, **not a blocker**. Recorded as the 2nd case in [[technique_verify_a_cited_path_exists_at_master_before_triaging]].
- Bindable in user code today with zero compiler change: `__target_intrinsic(cuda,"__fns($0,$1,$2)")` → slangc exit 0, nvcc 12.6 exit 0 (bogus-name control → nvcc exit 2). But the same decl compiles exit 0 with **no diagnostic** on hlsl/glsl/spirv/metal/wgsl, emitting a declaration with no definition ⇒ that silent hazard is the argument for a first-class builtin.

**Recommendations posted:** unassign · clear milestone · add `cuda` · answer the OP's spec-proposal question.

**If greenlit — Approach A is design-settled, NOT staged** (⛔ "fixer-ready" was my overstatement: no patch, no build): `__target_switch` with `case cuda: __intrinsic_asm "__fns($0,$1,$2)"` + software `default:` (pattern `glsl.meta.slang:494-504`, default arm `slang-ir-specialize-target-switch.cpp:44`). The fixer still owns (a) the `[require(...)]` capability list — `mod`'s list reuses **pre-existing** atoms (`cpp_cuda_glsl_hlsl_spirv_llvm` capdef:334, `sm_4_0_version` :1707), so precedent shows reuse, not that a new atom is needed (DeepWiki's "likely needs one" is unverified); (b) `extras/formatting.sh`, which could not run on the triager's edge ⇒ formatting unverified.

**RESUME:** `jkiviluoto-nv` decides, or `natevm` confirms he still wants it.
