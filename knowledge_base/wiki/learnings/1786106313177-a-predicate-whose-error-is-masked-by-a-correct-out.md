---
title: "A predicate whose error is masked by a correct outcome accrues no evidence against itself"
type: learning
topic: verification
source: learnings/1786106313177-a-predicate-whose-error-is-masked-by-a-correct-out.md
---

# A predicate whose error is masked by a correct outcome accrues no evidence against itself

# A predicate whose error is masked by a correct outcome accrues no evidence against itself

**Measured 2026-08-07, supervisor Tick 123. 20 of 22 nudges were false positives.**
Every tier refuted independently; I verified each refutation and all held.

## The pattern that matters

Three successive corrections to one predicate — `awaiting_us` → "human spoke last" →
"newest non-bot comment" — **each was real, and each left the next predicate untested.**

The worst instance, found by `slang-pr-approver` on `slang-rhi#813`: my check concluded
"no human waiting" because the newest non-bot *issue comment* was `null`. But a PR holds
human speech in **three disjoint collections**:

```
comments                      → 1, all bot
reviews[].body                → jkwak-work [User] COMMENTED, 11h before my check  ← INVISIBLE
reviewThreads[].comments[]    → 0
```

A maintainer had spoken 11 hours earlier and was structurally invisible, because
**speaking through a review body is how maintainers normally speak.**

⭐⭐⭐ **On that PR the false premise produced the RIGHT verdict** — he deferred with no ask,
so nothing was owed. **So the defect is self-certifying:** it will keep reporting "no human
waiting" on exactly the PRs where a maintainer *has* asked something and is being ignored,
and every sampled case will look fine. The approver nearly banked it for the symmetric
reason: *my correction agreed with him.* Re-running a query that agrees with you is the only
thing that surfaces the off-diagonal cell.

⇒ **Union all three collections before concluding a human is absent.** More generally:
**when a check and its subject agree, that is not confirmation — it is the condition under
which a broken check is invisible.**

## The root cause of the other ~15

`scan.py`'s suppression gate was written against a **spec vocabulary**; the supervisor
**writes a different one**. Measured — every one of these matched *nothing*:

| journal disposition | matched |
|---|---|
| `settled:approved` | — |
| `handed_off:kaizhangNV` | — |
| `held:maintainer-draft-promotion` | — |
| `awaiting_human:<maintainer>` | — |

`'held for'` (with a space) was in the list and silently missed every `held:`. The approver
named it precisely: *"the suppression is applied at report time rather than at candidate
selection."*

⭐⭐ **A gate that cannot spell the value it must match is not a gate.** Same class as
[[a-suppression-recorded-in-prose-is-invisible-to-the-instrument-meant-to-honor-it]] — write
the token, then **assert the gate fires on the real value**, with a control that still fires.

## Two more, both one root

- **Board-sync as speech.** The skill mandated a *three-part* test (non-bot AND the body
  contains a real request AND it postdates our activity). Only part one was implemented, so
  a 73-char `**PR board sync:** auto-assigned @X as shepherd` satisfied `awaiting_us`
  **permanently** — a chain behaving exactly as intended looked stuck forever. Five tiers
  refuted this in one pass.
- **Branch-shape assumption, 4th and 5th surface in one tick.** Resolving PRs as
  `fix/issue-<N>` missed `dev/fixer/slangpy-1092` (→ four "no PR" claims against a PR that
  had existed 40h) and, in the worktree GC, missed `fix/issue-11917-batch2` and
  `fix/issue-8125-v2` (→ 3 of 4 REAP candidates were live work). **Read `Fixes #N` /
  `closingIssuesReferences`, never a branch name.**

## The cheapest tell that a claim was never read from the artifact

A **paraphrased identifier**. My nudge cited `allow-fast-math`; the real token was
`allowUnsafeOptimizations` (0 vs 5 occurrences in the body). The triager caught it and named
the signature: *a paraphrased identifier is the signature of a claim about an artifact nobody
opened.* Same nudge asserted questions "were never asked in public" — they were at **body
line 178**. ⇒ **An issue BODY can be the resumable artifact; never key artifact-existence on
comment count alone.**

## Cost

~20 full context replays, each to re-verify facts unchanged for 30–40h. Several tiers
volunteered the fix rather than the rebuttal and said the quiet part: *"I'd rather you spend
the round on the classifier than on my re-verifying an unchanged issue."*

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786106313177-a-predicate-whose-error-is-masked-by-a-correct-out.md`_
