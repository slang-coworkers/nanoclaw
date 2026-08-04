---
name: project_8785_amplification_shader_payload_docs_wrong
description: "slang#8785 amplification shader + payload — TRIAGED 08-04 after 17d. BOTH the docs AND the compiler are wrong (an earlier verdict saying 'docs wrong, not the compiler' was RETRACTED — see the SUPERSEDED section). The documented `out payload T` form ICEs: spirv assert slang-ir-glsl-legalize.cpp:5235 (getArgCount()==4), metal assert slang-ir-legalize-varying-params.cpp:4566, and the RELEASE build SIGSEGVs (exit 139) because SLANG_ASSERT->SLANG_ASSUME makes the violated invariant UB; hlsl/glsl exit 0 but emit writes into a read-only cbuffer/push-constant (dxc 1.9 rejects). TRUE TRIGGER = the DispatchMesh payload arg is an entry-point PARAMETER (forced uniform); the `payload` modifier is a RED HERRING — bare `out T p` ICEs too. Root = slang-check-shader.cpp:2118-2155 stage switch omits Stage::Amplification. Supported forms today: `groupshared` global or a plain local. A1 docs fix is CROSS-REPO (shader-slang.github.io docs/coming-from-glsl.md:942-954,959) and UNOWNED; GAP1 multi-thread payload race NOT filed."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-04
---

## State

**slang#8785** *"Amplification shader and payload"* — open, assignee `jkwak-work`, Type=Bug (human-set, untouched), no labels. Comment history: bmillsNV 2025-10-23 (original ask: write an amplification shader, confirm Slang supports it incl. payload) → jkwak-work 2026-07-18 (*"@nv-slang-bot, can you triage this?"*) → **17 days silence** → **bot verdict `5173197689` @ 08-04 00:30:21Z** (Main-verified **fresh**; jkwak's was the last comment). Classification: **documentation (primary) + missing-diagnostic (secondary) / medium / P2** / frontend sema + mesh-amplification. No `reproduced` label — no mesh-shader GPU, stated publicly.

## ❌ VERDICT REPLACED 08-04 00:36Z — it is a **P1 CRASH**, not a docs bug. "Both are wrong, independently."

**The original docs/P2 verdict below was WRONG on substance, not just phrasing.** Triager re-verified with its own commands @`546ad18f7` and found the documented snippet **crashes at codegen**:

| target | outcome |
|---|---|
| `-target spirv` | **ICE `slang-ir-glsl-legalize.cpp(5235)`** |
| `-target metal` | **ICE `slang-ir-legalize-varying-params.cpp(4566)`** |
| release `slangc 2026.13.1` | **SIGSEGV, exit 139, core dumped** |

⇒ reclassified **bug / high / P1 / `reproduced` applied** (front-end sema + IR specialization + docs). Comment `5173197689` **edited in place** — Main-verified: still 3 comments (no dupes), `updated_at` 00:36:25Z vs `created_at` 00:30:21Z, body opens with an explicit *"this comment replaces an earlier automated triage of mine that concluded 'the documentation is wrong, not the compiler.' That conclusion was **incorrect**"*, and the overreach phrasing is gone.

## ⭐⭐ 00:43Z — ONE BUG, NOT THREE. Main-verified line-for-line, and it RULES OUT the harden-the-asserts approach.

The fixer corrected the triager (who verified by direct read; **Main independently confirmed at `546ad18f7`**): the two ICEs **and** the release segfault are **a single defect**, not three. The two sites are **structurally identical**:

| | spirv — `slang-ir-glsl-legalize.cpp` | metal — `slang-ir-legalize-varying-params.cpp` |
|---|---|---|
| argc assert | `:5235` | `:4561` |
| `getArg(3)` | `:5236` | `:4562` |
| `composeGetters<IRPtrType…>(payload, &IRInst::getDataType)` | `:5238-5239` | `:4564-4565` |
| `SLANG_ASSERT(payloadPtrType)` | `:5240` | `:4566` |
| **`payloadPtrType->getValueType()`** | **`:5241`** | **`:4567`** |

### ❌❌ THE "ONE NULL, TWO BUILD CONFIGS" MECHANISM IS WRONG — retracted 00:51Z. **I published it, and my "verification" could not have caught it.**

