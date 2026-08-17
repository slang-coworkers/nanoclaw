---
title: "A guard inserted between a debug assert and the original crash site inherits none of that assert's protection — and SLANG_ASSERT is an optimizer PROMISE in release"
type: learning
topic: slang-compiler
source: learnings/1786041369719-a-guard-inserted-between-a-debug-assert-and-the-or.md
---

# A guard inserted between a debug assert and the original crash site inherits none of that assert's protection — and SLANG_ASSERT is an optimizer PROMISE in release

I added a bounds guard to stop a null-deref crash. On an untested shape, **my new guard derefs null one line
earlier than the crash it was fixing** — same symptom, new culprit. slang#12155, 2026-08-06.

**The shape of the mistake, which is entirely general:**

```cpp
auto typeLayout = as<IRStructTypeLayout>(varLayout->getTypeLayout());  // can be NULL
...
SLANG_ASSERT(typeLayout);                            // pre-existing, debug-only
if (index >= (Index)typeLayout->getFieldCount())     // MY new guard — derefs null HERE
    { ... }
auto fieldLayout = typeLayout->getFieldLayout(index); // where it used to crash
```

I read the assert above my insertion point as establishing an invariant I could rely on. It does not. In this
codebase `SLANG_ASSERT` is:

```cpp
#ifdef _DEBUG
  ... real check ...
#else
  #define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)
#endif
```

So in release it is not merely *absent* protection — it is an **assumption the optimizer may act on**. My line
sat beneath a statement telling the compiler the null case cannot occur, while being the line that dereferences
the null.

**The rule:** a guard added between a debug assert and the original dereference inherits nothing. If your new
line touches the same object the old crash site touched, it needs **its own** check — or promote the assert to
the release-checked form (`SLANG_RELEASE_ASSERT` here). Insertion point does not confer protection; only a
check that runs in the shipping build does.

**And a second, deeper lesson: a guard for the wrong *kind* of wrongness.** My guard compared an index against
a **field count** — it assumed the layout was the right *type* but possibly the wrong *length*. The failing case
had a layout describing an entirely different type (a non-struct return, so the struct-layout cast yielded
null). A bounds check cannot help when the object is the wrong shape rather than the wrong size. **Name the
malformation your guard actually addresses, then ask what other malformations reach the same line.**

**Corollaries worth keeping:**

- **A guard is consumer-side handling of a malformed input.** If the producer never records the information the
  consumer needs (here: a pass synthesized a return struct and never recorded layout for it), no guard fixes
  that — it only declines to read it. Trace to the producer.
- **Test the shapes your fix *skips*, not just the ones it handles.** My rebuild was gated behind an `if` that
  didn't fire on the failing shape, so the guard ran unprotected on precisely the path my fix was supposed to
  own. Every early-out and gate in a fix defines an untested region.
- **A contaminated binary can still be informative if you disclose it.** My local build had an abandoned
  experiment linked in, so it returned `EXIT=0` where the reporter measured a crash. That isn't a
  contradiction — the experiment short-circuited the path before the guard, which *localized* the crash to
  exactly the reported path. Report what your instrument contains rather than offering its number.
- **Guilty controls make a crash report forwardable.** The reporter verified `slangc -v` matched the head under
  test and that the guard's comment string was present in the built source and **absent on master**. An earlier
  run of the same test used a *fetched release tarball* named like a build directory; its "still crashes"
  carried zero information and looked identical to a finding.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786041369719-a-guard-inserted-between-a-debug-assert-and-the-or.md`_
