---
name: feedback_a_bounded_grep_pattern_cannot_report_a_ceiling
description: "I published 'master's 380xx tops out at 38037' from the pattern 3803[0-9] — a 10-number window that structurally cannot see above 38039. A MAX/EXTENT claim requires an UNBOUNDED pattern; the window silently supplies the answer you asked for."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

# A bounded grep pattern cannot report a ceiling — it reports the top of your window

2026-08-06, slang #12393. I posted publicly that master's diagnostic range "currently tops out at
38037." Pristine `HEAD` runs to **38052**; 38045–38052 are geometry/mesh/vertex diagnostics (a
*shared* range, not autodiff-only), and 38038/38039 are unassigned **gaps in the middle**. Caught by
slang-triager against pristine source, not by me.

## The mechanism, which is the transferable part

My command was:

```
grep -n "3803[0-9]," source/slang/slang-diagnostics.lua      # ten numbers. that is the whole aperture.
```

Output ended at 38037, so I wrote "tops out at 38037." **The pattern could not have returned anything
above 38039 no matter what the file contained.** I asked a question about a 10-wide window and
reported the answer as a property of the file.

⭐⭐⭐ **A claim of the form MAX / TOP / LAST / HIGHEST / "next free" requires an UNBOUNDED pattern
plus a sort.** The correct instrument was there the whole time and is barely longer:

```
git show HEAD:<file> | grep -oE '\b380[0-9][0-9]\b' | sort -n | uniq    # whole block, ordered
```

⛔ **This is NOT the false-zero family** ([[feedback_grep_the_object_that_holds_the_code_not_the_launcher]],
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]). Those produce *zero* — visibly empty, and
a positive control catches them. This one produced **seven plausible matching lines**. The output was
real, non-empty, correct as far as it went, and a positive control would have *passed*. ⇒ **A control
proves the instrument reads the file; it says nothing about whether the instrument's SCOPE matches the
claim's scope.** The scope check is separate and has to be done by reading your own pattern back
against the sentence you're about to write.

⚠️ **It happened in the same investigation where I had just been burned four times by false zeros and
had written the control rule down.** I applied controls diligently to presence/absence and never
noticed that my *extent* claim had a different failure mode. Fixing one error class does not inoculate
the neighbouring one.

## Why it mattered beyond being wrong

A false ceiling is not inert — it has a *direction*. "Tops out at 38037" reads as "38040+ are free,"
when 38040–38043, 38045–38048, 38050–38052 are all taken. Actually free: **38038, 38039, 38044,
38049**. This exact PR family already survived a real diagnostic-number collision (#11709's error
walked 30705→30706→30707 against #11885's reservation — see
[[project_11709_groupshared_byref]]). So the misstatement pointed the next contributor at occupied
numbers in a codebase with a documented collision history.

⇒ ⭐⭐ **When deciding whether to correct a published detail whose conclusion was right, ask what a
reader would DO with the wrong version.** "Conclusion unaffected" was true here and still not
sufficient — the reason was load-bearing for a different decision (which number to claim) than the one
it appeared in. Posted the correction: issue comment 5207531076.

## Also confirmed in this exchange

- **Once a tree is patched, every source fact must come from `git show HEAD:<path>`.** The triager's
  own inverse near-miss: its first probe grepped the *working tree*, where its fix-probe had already
  inserted a `38038`, returning 2 — "E38038 exists at master," the exact opposite of the truth. Our
  clone is shared by sibling sessions (an unrelated `[ForceUnroll]` edit to `hlsl.meta.slang` appeared
  mid-investigation), so the working tree is not a reliable referent for *anyone* here, and
  `git checkout -- .` would destroy a sibling's in-flight work.
- The triager independently re-derived my `45ccce9a3` provenance with a must-hit/must-miss pair **plus
  a must-fail control proving the file exists at the parent commit** — stronger than my version, which
  lacked the existence control. Holds.
- Its stack trace (via `__cxa_throw` interposer + `addr2line`) shows the abort fires inside
  **interface-conformance witness synthesis** at `TypesFullyResolved`, not through a `bwd_diff`
  expression — which explains why declaring the function suffices. A subagent had claimed the
  opposite; execution refuted it.
