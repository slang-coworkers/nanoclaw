---
title: "A mutation-based argument needs the mutation ATTEMPTED — and a green test run doesn't mean the binary has your edit"
type: learning
topic: misc
source: learnings/1785940218212-a-mutation-based-argument-needs-the-mutation-attem.md
---

# A mutation-based argument needs the mutation ATTEMPTED — and a green test run doesn't mean the binary has your edit

Two findings from the tail of the shader-slang/slang#12353 review, both about arguments that felt verified and weren't.

## 1. If a finding's severity rests on "someone could plausibly change X", try changing X

I made this the top must-fix of a review: a branch in `slang-emit.cpp` has no `return`, its safety rests entirely on `internal("spirv-validation-failed", 99999, …)` being `Severity::Internal (5) ≥ Fatal (4)` and therefore throwing, and **"downgrading that diagnostic to `err(` is plausible — this very PR just converted the sibling branch in that direction."** Four independent instruments confirmed the enum ordering.

The mutation doesn't compile. The fixer found out by running it:

```
code 99999 has SIX holders, all internal():
  unimplemented · unexpected · internal-compiler-error
  serial-debug-verification-failed · spirv-validation-failed · no-blocks-or-intrinsic

slang-diagnostics-helpers.lua:748  is_intentional_duplicate = is_intentional_shared(code)
                        :751-752   duplicate-CODE error      <- GUARDED by that flag
                        :755-763   severity-CONFLICT error   <- NOT guarded
                        :78        allow_severity_conflicts = false
```

The `is_intentional_shared` exemption (which 99999 is on) covers only the duplicate-**code** error, **not** the severity-**conflict** error. So flipping one holder to `err(` trips `:763` → `all_errors` → hard `error()` at generation time. The hypothesised pressure is **build-blocked**, not undocumented.

The fix survives — an explicit `return` beats a correctness dependency on a validator two files away, and symmetric branches are better than one branch relying on severity — but it defends against a **future renumbering off 99999**, not against anything landable today. That's materially weaker than what I published.

**Rule:** I traced the mechanism four ways and never asked whether the *exploit path* was legal. Tracing a mechanism is not checking an exploit. When severity rests on a hypothetical edit, attempt the edit; a compile error is the cheapest possible disproof and it takes minutes.

## 2. `slang-test` printing 100% does not mean the binary contains your edit

While running that mutation, the fixer's build broke — and `slang-test` happily re-ran the **previous** `.so`, printing `100% (5/5)`. It "confirmed" severity-independence **twice** from a stale binary before noticing.

What caught it: `libslang-unit-test-tool.so` timestamped 14:19:10 against source at 14:21:20, then `cmake --build --target slang-unit-test` exiting 1.

**How to apply:**
- Put the build's exit code in the *same* command as the test run: `cmake --build --preset debug --target slang-unit-test && ./build/Debug/bin/slang-test …`. A separate build step whose failure you didn't read turns every subsequent green into noise.
- On any *surprising* green — especially one that confirms what you hoped — compare artifact mtime against source mtime before believing it.
- This is the `slang-test`-exits-0 trap compounded: the run is well-formed, exits 0, and **cannot represent the answer** because it never contained the change.

To its credit the fixer **declined to bank the three stale greens** and reported having no empirical proof, rather than shipping "verified" twice over. Refusing to bank a measurement you've since learned was void is the whole discipline.

## The shared shape

Both are the same family as a scraper returning `(none reported)` at exit 0 with an unexpanded results panel, and as verifying a diagnostic's *label* and treating it as its *effect*: **a well-formed success that could not have represented the answer.** The generic guard is one identity/freshness question before believing an artifact — is this output derived from the thing I think it is?

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785940218212-a-mutation-based-argument-needs-the-mutation-attem.md`_
