---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T17:16:58.712Z
---

# [approver/challenger-miss] A numeric ID is not a unique key — enumerate its definition sites before trusting a code-keyed join

## Symptom

slang#12455 adds a lint that joins each generated catalog test to a compiler
diagnostic by the diagnostic's **numeric code** (`catalog.get(code)`,
`docs/generated/tests/_meta/regenerate.py:1502`), hashing
`code<TAB>severity<TAB>name<TAB>message` from a committed snapshot. Everything
about it looks sound: 312/339 digests reproduce exactly, `selftest` is green,
the warning delta is exactly as claimed, and the primary bot review returned
"🟡 Has issues — 2 gap(s)" with **zero** 🔴.

It is still wrong for 3 live entries, because **diagnostic codes are not unique
across definition files**.

## Root cause

Slang defines diagnostics in two independent places — the `err()/warning()`
table in `source/slang/slang-diagnostics.lua` and `DIAGNOSTIC(...)` macros in
`source/compiler-core/slang-*-diagnostic-defs.h`. Measured at the PR head:

- **13 codes collide across the two families**: 20001-20012, 99999.
- **2 codes are duplicated inside a single header**: 10000
  (`illegalCharacterPrint`/`illegalCharacterHex`), 20011
  (`fieldNotDefinedOnType`/`fieldRequiredOnType`).

The snapshot (`_meta/diagnostics-catalog/catalog.txt`) holds 695 rows for 695
distinct codes — every collision was **already collapsed last-wins by the
extractor**. And the parser (`regenerate.py:1428-1433`) reads `parts[0..3]` +
`parts[5:]`, **discarding `parts[4]` — the `source` column**, the only field
that could disambiguate. So a code-keyed join cannot be correct here even in
principle.

Result: tests for lua codes 20001/20002/20005 get compared against the
JSON-parser diagnostics of the same number and reported as "drifted". The
warning tells the reader to run `catalog-digest <code>` and restamp — which
pins the test's provenance to an *unrelated diagnostic*, the exact laundering
the function's own docstring says it exists to prevent. The remediation is
worse than the stale value it replaces.

## How to catch it

**Whenever a change makes an identifier load-bearing as a join key, enumerate
its definition sites before trusting the join.** Two commands settled this:

```bash
# every definition site, per family
grep -hoE 'DIAGNOSTIC\(\s*[0-9]+' source/compiler-core/slang-*-diagnostic-defs.h
# lua: the code is the SECOND arg of err(), not the first — a naive
# "^\s*(err|warning)\(\s*[0-9]+" regex returns ZERO and looks like "no collisions"
python3 -c "...re.finditer(r'\b(err|warning|note|fatal)\(\s*\n\s*\"[^\"]+\",\s*\n\s*(\d+),', lua)"
# then: distinct codes vs total rows in the snapshot — equal means collisions
# were already collapsed, which is the tell.
awk -F'\t' '!/^#/ && NF>=6 {print $1}' catalog.txt | sort | tee all | uniq -d   # empty
wc -l < all; sort -u all | wc -l                                               # 695 == 695
```

Sub-lesson that nearly cost me the finding: **my first extraction regex returned
0 lua codes and I briefly read that as "no cross-file collisions."** A zero from
a hand-written extractor is a claim about the *extractor*, not the world — the
suspicious-zero class. I only caught it because a per-code `grep` for 20001 hit
both files, contradicting my own sweep. Cross-check any zero-collision result
against one positive instance before concluding.

## Fix

Include the defining source file in the key (or in the hashed tuple), so a
colliding code cannot resolve to the wrong diagnostic. Note that the PR's
recorded remedy for the neighbouring symptom — "re-extract the snapshot" — does
**not** fix it: re-extraction still has to collapse 13 colliding codes into one
row each.

## Transferable rule

A numeric or short-string ID is a unique key only within the namespace that
mints it. Before a change keys anything on one — a lint join, a dedup, a cache,
a map lookup — ask *which namespace guarantees uniqueness here, and does the
data cross it?* When the storage format has already collapsed duplicates
(distinct-keys == row-count on data you'd expect to have duplicates), the
collision is invisible downstream and every consumer inherits it silently.

## Also: the PR disclosed the symptom under the wrong cause

The PR body names 20001/20002/20005 and calls them a snapshot "`name` column
misalignment". The rows parse cleanly on `\t`; the kept `name` correctly belongs
to the same-numbered `.h` diagnostic. **A disclosed symptom attached to a wrong
cause is not mitigation** — it routes the fix to the wrong place (re-extraction
instead of re-keying). Read a disclosure as a claim to verify, not as coverage
already granted. (Fourth instance of the disclosure-is-not-safety class in my
store: cost-to-fix, expected-usage, intent, now wrong-cause.)
