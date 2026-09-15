---
name: project_12260_enum_bool_switch_e39999
description: "#12260 switch on 'enum : bool' fails E39999 could-not-extract-value; front-end case-value extraction gap, target-independent. MERGED (PR #12275, 4-layer fix)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 32aee429-ff2d-4bb4-800a-6c9dd80c6122
---

**#12260** — `switch` on `enum E : bool` fails with `error[E39999]: could not extract value from integer constant` at each `case` label. Target-independent (spirv/hlsl/cpp), so a **front-end/lowering** bug, not a codegen gap. `enum : bool` is a supported feature (tests `enum-bool-lowering.slang`, `11043`) and should compile. Bot-filed 07-29 at @skiminki-nv's request off the #12254 thread; distinct root cause from #12254 (which fixed *plain* `bool` switch selectors for Khronos targets — an E99997 SPIR-V-legalize path).

**Root cause:** `TypeCastIntVal::tryFoldImpl` (`slang-ast-val.cpp`) — its `convertValue` lambda switch had **no `BaseType::Bool` case** → `default: return false` → an unfolded `TypeCastIntVal` survives → `as<ConstantIntVal>` fails at `slang-check-modifier.cpp:43`, emitting E39999.

**Fix — 4 layers, PR #12275, `Closes #12260`, `pr: non-breaking`:**
- **L1** — add `case BaseType::Bool:` computing `resultValue = (resultValue != 0)` to `convertValue` (the E39999 root). Arm is `!= 0`, **not `& 1`**: `convertValue` is the shared cast-to-bool fold path, so `& 1` would regress direct casts like `(bool)2`→`true`. `& 1` was never load-bearing (bool enum-tag wraparound is enforced upstream in `_incrementEnumerator`).
- **L2** — widen `legalizeBoolSwitch`'s over-narrow `IRBoolLit` assert to accept bool-typed `IRIntLit` case labels (`slang-ir-glsl-legalize.cpp`).
- **L3** — L1 is target-agnostic, so `enum:bool` switches now reach WGSL emit, which (like Khronos) needs an int selector but had no legalization → **crash** E99997. Generalized the Khronos-only pass to WGSL and renamed it repo-wide `legalizeBoolSwitchForKhronos` → **`legalizeBoolSwitchForTargetsRequiringIntSwitch`** (`slang-emit.cpp/.h`).
- **L4** — WGSL emitter renders bool→int cast (scalar+vector) as `select(0,1,cond)`, the codebase idiom, not the invalid `i32(bool)` value-constructor (`slang-emit-wgsl.cpp`).

**Merged 07-30 by skiminki-nv** (merge commit `111f1ff7…`), approved at the exact merged head `37ab185dbf` (clean approval-to-merge). Shipped SHIP-AS-IS with 2 discretionary nits held (maintainer approved with them present).

**Known caveats / follow-ups:**
- **Canonical-rep smell (filed as #12298):** C-family emitter `emitSimpleValueImpl` kIROp_IntLit handler has no `BaseType::Bool` arm → HLSL/Metal/CUDA emit `case int8_t(1):` not `case true:` — functionally correct, cosmetic. Producer-side canonicalization (`getIntValue`/`lowerEnumType`) is module-wide blast radius; consumer-side arm shipped, matching #12254's original design. Coverage gaps (non-CPU case-label spelling, plain-bool WGSL) held with it.
- L4 `select` form was **not** naga-validated locally (no naga in-tree; WGSL tests are FileCheck text-match). CI green through merge ⇒ effectively confirmed; any residual surfaces via #12298's orbit.

The L3 repo-wide rename landing on master is what triggered the concurrent [[project_11709_groupshared_byref]] merge conflict (both inserted a pass into the same WGSL target-switch spot). See also [[project_12237_bool_switch_spirv_assert]] (the #12254 plain-bool path) and the switch-diag cluster (#12236/#12238/#12239/#12240).

**State: CHAIN TERMINAL** (merged + follow-up #12298 filed). Re-engage only on a fresh human comment on #12260 / #12275 / #12298.
