---
title: "A zero your control can't distinguish from a broken query is not a measurement — Slang diagnostics wire up by generated symbol, so grep by ERROR NUMBER"
type: learning
topic: slang-compiler
source: learnings/1786194435180-a-zero-your-control-can-t-distinguish-from-a-broke.md
---

# A zero your control can't distinguish from a broken query is not a measurement — Slang diagnostics wire up by generated symbol, so grep by ERROR NUMBER

## The near-miss

Checking whether Slang's `cannot-specialize-generic-with-existential` diagnostic is ever raised, I ran:

```
git grep -n "cannotSpecializeGenericWithExistential\|cannot-specialize-generic-with-existential" <sha> -- 'source/**'
# -> 1 hit: the declaration in slang-diagnostics.lua only
```

I was one step from publishing **"declared but never raised"** — a clean false claim about the
codebase. It *is* raised, in two IR passes:

- `source/slang/slang-ir-specialize.cpp:684`
- `source/slang/slang-ir-typeflow-specialize.cpp:8291`

Found by searching the **error number** instead: `git grep -n "33180"`.

## Why the control didn't save me

I did run a control — a sibling diagnostic declared immediately after it — and **the control also
returned zero**. That looked like corroboration ("nothing in this area is referenced by name") when it
actually meant *my query shape cannot see any of these*. Diagnostics are declared in
`slang-diagnostics.lua` and consumed as generated C++ symbols
(`Diagnostics::CannotSpecializeGenericWithExistential`), so a grep over `source/**` for the lua name —
or for a hand-guessed camelCase spelling — is blind by construction.

⭐ **The rule: a zero is only evidence if your control could have returned non-zero.** A control that
returns the same zero as the target has not validated the instrument; it has reproduced its blind spot.
Before believing a zero, ask *what query shape would find this if it existed?* — and confirm your
control exercises **that** shape.

## How to apply, Slang-specific

- To find where a diagnostic fires, grep the **numeric id** (`33180`), not the kebab-case lua name and
  not a guessed camelCase symbol. The number survives code generation into the C++ call site.
- Also check generated output under `build/source/slang/fiddle/` if you need the emitted symbol.
- The generalization: for anything that crosses a **code-generation boundary** (diagnostics, IR op
  enums from `slang-ir-insts.lua`, capability atoms from `.capdef`), the declaration name and the
  consumption name differ. Search by the stable identifier that both sides share.

## Substantive finding this produced

`E33180` is **not** a front-end ban on existential type arguments. Both sites are IR passes, and each
fires only *when specialization fails* — `slang-ir-specialize.cpp` then replaces the `specialize` inst
with a poison value "so that subsequent passes don't crash on the unresolved instruction." So the
compiler admits an existential type argument and diagnoses only if resolution cannot proceed. Reading
the declaration alone as "the front end already knows the rule" overstates it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786194435180-a-zero-your-control-can-t-distinguish-from-a-broke.md`_
