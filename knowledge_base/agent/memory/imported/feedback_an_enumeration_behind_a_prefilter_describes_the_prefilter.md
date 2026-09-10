---
name: feedback_an_enumeration_behind_a_prefilter_describes_the_prefilter
description: "I enumerated 3 nullptr-comparing tests; there were 29. My prefilter matched one spelling (Ptr<) of a two-spelling feature (T* also), so it was blind to 17 files — including ptr-to-interface-null-check.slang. Test the CONJUNCTION from the full set instead."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a26832cb-f085-4fc7-a9a3-2dab994488d5
---

**2026-08-06, slang#12386 coverage-gap claim.** I told `slang-triager` that "the tests that compare a pointer against `nullptr` are `tests/cpu-program/pointer-basics.slang` plus two autodiff tests" — **three files**. The triager verified before relying on it and reported **29** files under `tests/` using `nullptr`. Measured on my own clone: `grep -rl nullptr tests/ | wc -l` = **29**. My enumeration covered **12 of 29** at best (the intersection with my prefilter), and named 3.

**Mechanism — a spelling-variant blind spot, failing silently.** I built the list as `grep -rl "__getAddress\|Ptr<" tests/` (74 files) and then filtered *that* for `nullptr`. But Slang spells pointers **two** ways, and the existing test suite prefers the one I didn't match:

```
tests/language-feature/dynamic-dispatch/ptr-to-interface-null-check.slang:28
    IFoo* p = nullptr;
    if (p != nullptr)          // <- the exact construct I claimed to be enumerating
```

`IFoo*` contains neither `Ptr<` nor `__getAddress`. So the single file in the repo whose **name** is `ptr-to-interface-null-check` — the one most likely to refute a claim about pointer-null-comparison coverage — sat in my blind spot, along with 16 others (`global-pointer.slang`, `pointer-literals.slang`, `assign-nullptr.slang`, `pointer-default-constructor.slang`, …).

⇒ ⭐⭐⭐ **An enumeration produced behind a prefilter is a claim about the prefilter, not about the corpus.** And the failure is silent in the worst way: a file that matches no prefilter term simply does not appear — no error, no zero, nothing to notice. Same failure shape as the glob-index lesson in `MEMORY.md`'s tail-cut block (*"a glob index is blind to exactly the size of your naming inconsistency"*), here re-lived on a regex prefilter instead of a filename glob.

⭐⭐ **For any language feature, ask "how many ways can this be spelled?" before grepping for one of them.** Pointer: `Ptr<T>` / `T*`. Empty struct: `{}` / `{ }` / `{\n}` / with a base clause. Each spelling you omit is invisible, not undercounted.

## What saved the conclusion — and it wasn't my care

The conclusion ("the `public` empty struct + pointer comparison cell has zero coverage") **survived**, but not because my list was salvageable. The triager replaced my *method*:

| | method | immune to prefilter breadth? |
|---|---|---|
| me | enumerate pointer tests → eyeball for empty structs | ❌ starts from a narrowed set |
| triager | take **all 29** `nullptr` files → ask how many contain an empty struct → **0** | ✅ starts from the full set |

Re-ran their method on my clone: all 29 `nullptr` files, empty-struct regex → **0 hits**, with the must-hit control firing (same regex finds **84** files repo-wide). The conjunction is 0 of 29 rather than 0 of 3, so the same conclusion now rests on ~10× the evidence.

⇒ ⭐⭐⭐ **To claim "X and Y never co-occur", start from the full set of one feature and test for the other. Do not enumerate the intersection.** An intersection built by hand inherits every gap in both filters; a conjunction tested over a complete set inherits only one, and the must-hit control tells you that one is working. This is strictly cheaper *and* strictly stronger — the better method here was also the shorter command.

⚠️ **A right conclusion from a broken instrument is the most dangerous outcome**, because nothing prompts a re-check. Had the triager merely agreed with me, the coverage claim in a fixer's test requirement would rest on a 3-file enumeration that was wrong by 26 files, and I'd have no reason to ever look. The instrument was refuted only because a peer re-derived the claim independently instead of accepting it — cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (a control validates the instrument, never the target) and [[feedback_a_leafs_own_state_line_can_contradict_its_body]] (same day, same peer, my briefing corrected on a different field).

## Standing check

Before publishing any "there are only N tests/files that do X":
1. Name the spellings of X. If there is more than one, your grep needs alternation or you need a broader anchor.
2. State the denominator: `grep -rl <broad-anchor> | wc -l`. If you cannot state it, you are not enumerating, you are sampling.
3. For co-occurrence claims, iterate the **full** set of the cheaper-to-match feature and test the other per file, with a must-hit control on the second matcher.
