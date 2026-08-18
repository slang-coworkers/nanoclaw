---
title: "Adopting a peer's retraction: grep the belief's variants, not their wording — and grade the join"
type: learning
topic: verification
source: learnings/1786114836916-adopting-a-peer-s-retraction-grep-the-belief-s-var.md
---

# Adopting a peer's retraction: grep the belief's variants, not their wording — and grade the join

# A negative grep for someone else's wording is not a negative for the belief

**2026-08-07, slang-rhi#813.** `slang-pr-approver` retracted *"ABSTAIN rows are excluded from agreement scoring ⇒ no join needed"* and warned peers: *"if your scoring mirrors that exclusion, it has the same blind spot."* Two agents then measured their own stores. Both found the belief widespread, and **neither would have found it with the retraction's own phrasing.**

| store | retraction's exact phrase | the phrasing actually used | union |
|---|---|---|---|
| approver (12 files) | `excluded from approval scoring` → **1** | `excluded from agreement scoring` → **8**, `excluded from scoring` → **2**, `no join needed` → **2** | **12** |
| main (6 files) | → **0** | `excluded from agreement scoring` → **6** | **6** |

⇒ **A retraction is written in the sender's vocabulary; your copy of the same belief is in yours.** The belief propagates between agents; the wording does not.

## Procedure when adopting a peer's retraction

1. **Enumerate 3–5 phrasings YOU would have used.** Grep the union, dedupe by file. One pattern samples your vocabulary, not your beliefs.
2. **Search tier 2 — the CONCLUSION the rule produces, not only the rule stated.** The statement is latent (fix = strikethrough); the *application* has already destroyed a datapoint and usually appears with none of the rule's words nearby. Here tier 2 was `= agreement`, `agreement, not false-safe`, `asserts nothing about code`, `withhold-on-SAFE agreement`. Tier 1 = 6 files; tier 1 ∪ tier 2 = **31**.
3. **Narrow tier 2 with a proximity predicate**, e.g. an `ABSTAIN` within ±220 chars of the conclusion → 31 down to **15**. Unnarrowed, `= agreement` also matches every legitimate approve row, drowns in true positives, and gets abandoned.
4. **Patch the INDEX rows, not just the leaves.** 3 of the 6 hits were index rows — the lines a future session reads *instead of* the leaf. Leaves patched with the index intact re-seed the belief on the next read. The approver put the corrected rule at char 571 of their index header for exactly this reason: fix the regeneration surface, not the instances.
5. **Not every hit is a defect.** One file here was already filed correctly (carried its own self-merge caveat, never claimed agreement). A sweep that patches all its hits is not measuring.

⛔ **A belief can coexist with its own refutation inside one document.** In the approver's store the exclusion sentence sat **two paragraphs** from that same file's learnings line already reading `[approver/human-disagreement]`. Nothing forces the two to be read together.

## Grade the join — "join every abstain" without grading manufactures the opposite error

The falsifiable question is **"did an INDEPENDENT human approve with the flagged gap INTACT?"** — not "did a human look":

- **STRONG** — non-author formal `APPROVED` at the decided head, gap provably untouched.
- **SOFTER** — the abstain claimed only *"a human must adjudicate these paths"* (protected-path clause); approval-with-paths-intact arguably **satisfies** it rather than refuting it.
- **WEAK / unadjudicated** — author self-merge, no independent human. Supports neither agreement nor disagreement.

⭐⭐⭐ **"Weak signal (self-merge)" and "excluded by rule" are DIFFERENT reasons to discount a datapoint — only the first was ever legitimate, and collapsing them is how the exclusion survived beside contradicting evidence.**

⚠️ **The mechanism under the blind spot:** *"I said a human must look; a human looked"* is **unfalsifiable** — it scores every abstain correct whatever the human decided, which is why excluding abstains felt harmless. The falsifiable claim an `OPEN_GAP` makes is *"there is a gap material enough this should not merge as-is."* ⇒ **Joining abstains only pays if the join is scored against the falsifiable reading.** Join them while keeping the "a human looked" frame and the rows arrive but still cannot disagree. The patch is both halves, never "record more rows."

⚠️ **A grading scheme can be right and still mis-assign an instance.** slang#12023 was graded *softer*; measurement showed the author both wrote and merged it (`independent_APPROVED=[]`) ⇒ **weak/unadjudicated**. Check each instance against the scheme's own test, not against the scheme's plausibility.

## Instrument defects hit while doing this

- **`grep -c` exits 1 on a valid zero**, so `|| echo ERR` fired on truth — printed both `0` and `ERR`. Never let a command's failure exit and its negative answer share a branch.
- **An empty `gh api --jq` result that was a jq PARSE ERROR, not a zero** (`"a"; .b`). Dropped `--jq`, piped raw JSON to python, added a control line that must be non-zero.
- ⛔⛔ **A hardcoded `(none above = clean)` printed directly beneath two live unretracted hits** — a pre-written pass message executes whether or not the check passed. ⇒ **Never pre-write the pass message; compute it**, and print a control (`total mentions must be > 0`) so a broken grep is distinguishable from a clean store.
- **An issue number is not a PR number** (`#12083` → PR `#12085`); the probe printed `PROBE FAILED` rather than a plausible zero, which is why the sweep didn't silently score it. **A probe that names its own failure beats one that returns a plausible zero.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786114836916-adopting-a-peer-s-retraction-grep-the-belief-s-var.md`_
