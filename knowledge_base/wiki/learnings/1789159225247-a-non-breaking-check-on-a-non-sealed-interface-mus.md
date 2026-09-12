---
title: "A 'non-breaking' check on a non-[sealed] interface must cover the open user-conformer set, not just in-tree conformers"
type: learning
topic: misc
source: learnings/1789159225247-a-non-breaking-check-on-a-non-sealed-interface-mus.md
---

# A 'non-breaking' check on a non-[sealed] interface must cover the open user-conformer set, not just in-tree conformers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1785557987023-3ndlcl
written_at: 2026-09-11T20:40:25.247Z
---

# A 'non-breaking' check on a non-[sealed] interface must cover the open user-conformer set, not just in-tree conformers

**Context:** shader-slang/slang#12311 / PR #12312. A `(T)0.25` cast in a generic body `T:IArithmetic` floored to 0 because `IArithmetic` declares `__init(int)` and no `__init(float)`. The proposed fix added an `__init(float)` **requirement** to `IArithmetic`. A differential slangi run over every in-tree conformer showed no breakage, so both the triager and orchestrator signed it off as "non-breaking in practice."

**Why that was wrong (maintainer tangent-vector caught it):** `IArithmetic`/`IFloat`/`IComparable` are **non-`[sealed]`** interfaces (only `IArithmeticAtomicable` is sealed). A non-sealed interface admits the *open* set of user-defined conformers — not just the types in the core module. For a user arithmetic type that isn't integer-like (a fixed-point or rational `struct : IArithmetic` with only `__init(int)`), the new requirement would **synthesize its witness through the existing `__init(int)`** and silently truncate `(T)0.25`→0 — trading the reported silent-wrong-result for a *fresh* one in user code. The in-tree `struct MyNumber : IArithmetic {__init(int)}` test we cited as proof-of-non-breaking was itself the footgun.

**Durable rules:**
1. To clear an interface-shape change (especially adding a **requirement**) as non-breaking, reason about the OPEN set of user conformers — an in-tree-only differential run measures the right cells over the wrong population. Sealedness is the gate: for a non-`[sealed]` interface you cannot enumerate conformers, so "no in-tree breakage" is not "non-breaking."
2. For a requirement whose witness can be **auto-synthesized** (e.g. from an existing `__init(int)`), "it compiles" ≠ "it's correct" — the synthesized witness can be silently wrong.
3. Preferred remedy for this class: an **`extension<T> where T:IArithmetic { __init(float) }` that diagnoses a compile error** (fail loudly with guidance) rather than a new requirement — an extension member is not a conformance requirement, so it doesn't touch user conformance. Evolve the real interfaces in the experimental module (`slang.numerics`) where breaking changes are cheap.

**Outcome:** PR rejected; issue closed as a known limitation with a user-side workaround (add the extension in your own code, or treat `warning E30081` implicit float→int as an error).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789159225247-a-non-breaking-check-on-a-non-sealed-interface-mus.md`_
