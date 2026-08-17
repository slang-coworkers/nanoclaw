---
title: "Slang IR Passes, Diagnostics, and Tooling"
type: concept
group: slang-autodiff-ir
tags: [ir-passes, diagnostics, source-locations, ir-instructions, optimization, serialization, parser, tooling, agent-operations]
source_count: 22
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

## IR Pass Diagnostics: Source Location Loss

Warnings emitted from IR passes (e.g. E41021 `field-not-default-initialized`, E31106/E31107 parameter-group leaks) sometimes print with no `file:line`. The rich-diagnostics renderer silently omits `file:line` and the code snippet when the resolved `SourceLoc` has `line == 0` — no assert, no fallback ([Slang IR-pass diagnostics lose source locations because struct keys inherit IRBuilder's incidental loc](wiki/learnings/1780328920397-slang-ir-pass-diagnostics-lose-source-locations-be.md)).

Root cause: IR instructions are often synthesized, legalized, or link-time-cloned and carry an empty `sourceLoc`. Struct keys created by `lowerMemberVarDecl` via `builder->createStructKey()` never assign the key's `sourceLoc` from `fieldDecl->loc` and inherit whatever the `IRBuilder` incidentally holds at that moment — populated in simple single-file lowering, empty in complex linked/specialized paths.

Fixing the key at creation is a dead end for the imported-module case ([Locationless IR-pass diagnostics on imported-module structs: fix at emission, not key creation](wiki/learnings/1780418999087-locationless-ir-pass-diagnostics-on-imported-modul.md)): when a struct is deserialized from a precompiled `.slang-module`, its keys carry no source location resolvable in the consuming compile, and the consumer-side lowering never re-touches them. The correct fix is at the **diagnostic emission site**: give the diagnostic an explicit `.location` span, and fall back to a use-site location via `findFirstUseLoc(type_or_func)` when the originating inst's loc is invalid. `findFirstUseLoc` walks uses for the first one with a valid `sourceLoc`, so it recovers the common consumer-side case but is not a hard guarantee. A regression test must precompile a module and import it — a single-file test cannot reproduce the loss.

The "can't reproduce with a small shader" behavior is a tell for this bug class: simple repros trigger the IRBuilder's incidental position (correct location shown), while the complex/imported path does not.

## slang-diagnostics.lua: Dropped Secondary Messages

In `source/slang/slang-diagnostics.lua`, when editing a diagnostic's `span { ... }` to change its `loc` kind (e.g. `loc = "member:IRInst"` → `loc = "location"`), it is easy to accidentally drop the `message =` field ([Slang diagnostics.lua: changing a span's loc kind silently drops its secondary message](wiki/learnings/1780411224942-slang-diagnostics-lua-changing-a-span-s-loc-kind-s.md)). This silently removes the secondary annotation for every case — no CI failure, because no FileCheck pattern asserts on span label text. The fix when unintentional is to restore `message =` to the relocated span; a `loc = "location"` span can still carry a `message` (see existing usages). Observed on PR #11424 (E31107): three independent review passes all converged on the dropped `"This member will leak into a separate binding slot."` annotation.

## IR Text Dumper: IRParams Are Invisible

`dumpInstExpr` in `source/slang/slang-ir.cpp:7858-7971` renders every `IRParam` as the bare `param` keyword with no SSA id and no operand list, regardless of whether the param is in-block or orphan ([Slang IR text dumper renders all IRParams identically — orphan-vs-attached invisible from text](wiki/learnings/1780729718385-slang-ir-text-dumper-renders-all-irparams-identica.md)). The user-visible text dump cannot prove or refute "orphan IRParam" or "null parent/null type" claims. To prove the mechanism, use: a debugger break at the suspected null-deref site; a temporary patch printing `_debugUID` and `getParent() != nullptr`; or `extras/insttrace.py <debugUID>`. The text dump is sufficient for pass-level signature deltas (e.g. "value param re-typed `Array → Ptr` at pass 057") but not for exact internal IRParam shape.

## DeepWiki Staleness on Cross-Pass IR Details

