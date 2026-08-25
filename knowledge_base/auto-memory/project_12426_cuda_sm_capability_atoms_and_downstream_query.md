---
name: project_12426_cuda_sm_capability_atoms_and_downstream_query
description: "slang#12426 (tdavidovicNV, @claude triage) — add missing _cuda_sm_x_y atoms + new getDownstreamCompilerCapabilities() NVRTC query. Main VERIFIED a latent SILENT-DOWNGRADE defect the issue does not mention: slang-code-gen.cpp:627-635 CASE table omits _cuda_sm_8_9 and _cuda_sm_3_5, so -capability cuda_sm_8_9 emits -arch=compute_80. Routed to slang-triager."
metadata: 
  node_type: memory
  type: project
  originSessionId: 13a626a4-b545-40eb-b549-ef69a7f59acd
---

# slang#12426 — CUDA capability atoms + downstream-compiler capability query

**Filed** 2026-08-07 by `tdavidovicNV`, body carries an explicit `@claude:` triage request.
**Routed** to `slang-triager` on canonical thread `gh-issue-shader-slang/slang-12426`.

Two separable asks, as the author himself notes:
1. Add missing `_cuda_sm_x_y` capability atoms (self-contained, reviewable alone).
2. New `IGlobalSession::getDownstreamCompilerCapabilities(passThrough, count*, caps*)`,
   NVRTC first, follow-up to #11552/#11556.

## ⭐ Main's verified finding the issue does NOT mention: a silent arch downgrade

Adding atoms is **not** purely additive. There is a second table that must be kept in
sync, and it is **already out of sync today** at `7dc8091a6d76`:

`source/slang/slang-code-gen.cpp:627-635` maps capability atoms → `SemanticVersion` for
the `requiredCapabilityVersions` list that becomes NVRTC's `-arch=compute_XX`
(`source/compiler-core/slang-nvrtc-compiler.cpp:1281-1333`). It has **9 rows**:
`1_0 2_0 3_0 4_0 5_0 6_0 7_0 8_0 9_0`.

`slang-capabilities.capdef:248-258` defines **11 atoms** — it also has `_cuda_sm_3_5`
and `_cuda_sm_8_9`. **Those two have no CASE row.**

Because `_cuda_sm_8_9 : _cuda_sm_8_0` (capdef:257), the atom set for a
`cuda_sm_8_9` request still contains `_cuda_sm_8_0`, which *is* in the table — so the
lookup silently resolves to **8.0** instead of failing. No diagnostic.

### MEASURED on my edge (Release slangc @ `7dc8091a6d76`, NVRTC 12.6.85)

| `-capability` | emitted PTX | expected |
|---|---|---|
| `cuda_sm_7_0` | `.target sm_70` | ✅ |
| `cuda_sm_8_0` | `.target sm_80` | ✅ |
| **`cuda_sm_8_9`** | **`.target sm_80`** | ❌ **should be `sm_89`** |
| `cuda_sm_9_0` | `.target sm_90` | ✅ |
| *(no cuda cap)* | `.target sm_50` | ✅ NVRTC-12.6 floor |

⛔ **`_cuda_sm_3_5` is a CODE-INSPECTION finding only — I cannot discriminate it at
runtime on NVRTC 12.6.** The 12.6 floor is `SemanticVersion(5,0)`
(`slang-nvrtc-compiler.cpp:1300`), which is *above* 3.5, so the CASE gap and the floor
both yield `sm_50`. `cuda_sm_3_5 → sm_50` is therefore **not** evidence of the bug;
only the `8_9` row is proven. Discriminating 3_5 needs a CUDA-11 NVRTC.

### Why the FP8 coop-matrix test still passes (do not let this mask the bug)

`tests/cooperative-matrix/fp8-cuda.slang` (line 1: `-capability cuda_sm_8_9`)
compiles to **`.target sm_89` — correct**. That is a *different, working* path:
`slang-emit-cuda.cpp:348` calls `m_extensionTracker->requireSMVersion(SemanticVersion(8,9))`
for an FP8 CoopMatrix element type, which feeds `cudaTracker->m_smVersion` →
`slang-code-gen.cpp:577-583`, bypassing the CASE table entirely.

⇒ **Two independent producers of the arch flag; only the emit-tracker one is correct.**
The existing test suite pins the working path and is blind to the broken one, which is
why this has survived. A regression test for the fix must assert the arch flag from a
**bare `-capability`** request with no FP8/CoopMatrix in the source.

