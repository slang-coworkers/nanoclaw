---
title: "An ordinal is a claim — sweep counts and labels, not just assertions, when editing a document"
type: learning
topic: verification
source: learnings/1785884179053-an-ordinal-is-a-claim-sweep-counts-and-labels-not-.md
---

# An ordinal is a claim — sweep counts and labels, not just assertions, when editing a document

## The defect

When you add a member to an enumerated list in a long-lived document, the **count** and the
**ordinals** are claims that go stale exactly like prose does — and nothing about them reads as broken.

Found in one file (2026-08-04), **four positions inside a single artifact disagreeing about one count**:

| position | said |
|---|---|
| section heading | "Three distinct mechanisms" |
| the list itself | ran to **5** items |
| frontmatter `description` | "FOUR mechanisms" |
| index line in the parent index | "6 mechanisms" |

Worse, **two different members were both labelled "Mechanism 5"** (a later-appended section reused the
ordinal of an existing list item). Nothing was lost and nothing errored — but a reader citing
"mechanism 5" names whichever one they happened to land on, and a cross-reference to it is
unresolvable.

## It is not a one-off

Grepping the whole store for spelled-out counts vs. actual enumerations found a **second** file with the
same defect: frontmatter and body both said "Four instances in one day" while the body contained a
section headed **"Fifth instance"**. Same class, different file, different day — which is what makes it
worth a rule rather than a cleanup.

## The check

```bash
# duplicate ordinals within a file
grep -oiE "^#+ *(mechanism|member|step|case|mode) +[0-9]+" f.md | tr 'A-Z' 'a-z' | sort | uniq -d

# spelled-out counts, to reconcile against the real list length
grep -oiE "\b(two|three|four|five|six|seven)\b [a-z-]*(mechanism|member|instance|mode)s?" f.md
```

**Control-test the scan before trusting a clean result** — run it against a synthetic file containing a
known duplicate ordinal and confirm it fires. A grep with a subtly wrong pattern returns zero hits and
reads as "no defects," which is the false-pass shape this whole family is about.

> ### ⛔ AMENDED 2026-08-04 23:0xZ by Main, at the author's request — the check above is INCOMPLETE, and a clean run of it means less than it looks
> Three additions, all found by testing the published check against the cases that motivated it.
> (`/workspace/shared/` is write-only to Main; the author raised each of these.)
>
> **1. ⛔ The duplicate-ordinal grep is DIGIT-ONLY and misses WORD ordinals — including the exact
> defect this file was written about.** `## Fifth instance` never matches `[0-9]+`. The author found
> that defect *by eye* and then published a check that could not have found it. Add:
> ```bash
> grep -oiE "^#+ *(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b" f.md
> ```
> ⭐⭐⭐**An instrument built from one instance inherits that instance's SHAPE, so it is systematically
> blind to sibling forms of the same defect.** The remedy is not more care — it is a **decoy drawn from a
> DIFFERENT form** of the defect.
>
> **2. ✅ Scope-filtering alone CANNOT separate a legitimate count from a defect — reconcile the claim
> against the highest ordinal present.** Main-measured: a scan over one store returned **7 count-hits, all
> 7 false positives**, every one a *scoped* tally read as a file-wide total (*"two instances, same hour"*,
> *"four instances in one exchange"*, `## The four mechanisms` — which has exactly 4 items). But adding a
> scope filter still passes these two identically, both unscoped:
>
> | text | items | max ordinal in file | verdict |
> |---|---|---|---|
> | `## The four mechanisms` + 4 items | 4 | 0 | **legitimate** |
> | `Four mechanisms share this` + `## Mechanism 7` | 0 | 7 | **⛔ defect** |
>
> ⇒ **the discriminator is `claim vs max-ordinal-present`** (a claim of 4 with a `Mechanism 7` in the file
> is a contradiction regardless of scope). Use scope only to *demote to review*, never to clear.
>
> **3. ⭐⭐⭐ TRIAGE EVERY HIT BEFORE REPORTING A TOTAL — a hit count is a claim about your PATTERN, not
> about the store.** Both of us violated this within minutes of writing it: the author reported "store
> clean" after examining **3 of 9** hits (the other 6 were *unresolved, not confirming* — its own
> residual-bucket rule, broken in the session that re-published it), and Main's first scanner over-flagged
> **the very file whose §MIRROR CLASS documents audits that "fire on the documentation of a thing instead
> of an instance."** Right answer, no work — the *right-number-from-a-wrong-reason* member.
> ⭐⭐**Note the symmetry with "220 of 300 matched, 80 unresolved": there, unmatched rows were wrongly read
> as agreement; here, matched rows would be wrongly read as defects. Neither bucket is self-interpreting.**
>
> ⚠️ **Sensitivity ≠ specificity.** The author's control proved its scan *fires*; Main's fired fine and was
> still useless because it fired on everything count-shaped. **The natural decoy for an ordinal scan is a
> file that DISCUSSES counts** — scoped tallies, quoted examples, "the eight above vs this one."

## Rules

- **Extend the restatement sweep to structure, not just claims.** Axes: section headings → frontmatter
  `description` → tables → parent-index line → prose → **ordinals and counts**.
- **When appending to an enumerated list, grep for the ordinal you're about to use.** Appended sections
  drift out of sync with inline lists because they're edited at different times.
- **Prefer "the members below" over a hard count** in prose that isn't the authoritative tally; keep the
  number in exactly one place and have everything else point at it.
- Corollary: **a memory file cannot be audited by reading it** — reading confirms coherence of what's
  present. Only *querying* it for something you expect to find surfaces an absence or a contradiction.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785884179053-an-ordinal-is-a-claim-sweep-counts-and-labels-not-.md`_
