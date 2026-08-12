# GitHub search/code silently omits files over ~384KB — it cannot establish a denominator

**`gh api search/code` returns `total_count: 0` for files above GitHub's index cap (~384 KB) — no error, no warning, no partial-results flag.** Never use it to establish a *denominator* (population count, exhaustive enumeration, "N sites total", "nothing else does X"). Count locally with `git grep`.

**Measured 2026-08-07 on shader-slang/slang, two-arm control:**

| arm | query | `search/code` | local `git grep -c` |
|---|---|---|---|
| A (oversized file) | `"emitOpDecorate" filename:slang-emit-spirv.cpp` | **0** | **45** |
| B (small file) | `IRInterpolationModeDecoration filename:slang-emit-metal.cpp` | 1 | 1 |

Arm B proves the API and query syntax work — the only difference is file size. `slang-emit-spirv.cpp` is **491,551 bytes**, the single most emit-critical file in the repo. **The failure is systematically biased toward the largest, most important files**, i.e. exactly the ones an emit/codegen audit must cover. Check with `stat -c %s <file>`; >~384 KB ⇒ assume not indexed.

**Why this is worth your 30 seconds: it fires in the reassuring direction.** On a PR whose scoping argument depended on "how many places read `IRInterpolationModeDecoration`", three instruments gave three wrong answers before a local `git grep` gave the true 11 (1 struct decl + 10 reads):

1. `grep findDecoration<IRInterpolationModeDecoration>` → **6**. Searched by **call shape**, so 4 cast-shaped reads `(IRInterpolationModeDecoration*)dd` were structurally invisible.
2. Reading **six guessed-at files** → **10**. Better, still not an enumeration.
3. "Fixing" it via `search/code` **by entity name** → silently dropped `slang-emit-spirv.cpp`. **The fix was worse than the bug, because it carried the authority of a systematic method.**

⭐ **The generalizable pair — you need both halves:**
- **Search by the ENTITY** (the type/symbol name), not by one syntax for touching it. Fixes miss #1.
- **Count LOCALLY** in a freshly fetched checkout. Fixes miss #3.

Either alone still yields a wrong denominator.

**Practical rules:**
- Denominator claims ⇒ `git grep -n <entity> -- <paths>`, never `search/code`.
- `git grep -c` counts **matching lines, not occurrences** — they coincide only when no line has two mentions. Use `git grep -o <pat> | wc -l` when the number is load-bearing.
- If you must use `search/code`, pair every query with a **positive control**: a string you independently confirmed present in the *same* file. `total_count: 0` on the control ⇒ the file isn't indexed and the real query's 0 means nothing.
