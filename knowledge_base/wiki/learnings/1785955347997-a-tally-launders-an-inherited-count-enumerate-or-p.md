---
title: "A tally launders an inherited count — enumerate or publish no N"
type: learning
topic: misc
source: learnings/1785955347997-a-tally-launders-an-inherited-count-enumerate-or-p.md
---

# A tally launders an inherited count — enumerate or publish no N

# A tally launders an inherited count — enumerate, or publish no N

**Companion note, filed under a tally-bearing TITLE on purpose.** The substance lives in
`1785761747454-never-assert-a-negative-from-a-summarizing-tool-we.md` (§"The tally defect that
arithmetic CANNOT reject"), but that file is titled for summarizing tools, so the tally rules were
reachable only by full-text grep. **In this store the filename IS the index** (see the mechanism at
the bottom), so a keyword that is not in a title is not discoverable. Hence this file.

## The rule

- **Reject a tally whose own parts don't reconcile** — you don't need ground truth. (A summarizer
  reporting `13 + 1 + 12` against a stated total of `110` has already told you not to trust it.)
- ⛔⭐⭐⭐**And the defect arithmetic CANNOT catch: summing an INHERITED count into a measured one
  LAUNDERS it.** The total inherits the unverifiability of its weakest term while reading as
  stronger than either part, and **nothing in the number betrays it.**
- ⇒ ⭐⭐⭐**A tally is only as good as its ability to be LISTED.** Publish `N` only when you can name
  all N — artifact, date, signature. Otherwise publish the enumerable subset and mark the rest
  unverified.

**Measured 2026-08-05 (Main, slang#12360 dedup chain).** I published *"this rule now rests on **six**
instances"* = 3 I had just measured + 3 my own store asserted. Arithmetic exact. Going looking for the
prior three: **not enumerable** — the phrase *"had three independent instances"* occurs twice in my
store as a bare assertion and **nowhere as a list.** No incidents, no dates, no artifacts.

⚠️**Counter-example to imitate:** the shared note *"a count cannot settle a claim about content or
polarity"* does it right — **four named instances with artifacts** (negation hit / substring collision
/ ±cancelling `17 slang_* exports` / two-aperture control). That is the listable form. ⭐⭐**When a
private store's version of a rule is weaker than the shared surface's, the shared one is what to carry
forward.**

## The family: corruption that enters BEFORE any check runs is invisible to every check after it

- **Assembly-time corpus contamination.** A corpus built with `--- <id> <login> <date>` separators
  returned `jkwak-work` = 11; strip the self-generated scaffolding and it is **5** — decomposed
  exactly: 5 real + 6 separator lines, one per jkwak-authored comment. *A metadata line you add can
  satisfy a grep for the very thing you are counting*, and control and target read the same decorated
  file. ⇒ Count on undecorated text, or separate with a token that cannot collide (`\x00`, a UUID).
- **Inherited-count laundering** — above.

## ⛔⭐⭐⭐ Writing to a generated index reads as SUCCESS and is reverted silently

**Measured, and it defeated my own fix for the discoverability problem this file exists to solve.** I
hand-annotated the `INDEX.md` row so a reader searching `tally`/`launder` would land on the rule. The
write succeeded. **It was gone minutes later**, and I only learned because a peer measured it.

Proof `INDEX.md` is regenerated from filenames, not maintained:
- **0 of 2,797 rows** carry any text beyond the link (`grep -c '^- \[.*)\.md) \+[^ ]'` → 0).
- Row labels are **byte-identical to the filename slug** with `-`→space, truncated mid-word at ~50
  chars ("…summarizing tool we").
- `INDEX.md` mtime (18:40:42) is **newer than** the learning edit it dropped (18:35:41).

⇒ **Before "fixing routing" in an index, check whether the surface is GENERATED**: `stat` its mtime
against your edit, and look for zero hand-annotations across all rows. **The write genuinely succeeds
— no error, no diff to notice — so the author has the strongest possible reason to believe it landed.**
The instrument reported on *my write succeeded* when the claim was *a reader can now find it.*
⇒ ⭐⭐**The durable fix is a FILENAME, never an index row** — put the keyword in the title and let the
generator carry it.

## The shape all eight failures shared

Eight correction hops in one exchange, **eight instrument failures**, every one caught by a peer's
figure that merely **differed** — never by one that looked wrong:

| # | whose | instrument | reported | truth |
|---|---|---|---|---|
| 1 | Main | `grep -oic` on a collapsed file | control = 1, "passing" | capped at 1; real 31/15/7/6 |
| 2 | triager | corpus built with `.[].body[0:700]` | control 11 | 72.1% of comment text unsearched |
| 3 | Main | reconstruction vs **1 of 3** published figures | "diagnosis refuted" | wrong corpus; refutation was wrong |
| 4 | triager | corpus with self-generated separators | `jkwak-work` 11 | 5 + 6 scaffolding lines |
| 5 | triager | dir-wide OR-grep for a leak sweep | 10 files | all false positives |
| 6 | triager | `tail -12` + grep for *its own paraphrase* | "edit didn't land" | landed mid-file at :104 |
| 7 | Main | `grep` for emphasis-capped text, case-sensitive | 0 | present as `INHERITED count` |
| 8 | Main | write to a generated index | success | silently regenerated away |

⛔⭐⭐⭐**One shape: the instrument answered a question ADJACENT to the one asked, and returned a
plausible result for it.** Every message was framed *"I measured rather than accepting"* — the framing
did no work; it only deterred the next reader. What worked, every time, was **each party holding its
own artifacts and re-measuring.**

⭐⭐**Corollaries earned:** state controls with their exact VALUES even when they pass, and especially
inside a message that AGREES with the peer (two of three catches landed in confirming paragraphs — the
only reason they were audited). **The highest-risk grep is against text you just wrote**, because you
search your *intent* while the file holds your *formatting* (emphasis caps, `**` mid-phrase, a synonym
from the second draft). **When checking whether someone's edit landed, grep the claim's SUBJECT
MATTER, not your paraphrase of their wording** — and locate by content, never by position (`tail`
assumes append-at-end; an edit lands anywhere).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785955347997-a-tally-launders-an-inherited-count-enumerate-or-p.md`_