**What is actually true (triager re-verified by RUNNING both targets @`546ad18f7`, not by re-reading source):**

| target | assert that fires | mechanism |
|---|---|---|
| **spirv** | **arity** — `call->getArgCount() == 4` (`glsl-legalize:5235`) | **never reaches `composeGetters`.** The payload operand is dropped **upstream**: `-dump-ir` shows `call %DispatchMesh(1 : UInt, 1 : UInt, 1 : UInt)` — **3 args**. In release, `getArg(3)` on a 3-arg call is an **out-of-bounds operand read**, NOT a null deref. |
| **metal** | `payloadPtrType` (`varying-params:4566`) | arity **survives** (4 args), passes that assert, *then* the pointer-type getter yields null. **This** one is the null. |

⇒ **one front-end root cause → TWO DISTINCT downstream failure modes.** Release segfaults on both, by two different mechanisms.

**⭐⭐ My error, and it is the sharpest of the day: structural identity of the CODE does not imply identity of the FAILURE, because the two passes receive DIFFERENT IR.** My five-step table was correct — we each verified the code shape twice — and it was *irrelevant to the question I used it to answer*. **Reading two call sites can never tell you which assert fires; only running them can.** I confirmed a mechanism with an instrument that was structurally incapable of discriminating it, then published it, having explicitly told the triager I'd "verified it line-for-line."

**⭐ The triager's own error is worth more than mine:** its *first* empirical run printed both assert texts side by side (`getArgCount() == 4` for spirv vs `payloadPtrType` for metal) and it **overwrote its own measurement** when it adopted the tidier story. Rule it is carrying, and I am too: **when a neat mechanism contradicts a detail you already measured, the measurement wins.** Verify per-target by *running each target*, never by diffing source.

**⭐ Why this survived two independent reviews: the fix conclusion is unaffected.** One front-end rule still makes every site unreachable; Approach C is still out. **A wrong mechanism attached to a right conclusion gets no pushback from outcomes** — nothing downstream misbehaves, so nothing flags it. Second instance today (cf. the `#if` "structurally cannot" premise), and the reason both survived is identical.

**⭐ The "N signatures" rule cuts BOTH ways.** I correctly collapsed *causes* (one front-end root) and wrongly collapsed *mechanisms* (two distinct downstream paths). Collapsing and splitting are separate judgements about separate things; getting one right licenses nothing about the other.

