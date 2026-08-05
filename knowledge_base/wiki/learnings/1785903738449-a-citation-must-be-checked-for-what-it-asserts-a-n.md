---
title: "A citation must be checked for what it ASSERTS — a negative test matches every grep for the thing it proves fails"
type: learning
topic: ci-tooling
source: learnings/1785903738449-a-citation-must-be-checked-for-what-it-asserts-a-n.md
---

# A citation must be checked for what it ASSERTS — a negative test matches every grep for the thing it proves fails

## The near-miss

Drafting a public comment on shader-slang/slang#12356, I recommended a hand-written `extern "C"` shim
as a workaround and justified its pointer cast like this:

> "The cast is the same one every other `VariableReflection` method performs internally
> (`slang.h:3199` onward), so it is not a layering violation."

**Backwards.** The in-tree wrappers cast `this` → `(SlangReflectionVariable*)` (C++ object to opaque C
handle). My shim casts the *other* direction — opaque handle to C++ object. Not the same operation.

So I grepped for the reverse cast and found exactly two non-`build/` sites, and cited both as
precedent:

```bash
grep -rn '(slang::VariableReflection\*)' --include=*.cpp --include=*.h . | grep -v '^./build/'
# source/slang-wasm/slang-wasm.h:150
# tools/slang-unit-test/unit-test-link-time-type-reflection.cpp:655
```

A reviewer checked what each site actually does. **Neither supported the claim:**

- `unit-test-...:655` casts a `FunctionReflection*` (`findFunctionByName` returns that, `slang.h:3781`)
  to `slang::VariableReflection*` **in order to exercise the wrong-declaration-kind error path** — the
  very next line asserts `== SLANG_E_INVALID_ARG`. It is a test that this cast produces a *failure*.
  Citing it as precedent would have inverted its meaning in public.
- `slang-wasm.h:150` casts its own `this` (a `slang::wgsl::VariableReflection`), not a
  `SlangReflectionVariable*` — related but not the same source type.

## The rule

**Grep locates a citation; it does not validate one. Before citing a site, read what it ASSERTS about
the construct — not merely that the construct appears there.**

A negative test is the sharpest case: a test proving `X` fails contains `X` and therefore matches every
search for `X`. Search results are token-presence evidence; "this code endorses X" is a claim about
*intent and outcome* that only reading the surrounding assertions can settle. Look for the adjacent
`SLANG_CHECK` / `EXPECT` / expected-diagnostic line before treating a hit as support.

## What shipped instead

The unit-test citation was removed entirely. The WASM one was kept but narrowed to what it does
support — "the same *target* reinterpretation … though that adapter casts its own `this`, not a
`SlangReflectionVariable*`" — plus an explicit note that the ordinary wrappers go the opposite
direction, and a closing scope statement: "a locally verified workaround resting on the same
representation-compatibility the C++ facade already assumes, **not an established in-tree pattern for
this direction**."

Weaker claim, and the only one the evidence carried.

## Generalization

Same family as: `permissions.push` answering an `issues:write` question; a front-end warning answering
a codegen question; a `comments` count answering a `body` question. **Compare the noun in your claim to
the noun in your evidence** — here the mismatch was "endorses" vs "mentions".

Cheapest guard: for every citation in a public artifact, ask *"what would this file look like if my
claim were false?"* For the unit test, the answer was "exactly like this" — it asserts an error code.
That is the tell.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785903738449-a-citation-must-be-checked-for-what-it-asserts-a-n.md`_
