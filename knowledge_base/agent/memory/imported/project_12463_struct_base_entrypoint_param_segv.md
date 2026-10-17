---
type: project
name: project_12463_struct_base_entrypoint_param_segv
description: "slang#12463 — `struct Derived : Base` as an entry-point param SIGSEGVs (spirv/glsl/metal/wgsl) on the DEFAULT -std. Maintainer-owned: skiminki-nv (09-10) will DIAGNOSE struct:struct on legacy versions too (2026+ already errors via #7419); docs PR #13003 merged 09-11. No fix PR yet as of 10-17. Never dispatch a fixer; on his PR, route slang-reviewer."
metadata:
  node_type: memory
  type: project
  originSessionId: 8f2095bd-c297-4f41-a002-7ec21cfebfcc
---

# slang#12463 — `struct Derived : Base` as an entry-point parameter segfaults slangc

Opened 2026-08-10 by **zest-zero** (external). Triaged 08-11 by `slang-triager` on my dispatch: comment
**5248002132**. Labels `bug`, `reproduced`, `SPIR-V`, `Metal`, `WebGPU`. Assigned **skiminki-nv + zangold-nv**,
milestone Q3 2026.

```slang
struct Base { float a; };
struct Derived : Base { float b; };
[shader("fragment")] float4 fragmentMain(Derived i) : SV_Target { return float4(i.b); }
```

## State (verified 2026-10-17)

**OPEN. Held on the maintainer, who is implementing the fix himself.** The last comment is skiminki-nv's
**5621284811** (09-10). The cross-references are his two docs PRs, both merged: **#13003** "Add note on
struct-struct inheritance in user guide / language versions" (09-11) and #13014 (09-15). The docs gap he
flagged is closed. **No fix PR exists yet.**

- **Plan:** diagnose unsupported uses of derived structs on legacy `-std` versions too, because *"they crash the
  compiler today anyway, so we know that no one is using them."* The 2026+ half already errors (PR **#7419**,
  merged 2025-06-12).
- **Posture:** stand by to review. Do **not** dispatch `slang-fixer`, because that would duplicate claimed
  maintainer work. When his PR appears, route `slang-reviewer`. Check the PR against his compat argument
  ("crashing ⇒ unused ⇒ safe to reject"), against both crash sites, and against the missing test below.
- **Timer:** the per-issue gate `i12463-disposition-gate-4a1c` is no longer in Main's `ncl tasks list` (10-17).
  The chain is tracked in `supervisor-state.json` as `awaiting_human` / `advisory:maintainer-driving`.
  The planned ~30-day nudge point (from 09-10) has passed with no PR. The default `-std` path still
  segfaults on code that gets only warning E30816.

## Root cause — a field-count mismatch

- **IR has 2 fields.** `slang-lower-to-ir.cpp:12561-12580` prepends a member for the direct base.
- **The varying layout has 1.** `slang-parameter-binding.cpp:2791` walks only instance fields and has no
  `InheritanceDecl` loop. The uniform path does walk the base (`slang-type-layout.cpp:5816-5825`).
- Consumers index field layouts by IR ordinal, so index 1 reads past a one-entry list. There are **two crash
  sites**: `slang-ir-glsl-legalize.cpp:2199-2207` (the `SLANG_ASSERT` at `:2166` is `SLANG_ASSUME` in Release)
  and `hoistEntryPointParameterFromStruct` (`slang-ir-legalize-varying-params.cpp:2962`, Metal/WGSL).
- Exit codes: spirv/glsl/metal/wgsl give 139, cuda gives 255 (clean E99999), hlsl gives 0. `-std 2026` gives
  `E30811` with no crash. `-std 2025`, `-std 2018`, and the **default** all give 139.

**Dedup:** #4451 is the same defect. It was closed 2025-07-31 as "we removed struct inheritance". That
removal applies only from 2026, so the default path still crashes. Generalized in
[[feedback_a_closure_citing_feature_removal_is_version_scoped]].

## Test-coverage gap (for the review)

No in-tree test uses a struct with a concrete base as an entry-point param. A fix must test `-target spirv`
**and** `-target metal`, because they crash at different sites. The triager's naive base-walk ("Approach A")
took all four targets from 139 to 0 but left `i_base_a_0` and `i_b_0` both at `location = 0`. If a
layout fix comes back, the test must assert locations, not just a clean exit.

## How the plan got here

The positions changed three times. Each change came from skiminki-nv, and **I misread the first change once**.

1. 08-12: jhelferty-nv restated our disposition B (make it an error). skiminki-nv agreed: *"`A : B` means A
   conforms to B"*, so `struct : struct` should be diagnosed.
2. 09-10: he revised this to a hybrid: remove the feature from 202c and add a **band-aid** for legacy. I had
   claimed Approach A "becomes unreachable", which was wrong for legacy, and I retracted it.
3. 09-10b: after the triager posted the `location = 0` residual (5621084161), he chose to **diagnose legacy
   too**. So our measurement steered him off the complicated layout fix.

The lesson: re-read the maintainer's latest comment before you roll up a disposition. Each restatement
replaced the one before it.
