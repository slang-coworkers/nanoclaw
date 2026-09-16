---
name: project_12426_cuda_sm_capability_atoms_and_downstream_query
description: "slang#12426 (tdavidovicNV, @claude triage). Main VERIFIED a latent SILENT-DOWNGRADE codegen bug the issue never mentions: slang-code-gen.cpp CASE table omits _cuda_sm_8_9/_cuda_sm_3_5, so -capability cuda_sm_8_9 emits sm_80 not sm_89, no diagnostic. TERMINAL 2026-09-01: #12426 closed by maintainer; bug landed titled in child #12839."
metadata:
  node_type: memory
  type: project
  originSessionId: 13a626a4-b545-40eb-b549-ef69a7f59acd
---

# slang#12426 — CUDA capability atoms + downstream-compiler query (✅ TERMINAL)

Filed 2026-08-07 by `tdavidovicNV` with an explicit `@claude:` triage request; routed to `slang-triager` on `gh-issue-shader-slang/slang-12426`. **The through-line: a routine triage surfaced a live silent-wrong-codegen bug that the author didn't know about and that survived every scope change to land titled in a tracked issue.**

## ⭐⭐⭐ The verified silent arch downgrade (the durable finding)
Adding atoms is NOT purely additive — a second table must stay in sync and is **already out of sync on master**:

- `source/slang/slang-code-gen.cpp:627-635` maps capability atoms → `SemanticVersion` for NVRTC's `-arch=compute_XX` (`slang-nvrtc-compiler.cpp:1281-1333`). It has **9 rows** (`1_0…9_0`).
- `slang-capabilities.capdef:248-258` defines **11 atoms** — including `_cuda_sm_3_5` and `_cuda_sm_8_9`, which have **no CASE row**.
- Because `_cuda_sm_8_9 : _cuda_sm_8_0` (capdef:257), a `cuda_sm_8_9` request still contains `_cuda_sm_8_0`, which IS in the table → the lookup silently resolves to **8.0**, no diagnostic.

