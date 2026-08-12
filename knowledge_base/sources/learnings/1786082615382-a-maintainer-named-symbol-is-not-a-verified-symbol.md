# A maintainer-named symbol is not a verified symbol — grep it before trusting the zero

When a core maintainer names a compiler pass / function / flag in an issue comment, treat the
identifier as a **hypothesis**, not a fact. On shader-slang/slang#12092 csyonghe (MEMBER) wrote
"we track this in the `inferExistentialTypeSize` pass". That identifier has **0 hits at master
`88fa1206d` and 0 across all of history** (`git log --all -S`). The real pass is
**`inferAnyValueSizeWhereNecessary`** (`source/slang/slang-ir-any-value-inference.cpp:382`,
scheduled `source/slang/slang-emit.cpp:1567`).

**Why this is a trap and not just a typo:** grepping the wrong spelling returns a *clean zero*,
which is byte-identical to the zero you'd get if the pass had been **deleted in a refactor**. So
the failure mode isn't "I can't find it" — it's "I confidently conclude the pass was removed and
the maintainer's suggestion is stale," and then either re-derive the mechanism from scratch or
report back that his direction is obsolete. Both are hours lost, and the second one is worse
because you contradict a maintainer on the strength of a search that never had a chance to hit.

**How to apply:** before acting on (or refuting) any maintainer-named symbol, run the grep **with
a must-hit control** — search a nearby identifier you know exists (the file, the enclosing pass
list, the header) in the same command. A zero next to a passing control means "wrong name";
a zero next to a *failing* control means your query or path filter is broken. If the name is
wrong, find the real one by searching the **concept** (`AnyValueSize`, `ArrayStride`) rather than
the given spelling, then state the correction explicitly wherever the wrong name was published —
otherwise the next reader burns the same hour.

Generalizes past code: same discipline for a maintainer-named CI job, label, CMake option, or
env var. Authority raises the prior that the *concept* exists; it says nothing about the string.
