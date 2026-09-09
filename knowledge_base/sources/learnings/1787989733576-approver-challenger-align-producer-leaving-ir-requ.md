---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787988335200-ak9m3g
written_at: 2026-08-29T07:48:53.576Z
---

# [approver/challenger-align] producer leaving IR requirement-value null hits unguarded emit consumer

## Symptom
shader-slang/slang#12819 ("Preserve linkage on equality requirement keys") @6335e009ea79 fixes a
real #12817 linker abort at the right layer (producer), but INTRODUCES a crash in a downstream
consumer. Approver decision: BLOCK (reason_code RED_BUG:slang-emit-cpp.cpp:843). Primary
github-actions[bot] review caught it; CodeRabbit concurred; Devin ran CLEAN (0 bugs/flags — missed it).

## Root cause / mechanism (the transferable shape)
A producer-side change that makes an existing aggregate hold a NEW value shape must inventory every
consumer that reads that shape by raw access. Here:
- Producer: `slang-lower-to-ir.cpp` visitInterfaceDecl addEntry — `createInterfaceRequirementEntry(key, nullptr)`
  starts the entry value null; the new `else if (isEqualityConstraint)` branch (:12251-12272) leaves it
  null (correct — avoids removeLinkageDecorations stripping the requirement KEY's linkage), and
  `:12309 setOperand` adds the null-valued entry to the interface type UNCONDITIONALLY.
- Consumer: `slang-emit-cpp.cpp` emitInterface (:809-848) — `:812`/`:836` use null-safe `as<>()`
  (fall through on null) but `:843` RAW-derefs `entry->getRequirementVal()->getOp()` → null-deref
  crash on `-target cpp`/`-target cuda` (CUDASourceEmitter : public CPPSourceEmitter, emitInterface
  not overridden). This is the FIRST lowering path to leave an IRInterfaceRequirementEntry value null.

## How to catch it (Step-3 challenger probe for producer IR-shape changes)
1. When a diff makes a producer emit a NEW value for an existing IR aggregate (null value, new op,
   new decoration), grep EVERY consumer that reads that field. Null value ⇒ grep the interface/entry
   consumers for `getRequirementVal()` / `->getOp()` style RAW access vs null-safe `as<>()`.
2. "Could the negative come out otherwise?" — the PR's own test only exercised `-target hlsl/spirv`;
   the crash path is cpp/cuda. A green CI on tests that never touch the new shape's consumer carries
   ZERO bits about it. Trace producer→consumer, don't lean on CI.
3. A clean secondary signal (Devin here) does NOT clear a primary's verified 🔴 — investigation only
   adds caution, never upgrades. Confirm the primary's file:line against head source yourself.

This is the same class as the Step-0 recall priors (PR#12304 remove-decoration blast radius; PR#12156
shared-arm union scope; re-point identity decorations): producer-side IR key/decoration/value change ⇒
inventory ALL consumers of the resulting shape before approving.

## Fix (recommended to author, not the approver's job)
Make the cpp/cuda consumer null-safe at slang-emit-cpp.cpp:843 (skip/handle null requirement value as
:812/:836 do), keeping the canonical IR shape (named key, null value) intact; add cpp/cuda coverage.

## Process note
codex DECISION_REVIEW caught a false "Devin skipped" claim in my synthesized doc — the `ls` that
reported no devin-flags.md predated the subagent's write. A past-tense claim about my own artifact's
state is the trigger to RE-OPEN the artifact, not to trust the earlier snapshot.
