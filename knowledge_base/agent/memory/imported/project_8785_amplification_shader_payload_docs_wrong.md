---
name: project_8785_amplification_shader_payload_docs_wrong
description: "slang#8785 amplification shader + payload — TRIAGED 08-04 as bug/high/P1, `reproduced`. BOTH docs and compiler are wrong (an earlier 'docs wrong, not the compiler' verdict was retracted). The documented `out payload T` form crashes at codegen; TRUE trigger = an entry-point PARAMETER reaches DispatchMesh (the `payload` modifier is a red herring — bare `out T p` ICEs too). Root = slang-check-shader.cpp stage switch omits Stage::Amplification. Crash-half dispatched to slang-fixer (draft-only); docs half filed cross-repo as shader-slang.github.io#210 (human-owned). GAP1 (silent payload aliasing) folded in, jkwak to decide."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-04
---

## State

**slang#8785** *"Amplification shader and payload"* — open, assignee `jkwak-work`, Type=Bug, label **`reproduced`** (applied 08-04). Classification **bug / high / P1** (front-end sema + IR specialization + docs). Bot verdict comment `5173197689` (edited in place — replaces an earlier automated triage that wrongly concluded "the documentation is wrong, not the compiler").

## The defect — both wrong, independently

The documented `out payload T` snippet **crashes at codegen**: `-target spirv` ICEs at `slang-ir-glsl-legalize.cpp:5235`, `-target metal` ICEs at `slang-ir-legalize-varying-params.cpp:4566`, and a **release build SIGSEGVs (exit 139)** because `SLANG_ASSERT`→`SLANG_ASSUME` makes the violated invariant UB. hlsl/glsl exit 0 but emit writes into a read-only cbuffer/push-constant (dxc 1.9 rejects).

**TRUE trigger = an entry-point PARAMETER reaches `DispatchMesh`** (forced uniform). A 4-cell probe matrix confirmed `out TaskData p` with NO `payload` modifier ICEs identically, while `in T`/`uniform T` exit 0 — so the `payload` modifier is a **red herring**. Supported forms today: a `groupshared` global (emitted with the `taskPayloadSharedEXT` rate — the direct GLSL-qualifier analogue) or a plain local.

**Root cause (verified at `546ad18f7`):** `source/slang/slang-check-shader.cpp` stage switch (`:2118-2131`) lists Vertex/Fragment/Miss/…/**Mesh**/Hull/Domain → `canHaveVaryingInput = true`, but **`Stage::Amplification` appears nowhere** (`:2114-2160`), so it falls to `default:` (`:2153`) with `canHaveVaryingInput = false`. Any non-semantic amplification parameter is force-converted to `uniform` and merely warned (diagnostic 38040) — silently reinterpreting the user's intent. There is no non-groupshared-global branch downstream (`:5244-5247`).

**One front-end root cause → two DISTINCT downstream failure modes** (verified by RUNNING each target, not by re-reading source):

| target | assert | mechanism |
|---|---|---|
| spirv | arity `getArgCount()==4` (`glsl-legalize:5235`) | payload operand dropped upstream → `-dump-ir` shows a **3-arg** `DispatchMesh` call; in release `getArg(3)` is an OOB operand read |
| metal | `payloadPtrType` null (`varying-params:4566`) | 4 args survive, then the pointer-type getter yields null |

⇒ **This kills the harden-the-asserts approach (Approach C):** one front-end rule (a clean error when an entry-point parameter reaches `DispatchMesh`) makes every crash site and both silent-miscompile paths unreachable, rather than papering over reachable invalid IR. Distinct assert from #9580/#12134 (`glsl-legalize:2166`) — **do not merge those buckets.**

## Reusable lessons from this chain

- **Structural identity of CODE does not imply identity of FAILURE** — the two crash sites are line-for-line identical, yet fail differently because the IR reaching each pass differs. Reading two call sites can never tell you which assert fires; only running each target can. "Same code shape" is not evidence about failure identity.
- **A wrong mechanism attached to a RIGHT conclusion gets no pushback from outcomes** — the "one null, two build configs" story survived two reviews because the fix conclusion was unaffected; nothing downstream misbehaved to flag it. When a neat mechanism contradicts a detail you already measured, the measurement wins.
- **A keyword count over too WIDE a scope manufactures a FALSE refutation** — `search/code "out payload"` returns 20 hits (mostly ray-tracing `out RayPayload`, a different feature sharing the spelling); the amplification-entry-point scope enumerates to exactly 5 files, all with zero parameter forms ⇒ the absence claim is TRUE. Before accepting either polarity, ask what set the count ranges over. A feature-name collision is the cheapest way for a scope to silently widen — enumerate the feature's entry points and read them, don't grep the shared noun.
- **Check binary mtime against HEAD before citing an assert line number** — a stale Debug `slangc` reported `:5182` for code now at `:5235`.
- **Re-read a live artifact immediately before editing it; a changed body is a signal to VERIFY, not overwrite** — an in-flight PATCH nearly re-published a retracted conclusion, saved only because the edit path re-read first ("luck, not process").

## Dispatch / next action

- **Crash half → `slang-fixer`, DRAFT-ONLY.** Scope: amplification rule in `validateEntryPoint` (`slang-check-shader.cpp:2118-2155` + `:2200-2208`) emitting a clean error; the condition **must cover the bare `out T p` case** (keying on `HLSLPayloadModifier` alone leaves it crashing); must not regress `tests/diagnostics/entry-point-varying-stage-scope.slang`; add a GPU-free regression test. Prefer `Addresses #8785` over `Fixes #8785` (feature + docs halves stay open).
- **Docs half → FILED cross-repo as [`shader-slang.github.io#210`](https://github.com/shader-slang/shader-slang.github.io/issues/210)** (open, bot-authored, targets `docs/coming-from-glsl.md:942-954,959`), auto cross-referenced onto #8785. ⚠️ **No coworker is wired to `shader-slang.github.io`** ⇒ #210 is human-owned by construction; a docs maintainer applies the snippet directly.
- **RESUME (owner `jkwak-work`):** whether to add the optional compiler diagnostic, and whether GAP 1 earns a standalone issue.

## GAP 1 — silent aliasing (NOT a missing barrier)

⛔ The first framing ("32 threads store with no `OpControlBarrier`") was **retracted publicly**: `GLSL_EXT_mesh_shader` says `EmitMeshTasksEXT` implies a barrier, and the shipped `groupshared` idiom *also* emits zero `OpControlBarrier` — a rule that convicts the supported idiom is wrong. General error: concluding "the compiler fails to emit X" from X's absence without establishing the spec requires X.

✅ **The real hazard:** with `[numthreads(32,1,1)]` and a *local* payload, Slang promotes the per-thread local into one workgroup-wide `TaskPayloadWorkgroupEXT` global (`slang-ir-glsl-legalize.cpp:5266-5288`); all 32 threads store into one slot (last-writer-wins) while the source reads as thread-private. **Not filed separately** — two open questions are maintainer judgment (is last-writer-wins intended, matching HLSL/DXC? should Slang diagnose the silent shared promotion?); folded into #8785, jkwak decides.

Related: [[feedback_correction_unapplied_until_every_restatement_fixed]] (position decides which restatement is read — sweep the *earliest* statement), [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]], [[project_8306_embed_core_glsl_module_slang_dll]], [[project_8306_8785_triager_session_never_produced_a_turn]].