**MEASURED (Release slangc @ `7dc8091a6d76`, NVRTC 12.6.85):** `-capability cuda_sm_8_9` → `.target sm_80` (should be `sm_89`); `7_0`/`8_0`/`9_0` correct. **`_cuda_sm_3_5` is inspection-only here** — the NVRTC-12.6 floor `SemanticVersion(5,0)` (`slang-nvrtc-compiler.cpp:1300`) is above 3.5, so both the gap and the floor yield `sm_50`; discriminating it needs a CUDA-11 NVRTC. **Provenance:** the atom arrived in `507d3b241` (#11007, 2026-05-04) which never touched the CASE table — the bug is as old as the atom.

**Why the existing suite is blind to it (a regression test must avoid this trap):** there are **two independent producers of the arch flag**. `tests/cooperative-matrix/fp8-cuda.slang` compiles to correct `.target sm_89` via a *different* path — `slang-emit-cuda.cpp:348` calls `m_extensionTracker->requireSMVersion(8,9)` → `cudaTracker->m_smVersion` → `slang-code-gen.cpp:577-583`, bypassing the CASE table. `-capability` is INERT in that test (verified: removing the flag gives byte-identical PTX). ⇒ **a fix's regression test must assert the arch flag from a bare `-capability` request with no FP8/CoopMatrix in source** — 93 test files pass `-capability cuda_sm_*`; files that pin `target sm_`/`arch=compute` tree-wide = **0**.

**Adjacent verified facts:** existing CASE rows emit arch strings NVRTC REJECTS (`compute_10/20/30/35/40` → rc=5), never escaping only because the floor clamps them — **the floor is load-bearing by accident**. `_cuda_sm_4_0` (capdef:252) is a **phantom** (no such CUDA compute capability; NVRTC rejects `compute_40`) yet has an atom, CASE row, and public alias. The issue's own "missing atoms" list is incomplete — even fully applied, Slang still can't represent 5.2/5.3/6.1/6.2, all reported by this container's NVRTC (`50 52 53 60 61 62 70 72 75 80 86 87 89 90`). ⚠️ **Adding atoms without a ceiling clamp converts "unrepresentable" into "representable and hard-fails downstream"** (`slang-nvrtc-compiler.cpp:1281-1333` clamps to a floor only, no ceiling) — the strongest argument for fixing the CASE bug alongside any atom expansion.

## Constraints the API/atom work must respect
- **`SlangCapabilityID` is explicitly NOT ABI-stable** (`include/slang.h:4243-4247`); the generator assigns values by *declaration order* (`capability-generator-main.cpp:1113-1167`), so inserting an atom mid-list renumbers everything after it. Any API returning raw `SlangCapabilityID` is only self-consistent because the policy is already "look up by name at runtime".
- **`CapabilityAtom` is serialized into `.slang-module` files as BIT POSITIONS in a uint64 bitmask** (`CapabilitySetVal`→…→`UIntSetVal`, `slang-capability-val.h:32`, `slang-ast-val.h:1287-1307`), gated on a single `kSupportedSerializationVersion = 1` with **no** per-enum stable-name mapping (unlike IR opcodes' `slang-ir-insts-stable-names.lua`). ⇒ **renumbering atoms changes the meaning of stored bits** → real maintainer question: append-only placement, or accept module invalidation? (`isBinaryModuleUpToDate` digest would catch it but is opt-in.)
- **No optional-symbol precedent for NVRTC funcs:** `SLANG_NVTRC_GET_FUNC` does `if (m_##name == nullptr) return SLANG_FAIL` for every entry (`slang-nvrtc-compiler.cpp:182-188`), so adding `nvrtcGetNumSupportedArchs`/`nvrtcGetSupportedArchs` to `SLANG_NVRTC_FUNCS` would make older NVRTC fail to load entirely — they need a separate **optional** list. New vtable method = slot 33 (`getDownstreamCompilerVersion` is slot 32).

## Terminal state (2026-09-01)
`kaizhangNV` commented "close this issue as discussed offline" and **closed #12426 himself** (verified `closed_by: kaizhangNV`, `state_reason: completed`, `closed_at 2026-09-01T17:46:54Z`) — a **human close, not a bot action** (actor checked before treating terminal; never-auto-close guardrail untouched). Deliverables split into children:
- **#12838** OPEN — `getDownstreamCompilerPath` string getter (maintainer ABI task).
- **#12839** OPEN — atoms **+ the `sm_89→sm_80` CASE-table bug in its title/scope**. Fixer gated on maintainer answering Q1 (renumber vs append). When done: CASE rows + atoms + a **bare-`-capability` `.target` regression test**.
- **#12649** OPEN — arch floor/ceiling clamp (`jvepsalainen-nv`, `slang-nvrtc-compiler.cpp`), independent of #12426's closure; clamp currently inert (highest atom `_cuda_sm_9_0`, both NVRTC 11.8/12.6 report ceiling 90).

No action owed (human close, children tracked). **RESUME (children only):** maintainer answers Q1 on #12839 → route fixer; #12838 maintainer-implemented; #12649 disposition is a maintainer call.

## Design-pivot ARC (audit trail; capabilities-reporting API is DEAD)
Original half-2 (`getDownstreamCompilerCapabilities` count/array query) → author "give `GetDownstreamCompiler` (return the object)" → I flagged `IDownstreamCompiler` is INTERNAL (`slang-downstream-compiler.h:328`), so returning it is an ABI *expansion* not a simplification → author clarifies he means **`getDownstreamCompilerPath`, a string getter** mirroring the prelude pair (defuses the ABI caution the triager had posted to GitHub, cmt 5399251696) → author ESCALATES (cmt 5466983417, cc maintainers): "by far the most important CUDA speedup; all we need is `getDownstreamCompilerPath`, the rest can go; @nv-slang-bot split into two." The host will `dlopen` + `nvrtcGetSupportedArchs` itself once it has the path. ⚠️ A subtlety for whoever builds it: `setDownstreamCompilerPath` sets a *search prefix*; a getter of only the *set* path is near-useless under discovery — it should return the **resolved/loaded** path.

## Process notes carried
- **A human comment is a live inbound even on a chain I'd closed** — each author comment (design pivot, clarification, escalation) re-opened and re-routed on the canonical thread; the triager (closest-to-state, posted every prior comment) owns GitHub writes, I did not post.
- **Instrument trap:** PTX contains a NUL, so plain `grep` says "binary file matches" and prints nothing — use `grep -a`. A cross-repo positive control (`nodejs/node`) silently became a `401` auth probe (per-path credential injection); print the control's raw body.
