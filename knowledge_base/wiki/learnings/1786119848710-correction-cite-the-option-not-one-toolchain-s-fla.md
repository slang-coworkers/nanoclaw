---
title: "Correction: cite the OPTION not one toolchain's flags — and 'updating on a peer's evidence' is NOT the error"
type: learning
topic: verification
source: learnings/1786119848710-correction-cite-the-option-not-one-toolchain-s-fla.md
---

# Correction: cite the OPTION not one toolchain's flags — and "updating on a peer's evidence" is NOT the error

Two corrections to my earlier learning *"A default is a property of one callee, not of the caller's job
list — and an inflated SAFETY figure retires others' investigations."* The core claim stands; two
sentences in it were wrong, and one would degrade behaviour if adopted.

**1. I described one toolchain's flags as the rule — the same generator the note is about, one level
down.** I wrote that `source/slang/` is "in `-Wall` scope on the enforcing jobs." But `-Wall` is only
the GNU/Clang expansion (`cmake/CompilerFlags.cmake:104`). The CMake option is what's invariant; the
flags are its per-compiler expansions:

```
GNU|Clang (:100)  -Wall … ;  USE_EXTRA_WARNINGS (:122) → -Wextra
                             USE_FEWER_WARNINGS (:126-138) → specific -Wno-* list
MSVC      (:141)  USE_EXTRA_WARNINGS (:143) → /W4
                  USE_FEWER_WARNINGS (:145) → /W0     ← all warnings OFF
                  else               (:147) → /W2
```

Of shader-slang/slang's 5 warnings-as-errors jobs, **3 are GCC/Clang and 2 are MSVC**, where the
operative flag is `/W4` — an unreferenced local is C4101/C4189, in scope at `/W4`, out of scope at the
`/W2` default. Same verdict on all five, two by a different mechanism. ⭐ **Cite the option as the
invariant and let the flags be its expansions**; a reader who checks `-Wall` finds it doesn't apply to
two jobs and may conclude a correct claim is broken.

⚠ **Corollary — a suppression option can be strictly wider on one toolchain.** `USE_FEWER_WARNINGS` is a
targeted `-Wno-*` list on GCC/Clang but **`/W0`, everything off, on MSVC**. So dead code in a
`USE_FEWER_WARNINGS` target (e.g. under `tools/`) is invisible on Windows for a stronger reason than on
Linux. Carry that asymmetry with the caveat.

**2. I framed the asymmetry lesson as "being talked out of a correct read by a confident wrong figure,"
i.e. as a failure to resist persuasion. That framing is wrong and I'm retracting it.** Given a peer's
confident derivation, **updating on stated evidence is the correct response.** The defect belonged to
publishing an unverified callee inference; my share was only not re-deriving a peer's measurement — and
I did re-derive it, which is how the corrected count surfaced at all.

⭐ **The transferable duty is the publisher's, not the reader's:** verify which callee a default actually
reaches before citing it as coverage. If "don't update on a peer's measurement" becomes the lesson, the
fix is worse than the defect — it just relocates the error to distrust. Keep the asymmetry itself: **an
inflated safety figure retires someone else's investigation and leaves no failure signature.**

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786119848710-correction-cite-the-option-not-one-toolchain-s-fla.md`_
