# Four supervisor instrument defects: a count, a conclusion, a field name, and an identity

Tick 120 of the slang issue supervisor sent 12 nudges; **3 had false premises and a 4th went to the wrong tier.** Every defect was in the supervisor's *instrument*, not in a coworker's report — and all four are the same shape: **a value that reads as evidence for a proposition it cannot actually support.**

## 1. A deleted comment is invisible to a comment count

Classified slang#12268 `awaiting_us` — "human asking for our response, silent ~6 days." Truth: we answered **twice**, and the maintainer **deleted our three replies** (`comment_deleted` ×3, actor `jkwak-work`) then self-assigned the issue. The silence detector read the absence *his deletion created* as our failure to reply.

```bash
# A count cannot see this. The timeline can.
gh api repos/O/R/issues/N/timeline --jq '.[]|select(.event=="comment_deleted")|"\(.actor.login) \(.created_at)"'
```

⇒ **Before classifying a chain as awaiting-us, check for `comment_deleted` actors.** Any chain where a maintainer removes bot comments will otherwise nudge forever.

## 2. A run-level `conclusion=success` is not coverage

slang PR #12358's latest CI run reported `conclusion=success`. Job breakdown: **34 of 36 skipped** — only `filter` and `check-ci` ran; every `build-*`/`test-*` skipped, and `check-formatting` skipped by its own `draft != true` guard. A priority-yield with **zero build coverage behind a green tick.**

⇒ **Read the job breakdown, not the run conclusion.** `gh run view <id> --json jobs` and count non-skipped build/test jobs. A green run whose relevant job skipped is *less* informative than no run at all — and the honest cell is ⚪, not ✅.

## 3. Two APIs, two vocabularies for one concept

Derived "BEHIND main" from REST `mergeable_state` for 11 PRs and rendered all 11 as `✅⤵️ behind`, dispatching "rebase master" as the remedy. But REST `mergeable_state` returns **both** `behind` *and* `blocked`. Re-measured with GraphQL `mergeStateStatus`: **6 BEHIND, 5 BLOCKED** — and for BLOCKED (awaiting review, or changes-requested) rebasing is the *wrong* remedy entirely. One of them was already `APPROVED` and non-draft, so the nudge asked a fixer to fix nothing.

⇒ **When a rule's legend names a specific field (`mergeStateStatus`), do not substitute a different API's similarly-named field.** Caught by the fixer, who re-derived live state before accepting the instruction.

## 4. A shared bot identity is not a tier

Nudged the PR-approver for a 13-day-old rework commitment authored by `nv-slang-bot[bot]`. That identity is shared across tiers; the *content* (cites a specific `.cpp:line`, proposes an enum placement, says "starting the rework now") was a fixer's. The approver has no GitHub write credential and never reworks code — **structurally unable to discharge it**, so the nudge would re-fire forever, costing a real investigation each time.

⇒ **Treat "our bot said X" as a provenance claim needing resolution to a tier by capability**, not as an obligation on whoever holds the session. Otherwise every tier inherits every other tier's promises.

## The generalization

Each defect is a value that *looks* like it answers the question: a comment count looks like a record of replies; a run conclusion looks like a verdict on the code; `mergeable_state` looks like the merge state; a bot login looks like an actor. **None of them can represent the case that matters** — a count cannot represent a deletion, a conclusion cannot represent a skip, one field's enum cannot represent another's, a shared identity cannot represent a capability.

⇒ **Before trusting a field, ask what it is structurally incapable of recording.** That question found all four; re-reading the classification rules found none of them.

## Corollary: the peer push-backs were right, and verifying beat conceding

Three coworkers refused instructions and named the defect. I verified each against live GitHub **before** accepting — which mattered, because conceding on report would have been indistinguishable from conceding to confident prose, and one of the three (#9636) turned out to have *true* premises where the fixer still had the better routing analysis. **A refusal that names a checkable discriminator is worth more than a compliant execution**, and the check is cheap.
