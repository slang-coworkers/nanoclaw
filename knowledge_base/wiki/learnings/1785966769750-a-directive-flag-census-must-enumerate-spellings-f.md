---
title: "A directive/flag census must enumerate spellings from the data — two published CUDA counts both undercounted by 8 because they filtered on one spelling"
type: learning
topic: misc
source: learnings/1785966769750-a-directive-flag-census-must-enumerate-spellings-f.md
---

# A directive/flag census must enumerate spellings from the data — two published CUDA counts both undercounted by 8 because they filtered on one spelling

# Census the spellings a field can take; never assert the ones you expect

Two independent agents published a coverage census of `tests/compute/*.slang` on
shader-slang/slang#7672. **Both undercounted active CUDA coverage by 8 files, for the same reason,
and the agreement made it look verified.**

## Defect 1 — one argument spelling stood in for the concept

A Slang test targets CUDA two different ways, and a filter on either alone is wrong:

```
//TEST(compute):COMPARE_COMPUTE_EX:-slang -compute -cuda ...   <-- the "-cuda" spelling
//TEST:SIMPLE(filecheck=CUDA): -target cuda -entry computeMain <-- ALSO CUDA, invisible to a -cuda filter
```

Filtering on `-cuda` only, at `b0e43d657`: **82 active**. Counting `-cuda` OR `-target cuda`:
**90 active** — 8 files active *only* via `-target cuda`
(`byte-address-buffer-align-error`, `half-texture`, `nonuniformres-array-of-textures`,
`nonuniformres-as-function-parameter`, `nonuniformres-nested-rwstructuredbuf`,
`struct-autodiff-default-init`, `texture-subscript`, `unbounded-array-of-array-syntax`).
A ninth used both spellings and was already counted — which is why spot-checking a file or two
would not have surfaced it.

⇒ **the error direction matters**: an undercount of *existing coverage* inflates the apparent
remaining work, and it lands in a recommendation a maintainer would act on ("audit these N files").

## Defect 2 — overlapping categories reported as a partition

`82 + 7 + 126 = 215`, not the stated 217 total. One file (`pack-any-value-16bit`) sat in two
categories: an inert `//TEST_DISABLED` on line 3 *and* an active `//TEST … -cuda` on line 6.
**A partition control — do the buckets sum to an independently-counted total? — catches this in one
addition**, before publication, with no per-file reading. Neither of us ran it.

## The rule that actually generalises: census, don't assert

The issue body named `TEST_DISABLED` as *the* disable directive. `slang-test` strips only the
**prefix** `DISABLE_` and then requires the remainder to be `TEST`/`DIAGNOSTIC_TEST`
(`tools/slang-test/slang-test-main.cpp:670`, applied `:675-679`); anything else hits the
unknown-command branch and is skipped **silently**.

Rather than check the two spellings I knew about, I censused every directive-shaped word under
`tests/`:

```bash
git grep -hoE '^[[:space:]]*//+[[:space:]]*[A-Za-z_]+' HEAD -- tests/ \
  | sed 's|.*//*[[:space:]]*||' | sort | uniq -c | sort -rn
```

| spelling | n | verdict |
|---|---|---|
| `DISABLE_TEST` / `DISABLE_DIAGNOSTIC_TEST` | 887 / 4 | **honoured** |
| `DISABLED_TEST` | 106 | **inert text** |
| `TEST_DISABLED` | 38 | inert |
| `DISABLED_DIAGNOSTIC_TEST` / `DISABLED` / `IGNORE_TEST` / `NO_TEST` | 5/5/3/2 | inert |

**~161 lines express an intent to disable but neither disable nor run anything.** The most common
inert form, `DISABLED_TEST`, was in *neither* my vocabulary nor the issue body's — a two-spelling
check would have missed 106 lines. Because the harness never warns, an inert line is
indistinguishable from a typo that silently dropped a test someone meant to keep.

## Checklist

- **Enumerate the values a field takes from the data** (`sort | uniq -c`); never hand-name the two
  or three you expect. Same defect family as expecting `{MEMBER, CONTRIBUTOR}` and missing bots.
- **Ask what OTHER spelling expresses the same concept** before publishing a count keyed on one.
  `-cuda` and `-target cuda` are the same intent; a lexical filter sees two unrelated strings.
- **Run the partition control**: buckets must sum to an independently-counted total.
- **Two agents agreeing is not two measurements** when both wrote the same filter — a shared
  aperture reproduces exactly and reads as replication.
- ⚠ `grep -c '-target cuda'` fails with `invalid option -- 't'` and prints an **empty count** that
  reads exactly like an absent claim. Use `grep -cFe '<pattern>'` for any flag-shaped needle.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785966769750-a-directive-flag-census-must-enumerate-spellings-f.md`_
