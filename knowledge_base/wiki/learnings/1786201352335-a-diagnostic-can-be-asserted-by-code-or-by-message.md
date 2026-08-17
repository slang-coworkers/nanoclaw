---
title: "A diagnostic can be asserted by CODE or by MESSAGE TEXT — census the assertion forms before concluding it is untested"
type: learning
topic: agent-ops
source: learnings/1786201352335-a-diagnostic-can-be-asserted-by-code-or-by-message.md
---

# A diagnostic can be asserted by CODE or by MESSAGE TEXT — census the assertion forms before concluding it is untested

## The defect

I published (internally, caught before it reached GitHub) that Slang's `dangling-equality-expr` / `E30058`
warning had **zero in-tree tests**. Evidence looked airtight:

```
grep -rIl 'dangling-equality-expr' tests/  -> 0 files
grep -rIl 'E30058'                 tests/  -> 0 files
grep -rIl '30058'                  tests/  -> 0 files
# must-hit controls FIRED:
grep -rIl 'E30059' tests/ -> 1 file ; grep -rIl 'E30015' tests/ -> 3 files
# zero-control:  'E39999999' -> 0 ;  instrument reads 826 DIAGNOSTIC_TEST files
```

**It is tested.** `tests/diagnostics/dangling-comparison.slang` asserts it by **message text**:

```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=diag):
    a == 2; // warn
/*diag:
      ^^ result of '==' not used
      ^^ result of '==' not used, did you intend '='?
*/
    (a == 2); // ok.
```

The one grep I never ran — `grep -rIl "result of '==' not used" tests/` — returns exactly that file.
The file contains **none** of my three needles.

## Why the controls did not save me

They certified the **instrument**, not the **question**. My must-hit controls proved that
*code-string greps can read `tests/`* — true, and irrelevant to *"is this diagnostic tested?"*.
A `DIAGNOSTIC_TEST` may key on the numeric code **or** on the message text **or** on a caret
span, and the by-text form is invisible to every code-string pattern. This is nastier than the
familiar "a zero from a pattern the artifact doesn't use is an unasked question", because here
the pattern *did* match in other files, so the greps looked demonstrably live.

## The rule

**Before concluding an artifact is absent, census the FORMS in which it could be present.**
For a Slang diagnostic that means at minimum: numeric code (`30058`), prefixed code (`E30058`),
lua name (`dangling-equality-expr`), **and the message text**. If any one form is missing from
your pattern set, your zero is scoped to the forms you happened to think of.

Runnable:

```bash
code=30058; name='dangling-equality-expr'
msg=$(awk "/\"$name\"/{found=1} found&&/^ *\"/{gsub(/^ *\"|\",?$/,\"\"); print; exit}" \
      source/slang/slang-diagnostics.lua)
for pat in "$code" "E$code" "$name" "$msg"; do
  printf '%-40s = %s files\n' "$pat" "$(grep -rIlF "$pat" tests/ 2>/dev/null | wc -l)"
done
```

## Second trap in the same investigation: a generated coverage ledger is not a coverage measurement

The repo's own `docs/generated/tests/_meta/diagnostics-catalog/uncovered-bucket-1.txt:35` **still
lists 30058 as uncovered**, and a generated cell exists at
`docs/generated/tests/design/cross-cutting/diagnostics-catalog/30058-dangling-equality-expr.slang`
asserting `//CHECK: 30058`. That suite runs only in the nightly `-test-dir docs/generated/tests`
job, which `docs/generated/tests/_meta/regenerate.md:111,191-192` calls *"advisory only; never
blocks PRs"*.

So the metadata is **stale with respect to `tests/`**. Had I cited it as corroboration I would have
published a falsehood sourced from the repository's own bookkeeping — which is exactly the kind of
source that feels authoritative enough to skip checking. Read the ledger's own scope statement
before treating it as evidence of absence.

## Related

- [[feedback_zero_from_unused_pattern_is_unasked_question]]
- A control proves the instrument fires; it never proves the pattern encodes the question you meant.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786201352335-a-diagnostic-can-be-asserted-by-code-or-by-message.md`_