When DeepWiki and source reading disagree on a cross-pass IR detail, trust the source reading and use observed runtime/codegen behavior as a third witness ([DeepWiki can be stale on cross-pass IR details — disambiguate with observed behavior](wiki/learnings/1781472651294-deepwiki-can-be-stale-on-cross-pass-ir-details-dis.md)). On #11606 (Metal hoisted uniform dropped on composite-output vertex shaders), DeepWiki claimed `IREntryPointParamDecoration` is *removed* before the Metal wrapper is created; source reading showed it *survives*, naming the original (now non-entry) function. The symptom broke the tie: a removed decoration would cause the param to bind to all entry points (added), not dropped; dropped ⟹ non-null-mismatched ⟹ decoration survives. DeepWiki is reliable for architecture/flow orientation but not for "is this decoration removed here" precision.

## Entry-Point-Identity Decorations at Wrapper Swaps

When a pass replaces an entry point with a wrapper `IRFunc` (e.g. `legalizeVertexShaderOutputParamsForMetal`), any decoration that **records entry-point identity** must be manually re-pointed to the wrapper — `transferFunctionDecorations` only copies decorations sitting on the old func ([Slang IR: re-point entry-point-identity decorations at a wrapper-swap site](wiki/learnings/1781477381559-slang-ir-re-point-entry-point-identity-decorations.md)). Concretely, `IREntryPointParamDecoration(globalParam, entryPointFunc)` lives on the global param with the func as an operand; after the swap the operand stills names the old func, causing consumers to silently drop the uniform.

Fix at the swap site: use `traverseUses(inst, cb)` / `traverseUsers<I>(inst, cb)` (they snapshot the use list before mutating) and `IRUse::set(newFunc)`. Assert the decoration's single-operand invariant. Do NOT band-aid the consumer to tolerate stale identity, and do NOT use `replaceUsesWith` (self-recurse onto the wrapper's call to the original func).

Test note: `//TEST:SIMPLE(filecheck=METAL)` tests are silently ignored when LLVM FileCheck is not installed locally — verify CHECK logic by emulating with `slangc -target metal | grep -E`. Metal buffer-slot CHECKs escape attribute brackets: `{{\[\[}}buffer(0){{\]\]}}`.

## Variable-Arity IR Instructions and Serialization

`source/slang/slang-serialize-ir.cpp` stores `operandCount = inst->operandCount` per instruction and reads exactly that many back — so a fewer-operand inst serializes and deserializes faithfully **within the same compiler version** ([Variable-arity IR insts round-trip within a compiler version (serialize stores per-inst operandCount)](wiki/learnings/1781569081341-variable-arity-ir-insts-round-trip-within-a-compil.md)). The "misparse during deserialize" concern is factually wrong; there is no in-version break. The real concern is cross-version forward-compat: an older compiler loading a module with the shorter form will deserialize it correctly but may hit an unguarded accessor (e.g. bare `getOperand(1)`) at emit time — a legitimate maintainer-policy question, not a proven build bug.

Also, `min_operands` in `slang-ir-insts.lua` is generator-metadata only — no validator in `source/slang` or `source/compiler-core` enforces it (grep confirms only the `.lua` references it), so a stale `min_operands` value is misleading-but-harmless metadata.

## Adding a New IR Instruction: Two Required Follow-ups

Adding a new IR opcode to `source/slang/slang-ir-insts.lua` requires two follow-ups that silently break the build if missed ([New Slang IR opcode: stable-name registration + type-vs-key enum naming](wiki/learnings/1782585186668-new-slang-ir-opcode-stable-name-registration-type-.md)):

1. **Stable-name registration:** every leaf opcode needs an entry in `slang-ir-insts-stable-names.lua` or FIDDLE codegen aborts with `fatal error 400002: Instruction is missing stable name: <StructName>`. The key is the lua `full_path` — for a type opcode nested in `Type` it is `Type.<key>`; for a top-level ordinary/cast op it is the bare `<key>`. Assign the next unused integer and APPEND only (never renumber — values are serialized-IR ABI).

2. **Enum naming differs for types vs. ordinary ops:** for a **type** opcode the C++ enum is `kIROp_<struct_name>`, not `kIROp_<luaKey>`. E.g. `DescriptorHandle = { struct_name = "DescriptorHandleType" }` generates `kIROp_DescriptorHandleType`. For ordinary/value opcodes the key equals the struct_name. Mixing these compiles silently past the source stage but fails only after FIDDLE generation.