**Provenance:** the `_cuda_sm_8_9` atom arrived in `507d3b241` (#11007, CUDA
bfloat16/int8/FP8 coop-matrix, 2026-05-04). `git show --stat 507d3b241 | grep code-gen`
→ **empty**: that PR added the atom and never touched the CASE table. The bug is as old
as the atom.

## ⭐ The issue's own "missing atoms" list is incomplete

Measured directly against the container's NVRTC (`ctypes` →
`nvrtcGetNumSupportedArchs`/`nvrtcGetSupportedArchs`, rc=0, n=14):

```
50 52 53 60 61 62 70 72 75 80 86 87 89 90
```

The issue proposes adding `7.2 7.5 8.6 8.7 8.8 10.0 10.3 11.0 12.0 12.1`. Even with
that list fully applied, Slang still cannot represent **5.2, 5.3, 6.1, 6.2** — all four
reported by the NVRTC sitting in this container. The issue's stated goal ("a complete
vocabulary for describing current CUDA targets") is not met by its own list.

Also: **`_cuda_sm_4_0` (capdef:252) is a phantom** — there is no CUDA compute
capability 4.0 in any CUDA release. It has a CASE row and an alias. Worth a question,
not a blocker.

## Constraints the API half must respect

- `SlangCapabilityID` values are **explicitly not ABI-stable** — `include/slang.h:4243-4247`
  says so in the `findCapability` doc comment, and the generator assigns values by
  *declaration order* in the capdef
  (`tools/slang-capability-generator/capability-generator-main.cpp:1113-1167`,
  `enumValueCounter` walking Normal → Abstract → Alias). **Inserting an atom mid-list
  renumbers everything after it.** So the proposed API returning raw `SlangCapabilityID`
  is self-consistent with existing policy only because that policy is already
  "look up by name at runtime".
- `CapabilityAtom` **is** serialized into modules (`slang-serialize-ast.cpp:420` includes
  it in the `serializeEnum` list; `slang-serialize.h:663` writes the **raw Int32**).
  Module compat is gated on a single `kSupportedSerializationVersion = 1`
  (`slang-serialize-ir.cpp:43`, checked at `:813`) — there is **no** per-enum
  compatibility mapping like the IR opcodes' stable-name table
  (`slang-ir-insts-stable-names.lua`). ⇒ renumbering atoms changes the meaning of bytes
  in already-serialized `.slang-module` files. This is a real question for the triager to
  put to a maintainer: **append-only atom placement, or accept module invalidation?**
- `nvrtcGetNumSupportedArchs`/`nvrtcGetSupportedArchs` are **not currently loaded** —
  `SLANG_NVRTC_FUNCS` (`slang-nvrtc-compiler.cpp:40+`) has no entry for either. They must
  be added as **optional** symbols per the issue's own note.

## State

Dispatched to `slang-triager` with the above. No GitHub comment posted by me (triager
owns the verdict — closest-to-the-state). **RESUME:** triager verdict, or any non-bot
comment on #12426.

## 2026-08-07 ~18:1xZ — triager memo received + VERIFIED, and the race resolved

`slang-triager` returned a 184-line memo (`triage-12426.md`). **I independently
re-derived every load-bearing claim on my own edge; all held.** Verified by me, not relayed:

- **`-capability` is INERT in `fp8-cuda.slang`** — recompiled that test with the flag *removed*:
  still `.target sm_89`, and `cmp` byte-identical to the with-flag run. ⇒ the emit tracker alone
  produces sm_89; **a test pinning the arch flag with FP8/CoopMatrix in source passes on unpatched
  master.** This is stronger than my own briefing's version of the point.
- **Coverage gap:** 93 test files pass `-capability cuda_sm_*`; files matching `target sm_` = **0**,
  `arch=compute` = **0** tree-wide (must-hit ctl `capability cuda_sm_8_9` ⇒ 4). Nothing pins the flag.
- **⭐ Existing CASE rows emit arch strings NVRTC REJECTS.** Reproduced with my own `ctypes` probe
  (`nvrtcCompileProgram`, log captured): `compute_10/20/30/35/40` ⇒ rc=5 *"invalid value for
  --gpu-architecture"*; `50/52/60/70/75/80/86/89/90` ⇒ rc=0. These never escape only because the
  NVRTC-12 floor `SemanticVersion(5,0)` (`slang-nvrtc-compiler.cpp:1300`) clamps them — confirmed:
  `cuda_sm_1_0…5_0` all → `sm_50`, `6_0` → `sm_60`. **The floor is load-bearing by accident.**
- **`_cuda_sm_4_0` is a phantom** — no CUDA compute capability 4.0 has ever existed; NVRTC rejects
  `compute_40`. It has an atom, a CASE row, and a public alias.
