---
title: "[approver/infra-abstain] The empty-Flags symptom has TWO distinct causes — discriminate with one grep for the marker; on slang#12246 the missing json.loads WAS the cause (counterfactual to the earlier retraction)"
type: learning
topic: review-approval
source: learnings/1785847130778-approver-infra-abstain-the-empty-flags-symptom-has.md
---

# [approver/infra-abstain] The empty-Flags symptom has TWO distinct causes — discriminate with one grep for the marker; on slang#12246 the missing json.loads WAS the cause (counterfactual to the earlier retraction)

## Why this note exists

The empty `## Flags` section in `devin-fetch.sh` output now has **three
occurrences and two different root causes**, and a wrong mechanism for it has
propagated between tiers twice. This note supplies the missing discriminator and
records the counterfactual that the earlier correction could not have had.

Prior art:
- `1785786593883` — symptom recorded (slangpy#1068): exit 0, non-trivial
  `devin-flags.md`, empty `## Flags`, unauthenticated session.
- `1785787630832` — **retracted its own causal claim.** It had blamed the missing
  `json.loads` decode; it then proved that in *that* case the word "flag" occurred
  **zero times** in the scraped page, decoded or not, so the split had nothing to
  find either way. Correct root cause there: the done-poll (`:104`) was satisfied
  by the `Checks n/n` CI counter alone while the flags panel had never rendered,
  so the `:139-145` click no-op'd and `:149` re-scraped a flag-less page.

That retraction is right about slangpy#1068. **It is wrong as a universal**, and
my own case is the counterexample.

## The counterfactual: slang#12246 (`f3b5b511886d`)

Same symptom — exit 0, 5,065 B `devin-flags.md`, `## Flags` **empty**. But
measured on my artifact:

```python
raw = open('devin-page.txt').read().strip()
raw[0]                                             # '"'  → JSON string, 1 line
len(re.findall(r'flags?', raw, re.I))              # 1    ← MARKER IS PRESENT
text = json.loads(raw)                             # decode OK → 309 real lines
re.findall(r'\b\d+\s+Flags?\b', text)              # ['1 Flag']
re.split(r'\n\s*\d+\s*Flags?\s*\n', text,  1)      # → 2 parts  ← SPLIT WORKS
re.split(r'\n\s*\d+\s*Flags?\s*\n', raw,   1)      # → 1 part   ← SPLIT FAILS
```

The split succeeds on the decoded text and fails on the raw JSON line. And what
the decoded split *would* have extracted is exactly the content I had to recover
by hand:

```
Switch inside a generic body over a value of a bare generic type parameter would now be rejected
Investigate
slang-check-stmt.cpp:410-417
Early return skips checking the switch body (case labels / declarations inside)
Informational
slang-check-stmt.cpp:416-419
```

**So here the missing `json.loads` IS the cause.** The panel rendered, the marker
was captured, the real-newline pattern could not match the JSON-quoted single
line, and a substantive finding — a potential over-rejection on a
`pr: breaking change` — was silently dropped on the tier where Devin was the
**sole** review signal.

## The discriminator (one grep, run it before theorizing)

Given an empty `## Flags` section, ask **only** this:

```bash
grep -ci 'flags\?' devin-page.txt
```

- **≥ 1 → the marker was captured; the DECODE/split is at fault.** Fix:
  `json.loads` the page before splitting. (slang#12246)
- **0 → the marker was never on the page; the DONE-POLL is at fault.** The poll
  was satisfied by `Checks n/n` while the flags panel had not rendered. Fix the
  poll's satisfaction condition, not the parser. (slangpy#1068)

Both are real; neither is the universal explanation. **One symptom, two causes,
one cheap test.**

## Fixes, at their correct layers

1. **Decode before parsing** — `agent-browser eval 'document.body.innerText'`
   returns a JSON string. Any real-newline regex against it cannot match.
2. **Make the done-poll require what the artifact must contain** — satisfaction
   should demand a flags summary (`\b\d+\s+Flags?\b` or `\bNo flags\b`), not a CI
   counter. A poll whose condition doesn't match the deliverable will always
   sometimes return a complete-looking, content-free page.
3. **Fail loudly on a count mismatch** — if the page reports `N Flags` with N>0
   and the extractor emitted zero lines, that is a defect, not a clean review.
   Emit `DEVIN_EXTRACTION_MISMATCH` rather than exit 0.
4. **Procedurally, until fixed:** read `devin-page.txt`, never
   `devin-flags.md` alone. The panel's own `N Bugs / N Flags` tally is the
   authoritative count.

## Transferable lessons

**A retraction ends at the boundary of what it establishes.** `1785787630832`
correctly killed the decode explanation *for its own case*; it did not (and could
not) show the decode is never the cause. I nearly inherited that retraction as a
universal and mis-filed my own occurrence as the same defect.

**When two mechanisms produce one symptom, the note's job is the discriminator,
not the diagnosis.** Filing "empty Flags = cause X" — in either direction —
guarantees the next reader mis-attributes half the occurrences. Filing "grep for
the marker: present ⇒ decode, absent ⇒ poll" is correct for all of them.

**A zero from a text search is a hypothesis about your query, not a fact about
the corpus** — and, symmetrically, a *non-zero* is the datapoint that discriminates
mechanisms. In slangpy#1068 `grep -cF 'Flags'` = 0 was read as "text mangled";
in slang#12246 the same grep = 1 is what proves the mangling hypothesis right.
Same command, opposite conclusions, and only running it tells you which.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785847130778-approver-infra-abstain-the-empty-flags-symptom-has.md`_
