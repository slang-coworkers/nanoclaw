---
title: "Slang IR Passes, Diagnostics, and Tooling"
type: concept
group: slang-autodiff-ir
tags: [ir-passes, diagnostics, source-locations, ir-instructions, optimization, serialization, parser, tooling, agent-operations]
source_count: 30
---

# Slang IR Passes, Diagnostics, and Tooling

This page covers concrete knowledge about Slang's IR pass infrastructure, diagnostic source-location mechanics, IR instruction authoring, serialization, and operational practices observed while working in this codebase.

## TL;DR

- **IR-pass diagnostics lose `file:line` because synthesized/legalized/cloned insts carry an empty `sourceLoc`** — the renderer silently omits location when `line == 0`. Fix at the **emission site** (give the diagnostic an explicit `.location`, fall back to `findFirstUseLoc`), NOT at key creation (dead end for imported/deserialized modules). Tell: "can't reproduce with a small shader" — the simple path picks up the IRBuilder's incidental loc, the imported path doesn't; a regression test must precompile + import.
- **Editing a `span`'s `loc` kind in `slang-diagnostics.lua` silently drops the `message =` field** — no CI failure (no FileCheck asserts on span label text). A `loc = "location"` span can still carry a `message`.
- **The IR text dumper renders every `IRParam` as bare `param`** (no SSA id, no operands) — it cannot prove/refute orphan-IRParam or null-parent claims. Use a debugger break, a `_debugUID` patch, or `insttrace.py`; the text dump is good for pass-level signature deltas only.
- **When DeepWiki and source reading disagree on a cross-pass IR detail, trust source + observed runtime behavior.** DeepWiki is reliable for architecture/flow orientation, not "is this decoration removed here" precision.
- **A wrapper-swap pass must manually re-point any entry-point-identity decoration** (`IREntryPointParamDecoration`) to the wrapper — `transferFunctionDecorations` only copies decorations on the old func; use `traverseUses` + `IRUse::set`, never `replaceUsesWith` (self-recurse), and don't band-aid the consumer.
- **Variable-arity IR insts round-trip within a compiler version** (serialize stores per-inst `operandCount`) — the "misparse on deserialize" concern is false; the real risk is cross-version forward-compat (an older compiler hitting an unguarded `getOperand(1)`). `min_operands` in the `.lua` is generator metadata only — no validator enforces it.
- **Adding a new IR opcode has three silent-break follow-ups:** (1) register a stable name in `slang-ir-insts-stable-names.lua` (append-only, ABI); (2) a **type** opcode's C++ enum is `kIROp_<struct_name>`, not `kIROp_<luaKey>`; (3) increment `k_maxSupportedModuleVersion` in `slang-ir.h` by exactly one (`slangbot` posts an actionable version-check comment).
- **Parser-diagnostic gotchas:** identical-content diagnostics are deduped (interpolate an instance token); a header-phase parse error suppresses body-phase errors (don't mix param + local cases); `DIAGNOSTIC_TEST` exhaustive mode needs a `//PREFIX:` line for BOTH the primary and span rows of most errors.
- **Texture `Sample` `offset` is `constexpr`** — a wrapper forwarding it as a runtime param gets `E40013`; mark the wrapper param `constexpr` too (`[ForceInline]` does NOT fix it; the check precedes inlining).
- **A type-shape-keyed legalize gate is B/C-risky** — passes synthesize 1-vectors in-window, so an up-front presence scan misses them; force-run conservatively and key the scan on the pass's own `isSpecialType` predicate (a provable superset). A new *kind* of lattice value (SCCP marking aggregates as `Constant(inst)`) must audit every `as<IRConstant>` site pass-wide, not just the changed lines.
- **Scan-only `Agent` forks overreach** (inherit full context, may run the whole task + message upstream) — cap with "Read-only, return to ME only, no send_message/append_learning" or use `Explore`. Concurrent ninja on one build dir races destructively (transient `ranlib: No such file`) — serialize.
- **Primal-hoist sizes reverse-mode loop storage from `IRLoopMaxItersDecoration`, so a wrong inferred trip count is wrong code.** A false zero-trip from trip-count inference attaches `MaxIters(0)`, undersizes the tape, and `bwd_diff` goes out of bounds; non-differentiable loops only get a warning.

## IR Pass Diagnostics: Source Location Loss

IR-pass warnings (E41021 `field-not-default-initialized`, E31106/E31107 parameter-group leaks) sometimes print with no `file:line`: the rich-diagnostics renderer silently omits location and snippet when the resolved `SourceLoc` has `line == 0`. Synthesized, legalized, or link-time-cloned insts carry an empty `sourceLoc`; struct keys from `lowerMemberVarDecl` → `builder->createStructKey()` never take `fieldDecl->loc` and inherit whatever the `IRBuilder` incidentally holds — populated in simple single-file lowering, empty in linked/specialized paths ([Slang IR-pass diagnostics lose source locations because struct keys inherit IRBuilder's incidental loc](../learnings/1780328920397-slang-ir-pass-diagnostics-lose-source-locations-be.md)). Hence the tell: "can't reproduce with a small shader".

Fixing the key at creation is a dead end for imported modules: keys deserialized from a precompiled `.slang-module` have no loc resolvable in the consuming compile, and consumer lowering never re-touches them. Fix at the **emission site**: give the diagnostic an explicit `.location` span and fall back to `findFirstUseLoc(type_or_func)` (first use with a valid `sourceLoc`; recovers the common case, not a guarantee). The regression test must precompile a module and import it ([Locationless IR-pass diagnostics on imported-module structs: fix at emission, not key creation](../learnings/1780418999087-locationless-ir-pass-diagnostics-on-imported-modul.md)).

A producer-side fix does work when the source is in the same compile. On HLSL and CUDA, `collectGlobalUniformParameters` moves uniform globals into a `globalParams` struct with fresh locless `createStructKey()` keys, so a field diagnostic on a `uniform` global (on CUDA, any resource-typed global) reports line 0. Copy `fieldKey->sourceLoc = globalParam->sourceLoc` only **after** the existing `SLANG_ASSERT(globalParam)` — non-uniform entries arrive with a null param, and placing it earlier segfaulted two GLSL tests ([late IR unsupported-shape checks must look through wrappers](../learnings/1793309934870-late-ir-unsupported-shape-checks-must-look-through.md)) ([Slang IR diagnostics: run a check for an optimizable shape late](../learnings/1793321156877-slang-ir-diagnostics-run-a-check-for-an-optimizabl.md)). Where such checks belong and what they must look through: [[wiki/concepts/slang-compiler-unsupported-shape-checks-and-emitter-use-checks.md]].

## slang-diagnostics.lua: Dropped Secondary Messages

Changing a `span { ... }`'s `loc` kind in `source/slang/slang-diagnostics.lua` (e.g. `loc = "member:IRInst"` → `loc = "location"`) easily drops its `message =` field, silently removing the secondary annotation everywhere — no FileCheck asserts on span label text. Restore `message =`; a `loc = "location"` span can carry one. Seen on PR #11424 (E31107), where three review passes converged on the dropped `"This member will leak into a separate binding slot."` ([Slang diagnostics.lua: changing a span's loc kind silently drops its secondary message](../learnings/1780411224942-slang-diagnostics-lua-changing-a-span-s-loc-kind-s.md)).

## IR Text Dumper: IRParams Are Invisible

`dumpInstExpr` (`source/slang/slang-ir.cpp:7858-7971`) renders every `IRParam` as bare `param` — no SSA id, no operands, in-block or orphan alike — so the text dump cannot prove or refute "orphan IRParam" / "null parent/type" claims. Prove the mechanism with a debugger break at the null-deref site, a temporary patch printing `_debugUID` and `getParent() != nullptr`, or `extras/insttrace.py <debugUID>`. The dump suffices for pass-level signature deltas (e.g. "value param re-typed `Array → Ptr` at pass 057") ([Slang IR text dumper renders all IRParams identically — orphan-vs-attached invisible from text](../learnings/1780729718385-slang-ir-text-dumper-renders-all-irparams-identica.md)).

## DeepWiki Staleness on Cross-Pass IR Details

When DeepWiki and source disagree on a cross-pass IR detail, trust source and use observed behavior as tiebreaker. On #11606 (Metal hoisted uniform dropped on composite-output vertex shaders) DeepWiki said `IREntryPointParamDecoration` is *removed* before the Metal wrapper is built; source showed it *survives*, naming the old func. The symptom decided it: a removed decoration would bind the param to all entry points (added), not drop it ([DeepWiki can be stale on cross-pass IR details — disambiguate with observed behavior](../learnings/1781472651294-deepwiki-can-be-stale-on-cross-pass-ir-details-dis.md)).

## Entry-Point-Identity Decorations at Wrapper Swaps

When a pass replaces an entry point with a wrapper `IRFunc` (e.g. `legalizeVertexShaderOutputParamsForMetal`), decorations that **record entry-point identity** must be re-pointed manually — `transferFunctionDecorations` only copies decorations on the old func. `IREntryPointParamDecoration(globalParam, entryPointFunc)` lives on the global param with the func as operand; left stale, consumers silently drop the uniform. Fix at the swap site with `traverseUses(inst, cb)` / `traverseUsers<I>(inst, cb)` (they snapshot uses) and `IRUse::set(newFunc)`, asserting the single-operand invariant. Don't band-aid the consumer; don't use `replaceUsesWith` (self-recurses onto the wrapper's call to the original) ([Slang IR: re-point entry-point-identity decorations at a wrapper-swap site](../learnings/1781477381559-slang-ir-re-point-entry-point-identity-decorations.md)).

Test note: `//TEST:SIMPLE(filecheck=METAL)` tests are silently ignored without local LLVM FileCheck — emulate with `slangc -target metal | grep -E`. Metal buffer-slot CHECKs escape brackets: `{{\[\[}}buffer(0){{\]\]}}`.

## Variable-Arity IR Instructions and Serialization

`source/slang/slang-serialize-ir.cpp` stores `operandCount = inst->operandCount` per inst and reads exactly that many back, so a fewer-operand inst round-trips faithfully **within a compiler version** — no "misparse on deserialize". The real question is cross-version forward-compat: an older compiler loads the shorter form correctly but may hit an unguarded accessor (bare `getOperand(1)`) at emit — a maintainer-policy question, not a proven bug. `min_operands` in `slang-ir-insts.lua` is generator metadata only; no validator in `source/slang` or `source/compiler-core` reads it ([Variable-arity IR insts round-trip within a compiler version (serialize stores per-inst operandCount)](../learnings/1781569081341-variable-arity-ir-insts-round-trip-within-a-compil.md)).

## Adding a New IR Instruction: Required Follow-ups

A new opcode in `source/slang/slang-ir-insts.lua` silently breaks the build unless ([New Slang IR opcode: stable-name registration + type-vs-key enum naming](../learnings/1782585186668-new-slang-ir-opcode-stable-name-registration-type-.md)):

1. **Stable name:** every leaf opcode needs an entry in `slang-ir-insts-stable-names.lua`, else FIDDLE aborts `fatal error 400002: Instruction is missing stable name: <StructName>`. Key is the lua `full_path` (`Type.<key>` for a type opcode nested in `Type`; bare `<key>` for a top-level op). Next unused integer, APPEND only — values are serialized-IR ABI.
2. **Enum naming:** a **type** opcode's enum is `kIROp_<struct_name>` (`DescriptorHandle = { struct_name = "DescriptorHandleType" }` → `kIROp_DescriptorHandleType`); ordinary ops use the key. Mixing them fails only after FIDDLE generation.
3. **Module version:** any PR adding an IR inst — even a no-operand decoration — increments `k_maxSupportedModuleVersion` in `source/slang/slang-ir.h` by exactly one (policy documented above the constant). `slangbot`'s `<!-- slang-ir-version-check -->` comment is actionable. To find who last bumped it use `git log -G 'k_maxSupportedModuleVersion = 22'`, not `git log -S` (misses value-only edits) ([Adding an IR instruction requires bumping k_maxSupportedModuleVersion (slang-ir.h)](../learnings/1782491129029-adding-an-ir-instruction-requires-bumping-k-maxsup.md)).

## Parser Diagnostics: Dedup, Body-Phase Suppression, DIAGNOSTIC_TEST Mechanics

From shader-slang/slang#11664 ([Slang parser-diagnostic gotchas: message dedup, body-phase error suppression, DIAGNOSTIC_TEST exhaustive rows](../learnings/1781826649693-slang-parser-diagnostic-gotchas-message-dedup-body.md)):

1. **Dedup:** diagnostics with identical code + message collapse; interpolate an instance token (e.g. `~op`).
2. **Body-phase suppression:** a declaration-header parse error suppresses body-phase errors, so don't pair a param-error and a local-variable-error case in one test — use a global variable (same `CompleteVarDecl` path, header phase).
3. **DIAGNOSTIC_TEST:** runs `slangc <file> -enable-machine-readable-diagnostics` (front-end only). With `diag=`, inline `//PREFIX:` annotations are used and `.expected` ignored. Exhaustive mode (default) must match every row; one error emits a primary row and a span row (deduped only if its message equals the title), so most errors need TWO `//PREFIX:` lines.

## Texture Sample Offset: Constexpr Propagation

`_Texture.Sample(SamplerState, location, offset)` declares `offset` `constexpr` in `hlsl.meta.slang` so it lowers to an immediate `ConstOffset` operand; a wrapper forwarding it as a runtime param gets `E40013: argument is not a compile-time constant`. Mark the wrapper param `constexpr`; `[ForceInline]` doesn't help (the check precedes inlining). The core-module reference omits `constexpr` on `offset`, which is why users expect a plain forward to work ([Slang texture Sample offset is constexpr; wrappers must forward it as constexpr](../learnings/1782041019246-slang-texture-sample-offset-is-constexpr-wrappers-.md)).

## Build: Concurrent Ninja Race

Two `cmake --build`/ninja runs on one build dir race destructively: `FAILED: .../libSPIRV-Tools-opt.a` with `ranlib: '...libSPIRV-Tools-opt.a': No such file` (archive exists afterward; transient, not disk-full). Confirm none running (`pgrep -af 'ninja -f build-Debug'`), then rebuild serially. Also, `Agent(prompt=...)` forks without `subagent_type` inherit full context and tools and may run the whole parent task; for read-only scans add "do NOT modify files or launch builds; return findings to me only" or use `Explore` ([Concurrent ninja on one build dir → transient ranlib 'No such file' race; fork (no subagent_type) can overstep its task](../learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md)).

## Agent Operational Patterns

- **Cap scan-only forks:** "Read-only. Return findings to ME only. Do NOT send_message, do NOT append_learning." — otherwise a fork may run the full task and report upstream, a provenance hazard ([A scan-only Agent fork can overreach into the full task and message the parent](../learnings/1782203173377-a-scan-only-agent-fork-can-overreach-into-the-full.md)).
- **send_message-to-self doesn't wake stopped sessions:** `target_session_id`-pinned dispatches to your own group don't reliably restart a stopped container. Do multi-session work directly with `gh` or have the chain parent re-dispatch; verify against the external artifact (e.g. label event history) ([Waking your own agent's stopped per-issue sessions via send_message-to-self does not resume them](../learnings/1781110850059-waking-your-own-agent-s-stopped-per-issue-sessions.md)).
- **Check last MESSAGE time before escalating a loop claim:** `last_active` is a heartbeat file touch. A `running` session whose last message is hours old is a dead loop; check `ncl sessions messages <id>`, and relay as UNVERIFIED if you can't read it ([Before escalating a peer's 'ongoing loop' claim, check last MESSAGE timestamp vs last_active (heartbeat)](../learnings/1782346077621-before-escalating-a-peer-s-ongoing-loop-claim-chec.md)).
- **a2a HTML-escapes verbatim text** (`"`→`&quot;`, `>`→`&gt;`, `<`→`&lt;`, possibly double): the posting coworker decodes entities before posting, then verifies via `github_get_issue` ([a2a message transport HTML-escapes verbatim text — decode before posting to GitHub](../learnings/1780473326506-a2a-message-transport-html-escapes-verbatim-text-d.md)).
- **A maintainer's own fork PR is exploration**, not necessarily what they want landed under "propose a fix if none exists": report it with nuance and let parent/maintainer choose upstream-it, independent fix, or defer — no competing PR first ([Maintainer 'propose a fix if none exists' + their own fork PR = confirm direction, don't assume upstream-it](../learnings/1781663826357-maintainer-propose-a-fix-if-none-exists-their-own-.md)).
- **slang-mcp's Discord Gateway is lazy:** `init_discord_client()` (`container/mcp-servers/slang-mcp/src/discord/discord.py:338`) runs only on the first Discord tool call, so after a respawn no `MESSAGE_CREATE` events flow until then; ask `slang-discord-support` to call `discord_read_messages` once ([slang-mcp's Discord Gateway connection is LAZY — init_discord_client() only fires when a Discord tool is invoked. After slang-mcp respawn, no live MESSAGE_CREATE events flow until first tool call.](../learnings/legoop-project_slang_mcp_gateway_lazy.md)).
- **a2a self-edge / empty-ack loops:** routing rules, root cause, detection and stand-down are in [CONSOLIDATED: a2a messaging — reply routing rules + self-edge/empty-ack loop incident](../learnings/1780558160000-CONSOLIDATED-a2a-messaging-routing-and-self-edge-loop.md).
- **Discord 2000-char hard limit** on `content`; the MCP server doesn't auto-split. Pre-split into ≤2000-char messages (emoji and URLs count) with feedback buttons on the last only ([Discord per-message char limit is 2000](../learnings/1780404951139-discord-per-message-char-limit-is-2000.md), [Discord send_message enforces a 2000-char hard limit](../learnings/1781903378102-discord-send-message-enforces-a-2000-char-hard-lim.md)).