**⭐ Instrument staleness (fixer's catch, adopt generally):** its Debug `slangc` was **5h older than HEAD** and reported the arity assert at **`:5182`** vs the current **`:5235`**. ⇒ **check binary mtime against the HEAD commit date before citing an assert line number.** A stale binary yields real-looking line numbers for code that has moved.

**And the code has no parameter path at all** — Main-verified `:5244-5247`: immediately after the asserts it computes `isGroupsharedGlobal = payload->getParent() == module->getModuleInst() && composeGetters<IRGroupSharedRate>(...)` and branches on it. There is no non-groupshared-global branch.

⇒ **This shaped the fix, and it kills Approach C (harden the asserts).** One front-end rule removes **both** ICEs, **the** segfault, and both silent-miscompile paths — because with a clean front-end error none of those sites are ever reached. Hardening asserts would paper over a reachable-invalid-IR state instead of preventing it. Now stated in the public verdict.

⭐ **Generalizable: "N crash signatures" is a hypothesis about count, not an observation** — but see the retraction above for how *I* misapplied it. The sound half: **causes** here really do collapse to one front-end root. The unsound half: I also collapsed the **mechanisms**, and they are genuinely two. ⚠️ *"Check whether the sites are the same code shape"* — which is what I originally wrote here — is exactly the wrong test: **the sites ARE the same shape and the failures are still different**, because the IR reaching each pass differs. Same code shape is not evidence about failure identity.

**⚠️ Bucket separation re-verified by Main:** `glsl-legalize:2166` is `SLANG_ASSERT(structTypeLayout)` in struct-field scalarization — same file, **genuinely unrelated site**. Correctly NOT merged with #9580/#12134.

**⭐ SCOPE CORRECTION — the `payload` modifier is NOT the trigger.** A 4-cell probe matrix showed **`out TaskData p` with NO `payload` modifier ICEs identically at `:5235`**, while `in T p` and `uniform T p` exit 0. ⇒ the trigger is **"an entry-point *parameter* reaches `DispatchMesh`"**, independent of the modifier.

**Main-verified the mechanism is coherent** (could not reproduce the ICE — no slang checkout or `slangc` in this container, stated rather than implied): both cited files reach the cited lines at that SHA (`slang-ir-glsl-legalize.cpp` 5412 lines, `slang-ir-legalize-varying-params.cpp` 5174), and `:5235` is
```cpp
SLANG_ASSERT(call->getArgCount() == 4);   // inside the dispatchMeshFunc use-walk
const auto payload = call->getArg(3);
```
— precisely the assert an unexpected entry-point parameter would trip. ⚠️ **Distinct assert from #9580/#12134** (those are `glsl-legalize:2166`); do not merge the buckets.

**⭐ Triager's root error, self-diagnosed and worth keeping:** *"I ruled the compiler innocent from a front-end warning and never compiled the documented snippet to codegen."* Its corollary to its own defect-inversion rule: it asked **"does it reject valid code?"** but not **"does it CRASH on the invalid code it accepts?"** A front-end diagnostic firing tells you nothing about what happens when the same input reaches the back end.

**⭐⭐ NEAR-MISS — an in-flight `PATCH` would have overwritten a correction and re-published the wrong conclusion.** It survived only because the edit path re-read the body first and noticed it had changed. Triager's words: **"luck, not process."** New rule adopted: **re-read an artifact live immediately before editing it; a changed body is a signal to VERIFY, not to overwrite.** This is the write-side twin of the read-side staleness rules, and the only reason a retraction didn't get silently reverted.

**Routing consequence:** #8785 is now a **P1 crash**, which changes the calculus on holding it maintainer-only. #8306's verdict is **unaffected and stands**.

## (SUPERSEDED — see above) Original verdict: the DOCS are wrong, not the compiler

`payload` **is** a real modifier (`HLSLPayloadModifier`), but only as **`in payload T` on the MESH entry point to receive** it. **There is no `out payload` producer form** on the amplification side. The supported producer idiom is **`groupshared` + `DispatchMesh`**, and that is *not* a workaround: `tests/pipeline/rasterization/mesh/task-groupshared.slang`'s own header comment says that form is identified during lowering and emitted with the **`taskPayloadSharedEXT`** rate — i.e. the direct analogue of the GLSL qualifier.

**Root cause — Main-verified at `546ad18f7`, and it is exact.** `source/slang/slang-check-shader.cpp` stage switch:
- `:2118` `bool canHaveVaryingInput = false;`
- `:2122-2131` cases: `Vertex, Fragment, Miss, AnyHit, ClosestHit, Callable, Geometry, **Mesh**, Hull, Domain` → `:2132` `canHaveVaryingInput = true`
- **`Stage::Amplification` appears NOWHERE in `:2114-2160`** (grep count **0**) ⇒ falls through to `default:` at `:2153`, leaving `canHaveVaryingInput = false`.

⇒ any non-semantic amplification parameter is **force-converted to `uniform`** and warned at `:2203-2207` (**diagnostic 38040**) — silently reinterpreting the user's `payload` intent rather than diagnosing it.

Triager also confirmed the reporter's sharp secondary point: `task-simple.slang`'s local-struct form only works because it pins `AMPLIFICATION_NUM_THREADS_X = 1`.

## Next action — docs fix, and the page is NOT in this repo

**⚠️ Main-verified the docs-not-in-repo finding** (the triager's conclusion is right; its phrasing was loose): `search/code` for `taskPayloadSharedEXT` returns **3** hits tree-wide, **all source/test** — `slang-emit-glsl.cpp`, `slang-ir-glsl-legalize.cpp`, `task-groupshared.slang`. The claims that actually matter both hold: **`extension:md` hits = 0**, and **`filename:coming-from-glsl` = 0**. So the offending page lives in the **docs-site source**, not here ⇒ the issue may need **re-scoping or a cross-repo pointer**. ⚠️ Note for future citation: *"zero hits tree-wide"* was imprecise — say *"zero in markdown"*; the source hits are the mechanism's implementation, which is the opposite of absence.

**Optional compiler polish:** a targeted diagnostic instead of silently reinterpreting `payload` as `uniform`.

**No fixer dispatched** — jkwak is assignee on both #8306 and #8785, neither has a "make a PR", and both carry an open maintainer decision.

## ⭐ On bmillsNV's original ask — the triage boundary was named, not crossed

Support **is** present and test-covered for the existing forms: `task-simple`, `task-groupshared`, spirv `wave-get-wave-index-mesh-amplification`, metal `simple-task`. **Writing a new multi-thread amplification shader and validating on hardware is implementation + GPU validation** — the triager **stopped there and said so publicly** rather than attempting it. Correct: naming the boundary *is* a complete triage result, and claiming hardware validation without a mesh-shader GPU would have been the day's recurring error in a new place.

## Dispatch state (08-04 00:43Z)

**Split executed as Main called it.** `slang-fixer` dispatched on the **crash half only, DRAFT-ONLY**. Note the fixer had been **holding correctly** before this — it told the triager that a severity raise increases *jkwak's* priority, not its own authority, and named "an explicit dispatch from you" as the only thing that would change that. **Correct reading of the drafts-only + op-gate rules**; the P1 label alone was not a mandate.

**Fixer scope:** amplification rule in `validateEntryPoint` (`slang-check-shader.cpp:2118-2155` + `:2200-2208`) emitting a clean error; condition **must cover the bare `out T p` case** (keying on `HLSLPayloadModifier` alone leaves it crashing — that's the whole point of the scope correction); must not regress `tests/diagnostics/entry-point-varying-stage-scope.slang`; GPU-free regression test pinning bare-`out T`.

**Held out of scope:** `out payload`-should-work (jkwak / #4039) and the docs page — now located: **`shader-slang.github.io` `docs/coming-from-glsl.md:942-954, :959`**, needs a cross-repo pointer.

⭐**Triager surfaced a judgement call instead of deciding it silently:** `Fixes #8785` is arguably too broad while the feature + docs halves stay open, so it asked the fixer to prefer **`Addresses #8785`** or scope the PR body explicitly, **and to say which it chose**. Good instinct — an auto-closing keyword would shut an issue whose two other halves are unresolved.

## ✅ A1 FILED — `shader-slang/shader-slang.github.io#210` (2026-08-04 00:52:11Z)

The cross-repo docs half now has a public artifact: **[github.io#210](https://github.com/shader-slang/shader-slang.github.io/issues/210)**,
author `nv-slang-bot[bot]`, open, no labels. **Auto cross-referenced onto #8785's timeline at
00:52:13Z** ⇒ a human on #8785 can navigate to it; the bot comment `5173197689` names the repo
(it predates the issue, so it carries no `#210` link — the timeline event covers that).
**Deliberately did NOT add a "filed 210" comment to #8785** — the cross-reference already renders,
and a redundant comment would trip the debounce rule.

**Main-verified before recording (all at the live tip):**
- **Citations exact.** `docs/coming-from-glsl.md` (1110 lines, control) — `:942-954` *is* the Slang
  fence containing `out payload TaskData payload`; `:959` *is* `- **Payload**: Replace
  \`taskPayloadSharedEXT\` with output parameter`. Both quoted correctly.
- **No retracted framing leaked into the public issue.** 6-term ladder over the body (61 lines,
  control) — `not the compiler` · `docs wrong` · `OpControlBarrier` · `barrier` · `synchroniz` ·
  `race` **all 0**; positive controls `groupshared` and `crashes the compiler` non-zero. The two
  retractions (docs-not-compiler; missing-barrier) held across the repo boundary.
- **Recommended replacement is real:** `tests/pipeline/rasterization/mesh/task-groupshared.slang`
  exists, 2293 B.
- **No duplicate:** `amplification` in the docs repo ⇒ **1** issue (this one); `coming-from-glsl`
  ⇒ 5, the other 4 unrelated (#196/#195/#188 identifier-clarity, #19 GLSL tutorial).

### ⭐⭐ The absence claim — and how the OBVIOUS check would have FALSELY REFUTED a TRUE claim

The body asserts *"no in-tree test uses one"* (`out payload` on amplification). Absence claim ⇒ ran
the ladder. **`search/code` for `"out payload"` repo-wide returns `total_count: 20`, including many
`tests/…` paths** — which reads as a flat refutation. It is not: those are **ray-tracing**
`out RayPayload`/optix payload-register tests, a different feature that shares the spelling.

The discriminating scope is *amplification entry points*, which enumerates to **exactly 5 files** —
and I opened **all 5**:

| test | payload form |
|---|---|
| `mesh/task-groupshared.slang` | `groupshared MeshPayload p;` `:32` |
| `mesh/task-simple.slang` | plain local → `DispatchMesh` `:45` |
| `diagnostics/entry-point-varying-stage-scope.slang` | plain local `TaskPayload p;` `:68-70` |
| `spirv/device-index-all-stages.slang` | plain local `Payload p;` `:148-150` |
| `spirv/wave-get-wave-index-mesh-amplification.slang` | no payload at all |

⇒ **zero parameter forms. The claim is TRUE.** Positive control that the instrument works:
`"in payload"` ⇒ 9 files, all mesh-side (`task-simple:82`, `task-groupshared:74`) — exactly the
form the issue says is the correct spelling.

⭐⭐ **New shape, and it's the mirror of my usual error: a keyword count over too WIDE a scope
manufactures a FALSE REFUTATION.** My standing rules were built for false *confirmation* (a zero
without a control; a citation authenticating a location, not a scope). This is the same defect with
the sign flipped — 20 hits would have let me "correct" a peer who was right. ⇒ **before accepting
EITHER polarity, ask what set the count ranges over and whether that set is the claim's set.**
⭐ Corollary: a feature-name collision (`payload` = ray-tracing *and* mesh/amplification) is the
cheapest way for a scope to silently widen — **enumerate the feature's entry points, then read
them**, rather than grepping the shared noun.

## RESUME

jkwak-work decides: **the optional compiler diagnostic** (crash half is separately dispatched to
`slang-fixer`, draft-only), and whether **GAP 1** (silent aliasing) earns a standalone issue.
**A1 is no longer waiting on us** — #210 carries the exact replacement snippet; a docs maintainer
can apply it directly. ⚠️ **No coworker is wired to `shader-slang.github.io`** (my repo table covers
`slang`, `slang-rhi`, `slangpy` only) ⇒ nobody on the fleet can open that docs PR; #210 is
human-owned by construction. Both 17-day stale requests remain cleared.

Related: [[project_8306_embed_core_glsl_module_slang_dll]], [[project_8306_8785_triager_session_never_produced_a_turn]] (the 17-day silence, still separately unexplained).

## GAP 1 — CORRECTED framing: silent aliasing, NOT a missing barrier (2026-08-04)

⛔ **RETRACTED:** the first version of this gap claimed 32 threads produce one unsynchronized
`OpStore` with **no `OpControlBarrier`**, i.e. a synchronization defect. **That framing is wrong** and
was retracted publicly on issue #8785 (comment `5173197689`, count still 3).

- `GLSL_EXT_mesh_shader` specifies that `EmitMeshTasksEXT` **implies a `barrier()`** (and must be
  called exactly once under uniform control flow). So synchronization is **not** the defect.
- **The control that settles it:** the shipped, tested `groupshared` idiom *also* emits **zero**
  `OpControlBarrier`. A rule that convicts the supported idiom is wrong. This was one command away.
- ⭐ The general error: concluding *"the compiler fails to emit X"* from **X's absence in the output**,
  without first establishing that the spec **requires** X.

✅ **The real hazard, correctly framed — silent aliasing.** With `[numthreads(32,1,1)]` and a *local*
payload, Slang promotes the per-thread local into one workgroup-wide `TaskPayloadWorkgroupEXT` global
(`__EmitMeshTasks_Payload`, `slang-ir-glsl-legalize.cpp:5266-5288`). All 32 threads store into one
slot — last writer wins — while the source reads as thread-private.

**Deliberately NOT filed as its own issue.** Two open questions are maintainer judgment, not evidence
gaps: (1) is last-writer-wins *intended* (it matches HLSL/DXC `DispatchMesh`, where the payload is
inherently group-shared)? (2) should Slang **diagnose** a per-thread local silently becoming shared?
If intended, the fix is documentation — and a docs bug on this exact page already exists (A1). Folded
into #8785; jkwak decides whether it earns a standalone issue.
