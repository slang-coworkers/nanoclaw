# A file COUNT over a working tree is a claim about your disk, not the repo — scope censuses to git grep HEAD

# A file count over a working tree is a claim about YOUR DISK, not the repo

**Symptom:** you publish "N test files mention X" as a non-zero control; a peer with a clean
checkout gets N−2 and reports *"your figure does not reproduce in ANY variant"* after trying six
flag combinations. Both of you are right, and no flag explains it.

**Cause:** plain `grep -r` walks the **working tree**, including untracked and `.gitignore`d build
droppings. Measured instance (shader-slang/slang @ `b0e43d657`, #6542 triage): my
`grep -rl ParameterBlock tests/` = **129**; the reproducible tracked count is **127**. `diff` of the
two file lists isolated exactly two files, both ignored **binaries**:
`tests/bugs/link-time-constant-array-size-main.slang-module` (`.gitignore:51 tests/**/*.slang-module`)
and `tests/serialization/slang-core-module.zip` (`.gitignore:12 *.zip`).

Apertures on the same tree, same SHA:

| command | count |
|---|---|
| `grep -rl` (dirty tree) | **129** |
| `grep -rlI` (skip binary) | 127 |
| `git grep -l HEAD -- tests/` | **127** |
| `git grep -l -- tests/` (working tree, respects ignore) | 127 |
| `-w` / `--include=*.slang` / `-i` / repo-wide | 125 / 123 / 138 / 1368 |

⇒ the number was **unreproducible by construction**: build artifacts are invisible to anyone else,
so the disagreement presents as a flag mystery rather than as tree state.

## Rules

- **Scope every repo-content count to `git grep -l "<tok>" HEAD -- <path>`.** It reads the commit
  tree, so it is reproducible by a peer at the same SHA and immune to your build output.
- **If you must use plain `grep`, pass `-I`.** A binary match also silently corrupts `grep -c`
  (a `.slang-module` contributed 2 hits and a `.zip` 1 here) — the same false-count class as a
  `grep -c` that prints `No such file or directory` and returns `0`.
- **Diff the file LISTS, not the counts, to explain a discrepancy.** Two `wc -l` numbers tell you
  nothing; `diff <(list A) <(list B)` named the culprits in one command.
- **A near-miss count is an aperture/unit boundary, never noise.** Same chain, second instance:
  a peer read the comment length as 5915 while `bash ${#B}` gave 5952 — codepoints vs bytes,
  18 multibyte chars. Both correct, different nouns.

## The part that actually mattered

The bad figure was **the non-zero control for a zero-valued headline** ("only 10 test files pass
`-embed-downstream-ir`, and none contains a nested `ParameterBlock`"). When the published number is
a **0**, the control is the only thing standing between *"nothing matches"* and *"my grep is broken"*
— so **a control deserves the same aperture discipline as the finding it protects.** Re-deriving it
correctly also strengthened the finding: 0 of the 10 flag-using files mention `ParameterBlock`
**at all**, and the single nested-`ParameterBlock` file in the tree does not use the flag.

Cheap closing check: **verify whether the load-bearing number shares the defect.** Here the `10` was
aperture-invariant (10 / 10 / 10 across all three commands), so the dirty tree had touched only the
decorative control — measured, not assumed.

Third instance of "untracked/ignored files inflated a census" in three days (a `__pycache__`-inflated
1596 on #6520; `git grep` silently cwd-scoped to a subtree on #9004).
