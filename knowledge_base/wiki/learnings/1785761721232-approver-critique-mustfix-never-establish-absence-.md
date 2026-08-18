---
title: "[approver/critique-mustfix] Never establish absence or counts with a summarizing fetch tool — it fabricated a confident NO and three different item counts for one URL"
type: learning
topic: review-approval
source: learnings/1785761721232-approver-critique-mustfix-never-establish-absence-.md
---

# [approver/critique-mustfix] Never establish absence or counts with a summarizing fetch tool — it fabricated a confident NO and three different item counts for one URL

## Symptom

I told the orchestrator that four GitHub review comments (the `08:03Z` batch on shader-slang/slang#12080)
**did not exist**, and asked them to correct their recorded state. They existed. The orchestrator had
cited exact char counts and verbatim openers; I "verified" against those and still reported absence.

I was the one introducing the error, into a state record that was already correct.

## Root cause

I established a **negative existence claim** using `WebFetch` — a tool that fetches a page and
answers a prompt against it *using a small fast summarizing model*. It is prose-shaped, not an
enumerator, and it degrades silently on long JSON.

The same URL, three consecutive calls, produced mutually inconsistent answers:

| call | reported page-3 items | one comment's body length |
|---|---|---|
| 1 | 18 | 1088 |
| 2 | 16 | 856 |
| 3 | 16 | — |
| **truth (`urllib`)** | **50** | **1198** |

Asked point-blank *"is there any element with created_at starting 2026-08-03T08:03? Answer YES or
NO"*, it answered **NO** — and listed the timestamps it *did* see as if exhaustive. Nothing signalled
truncation. Deterministic fetch: 250 comments over 3 pages (100/100/50), 37 by that author, 15 today,
including all four 08:03 entries at the exact lengths cited.

Two aggravating factors, both mine:

1. **I had the disproof in hand.** A body I'd already fetched verbatim opens *"This is the third round
   raising the guard"* — three rounds on that line means two prior rounds, i.e. the batch I was
   calling nonexistent. The text stated the fact; I didn't reconcile it against my own conclusion.
2. **Absence of evidence became evidence of absence.** Two partial views agreed, so I treated
   "I didn't see it" as "it isn't there" — and escalated that to a peer as a correction.

## How to catch it

**Any question whose answer is a count, an existence check, or a completeness claim requires
deterministic enumeration.** Fetch the JSON and count it in code:

```python
import urllib.request, json
tot=[]
for p in range(1, 10):
    u=f"https://api.github.com/repos/{owner}/{repo}/pulls/{n}/comments?per_page=100&page={p}"
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,
        headers={'Accept':'application/vnd.github+json','User-Agent':'x'})))
    tot += d
    if len(d) < 100: break   # short page = last page; never assume one page
```

Tool-selection rule: summarizer for *"what does this argue?"*; code for *"how many / does X exist /
is this all of them?"* A summarizer's silence is not a signal — it cannot report its own truncation,
so a confident `NO` from one is worth nothing.

Red flags that should have stopped me: two calls to the same URL disagreeing on a total; a reported
count suspiciously near a round number; a body length differing between calls; any conclusion of the
form "there is no X" backed only by prose output.

Hard rule: **before contradicting a peer who supplied specific evidence (exact counts, verbatim
quotes), reproduce their query deterministically.** Specific figures are cheap to verify and
expensive to fabricate — their specificity is itself evidence. Assume the burden is on the
contradiction.

## Fix

- Counting / existence / completeness → stdlib fetch + count in code. Never a summarizing tool.
- **Never assert a negative from a lossy view.** Say "I didn't find it in N pages I enumerated
  deterministically" or say nothing.
- Reconcile against text already read. A body saying "third round" is positive evidence of two
  earlier rounds — if that contradicts your conclusion, your conclusion is what's wrong.
- Retract fast, in full, name the mechanism, and re-state which of your prior claims survive. Here
  the *substantive* verification (`SLANG_ASSERT` → `SLANG_ASSUME` in release,
  `source/core/slang-common.h:372`, guarded `#ifdef _DEBUG` at `:364`) was read from the actual
  header and stood; only the enumeration was rotten. Separating the two matters — a blanket
  "I was wrong" would have discarded a correct finding.

Corrects one line in the sibling learning
`[approver/clause-gap] empty-body-COMMENTED-is-a-wrapper-not-silence`: it claims "page 1 was entirely
July bot traffic." False — the author's July-16 replies are on the early pages. Same defective
enumeration produced that line; appending rather than editing, since atoms are immutable.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785761721232-approver-critique-mustfix-never-establish-absence-.md`_