Any PR adding a new IR instruction — including a no-operand decoration — must also increment `k_maxSupportedModuleVersion` in `source/slang/slang-ir.h` by exactly one ([Adding an IR instruction requires bumping k_maxSupportedModuleVersion (slang-ir.h)](wiki/learnings/1782491129029-adding-an-ir-instruction-requires-bumping-k-maxsup.md)). The policy is documented above the constant. The repo bot `slangbot` posts a `<!-- slang-ir-version-check -->` comment on any PR touching IR-inst files — treat it as actionable. Finding who last bumped the value: use `git log -G 'k_maxSupportedModuleVersion = 22'` (regex, any-line-change), not `git log -S` (which counts string occurrences and misses value-only edits).

## Parser Diagnostics: Dedup, Body-Phase Suppression, DIAGNOSTIC_TEST Mechanics

Three non-obvious behaviors from fixing shader-slang/slang#11664 ([Slang parser-diagnostic gotchas: message dedup, body-phase error suppression, DIAGNOSTIC_TEST exhaustive rows](wiki/learnings/1781826649693-slang-parser-diagnostic-gotchas-message-dedup-body.md)):

1. **Dedup:** a diagnostic with no per-instance content is collapsed across occurrences (same code + message). Always interpolate an instance-specific token (e.g. `~op`) so distinct errors produce distinct messages.

2. **Body-phase suppression:** a declaration-header parse error suppresses function-body-phase errors. Don't mix a parameter-error case and a local-variable-error case in one diagnostic-test file expecting both — use a global variable (same `CompleteVarDecl` code path, header phase) alongside the param.

3. **DIAGNOSTIC_TEST mechanics:** runs `slangc <file> -enable-machine-readable-diagnostics` (no target/entry; front-end only). With `diag=` set, the harness uses inline `//PREFIX:` annotations and ignores `.expected` files. Exhaustive mode (default) requires every emitted diagnostic row to be matched. A single error emits TWO rows: the primary (short title) and a span row (span message); the span row is only deduped if its message equals the title. So most errors need TWO `//PREFIX:` lines.

## Texture Sample Offset: Constexpr Propagation

`_Texture.Sample(SamplerState, location, offset)` declares `offset` as `constexpr` in `hlsl.meta.slang` — it must be a compile-time constant to lower to an immediate `ConstOffset` image operand ([Slang texture Sample offset is constexpr; wrappers must forward it as constexpr](wiki/learnings/1782041019246-slang-texture-sample-offset-is-constexpr-wrappers-.md)). A wrapper method that forwards `offset` as a runtime parameter gets `E40013: argument is not a compile-time constant`. Fix: mark the wrapper's `offset` parameter `constexpr` too. `[ForceInline]` does NOT fix it — the constexpr check happens during semantic analysis before inlining. The core-module-reference renders the `Sample` signature WITHOUT the `constexpr` qualifier on `offset`, which is why users expect a plain forward to type-check.

## Build: Concurrent Ninja Race

Running two `cmake --build`/ninja invocations on the same build directory races destructively ([Concurrent ninja on one build dir → transient ranlib 'No such file' race; fork (no subagent_type) can overstep its task](wiki/learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md)). Symptom: `FAILED: .../libSPIRV-Tools-opt.a` with `ranlib: '...libSPIRV-Tools-opt.a': No such file`. The archive exists afterward; the edge is just marked failed and ninja stops. Recovery: confirm no ninja is running (`pgrep -af 'ninja -f build-Debug'`), then run a serial incremental rebuild. This is transient — not disk-full.

Also: `Agent(prompt=...)` forks without `subagent_type` inherit full context and all tools and may run the entire parent task rather than a narrow scan sub-step. For strictly read-only recall/scan, add an explicit "do NOT modify files or launch builds; return findings to me only" guardrail, or use the `Explore` subagent type ([Concurrent ninja on one build dir → transient ranlib 'No such file' race; fork (no subagent_type) can overstep its task](wiki/learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md)).

## Agent Operational Patterns

**Scan-only forks can overreach:** When dispatching an `Agent` fork for a narrow read-only sub-step, explicitly cap it with "Read-only. Return findings to ME only. Do NOT send_message, do NOT append_learning." A fork that inherits full context may run the complete parent task and report directly upstream, creating a provenance hazard ([A scan-only Agent fork can overreach into the full task and message the parent](wiki/learnings/1782203173377-a-scan-only-agent-fork-can-overreach-into-the-full.md)).

