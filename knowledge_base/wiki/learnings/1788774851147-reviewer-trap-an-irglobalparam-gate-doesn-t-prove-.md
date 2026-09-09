---
title: "Reviewer trap: an IRGlobalParam gate doesn't prove a getTypeNameHint reflection side-effect is 'non-manifesting'"
type: learning
topic: review-process
source: learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md
---

# Reviewer trap: an IRGlobalParam gate doesn't prove a getTypeNameHint reflection side-effect is "non-manifesting"

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788756306912-tt12ar
written_at: 2026-09-07T09:54:11.147Z
---

# Reviewer trap: an IRGlobalParam gate doesn't prove a getTypeNameHint reflection side-effect is "non-manifesting"

## Context
Adding a `getTypeNameHint` case flips a previously-empty hint to non-empty, which makes `addUserTypeHintDecorations` (`slang-ir-user-type-hint.cpp`) emit a `-fspv-reflect` `UserTypeGOOGLE` decoration where none existed before. On shader-slang/slang#12922 (naming six opaque builtins) this was flagged, then wrongly dismissed as "non-manifesting," then re-confirmed as real.

## The trap
`addUserTypeHintDecorations` is gated on `as<IRGlobalParam>(globalInst)` — it only decorates surviving `IRGlobalParam`s. It is tempting to reason "these types are local value types / get lowered away, so they never reach it → non-manifesting." That gate is **necessary but not sufficient**. You must check whether the type can **survive to emission as an IRGlobalParam**, and craft the repro to exercise that survival path — not a path that lowers it away.

## Concrete
- A **used** global `RayQuery` (e.g. `RayFlags()`/traced) lowers to SPIR-V query ops and the global is copied into a **local** before the reflection pass → **no** `UserTypeGOOGLE` (suppressed). A repro that uses the query will wrongly show "non-manifesting."
- An **unused** global `RayQuery` passed to a `[noinline]` fn, `-emit-spirv-directly`, **survives** as an `IRGlobalParam` → emits `OpDecorateString %globalQuery UserTypeGOOGLE "rayquery:<0>"`. This is the manifesting case.
- `DescriptorHandle<T>` globals fold into the GlobalParams/parameter cbuffer before emission (decoration discarded) → genuinely no reflection string; a `Texture2D` global is the control that does emit one.

## Reviewer lessons
1. Don't confirm a peer's "non-manifesting" claim from a static gate + a single repro — verify the repro exercises the **survival** path (unused, not lowered-away), or say "unverified" rather than confirming.
2. The effect here is real but **use-dependent and additive/benign**: a descriptive reflection string replaces an absent one; no binding added/dropped/moved. So it's a documentation/optional-test item, not a bug or blocker — but it IS user-observable and should be described in the PR blast-radius, and (once shown to manifest) a small positive `-fspv-reflect` regression test asserting the intended string is reasonable.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md`_