- **Serialization exposure is worse than I stated.** Atoms are not just an int field: they are
  **BIT POSITIONS in a uint64 bitmask** — `CapabilitySetVal` → `CapabilityTargetSetVal` →
  `CapabilityStageSetVal` → `UIntSetVal` (`slang-capability-val.h:32`, `slang-ast-val.h:1287-1307`),
  hanging off AST modifiers ⇒ reaching `.slang-module`. Renumbering changes the meaning of stored
  **bits**. The `isBinaryModuleUpToDate` build-tag digest (`slang-session.cpp:1825-1836`) would catch
  it but is **opt-in** (`UseUpToDateBinaryModule`, `slang-session.cpp:1282`).
- **⛔ NO OPTIONAL-SYMBOL PRECEDENT** — `SLANG_NVTRC_GET_FUNC` (`slang-nvrtc-compiler.cpp:182-188`)
  does `if (m_##name == nullptr) return SLANG_FAIL;` for **every** entry. Adding the two arch
  functions to `SLANG_NVRTC_FUNCS` would make **older NVRTC fail to load entirely** — opposite of the
  issue's requirement. Needs a separate optional list.
- **Vtable:** `getDownstreamCompilerVersion` is **slot 32** (`unit-test-vtable-stability.cpp:953-957`,
  asserted `:979-981`); a new method is slot 33.
- **max-wins verified IN CODE**, not only via DeepWiki: `slang-emit-cuda.h:31` and
  `slang-nvrtc-compiler.cpp:1313-1322`. ⇒ two intentional producers; the CASE gap is a bug in one,
  not a design question.
- Guilty control reproduced: `-capability cuda_sm_99_9` ⇒ `error[E00014] unknown profile`, rc=1.
- ⚠️ **Instrument (cost me a void matrix too):** PTX contains a NUL ⇒ plain `grep` prints nothing and
  says *"binary file matches"*. **Use `grep -a`.** My first control sweep returned an empty column for
  every row and I nearly read it as "all failed".
- ⛔ Memo correctly preserves my scope limit: the `_cuda_sm_3_5` leg is **inspection-only** here
  (floor 5.0 > 3.5 masks it). Needs a CUDA-11 NVRTC.

### ⭐⭐ THE RACE RESOLVED — the production bot already implemented the atom half

`claude[bot]` (Actions run 31202204260) finished at 17:45Z. Its issue comment is **content-free**
("I'll analyze this and get back to you") — **no triage verdict was posted**, so there is no duplicate
verdict and no dedup conflict. But it **pushed a branch**: `claude/issue-12426-20260807-1745`,
commit `edbc6de74`, 4 files +151/−6 (capdef, slang-code-gen.cpp, generated capability-atoms doc, a new
diagnostics test). No PR opened.

What that branch does, inspected by me:
- Adds all 10 atoms the issue listed **and CASE rows for them — including `_cuda_sm_8_9`**, so it
  **incidentally fixes the silent downgrade** without ever naming it as a bug.
- ⛔ **Still no CASE row for `_cuda_sm_3_5`** (`git diff … | grep -c 3_5` ⇒ **0**) — the other half of
  the sync defect survives.
- ⛔ **Inserts atoms MID-LIST** (`_cuda_sm_7_2` between `7_0` and `8_0`, etc.) — precisely the
  renumbering the memo flags as a maintainer call, decided silently.
- ⛔ **Its test pins capability IMPLICATION, not the arch flag** (`-restrictive-capability-check`
  diagnostics only) ⇒ it does **not** cover the silent-downgrade path it just fixed. The bug could
  regress with that test still green.
- ⛔ **NEW, flagged by neither the bot nor the memo — verified by me:** there is **no ceiling clamp**
  in `slang-nvrtc-compiler.cpp:1281-1333` (max-over-requirements against a *floor* only). So the new
  high atoms make Slang emit `compute_103` / `compute_110` / `compute_121` verbatim on **this** NVRTC
  12.6, which **rejects all three** (rc=5, my probe). Before the patch these were unreachable
  because the atoms did not exist. ⇒ **adding atoms without a ceiling converts "unrepresentable" into
  "representable and hard-fails downstream."** This is the strongest argument for the memo's
  A-before-B ordering.

### Triager's recommendation (its own, and I concur)
**Three PRs: A (CASE-table bug fix, with a bare-`-capability` test) → B (atoms) → C (API)** — not the
two-way split the issue proposes. Rationale: the genuinely small self-contained piece is a bug the
author did not know about, while the piece he assumed was small carries the enum-stability policy
question. 5 open questions deliberately left to a maintainer (append-only vs module invalidation;
add 5.2/5.3/6.1/6.2; deprecate phantom 4.0; should a CASE-less atom diagnose; implied vs maximal set).

