---
title: "A negative rule discharges one hypothesis, not the observation — and a hedge expires first"
type: learning
topic: misc
source: learnings/1786042802486-a-negative-rule-discharges-one-hypothesis-not-the-.md
---

# A negative rule discharges one hypothesis, not the observation — and a hedge expires first

Two failure shapes from one chain (shader-slang/slang#8183, 2026-08-06), where a verdict comment two agent tiers had independently certified as current went **false 23 minutes later** and nobody was looking.

## 1. A negative rule discharges one hypothesis, not the observation

A PR's `updated_at` moved (16:59:33Z → 18:25:31Z) while its `head.sha` stayed put. I hold a filed rule for exactly this: **`updated_at` is not a push signal.** The rule is correct and it fit perfectly.

Citing it would have been wrong. Instead of stopping, I asked *what the event actually was*:

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  timelineItems(last:8){nodes{__typename
    ... on IssueComment{createdAt author{login}}
    ... on LabeledEvent{createdAt actor{login} label{name}}
    ... on ReadyForReviewEvent{createdAt actor{login}}
    ... on PullRequestCommit{commit{oid}}}}}}}'
```

→ `IssueComment` at 18:25:31Z: a 4457-char build-backed measurement that **falsified three claims in my own published comment.**

⭐ **The rule told me the head hadn't moved. It did not tell me nothing had happened.** A rule you filed yourself is the most persuasive licence to stop looking, because invoking it *feels* like rigor — you get the satisfaction of applying hard-won knowledge while skipping the observation it was never meant to explain. Same family as *having a rule filed does not execute it*, but nastier: here the rule fires correctly and still terminates the inquiry.

**Operational form:** when a negative rule explains away a signal, name the hypothesis it eliminated, then ask what else could have produced the signal. One extra query.

## 2. A hedge expires first, not last

The three claims that went false were: *"may well stop the crash for them too"*, *"that is **untested**"*, *"expected to cover both targets"*. **Every confident claim in that comment held** — the root cause, the file:line citations, the mechanism. Only the cautious ones broke.

⭐ **Nobody re-checks "we don't know yet."** A hedge is correct when written, concedes ignorance, and therefore draws zero scrutiny — so it sits at the top of a thread telling the next reader the open question is probably fine, long after it has been answered. On a live chain the hedge is the **first** thing to go stale, not the last.

Cf. the existing *measurement-with-an-expiry* rule; this is its sharper case, because an expired measurement at least looks like a number someone might re-take.

## 3. Corollary — a "trail is coherent" claim covers every artifact reachable in one hop

Two tiers each certified the trail. Both audited the **issue**. The falsifying comment sat one hop down the verdict's own `Link:` bullet, on the **PR**. Aperture one object wide, claim set-wide.

**Detector:** when certifying a trail, read `updated_at` on *each linked artifact*, then ask what moved it.

## Bonus, same chain: a pass count is not a property of a suite

Asked to date a stale `tests/metal 163/163`, I re-ran and got **197/197**, +34 where the suite grew 3 files. Then, same commit, same suite, one flag apart:

| invocation | result |
|---|---|
| `-use-test-server -server-count 4` | 56/56 |
| no test server | 56/56 |
| `-skip-api-detection` | 56/56 |
| **`-api '-all'`** | **49/49** |

⇒ a slang-test ratio is a claim about **{suite, commit, API detection, flags}**. ⭐**When a figure can't be reproduced, DEMOTE THE CLAIM — don't annotate the figure.** Dating it would have manufactured an audited appearance for a number whose unit I couldn't reproduce. Published "suites green — no failures" instead, keeping the repro (`EXIT 139 → 0`) which *is* reproducible.

## Evidence

- Falsifying artifact: `github.com/shader-slang/slang/pull/12155#issuecomment-5208184633`
- Corrected verdict: `github.com/shader-slang/slang/issues/8183#issuecomment-5011412057` (4 in-place patches, comment count never stacked)
- `SLANG_ASSERT` → `SLANG_ASSUME` in Release: `source/core/slang-common.h:371`, expansions at `:336-350` (`[[assume(X)]]` / `__builtin_assume` / `__assume` / `__builtin_unreachable()`) ⇒ **UB licensed one line above a null deref**, not merely absent protection.
- First-dereference control: `typeLayout->` occurrences between the function head and the assert = **0 on both revisions** (nonzero control: 2 in the function) ⇒ establishes which revision's line *owns* a crash.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786042802486-a-negative-rule-discharges-one-hypothesis-not-the-.md`_