**Waking stopped per-issue sessions via send_message-to-self does not work:** `target_session_id`-pinned dispatches to your own agent group do not reliably restart a stopped container ([Waking your own agent's stopped per-issue sessions via send_message-to-self does not resume them](wiki/learnings/1781110850059-waking-your-own-agent-s-stopped-per-issue-sessions.md)). For work across many historical sessions, do it directly in the current session using `gh`, or have the chain parent re-dispatch. Verify success against the external artifact (e.g. GitHub label event history), not session replies.

**Before escalating a peer loop claim, check last message timestamp:** `last_active` is heartbeat-only (a periodic file touch), not proof of message processing ([Before escalating a peer's 'ongoing loop' claim, check last MESSAGE timestamp vs last_active (heartbeat)](wiki/learnings/1782346077621-before-escalating-a-peer-s-ongoing-loop-claim-chec.md)). A session showing `running`/`last_active` ~now but whose last actual message is hours old is an already-dead loop. Diagnose with `ncl sessions messages <id>` and compare message timestamp to `last_active` before escalating. If you can't read the session (different group/scope), relay the claim as UNVERIFIED.

**a2a message transport HTML-escapes verbatim text:** when routing a verbatim GitHub-comment body through an a2a `send_message` to a GitHub-capable coworker, the message transport HTML-escapes special characters (`"`→`&quot;`, `>`→`&gt;`, `<`→`&lt;`), which can arrive double-escaped ([a2a message transport HTML-escapes verbatim text — decode before posting to GitHub](wiki/learnings/1780473326506-a2a-message-transport-html-escapes-verbatim-text-d.md)). The posting coworker must decode HTML entities before posting, then verify the live comment via `github_get_issue`.

**Maintainer fork PR does not satisfy "propose a fix if none exists":** a maintainer's fork PR is exploration, not necessarily the artifact they want landed ([Maintainer 'propose a fix if none exists' + their own fork PR = confirm direction, don't assume upstream-it](wiki/learnings/1781663826357-maintainer-propose-a-fix-if-none-exists-their-own-.md)). Report the existence finding with nuance and let the parent/maintainer pick between upstream-the-fork-PR, independent fix, or defer. Don't open a competing PR before that call.

**slang-mcp Discord Gateway is lazy:** `init_discord_client()` in `container/mcp-servers/slang-mcp/src/discord/discord.py:338` is not called at server startup — it fires only when a Discord tool is invoked ([slang-mcp's Discord Gateway connection is LAZY — init_discord_client() only fires when a Discord tool is invoked. After slang-mcp respawn, no live MESSAGE_CREATE events flow until first tool call.](wiki/learnings/legoop-project_slang_mcp_gateway_lazy.md)). After slang-mcp respawns, no live `MESSAGE_CREATE` events flow until the first tool call. Trigger manually by sending a chat to `slang-discord-support` asking it to call `discord_read_messages` once.

**a2a self-edge and empty-ack loops:** consolidated details on reply routing rules, self-edge root cause, detection, mitigation, and stand-down protocol are in [CONSOLIDATED: a2a messaging — reply routing rules + self-edge/empty-ack loop incident](wiki/learnings/1780558160000-CONSOLIDATED-a2a-messaging-routing-and-self-edge-loop.md).

## Discord Character Limit

Discord's API enforces a hard 2000-character limit on message `content` ([Discord per-message char limit is 2000](wiki/learnings/1780404951139-discord-per-message-char-limit-is-2000.md), [Discord send_message enforces a 2000-char hard limit](wiki/learnings/1781903378102-discord-send-message-enforces-a-2000-char-hard-lim.md)). The MCP server does not auto-split. For long technical answers, pre-split into ≤2000-char messages and put feedback buttons on the final message only. Budget conservatively: emoji and inline GitHub URLs each consume characters.


## Recent operational learnings (incremental fold 2026-07-17)

**[approver/gating-safety] On-demand builtin loading can widen a null-deref surface when a fix swaps decl-owned state for context-owned state** — **Symptom:** slang#12136 ("Load autodiff builtins on demand") splits diff.meta.slang into a lazily-loaded supplement. [[approver/gating-safety] On-demand builtin loading can widen a null-deref surface when a fix swaps decl-owned state for context-owned state](wiki/learnings/1784184038640-approver-gating-safety-on-demand-builtin-loading-c.md)

**[approver/gating-safety] Lazy autodiff-module load (slang#12136) crashes on IDifferentiable-CONSTRAINED types with no trigger — gap#1 is real (SIGSEGV), not advisory** — **PR:** slang#12136 "Load autodiff builtins on demand" (jvepsalainen-nv, issue-12113). [[approver/gating-safety] Lazy autodiff-module load (slang#12136) crashes on IDifferentiable-CONSTRAINED types with no trigger — gap#1 is real (SIGSEGV), not advisory](wiki/learnings/1784186366576-approver-gating-safety-lazy-autodiff-module-load-s.md)

---
## #11917 Type-Shape-Keyed Legalize Passes Are B/C-Risky (2026-07-14 fold)

Gating `legalizeEmptyArray`/`legalizeVectorTypes`/`legalizeUniformBufferLoad` on an up-front IntLit-dimension scan is unsafe: `generateAnyValueMarshallingFunctions` synthesizes 1-vectors *in-window* (between the calc scan and the pass), so a presence scan that ran earlier misses them — no naive gate is safe for this family ([#11917 gating: legalize passes keyed on type shape are B/C-risky](wiki/learnings/1783995257092-11917-gating-legalize-passes-keyed-on-type-shape-i.md)).

**SCCP: a new *kind* of lattice value must audit the invariant's full blast radius, not just the changed lines.** Teaching global-scope SCCP to fold aggregate constructors by marking `MakeVector`/`MakeVectorFromScalar` as `LatticeVal::getConstant(inst)` ("constant as itself") silently breaks a pass-wide invariant: every scalar evaluator (`evalCast`, `evalBitCast`, `evalNeg`, `evalBinaryImpl`, …) does `as<IRConstant>(v.value)` and dereferences the result **without a null check**. `bit_cast` (vector operand → scalar result) slips the vector-result fold gate and null-derefs in `evalBitCast`; repro `static const uint u = bit_cast<uint>(uint16_t2(1,2));`. Principled fix: document at `getConstant` that a `Constant` may now wrap a self-referential aggregate and guard-or-assert-scalar EVERY `as<IRConstant>` site ([SCCP marking non-IRConstant aggregates as Constant(inst) breaks the pass-wide IRConstant invariant](wiki/learnings/1785338682203-sccp-marking-non-irconstant-aggregates-as-constant.md)). Extending the #11917 gating theme above: the #11987 "in-pass shallow scan at pass entry" early-out does **NOT** transfer from the standalone `legalizeMatrixTypes` (whose scan blind-spot matches its own IRGeneric bail) to `legalizeEmptyTypes`/`legalizeResourceTypes`, which are thin wrappers over the SHARED `legalizeTypes()` framework with no such bail — use a conservative force-run when any unspecialized IRGeneric remains, added per-context (never in the shared `processModule`), and key the scan on the pass's OWN `isSpecialType` predicate so it is a provable superset of everything the pass mutates ([#11987 in-pass-scan template does NOT transfer to shared-legalizeTypes passes](wiki/learnings/1785373772506-11917-in-pass-scan-11987-template-does-not-transfe.md)).

**Source learnings (26):**
- [Slang IR-pass diagnostics lose source locations](wiki/learnings/1780328920397-slang-ir-pass-diagnostics-lose-source-locations-be.md)
- [Slang diagnostics.lua: changing a span's loc kind silently drops secondary message](wiki/learnings/1780411224942-slang-diagnostics-lua-changing-a-span-s-loc-kind-s.md)
- [Locationless IR-pass diagnostics on imported-module structs: fix at emission, not key creation](wiki/learnings/1780418999087-locationless-ir-pass-diagnostics-on-imported-modul.md)
- [Slang IR text dumper renders all IRParams identically](wiki/learnings/1780729718385-slang-ir-text-dumper-renders-all-irparams-identica.md)
- [DeepWiki can be stale on cross-pass IR details](wiki/learnings/1781472651294-deepwiki-can-be-stale-on-cross-pass-ir-details-dis.md)
- [Slang IR: re-point entry-point-identity decorations at a wrapper-swap site](wiki/learnings/1781477381559-slang-ir-re-point-entry-point-identity-decorations.md)
- [Variable-arity IR insts round-trip within a compiler version](wiki/learnings/1781569081341-variable-arity-ir-insts-round-trip-within-a-compil.md)
- [Slang parser-diagnostic gotchas: message dedup, body-phase error suppression, DIAGNOSTIC_TEST mechanics](wiki/learnings/1781826649693-slang-parser-diagnostic-gotchas-message-dedup-body.md)
- [Slang texture Sample offset is constexpr; wrappers must forward it as constexpr](wiki/learnings/1782041019246-slang-texture-sample-offset-is-constexpr-wrappers-.md)
- [Adding an IR instruction requires bumping k_maxSupportedModuleVersion](wiki/learnings/1782491129029-adding-an-ir-instruction-requires-bumping-k-maxsup.md)
- [New Slang IR opcode: stable-name registration + type-vs-key enum naming](wiki/learnings/1782585186668-new-slang-ir-opcode-stable-name-registration-type-.md)
- [Concurrent ninja on one build dir → transient ranlib race; fork can overstep its task](wiki/learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md)
- [Waking your own agent's stopped per-issue sessions via send_message-to-self does not resume them](wiki/learnings/1781110850059-waking-your-own-agent-s-stopped-per-issue-sessions.md)
- [Discord per-message char limit is 2000](wiki/learnings/1780404951139-discord-per-message-char-limit-is-2000.md)
- [Discord send_message enforces a 2000-char hard limit](wiki/learnings/1781903378102-discord-send-message-enforces-a-2000-char-hard-lim.md)
- [a2a message transport HTML-escapes verbatim text](wiki/learnings/1780473326506-a2a-message-transport-html-escapes-verbatim-text-d.md)
- [CONSOLIDATED: a2a messaging — reply routing rules + self-edge/empty-ack loop incident](wiki/learnings/1780558160000-CONSOLIDATED-a2a-messaging-routing-and-self-edge-loop.md)
- [Maintainer 'propose a fix if none exists' + their own fork PR = confirm direction, don't assume upstream-it](wiki/learnings/1781663826357-maintainer-propose-a-fix-if-none-exists-their-own-.md)
- [A scan-only agent fork can overreach into the full task and message the parent](wiki/learnings/1782203173377-a-scan-only-agent-fork-can-overreach-into-the-full.md)
- [Before escalating a peer's ongoing loop claim, check last message timestamp vs last_active](wiki/learnings/1782346077621-before-escalating-a-peer-s-ongoing-loop-claim-chec.md)
- [slang-mcp's Discord Gateway connection is LAZY](wiki/learnings/legoop-project_slang_mcp_gateway_lazy.md)
- [#11917 gating: legalize passes keyed on TYPE SHAPE (IntLit dims) are B/C-risky — in-window any-value marshalling synthesizes 1-vectors](wiki/learnings/1783995257092-11917-gating-legalize-passes-keyed-on-type-shape-i.md)
- [[approver/gating-safety] On-demand builtin loading can widen a null-deref surface when a fix swaps decl-owned state for context-owned state](wiki/learnings/1784184038640-approver-gating-safety-on-demand-builtin-loading-c.md)
- [[approver/gating-safety] Lazy autodiff-module load (slang#12136) crashes on IDifferentiable-CONSTRAINED types with no trigger — gap#1 is real (SIGSEGV), not advisory](wiki/learnings/1784186366576-approver-gating-safety-lazy-autodiff-module-load-s.md)
- [SCCP: marking aggregates as `Constant(inst)` breaks the pass-wide `IRConstant` invariant — every `as<IRConstant>(v.value)` null-derefs (bit_cast vector→scalar repro); guard ALL sites, not the one that broke](wiki/learnings/1785338682203-sccp-marking-non-irconstant-aggregates-as-constant.md)
- [#11917: #11987 in-pass-scan early-out does NOT transfer to shared-`legalizeTypes` wrappers — per-context guard + conservative generic force-run; key the scan on the pass's own `isSpecialType` (safe superset)](wiki/learnings/1785373772506-11917-in-pass-scan-11987-template-does-not-transfe.md)

_Catalog: [[wiki/index.md]]_
