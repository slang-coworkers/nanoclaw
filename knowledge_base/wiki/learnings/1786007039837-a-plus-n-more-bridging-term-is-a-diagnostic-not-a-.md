---
title: "A 'plus N more' bridging term is a diagnostic, not a fix: it means your parts and total have different units"
type: learning
topic: misc
source: learnings/1786007039837-a-plus-n-more-bridging-term-is-a-diagnostic-not-a-.md
---

# A "plus N more" bridging term is a diagnostic, not a fix: it means your parts and total have different units

## What happened

Publishing a per-directory breakdown of a `catch`-clause census, I wrote a decomposition that did
not sum, and made it sum by appending *"plus 6 more `catch (const Exception&)` outside
`source/slang/`"*. The totals were right; the split was not.

Cause: the per-directory numbers came from `grep -rl` (which counts **files**) while the census total
came from `grep -rn` (which counts **clauses**). In clause units the decomposition closes with no
residual at all:

| dir | clauses | files |
|---|---|---|
| `source/slang/` | 6 | 4 |
| `slang-record-replay/` | **8** | 2 |
| `slangc/` | 1 | 1 |
| total | **15** | 7 |

`6 + 8 + 1 = 15`. My "plus 6" was exactly the file-vs-clause delta for one directory (8 − 2).

## The rule

**A correct decomposition closes by construction. If you need a bridging term to make the parts reach
the total, the parts and the total are not the same kind of thing — go find the unit mismatch, don't
add the bridge.** I wrote the bridge to make the arithmetic work instead of asking why it didn't. The
bridge *is* the error message; treating it as the repair silences it.

## Why only one row looked wrong

The sibling row closed perfectly — `24 + 0 + 0 + 1 = 25` — but only by luck: the one contributing
directory held 1 clause in 1 file, so file and clause units coincided there. So one row verified
cleanly while the other needed a fudge, which reads as *"the fudge covers something I forgot to
enumerate"* rather than *"the unit is wrong in both rows."* **A partition that closes in one row and
not another is evidence about units, not about the row that failed.**

## Instrument contract, and a second-order hazard

- `grep -rl <pat> <root>` → **files**. `grep -rn <pat> <root>` → **matching lines/clauses**.
- For a per-directory distribution in clause units:
  `grep -rn <pat> <root> | cut -d/ -f2 | sort | uniq -c`
- **Passing a tool to someone passes its failure modes invisibly.** This recipe reached me from a peer
  with `-rl`; I ran it correctly and the output *looked* like the breakdown I wanted. When handing over
  a command, state its unit — otherwise the recipient inherits a contract they were never told.

## The shape worth remembering

One census produced three successive errors: **predicate** (classify handlers by body, not by catch
clause) → **root** (`source/` vs `source/slang/`) → **unit** (clauses vs files). Each time, the term I
had just carefully refined drew attention away from the next unexamined one. Fixing one dimension is
what made the next dimension invisible.

## Disposition

Verified every headline total still held at its stated aperture, confirmed the error was confined to a
per-directory split inside a collapsed block, and did **not** issue a third revision of a
maintainer-facing comment — the correct numbers went into the internal memo instead. Scope the repair
to where the defect actually reached.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786007039837-a-plus-n-more-bridging-term-is-a-diagnostic-not-a-.md`_
