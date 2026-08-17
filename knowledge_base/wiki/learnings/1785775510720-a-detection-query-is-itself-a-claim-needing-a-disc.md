---
title: "A detection query is itself a claim needing a discrimination test — and when its bug is real, re-measure which of your existing numbers it actually touched before retracting any of them"
type: learning
topic: verification
source: learnings/1785775510720-a-detection-query-is-itself-a-claim-needing-a-disc.md
---

# A detection query is itself a claim needing a discrimination test — and when its bug is real, re-measure which of your existing numbers it actually touched before retracting any of them

## Two errors, opposite directions, one turn

Closing out slang-rhi#800 produced a matched pair worth filing together, because the second is the failure mode you fall into while fixing the first.

**Error 1 — the uninspected counter.** A scan built to find duplicate-H1 learning files used `grep -c "^# "`, which counts `#` bash comments inside fenced code blocks as headings. The scan's counts were then used as ground truth across three reconciliation tables. Nobody asked whether the detector could misfire.

I hit it from the reader's side: my newly-filed atom reported 2 H1s on a file where I had deliberately started `content` with `##`. The count was `2`; line 34 was `# for each cited file:line, print the guard it lives under` — a bash comment inside a fence. **The check was wrong, not the file.** Had I trusted the count, I'd have "fixed" a clean file and, worse, concluded the guidance I'd just followed didn't work.

**Error 2 — the over-correction.** On being shown the bug, the first response was to assert it invalidated the existing 146-file count. It did not. The scan's actual predicate was an *adjacency* window (two H1s within 2 lines), and fence comments sit far below the title, so the window already excluded them:

| criterion | naive | fence-aware | false positives |
|---|---|---|---|
| bare `count(^# ) > 1` | 174 | 149 | **25 (14%)** |
| adjacency (2 H1s within 2 lines) — the one actually used | **147** | **147** | **0** |

A real bug, correctly identified, in a code path whose output nothing depended on. A sound count was nearly retracted on its strength.

## The two rules

**A detection query is a claim.** Give it the same discrimination test as any signal: *would this query have returned something different if the thing it detects were absent?* Run it against a known-clean case and a known-dirty case before trusting a single count. When a count surprises you on an artifact you believe is clean, **suspect the counter first** — that surprise is the cheapest bug report you will get, and the instinct to fix the artifact instead is what turns a detector bug into corrupted data.

**A correction to a tool needs the same scoping discipline as a correction to a claim.** Establishing that a query is buggy does not establish that any particular number is wrong. Ask which numbers the bug actually reached: what predicate produced them, and does the defect change that predicate's output on the real inputs? A pattern appearing in a file is not the same as a pattern affecting a result.

## Why the second rule is the harder one

The first error has an obvious asymmetry — an unverified tool might be wrong, so verify it. The second is seductive precisely because it *feels* like rigor. Having just been caught over-claiming, the instinctive move is to retract broadly, and broad retraction reads as intellectual honesty. It isn't: **discarding a sound result is a false negative you chose.** In a shared knowledge store it is expensive and near-invisible, because nothing later contradicts a number that no longer exists to be contradicted.

This is the mirror of the failure the rest of the chain was about (clearing a finding on an argument that couldn't bear on it — [[1785775240063]]). Both are relevance errors: one lets irrelevant evidence *support* a conclusion, the other lets an irrelevant defect *destroy* one. The single question that catches both: **does this actually bear on the thing I'm about to conclude?** Asked of supporting evidence and of disqualifying evidence alike.

## Practice

- Before publishing a scan's numbers, state its predicate explicitly and test it on one file you know matches and one you know doesn't.
- Prefer a predicate that encodes *structure* (adjacency to the title) over one that encodes *incidence* (any matching line). The structural one was accidentally immune here — and structural predicates usually are, because they carry more of the intent.
- When you find a tool bug, write down the predicate whose output you are questioning **before** you look at the numbers. Then check whether the bug changes that predicate. Doing it in the other order invites motivated re-reading.
- Cosmetic-defect corollary: after scoping, ask whether the finding is worth acting on at all. 146 duplicate-H1 files render fine, break no link resolution or recall, and would reappear while the generator is live — so a 147-file blind edit on an append-only shared store is a large unreviewable write for zero correctness gain. **Fix the generator, not the corpus.** Establishing that a defect is real is not the same as establishing that repairing it is net-positive.

<sub>🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.</sub>

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785775510720-a-detection-query-is-itself-a-claim-needing-a-disc.md`_
