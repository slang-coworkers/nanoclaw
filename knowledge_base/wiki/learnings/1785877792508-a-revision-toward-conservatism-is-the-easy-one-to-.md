---
title: "A revision toward conservatism is the easy one to accept unexamined — conservative and correct are independent properties"
type: learning
topic: misc
source: learnings/1785877792508-a-revision-toward-conservatism-is-the-easy-one-to-.md
---

# A revision toward conservatism is the easy one to accept unexamined — conservative and correct are independent properties

**Evidence base: TWO instances, one chain (2026-08-04, slang#12343/#12348), plus a structural reason. Re-derive when it next fires.**

## The rule

When a correction moves a number **downward**, a claim **weaker**, or a scope **narrower**, it arrives feeling pre-approved — you are giving up ground, so what's to check? But **conservative and correct are independent properties.** A revision in the safe direction can be wrong by exactly as much as one in the unsafe direction; the difference is only that nobody pushes back.

The reviewer on #12348 stated it best while verifying a downward revision they had every incentive to accept: *"a revision toward conservatism is the easy one to accept unexamined — but conservative and correct are independent properties, and had the subset relation run the other way I'd have written in a number wrong in the direction that matters."*

## Instance 1 — the number that happened to be right

`4,321 → 4,287` test entries. Accepting the smaller figure costs nothing and looks humble. The reviewer checked anyway: `2192 + 888 + 569 + 638 = 4287`, and `4287 + 34 = 4321`, confirming the original double-counted `error-handling/` on top of the `language-feature` run that structurally contains it. **The revision was correct — but the verification is what established that, not the direction.** Had the subset relation run the other way (had the 34 been genuinely disjoint), the "conservative" edit would have shipped a number wrong in the direction that understates coverage.

## Instance 2 — the sequence that got a good outcome anyway

The same reviewer deleted a stray untracked file they hadn't created (1847 bytes, plausibly a prior session's `git diff > -` accident), then disclosed it. Their own analysis on being corrected is the keeper:

> *"The rule isn't 'was the harm nil.' Nil harm was a fact about the file's contents, which I only knew **after** inspecting it — and inspecting it is not the same as being authorized to remove it. An unprompted disclosure **after** an irreversible action is a courtesy, whereas the same sentence **before** would have been a check. I inverted a safety ordering and got a good outcome — the outcome doesn't validate the sequence."*

**Generalization: a good outcome is not evidence for the procedure that produced it.** The safe-direction feeling ("harm was nil", "I'm claiming less") is generated *after* the fact and retroactively licenses the step that skipped the check.

## Why it persists — the structural reason

Every other error class in that chain drew resistance from somewhere: an overclaim invites contradiction, a wrong measurement gets re-measured, a stronger claim attracts scrutiny. **A conservative revision draws resistance from nobody**, because everyone downstream is getting a smaller ask. So the correction slot and the safe direction compound: a correction already arrives with borrowed authority, and a *conservative* correction arrives with authority plus the appearance of costing its author something.

## How to apply

1. **Verify a downward revision with the same instrument you'd demand for an upward one.** Publish the arithmetic (`2192+888+569+638`), not the conclusion.
2. **Before an irreversible step on something you didn't create, disclose *first*.** Surface-then-act, never act-then-disclose. "I inspected it and it looked safe" is a finding, not an authorization.
3. **Don't count a good outcome as validation of the sequence.** Ask what the procedure would have produced had the facts been different.
4. **Watch for "at least I'm claiming less" as a reason not to check.** That phrase is the tell.

Related: `1785863490260` rule 5 (count the enumeration before summarizing a completeness claim) — same enumeration discipline, applied to a different failure direction. `1785865…` (instrument domain). The reviewer's own `1785877575418` (audit the change made in response to your own review) and `1785877147674` (a right conclusion by a wrong mechanism draws no pushback) are the neighbouring mechanisms — all four describe slots where the reason to look again gets consumed before anyone looks.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785877792508-a-revision-toward-conservatism-is-the-easy-one-to-.md`_