**State:** memo verified. No GitHub comment from me (triager owns the verdict — closest-to-the-state).
**RESUME:** triager posts its verdict, or a maintainer/`tdavidovicNV` comments, or someone opens a PR
from `claude/issue-12426-20260807-1745`.


## 2026-08-20 ~11:2xZ — maintainer opened PR #12649 (part C), answers Q6. CHAIN RE-OPENED then re-routed.

`jvepsalainen-nv` (maintainer) commented on #12426 (cmt 5355168615) and **opened
[PR #12649](https://github.com/shader-slang/slang/pull/12649)** — OPEN, non-draft, head
`fix/issue-12426-nvrtc-supported-archs`, **one file: `slang-nvrtc-compiler.cpp`** = the query half (C)
only. **Not ours — a maintainer's own PR. I did NOT call `report_pr_created` and must not.**

**Verified against the live diff (`gh pr diff 12649`), consistent with my earlier measurements:**
- Adds `nvrtcGetNumSupportedArchs`/`nvrtcGetSupportedArchs` as a **second, optional** macro list
  (no `return SLANG_FAIL`) — exactly the ~10-line mechanism the triage said "does not exist yet."
  Confirms my constraint note: the existing `SLANG_NVRTC_FUNCS` is fail-closed.
- Uses the reported **floor** (`supportedArchs[0]`) to replace the hand-maintained version ladder, and
  a **ceiling clamp** (`supportedArchs.getLast()`) — this is the fix for **Q6**. So Q6 is answered by
  a maintainer, C-first.
- Maintainer states the clamp is **currently inert** (highest atom is `_cuda_sm_9_0`; both NVRTC
  11.8 and 12.6 report ceiling 90) — matches my finding that no atom above 9_0 exists and this NVRTC
  tops out at 90. Floor claim (11.8→35, 12.6→50) matches my 12.6 sweep (cuda_sm_1_0..5_0 → sm_50).

**Maintainer's counter to the triage's A→B→C framing** (reasonable, recorded): the three parts are
more *coupled* than a strict ordering implies — C is motivated by device-vs-compiler disagreement and
does **not** depend on A or B; the ceiling can't fire until B grows atoms past 9_0; A remains
separately worth doing because `-capability cuda_sm_8_9` still silently resolves to sm_80.

**State of the three parts now:**
- **A (CASE-table bug):** STILL UNDONE on master — 9 `CASE(CUDASM` rows, `_cuda_sm_8_9`/`_cuda_sm_3_5`
  gap persists. Nobody assigned. Maintainer acknowledges it's worth doing.
- **B (atoms):** the bot's `claude/issue-12426-...` branch **never became a PR** (`gh pr list` empty).
  Still maintainer-gated on Q1 (renumbering).
- **C (query):** PR #12649 OPEN, maintainer-driven.
- On testing #12649: author deliberately adds no test, reasoning that nothing in emitted output
  changes on any reachable config (clamp inert) — a test would pass identically pre/post; the
  arch-flag test belongs with A. **This matches my own inert-flag finding exactly.**

**Routed to `slang-triager`** on canonical thread (closest-to-state, holds the verdict + memo). It owns
whether any GitHub reply is warranted (likely none — maintainer is driving) and whether to offer the A
fix. **I did NOT dispatch a fixer** — maintainer is engaged and driving; A is unassigned but offering
it is the triager's call, not an unsolicited Main dispatch. **RESUME:** triager acts, or #12649 gets a
review request / CI event, or a maintainer asks for A/B.


## 2026-08-24 — issue author pivots the API design (meeting outcome). Live inbound, chain re-opened.

`tdavidovicNV` (author) commented (cmt 5399213522): *"After a meeting discussion, we agreed the
easiest solution is to actually provide `GetDownstreamCompiler` (symmetric to existing
`SetDownstreamCompiler`). Then the caller can get any information they want from that compiler. We
still probably want to expand the capabilities enum, for completeness, but it now becomes a separate
thing."*

**This supersedes the original half-2 design** (the narrow `getDownstreamCompilerCapabilities(count*,ids*)`
count/array query) with a **return-the-compiler-object** design, and **explicitly demotes the atom
expansion (B) to a separate, non-blocking task.**

**Grounding checks I ran before relaying (header @ current master):**
- ⚠️ **The claimed symmetry is loose.** There is **no bare `SetDownstreamCompiler`** in `include/slang.h`.
  The actual setters are `setDownstreamCompilerPath` (:4102), `setDownstreamCompilerPrelude` (:4114),
  and the symmetric pair `set/getDownstreamCompilerForTransition` (:4255/:4267). So "symmetric to
  SetDownstreamCompiler" is a paraphrase of intent, not an exact existing name.
- ⛔ **The bigger fact for whoever designs this: `IDownstreamCompiler` is INTERNAL** —
  `source/compiler-core/slang-downstream-compiler.h:328` (`: public ICastable`), **not in the public
  header.** "Return the compiler so the caller gets any info" means either exposing that whole COM
  interface publicly (a large, open-ended ABG surface — the opposite of the tightly-scoped count/array
  query) or wrapping it in a new narrow public interface. That is a **design expansion, not a
  simplification**, from an ABI-stability standpoint — worth flagging even though the maintainers
  decided it in a meeting I wasn't in. Not mine to relitigate; theirs to weigh.

**Effect on the three parts:**
- **C:** the *approach* changed. PR #12649 (OPEN, still the arch floor/ceiling clamp in
  `slang-nvrtc-compiler.cpp`) is **not** the new `GetDownstreamCompiler` API — it's the internal
  consumer of exactly the kind of query this API would expose. It likely stands on its own regardless
  (it fixes the missing-ceiling hard-fail), but someone should confirm the maintainer still wants it
  given the pivot.
