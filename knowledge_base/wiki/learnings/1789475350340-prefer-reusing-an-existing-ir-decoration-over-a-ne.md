---
title: "Prefer reusing an existing IR decoration over a new stable opcode; post-approve rebase dismisses approval"
type: learning
topic: slang-compiler
source: learnings/1789475350340-prefer-reusing-an-existing-ir-decoration-over-a-ne.md
---

# Prefer reusing an existing IR decoration over a new stable opcode; post-approve rebase dismisses approval

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-09-15T12:29:10.340Z
---

# Prefer reusing an existing IR decoration over a new stable opcode; post-approve rebase dismisses approval

From shader-slang/slang#12875 (bulk-copy AnyValue, maintainer @jvepsalainen-nv). Three reusable lessons:

**1. Maintainers prefer "make the fix smaller."** When you need a provenance marker on an IR inst, first ask whether an *existing* decoration on a *known single-producer* type can serve, before adding a new stable IR opcode. Here the fix originally added `AnyValueMarshalCastDecoration` (new opcode + stable-name entry + generated builder + `k_maxSupportedModuleVersion` bump + per-cast decorations). The maintainer asked to instead attach the *existing* `IRAnyValueSizeDecoration` to the concrete `AnyValueN` storage struct (produced in exactly one place, `ensureAnyValueType()`) and gate on `as<IRStructType>(result) && result->findDecoration<IRAnyValueSizeDecoration>()`. That dropped the opcode, stable-name, builder, and version bump entirely — same provenance boundary, ~13 fewer lines. A new stable opcode forces a `k_max` bump and a serialized-IR-version concern; reusing an existing decoration avoids all of it.

**2. Safety of "attach an existing decoration to a new type" is a TYPE-SPECIFIC argument, not a pass-ordering one.** My first rationale ("all existing readers run before the marshalling pass") was FALSE — `getInterfaceAnyValueSize` is called *inside* the marshalling file itself. codex OUTPUT_REVIEW caught it. The CORRECT, verifiable argument: check every call site of the decoration's readers and confirm the *argument type* is never the newly-marked type. Here all four `getInterfaceAnyValueSize` sites (slang-ir-layout.cpp + 3 in the marshalling file) pass an interface/associated-interface type, never the generated `AnyValueN` struct — so marking the struct is invisible to them regardless of pass order. Always verify reader call-site argument types at the source; don't hand-wave with ordering.

**3. NEVER rebase/force-push a branch after a maintainer APPROVE.** GitHub branch protection can dismiss stale approvals on new commits. If the approved branch is behind master, leave it — the maintainer's merge (squash / "update branch" button) handles it. Don't "helpfully" rebase a 60-behind approved PR; you'll bounce it back to needing re-review.

Bonus: a Windows GPU `test-slang` job showing `conclusion:failure` with EMPTY `steps:[]` and a generic "exit code 1" is almost always infra (the maintainer here confirmed it was the `Common Test Setup` step), not a code regression — especially when your change is target-gated away from that backend. Rerun (`gh run rerun <id> --failed`), don't chase it as a code bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789475350340-prefer-reusing-an-existing-ir-decoration-over-a-ne.md`_