## Lazy Autodiff Builtin Loading (slang#12136)

slang#12136 ("Load autodiff builtins on demand") splits diff.meta.slang into a lazily loaded supplement. Swapping decl-owned state for context-owned state widens the null-deref surface ([[approver/gating-safety] On-demand builtin loading can widen a null-deref surface when a fix swaps decl-owned state for context-owned state](../learnings/1784184038640-approver-gating-safety-on-demand-builtin-loading-c.md)), and it crashed (SIGSEGV) on IDifferentiable-constrained types with no load trigger — a real gap, not advisory ([[approver/gating-safety] Lazy autodiff-module load (slang#12136) crashes on IDifferentiable-CONSTRAINED types with no trigger — gap#1 is real (SIGSEGV), not advisory](../learnings/1784186366576-approver-gating-safety-lazy-autodiff-module-load-s.md)).

## Type-Shape-Keyed Legalize Gates and SCCP Invariants (#11917)

Gating `legalizeEmptyArray`/`legalizeVectorTypes`/`legalizeUniformBufferLoad` on an up-front IntLit-dimension scan is unsafe: `generateAnyValueMarshallingFunctions` synthesizes 1-vectors *in-window* (after the scan, before the pass), so no naive gate is safe for this family ([#11917 gating: legalize passes keyed on type shape are B/C-risky](../learnings/1783995257092-11917-gating-legalize-passes-keyed-on-type-shape-i.md)). The #11987 "in-pass shallow scan at pass entry" early-out works for standalone `legalizeMatrixTypes` (its blind spot matches its own IRGeneric bail) but does **NOT** transfer to `legalizeEmptyTypes`/`legalizeResourceTypes`, thin wrappers over the shared `legalizeTypes()` with no such bail: force-run conservatively while any unspecialized IRGeneric remains, per-context (never in shared `processModule`), and key the scan on the pass's OWN `isSpecialType` so it is a provable superset ([#11987 in-pass-scan template does NOT transfer to shared-legalizeTypes passes](../learnings/1785373772506-11917-in-pass-scan-11987-template-does-not-transfe.md)).

**SCCP: a new *kind* of lattice value must audit the full blast radius.** Marking `MakeVector`/`MakeVectorFromScalar` as `LatticeVal::getConstant(inst)` ("constant as itself") breaks a pass-wide invariant: every scalar evaluator (`evalCast`, `evalBitCast`, `evalNeg`, `evalBinaryImpl`, …) dereferences `as<IRConstant>(v.value)` unchecked. `bit_cast` (vector → scalar) slips the vector-result gate and null-derefs in `evalBitCast`; repro `static const uint u = bit_cast<uint>(uint16_t2(1,2));`. Document at `getConstant` that a `Constant` may wrap a self-referential aggregate, and guard-or-assert-scalar EVERY `as<IRConstant>` site ([SCCP marking non-IRConstant aggregates as Constant(inst) breaks the pass-wide IRConstant invariant](../learnings/1785338682203-sccp-marking-non-irconstant-aggregates-as-constant.md)).

## Reverse-Mode Loop Storage Sizing (#13000, PR #13993)

**Nested `[MaxIters]` transposition (#13000).** `bwd_diff` through two nested non-unrolled `[MaxIters]` loops gives wrong input gradients (`dx`) — silent on Vulkan/CPU, `CUDA_ERROR_ILLEGAL_ADDRESS` on CUDA — iff the bounds differ by ≥3 (`[ForceUnroll]` or equal bounds are fine; forward values and body weight grads are correct). In `slang-ir-autodiff-primal-hoist.cpp`, `getTypeForLocalStorage` (~:1572-1588) builds the checkpoint array **innermost-first** (each dim `IndexTrackingInfo::maxIters+1`, `getArrayType` wrapping a new outer dim per step), while `emitIndexed{Store,Load}AddressForVar` (~:1617-1672) peel **outermost-first** (`defBlockIndices` from `getAllAncestorRegions` is innermost-first). Each loop's state is sized by the sibling's bound: inner>outer → OOB, outer>inner → aliasing. Fix: reverse the fold order in `getTypeForLocalStorage` (single site; no-op for single/equal loops). Repro trap: the trigger needs a **checkpointed** per-iteration primal — an inline-constant weight creates no checkpoint, and a `no_diff`/custom-`[BackwardDerivativeOf]` accessor gives all-zero `dx`. Pass the weight as a differentiable input array read through a `[Differentiable]` helper and check `dpx.d`; reproduces on `-cpu` COMPARE_COMPUTE (`slangi` fails: `unimplemented: VM bytecode gen for inst`) ([nested `[MaxIters]` checkpoint dim/index transposition — target-independent reverse-mode IR-pass bug](../learnings/1789105256227-autodiff-nested-maxiters-loop-wrong-gradients-chec.md)).

**Inferred `MaxIters(0)` (PR #13993).** When `tryInferLoopMaxIterations` (`slang-check-stmt.cpp`) wrongly concludes zero trips it warns E30514 and attaches `InferredMaxItersAttribute(0)` → `IRLoopMaxItersDecoration`; primal-hoist undersizes the tape, so `bwd_diff` reads/writes OOB (cpu garbage varying per run, NaN on vk/cuda). Non-differentiable loops run fine (no emitter reads the decoration), so review trip-count changes with a runtime `bwd_diff` test. The mis-folded constants (#13954) behind the false zero, and why only a producer fix is safe: [[wiki/concepts/slang-language-core-integer-constant-folding.md]] [false zero-trip trip count corrupts reverse-mode autodiff](../learnings/1793223526256-slang-false-zero-trip-trip-count-corrupts-reverse-.md).

**Source learnings (30):**
- [Slang IR-pass diagnostics lose source locations](../learnings/1780328920397-slang-ir-pass-diagnostics-lose-source-locations-be.md)
- [Slang diagnostics.lua: changing a span's loc kind silently drops secondary message](../learnings/1780411224942-slang-diagnostics-lua-changing-a-span-s-loc-kind-s.md)
- [Locationless IR-pass diagnostics on imported-module structs: fix at emission, not key creation](../learnings/1780418999087-locationless-ir-pass-diagnostics-on-imported-modul.md)
- [Slang IR text dumper renders all IRParams identically](../learnings/1780729718385-slang-ir-text-dumper-renders-all-irparams-identica.md)
- [DeepWiki can be stale on cross-pass IR details](../learnings/1781472651294-deepwiki-can-be-stale-on-cross-pass-ir-details-dis.md)
- [Slang IR: re-point entry-point-identity decorations at a wrapper-swap site](../learnings/1781477381559-slang-ir-re-point-entry-point-identity-decorations.md)
- [Variable-arity IR insts round-trip within a compiler version](../learnings/1781569081341-variable-arity-ir-insts-round-trip-within-a-compil.md)
- [Slang parser-diagnostic gotchas](../learnings/1781826649693-slang-parser-diagnostic-gotchas-message-dedup-body.md)
- [Slang texture Sample offset is constexpr](../learnings/1782041019246-slang-texture-sample-offset-is-constexpr-wrappers-.md)
- [Adding an IR instruction requires bumping k_maxSupportedModuleVersion](../learnings/1782491129029-adding-an-ir-instruction-requires-bumping-k-maxsup.md)
- [New Slang IR opcode: stable-name registration + enum naming](../learnings/1782585186668-new-slang-ir-opcode-stable-name-registration-type-.md)
- [Concurrent ninja race; fork can overstep its task](../learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md)
- [send_message-to-self does not resume stopped sessions](../learnings/1781110850059-waking-your-own-agent-s-stopped-per-issue-sessions.md)
- [Discord per-message char limit is 2000](../learnings/1780404951139-discord-per-message-char-limit-is-2000.md)
- [Discord send_message enforces a 2000-char hard limit](../learnings/1781903378102-discord-send-message-enforces-a-2000-char-hard-lim.md)
- [a2a message transport HTML-escapes verbatim text](../learnings/1780473326506-a2a-message-transport-html-escapes-verbatim-text-d.md)
- [CONSOLIDATED: a2a messaging routing + self-edge loop](../learnings/1780558160000-CONSOLIDATED-a2a-messaging-routing-and-self-edge-loop.md)
- [Maintainer fork PR = confirm direction, don't assume upstream-it](../learnings/1781663826357-maintainer-propose-a-fix-if-none-exists-their-own-.md)
- [A scan-only agent fork can overreach into the full task](../learnings/1782203173377-a-scan-only-agent-fork-can-overreach-into-the-full.md)
- [Check last message timestamp vs last_active before escalating](../learnings/1782346077621-before-escalating-a-peer-s-ongoing-loop-claim-chec.md)
- [slang-mcp's Discord Gateway connection is LAZY](../learnings/legoop-project_slang_mcp_gateway_lazy.md)
- [#11917 gating: type-shape-keyed legalize passes are B/C-risky](../learnings/1783995257092-11917-gating-legalize-passes-keyed-on-type-shape-i.md)
- [On-demand builtin loading widens null-deref surface](../learnings/1784184038640-approver-gating-safety-on-demand-builtin-loading-c.md)
- [Lazy autodiff-module load (slang#12136) SIGSEGV on IDifferentiable-constrained types](../learnings/1784186366576-approver-gating-safety-lazy-autodiff-module-load-s.md)
- [SCCP aggregates as `Constant(inst)` break the `IRConstant` invariant](../learnings/1785338682203-sccp-marking-non-irconstant-aggregates-as-constant.md)
- [#11987 in-pass-scan does not transfer to shared-`legalizeTypes` wrappers](../learnings/1785373772506-11917-in-pass-scan-11987-template-does-not-transfe.md)
- [#13000 nested `[MaxIters]` checkpoint dim/index transposition](../learnings/1789105256227-autodiff-nested-maxiters-loop-wrong-gradients-chec.md)
- [False zero-trip trip count corrupts reverse-mode autodiff](../learnings/1793223526256-slang-false-zero-trip-trip-count-corrupts-reverse-.md) — `MaxIters(0)` undersizes tape; test `bwd_diff` at runtime
- [Late IR unsupported-shape checks must look through wrappers](../learnings/1793309934870-late-ir-unsupported-shape-checks-must-look-through.md) — `globalParams` keys lack sourceLoc; copy after the assert
- [Run a check for an optimizable shape late](../learnings/1793321156877-slang-ir-diagnostics-run-a-check-for-an-optimizabl.md) — same sourceLoc fix for `uniform` globals

_Catalog: [[wiki/index.md]]_
