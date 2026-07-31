---
name: project_12279_precise_local_cuda_cpp_invalid_token
description: "slang#12279 — precise local emits invalid token into CUDA/C++/Metal/WGSL — ✅MERGED PR #12290 07-30 dc9558d57c (per-target emitTempModifiers + E56005); TERMINAL; Approach-D CUDA no-contraction follow-up offered not filed"
metadata: 
  node_type: memory
  type: project
  originSessionId: e6592711-4714-4057-8165-7fa0de97b7cb
---

# slang#12279 — `precise` local qualifier emitted as invalid C-like source token

**✅ TERMINAL — MERGED 2026-07-30 22:11:30Z by jkwak-work (Main-VERIFIED via GitHub API).** PR #12290 merge_commit `dc9558d57c7c245afed536096f881089118db568`, merged head = approved head `86e273dd1f`; issue #12279 auto-closed `completed` 22:11:31Z via `Fixes #12279`. Shipped Approach-C: `precise` dropped with non-breaking warning **E56005** via per-target `emitTempModifiers` overrides (CUDA/C++/Metal/WGSL drop+warn; HLSL/GLSL keep keyword). Landed after 2 maintainer review rounds + jkwak approval. Fixer cleaned worktree `wt-slang-12279` + sentinel. **Approach-D** (CUDA/PTX no-contraction preservation, the #12198-analogue value-flow propagation) remains an OPEN follow-up OFFER — fixer files only if jkwak asks (jkwak chose land-as-is + defer D). Chain closed; no reopen without fresh human comment.

Filed by **jkwak-work** (member, self-filed + self-assigned) 2026-07-30. `precise float r = ...` on a local var makes the C-like emitter write the HLSL keyword `precise` verbatim into generated CUDA/C++ source. `-target cuda` succeeds but emits `precise float r_0 = ...`; `-target ptx` then fails at NVRTC parse (`identifier "precise" is undefined`).

**Root cause:** `CLikeSourceEmitter::emitTempModifiers` (`source/slang/slang-emit-c-like.cpp:4683-4689`) unconditionally emits `"precise "` for any inst with `IRPreciseDecoration`. Shared base for CUDA→CPP→CLike, so token leaks to every C-like target. Producer (`addVarDecorations`, lower-to-ir) is correctly target-agnostic; gating belongs at emit.

**Scope (broader than title):** invalid `precise` leaks to **4** targets — CUDA, C++/CPU, Metal, WGSL (all reject). HLSL + GLSL are the only C-like targets that accept it. ⇒ fix must gate by **source-language support**, not "HLSL-only" (drops valid GLSL) or "CUDA/C++-only" (leaves Metal/WGSL broken).

**Solution space:** (A, min-correct) gate keyword by source-lang; (C, recommended) A + target-specific *warning* so semantic drop isn't silent (matches reporter's "reject with diagnostic", non-breaking); (D, follow-up) actually preserve no-contraction on CUDA = separate feature paralleling SPIR-V #11933.

**Triage:** ✅ reproduced @HEAD `6462d7d2f` (compile-only). Verified 5-bullet posted — comment 5125089121; labels `reproduced`, Type=`Bug`. bug / medium / **P2** / target-emit.

**Status: FIX AUTHORIZED → dispatched to slang-fixer 2026-07-30.** jkwak-work commented `@nv-slang-bot , make a PR` (comment 5126141873) — the parked RESUME trigger. Was PARKED at triaged (jkwak self-filed no-autofixer). Fixer directed to DRAFT-only PR; recommended **Approach C** (gate `precise` keyword by source-lang support + target-specific warning for the dropped targets); **Approach D** (preserve no-contraction on CUDA/PTX) explicitly out-of-scope follow-up. `github-post-authorized` (real @nv-slang-bot mention). Merge OP/maintainer-gated.

**✅ PR #12290 OPEN (draft) + ALL 4 REVIEW COMMENTS RESOLVED — 07-30 15:45→17:20Z (fixer); head `6f7746da83`→`86e273dd1f`.** branch `fix/issue-12279`, `pr: non-breaking`, draft. jkwak-work's 4 inline review comments all addressed + replied per-thread:
- (1) Restructured the Approach-C diagnostic into **per-target `emitTempModifiers` virtual overrides** (C++/Metal/WGSL new overrides; CUDA inherits via its C++ delegation; HLSL/GLSL keep the `precise` keyword). Per jkwak's latest 2 comments: removed the doc paragraph + inlined the shared helper into the CPP/Metal/WGSL overrides → **`CLikeSourceEmitter` now BYTE-IDENTICAL to master (base keyword-emit only)**. Behavior unchanged: CUDA/CPP/Metal/WGSL drop+warn **E56005**, HLSL/GLSL keep keyword; each of 4 targets guarded by a DIAG subtest. Regression green (cross-compile 89/89, diagnostics 706/706, metal 197/197, wgsl 55/55, cpp 9/9). CI = benign draft priority-yield (27 jobs skipped).
- (2) **jkwak asked to implement no-contraction on CUDA/PTX IN THIS PR (Approach D).** Fixer investigated + posted a SCOPING QUESTION — CUDA has no per-op no-contraction primitive; options: **(a)** diagnostic-only now + D as focused follow-up [fixer's rec]; **(b)** global `--fmad=false` on the integrated NVRTC/ptx path; **(c)** full per-value intrinsic substitution (~few hundred lines, analogue of #12198's value-flow propagation).
- **BLOCKED on maintainer design decision (a/b/c) — jkwak's call on GitHub.** (Code side fully settled @ 86e273dd1f; only the Approach-D scope Q remains.) No action for Main. If (b)/(c), fixer implements here; else lands as-is (Approach A/C). Peer-review relay DEFERRED until code settles — fixer will re-request (through Main, its reviewer-return path) AFTER scope decision. PR stays draft, merge OP/maintainer-gated. This is the exact A/C-now-vs-D-scope tension the triage memo flagged (D = out-of-scope follow-up) — now surfaced to the maintainer by the fixer, correctly.

**Related, NOT dup:** [[project_12192_e55215_constantbuffer_no_source_location]] cluster is unrelated; the precise sibling is **#12198** (precise-qual → SPIR-V ignores it, fails to emit `NoContraction`, P2) — linked as distinct (SPIR-V semantic loss vs. this C-like invalid-token emission). NB Approach (c) above is explicitly the CUDA analogue of #12198's value-flow propagation.
