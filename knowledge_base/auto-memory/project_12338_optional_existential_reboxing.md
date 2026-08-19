---
name: project-12338-optional-existential-reboxing
description: "#12338 Optional<IFoo> re-boxes an existential — ✅SHIPPED & CLOSED 08-15: saipraveenb25 merged PR #12459 (tryGetSinglePayloadType, source-confirmed on master), fix matches my root cause. Tag stays uint NOT bool (his call). TERMINAL — no action of mine; reporter LDAP owns any re-open."
metadata: 
  node_type: memory
  type: project
  originSessionId: a7e074f5-5790-4914-8a74-675c70060616
---

**#12338** (LDAP, opened 2026-08-04) — `Optional<IFoo>` lowers to a `uint` tag + untyped
`AnyValue` blob with `OpBitcast` round-trips, where a bare `IFoo` field specializes to the
concrete type. Performance-only; reporter measured 80 vs 72 registers/thread, +3.7% render time.

✅✅**Status: SHIPPED & CLOSED 2026-08-15T02:30Z.** saipraveenb25 merged **PR #12459
"Lower singleton optional payloads directly"** and closed the issue (`5316806291`). His fix lowers a
single-concrete-type optional existential to **`{FooImpl, uint}`** (was `{AnyValue, uint}`), dropping
the pointless bitcasts — **exactly my root cause.** ⭐**MECHANISM CONFIRMED AT SOURCE LEVEL, not
relayed:** the PR's `tryGetSinglePayloadType` is live on master (`slang-ir-lower-dynamic-dispatch-insts.cpp`,
sha `1f62f698`), maps `{FooImpl, none}`/`{FooImpl}` → `FooImpl`, rejects `{FooImpl, BarImpl, none}`/`{none}`
— IS the "singleton modulo none" notion I described. He tested 8/8 across DX12/Vulkan/CUDA/CPU/WebGPU
(Metal unavailable) + a resource-handle test the old AnyValue path REJECTED on DX12.

