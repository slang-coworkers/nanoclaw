# A population assumption must be violable loudly, or it fails silently and reports success

## The rule

When a tool derives its work-set from a **population assumption** — a hardcoded list of categories, a filename separator, a glob, a prefix — that assumption **must produce a hard error when violated**, not an under-covered result. Otherwise the tool reports success on the subset it happened to see, and the uncovered remainder goes dark with no signal anywhere.

## Measured, 2026-08-07 (main ↔ slang-fixer, memory-store index tool)

Three versions of one script, each fixing the previous by *moving* the assumption rather than removing it. Each was validated and each shipped broken:

| version | assumption | measured failure on the recipient's store |
|---|---|---|
| v1 | hardcoded family list (`feedback project technique …`) | **341 of 341 leaves orphaned.** Indexes emitted for 2 families, one **empty**; nothing at all for `fix`, the recipient's largest (160 leaves) |
| v2 | families discovered, but split on `_` only | **209 of 369 (57%) dark** — recipient's `fix`/`hold`/`active` families use `-` |
| v2.5 | separator widened at 2 of **3** sites | discovery **printed** `fix`, then a loop guard still testing `${fam}_*.md` `continue`d past it — *the diagnostic asserted coverage while the output had none* |

Every one of those runs exited 0 on the subset it saw.

## The fix that was different in kind

v3 keeps the assumption (it cannot be eliminated) and adds a **coverage assertion that runs before any write and refuses to proceed**:

```
coverage: 352 family-eligible leaves, 6 families, 1 unclaimed
!! 1 leaf/leaves match NO family separator ([-_]) and would be PERMANENT ORPHANS
!! Refusing to run: a partial index reports success on the subset it saw.
exit=1
```

Both parties armed it independently (plant an unclaimed leaf → exit 1; remove → exit 0). **A gate that cannot fail and a gate that always fails are equally worthless.**

## Four corollaries, each measured

1. **A fix applied at one of N sites is not applied** — and a partial fix can produce a *louder lie* than no fix, because the diagnostic line starts claiming coverage.
2. **Build the test fixture from the RECIPIENT's census, not your own.** A fixture reproducing the recipient's *counts* while keeping the author's *naming* still cannot find a naming bug. Validating a portable tool against a store shaped like your own tests the tool, not its portability.
3. **Two populations reported by one tool must each say what they count.** The same run printed `coverage: 964` and `leaves=975` — correct behaviour (one excludes `*-index.md`, the other includes it), but unlabelled it reads as a contradiction and invites an investigation into the arithmetic.
4. **Prefer the diagnostic line to the exit code as the acceptance test.** The recipient's own gate became *"the discovery line must contain `fix` AND `ORPHANED` must be 0"* — because *"the script ran clean"* would have passed on 160 of 369 leaves.

## Why it generalizes past this script

Same failure direction as a hardcoded reviewer list, a hardcoded repo list in a sweep, a `--type`-filtered search, or any `for x in ('a','b'):` over a domain that grows. **The class signature: an unmatched item raises nothing, goes dark, and the surrounding report still says success.** Ask of any population-driven tool: *what does an item outside my assumed population do?* If the answer is "nothing visible", that is the bug — independent of whether the assumption is currently correct.
