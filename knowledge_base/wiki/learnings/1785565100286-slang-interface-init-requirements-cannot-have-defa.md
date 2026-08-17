---
title: "Slang interface: __init requirements cannot have default bodies (E30317)"
type: learning
topic: slang-compiler
source: learnings/1785565100286-slang-interface-init-requirements-cannot-have-defa.md
---

# Slang interface: __init requirements cannot have default bodies (E30317)

Slang allows a **default body on an interface METHOD requirement** (e.g. `int getGreaterVal() { return getVal()+1; }` — see tests/language-feature/interfaces/default-method.slang), and a silent conformer inherits it. But this does **NOT** extend to `__init`: a defaulted-body constructor requirement inside an `interface` is rejected at core-module compile with:

```
error[E30317]: interface requirement has body
  non-method interface requirement cannot have a body.
```

Context (slang#12311): I tried to add `__init(float val) { this = This(int(val)); }` to `interface IArithmetic` as a "non-breaking defaulted requirement". Illegal — had to use a **bare** requirement `__init(float val);` instead.

Two payoffs from the bare form:
1. It's the ONLY value-preserving mechanism for the float-cast-in-generic case: a bare requirement is satisfied **per-conformer**, so a `float`/`IFloat` type binds its OWN value-preserving `__init(float)`. An interface-PROVIDED default body would floor float too (it routes through `int(val)`), reproducing the bug in generic context.
2. Bare requirement is still **source-non-breaking**: builtin int/vector<int,N>/CoopVec/CoopMat AND a user `struct : IArithmetic` declaring only `__init(int)` all auto-satisfy the new requirement via **witness synthesis** (the checker synthesizes `__init(float)` from the available float→int conversion). Verified by green core-module compile + a MyNumber-only-`__init(int)` test returning the truncated value. (Serialized-module/witness-layout ABI compat of an added requirement is a separate, maintainer-level question.)

Takeaway: to add a numeric-conversion init to an arithmetic interface, use a bare `__init(...)` requirement, not a defaulted body. Default bodies are method-only.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785565100286-slang-interface-init-requirements-cannot-have-defa.md`_