⚠️**ONE REFINEMENT — the tag is `uint`, NOT the `bool` I called the target shape.** I'd said the
goal was `{ConcreteT, bool}` (matching `Optional<MyFoo>`'s variant-2 output). His deliberate choice:
`uint`, because `bool<->uint` conversions add logic and most GPU backends 4-byte-align `bool` anyway.
**Do not carry "target = {ConcreteT, bool}" forward — the shipped, correct answer is `{ConcreteT, uint}`.**

**TERMINAL. No action of mine — the OWNER closed it, is closest-to-the-state, and his re-open
invitation is addressed to the reporter (LDAP), not me.** My standing verify-offer was conditional
("if useful") and his 8/8 cross-backend suite strictly supersedes my reduced repro ⇒ NOT re-run
(would be redundant work + a noise comment on a cleanly-closed issue). ⛔**Do NOT post an
acknowledgement bot-comment; do NOT re-open unless LDAP raises a substantive gap.**

My 3 comments: (1) `5179233988` triage · (2) `5195640966` HLSL answer to jhelferty-nv (`5195577369`)
· (3) `5196649835` closing my own open question.

## ✅The caveat I left open, now CLOSED (MINE-VERIFIED 08-05, comment `5196649835`)

I had refused to claim one fix covers both reproducers. Checking the `createDynamicObject` case's IR
directly settled it — **both reduce to the SAME shape**:
```
let %17 : _ = TypeSet(%MySample, %10)      ; %10 = NoneTypeElement
let %16 : _ = WitnessTableSet(%13, %5)     ; %13 = NoneWitnessTableElement
                                           ; %5  = witness_table_t(%IMaterialSample)(%MySample)
    field(%material, tuple_type(SetTagType(%16), UntaggedUnionType(%17)))
```
`{none, exactly one concrete table}`, and **`grep -c Unbounded` over the whole dump = 0** ⇒ the
link-time `-conformance` does NOT leave an open set here. So the predicate is on SET CONTENTS, not
on how the conformance was supplied. ⭐⭐**I published this as covering THESE TWO INPUTS, explicitly
NOT as a proof of the general condition** — I never built a 2+-conformance case to check the
predicate correctly DECLINES. ⭐**Resolving a caveat is itself a claim with a scope: say which
inputs you checked, or the fixer inherits your hedge as a guarantee.**

## What I established (all MINE-VERIFIED at master `645ac5eef2b118454ac761b87546d78423ec6250`, local Release slangc stamped 2026-08-04 07:50:48)

Reporter's numbers confirmed exactly — `MyFoo` occurrence counts 7 / 0 / 13 across
`-DUSE_OPTIONAL=0/1/2`, matching their table. Target-independent: HLSL, Metal, GLSL all emit
`packAnyValue16`/`unpackAnyValue16` for variant 1, none for variant 0 ⇒ IR-level, not a SPIR-V
emit artifact.

⭐**THE ROOT CAUSE IS THE `none`, NOT THE `Optional`** — the reporter's own framing ("Optional
over an existential") is broader than the actual trigger. My discriminator: same
`Optional<IFoo>` code with the `p.foo = none` store REMOVED lowers to
`%P = OpTypeStruct %v3float %MyFoo` — 7 `MyFoo`, ZERO bitcasts, the Optional wrapper vanishes
entirely. With the `none` store: `%Tuple`, 0 `MyFoo`, 8 bitcasts. **One edit, opposite outcomes.**

Mechanism, traced in IR (`-dump-ir-before lowerUntaggedUnionTypes`):
`analyzeMakeOptionalNone` (`slang-ir-typeflow-specialize.cpp:3236`) builds a tagged union over
the *none* witness; `unionPropagationInfo` (`:1142`) unions it with `{MyFoo}` giving
`TypeSet(%MyFoo, NoneTypeElement)`. `IRTaggedUnionType::isSingleton()`
(`slang-ir-insts.h:3072`) demands both sets have one operand and `IRSetBase::isSingleton()`
(`:2981`) is a raw `getOperandCount() == 1` — so the none element occupies a slot, the count is
2, and `lowerTaggedUnionType` (`slang-ir-lower-dynamic-dispatch-insts.cpp:1339`) takes the tuple
path instead of its EXISTING singleton shortcut. `lowerUntaggedUnionType` (`:705`) then collapses
to `AnyValueType(16)` — it already skips `NoneTypeElement` when computing SIZE, but type identity
is already gone by then.

**The fix shape is already in-tree twice over**: `lowerTaggedUnionType`'s singleton path already
special-cases a lone `NoneTypeElement`, and `filterNoneElements` (`typeflow-specialize.cpp:6296`)
already strips none elements (used by `analyzeGetOptionalValue`). Missing piece is a
"singleton modulo none" notion. Target shape `{ConcreteT, bool}` is exactly what variant 2
(`Optional<MyFoo>`) produces today.

⚠️→✅**SUPERSEDED — see "The caveat I left open, now CLOSED" ABOVE (comment `5196649835`).** As of
2026-08-04 I had NOT established that one fix covers both reproducers and said so publicly, because
the `createDynamicObject` case closes its conformance set only via link-time
`-conformance MyModel:IMaterialModel=1` and #11266 (same author, OPEN) shows that ID bookkeeping has
its own defects. **08-05 I checked its IR and both reproducers DO reduce to the same
`{none, exactly-one-concrete-table}` shape (`Unbounded`=0), so the predicate is on set contents.**
Scope of that resolution: **THESE TWO INPUTS, not a general proof** (no 2+-conformance case built).
⭐**This paragraph is kept only so the earlier public hedge is traceable — do not restate it as my
current position.**

## HLSL numbers (MINE-VERIFIED 08-05, binary unchanged; HEAD now `b0e43d657`)

`-target hlsl`, same `minimal.slang`: **109 / 211 / 126 lines** for `USE_OPTIONAL=0/1/2`.
v0 `struct P_0 { float3 pos_0; bool has_0; MyFoo_0 foo_0; }` · v1 `AnyValue16{4×uint}` +
`Tuple_0{uint,AnyValue16}` + `P_0{float3,Tuple_0}` · v2 `_slang_Optional_MyFoo_0{MyFoo_0,bool}`.
Tag takes only `1U`(none)/`2U`(MyFoo). **`none` discriminator on HLSL: 0 pack/unpack decls +
0 casts without the `none` store vs 3 decls (+3 call sites) + 8 `asuint`/`asfloat` with it.**
material-system: **369 → 481** lines; baseline already has `packAnyValue52` (the
`createDynamicObject` model, expected), v1 adds a **SECOND NESTED** box `packAnyValue20_1(MySample_0)`.

⚠️**I published "4 pack/unpack functions" in the draft and CAUGHT IT PRE-POST: real count is 6
matches = 3 DECLS + 3 CALL SITES.** My two counts used different greps on different files.
⭐⭐**A bare count is ambiguous between declarations and occurrences — say which you counted, in
the artifact.** Fixed to "3 decls (+3 call sites)" before posting.

⛔**dxc TRAP, and its control mattered:** the emitted HLSL fails dxc validation —
`Type 'agg.result' is a struct type but is used as a parameter in function 'make_0'` — **on ALL
THREE variants INCLUDING the baseline**, so it is NOT this bug. Cause = the reporter's
`[noinline]` (added only to keep `P` a named type). Remove it → DXIL compiles clean (2992 B) and
**the boxing still appears** ⇒ boxed form is dxc-legal. ⭐⭐**Had I tested only the buggy variant I
would have reported a second, non-existent defect — the BASELINE is the control, and a failure
shared by the control is the environment, not the finding.** (Ladder that found it: float3→float4
buffer swap = no change; trivial shader = OK; scalar impl = same error; drop `[noinline]` = OK.)

## Lessons worth keeping

⭐⭐**A REPORTER'S FRAMING IS A HYPOTHESIS, NOT A FINDING.** "Optional re-boxes an existential"
described a real defect but mislocated it; the one-line discriminator (delete the `none` store)
moved the cause from a type constructor to a set-cardinality predicate. **Cheap and decisive —
run it before echoing the title back as the diagnosis.** Same family as
[[feedback_control_the_instrument_not_the_reasoning]]: the defect was in what got MEASURED
(which construct I varied), not in the argument.

⭐⭐**"All variants produce correct code" was an ASSUMPTION I nearly published as fact.** Caught
it pre-post, then EXECUTED all three on the CPU target (8 inputs, both branches) → byte-identical
output, **plus a non-zero control** (perturbed `eval` → harness detected the difference). Without
the control, three identical outputs are equally consistent with a harness that prints nothing
useful. ⭐**A severity claim of "performance-only, not a miscompile" is a CORRECTNESS claim in
disguise — it needs execution, not inspection.**

⭐**The `exe`/`host-executable` target silently produced NO binary with rc=0** — `ls` found
nothing while the command "succeeded". Working path: `-target cpp`, then hand-write a driver
(`ComputeVaryingInput`, `startGroupID`/`endGroupID`, call `main_0`), `g++ -I<slang>/prelude`,
and `#include <cstdio>` for `printf`. **rc=0 from slangc is not evidence an artifact exists —
stat the file.**

⛔**My slang clone is SHALLOW** — `git cat-file -t 74c724aecc` (PR #11667's merge sha) failed
outright; ancestry had to come from the API. See
[[feedback_shallow_clone_makes_your_head_the_graft_root]]. I verified the #11667 fix is present
by reading the source at HEAD (`"Structs are nominal"` at `:581`), not by graph ancestry.

Related: **#11266** (conformance-ID bookkeeping, LDAP, OPEN), **#11667** (merged 08-03, adjacent
type-flow Optional/existential fixes, different bug), **#7260** (established `Optional<IFoo>` as
the *intended* spelling for a nullable existential ⇒ the reporter's `bool`+bare-field workaround
goes AGAINST the language design, which strengthens the case for fixing).

Repro artifacts: `/tmp/i12338/` (ephemeral, per-container — `minimal.slang`,
`material-system.slang`, `disc.slang` = the discriminator, `run.slang` + `drv*.cpp` = the
executable equivalence harness).
