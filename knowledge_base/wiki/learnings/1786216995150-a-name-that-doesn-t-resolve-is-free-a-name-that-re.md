---
title: "A name that doesn't resolve is free; a name that resolves to something weaker than you assumed is the expensive one"
type: learning
topic: misc
source: learnings/1786216995150-a-name-that-doesn-t-resolve-is-free-a-name-that-re.md
---

# A name that doesn't resolve is free; a name that resolves to something weaker than you assumed is the expensive one

Two "assumed an API's behaviour from its name" errors in one afternoon on the same Slang change. They cost radically different amounts, and the difference is the useful part — it tells you where to spend a grep.

## The cheap one: a name that doesn't resolve

I wrote `args.containsPredicate([](const LegalVal& arg){ ... })`. **No such method.** The compiler rejected it in seconds; total cost was one build.

Worth noting *why* it felt safe, because it wasn't a typo or a near-miss on a real name. The container (`ConstArrayView`) provides:

```
indexOf · lastIndexOf · findFirstIndex(predicate) · findLastIndex(predicate) · containsMemory
```

So a `bool contains…` exists, and predicate-taking methods exist — `containsPredicate` is a **legal composition of the API's own vocabulary that the API never combined**. Derivable, plausible, absent. And `findFirstIndex` — the correct call — was already used elsewhere in the very file I was editing.

## The expensive one: a name that resolves to something weaker

I replaced a bare `return LegalVal();` with `UNREACHABLE_RETURN(LegalVal())` to make an invariant self-enforcing, and wrote **"self-enforce the fatal invariant"** in the commit message. The macro:

```cpp
#ifdef _MSC_VER
#define UNREACHABLE_RETURN(x)
#else
#define UNREACHABLE_RETURN(x) return x;
#endif
```

It's a compiler-warning shim. On non-MSVC it expands to *literally the line it replaced* — zero behavioural change, under a commit message asserting the opposite. It compiled, tests passed, and it took a reviewer reading the macro definition to catch it. (The enforcing macro is `SLANG_UNREACHABLE` one file over, which calls a `[[noreturn]] handleSignal`. One word apart; one vanishes, one throws. There's an in-tree `TODO: Shouldn't these be SLANG_ prefixed?` above the shim, so others have tripped here.)

## The discriminator

**A name that doesn't resolve is free — the compiler is your reviewer. A name that resolves to something weaker than you assumed is the expensive one, because every automated check passes and only a human reading the definition can catch it.**

So don't spend the grep on unfamiliar names; the build catches those. **Spend it on familiar-looking names you are relying on for a guarantee.** The trigger is the shape of your claim, not your confidence in the identifier:

- "this asserts / enforces / validates / guarantees X" → read the definition before writing the claim
- "this is unreachable / cannot happen" → check what the macro *does* in a release build, not just what it's named
- anything whose value is that it *fails* under some condition → verify it fails, by mutation

The general rule: **if you are about to make a written claim about a construct's guarantee, read the construct.** Both errors were the same act — inferring semantics from an identifier — but only one was expensive, and it was expensive precisely because it type-checked.

## Related: a structure can make a claim the code doesn't honour

Same episode, same family. I wrote a `for` loop over operands that diagnosed on the first eliminated one and asserted inside the body — so it could **never iterate twice**. The *shape* advertised per-operand reporting; the body guaranteed report-once. Replaced with a `findFirstIndex` predicate so the structure asks the question the code is actually asking.

A loop that can't loop, a macro that doesn't enforce, a commit message that overstates, a test header claiming coverage it lacks: all four are **an artifact asserting something about itself that isn't true**. That's the connective tissue, and it's worth checking as one habit rather than four.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786216995150-a-name-that-doesn-t-resolve-is-free-a-name-that-re.md`_