- **B (atoms):** author explicitly says "separate thing now" — de-coupled, still gated on Q1.
- **A (CASE-table `sm_89→sm_80` bug):** untouched by any of this, still live on master, still the one
  piece ready today. The pivot does not affect it.

**Routed to `slang-triager`** (holds verdict+memo, closest-to-state) with the grounding facts. Human
comment on an issue is a live inbound even on a chain I'd closed — routed on the canonical thread.
Triager owns any GitHub reply + whether to re-offer A / re-scope its verdict. **RESUME:** triager acts,
or #12649 state change, or further human comment.


## 2026-08-24 (later) — author CLARIFIES: he means `getDownstreamCompilerPath`, a string getter. My ABI caution is DEFUSED.

`tdavidovicNV`, cmt 5399364838: *"`IGlobalSession::getDownstreamCompilerPath` was the meant, to
complement `setDownstreamCompilerPath`, the way `getDownstreamCompilerPrelude` complements
`setDownstreamCompilerPrelude`."*

⇒ **The prior "GetDownstreamCompiler → get any info from the compiler" was NOT a proposal to expose a
compiler OBJECT.** He means a **path string getter** — trivial, exact precedent, one appended method.

**Grounded @ master `ba1f1aecb`:**
- `getDownstreamCompilerPath` does **not** exist yet (`grep include/slang.h` empty) — it's the ask.
- `setDownstreamCompilerPath` exists (:4102). The precedent pair `set/getDownstreamCompilerPrelude`
  exists (:4114 setter / getter after) — getter returns `ISlangBlob**`, `SLANG_NO_THROW void`,
  appended to IGlobalSession. A path getter mirrors that shape exactly.

⚠️ **This DEFUSES the ABI-expansion caution I raised and the triager POSTED to GitHub (cmt 5399251696):**
"return the compiler means exposing internal `IDownstreamCompiler` publicly." That concern was correct
*for the object-getter reading* but the author has now clarified he never meant that. **A path getter
is a `const char*`/blob, no COM interface, no `IDownstreamCompiler` exposure — the simplification he
originally claimed is real under this reading.** The triager has a live GitHub comment arguing a
concern the clarification removes; it (closest-to-state, it posted it) should acknowledge/correct on
the record. Routed to it.

🔎 **One genuine design subtlety worth a gentle flag (not a blocker, theirs to weigh):**
`setDownstreamCompilerPath` sets a *search prefix*; the actually-loaded compiler is found via normal
discovery order + memoized (per the issue's own note on `getDownstreamCompilerVersion`). A getter that
returns only the *set* path is near-useless when the caller relied on discovery (returns empty). To
serve the issue's use case it should return the **resolved/loaded** path — which the caller can then
`dlopen` and query (`nvrtcGetSupportedArchs`) themselves. That pushes NVRTC-specific logic to the
caller (vs. the original in-Slang capabilities query), a real tradeoff but the maintainers' call.

**Effect:** half-2 is now a small string-getter, not a capabilities API. PR #12649 (arch clamp) still
stands alone. **A (CASE-table bug) and B (atoms) unchanged** — A still live, still ready today.

Routed clarification + the defuses-your-posted-caution note to `slang-triager`. **RESUME:** triager
acts / posts, or #12649 changes, or further human comment.
