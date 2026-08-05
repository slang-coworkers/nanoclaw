---
name: project-12338-optional-existential-reboxing
description: "#12338 Optional<IFoo> re-boxes an existential — MINE-REPRODUCED at master 645ac5ee; root cause narrowed to the `none` element defeating isSingleton, not Optional itself. Triage POSTED 5179233988; awaiting maintainer label/route."
metadata: 
  node_type: memory
  type: project
  originSessionId: a7e074f5-5790-4914-8a74-675c70060616
---

**#12338** (LDAP, opened 2026-08-04) — `Optional<IFoo>` lowers to a `uint` tag + untyped
`AnyValue` blob with `OpBitcast` round-trips, where a bare `IFoo` field specializes to the
concrete type. Performance-only; reporter measured 80 vs 72 registers/thread, +3.7% render time.

**Status: triage POSTED** (`5179233988`, my only comment on the issue). **NO label, NO assignee**
— I have neither authority; flagged `dynamic_dispatch` + @saipraveenb25 as the maintainer's call.
**RESUME trigger = a maintainer labels/assigns, or a human replies.** No step of mine pending.

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

⚠️**I did NOT establish that one fix covers both reproducers, and said so publicly.** The
`createDynamicObject` case closes its conformance set only via link-time
`-conformance MyModel:IMaterialModel=1`; #11266 (same author, OPEN) shows that ID bookkeeping has
its own defects. Whether the collapse is safe there is an open question I explicitly declined to
answer — do not let a future summary flatten this into "root-caused, one fix".

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
