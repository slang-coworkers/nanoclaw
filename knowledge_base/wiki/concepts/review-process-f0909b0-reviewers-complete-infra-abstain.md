---
title: reviewers_complete, NO_REVIEW_SIGNAL & calibration — never self-review in place of the missing doc
type: concept
group: review-process
tags: [reviewers-complete, no-review-signal, bot-authored, self-review, calibration-join, self-merge, retry, block-mandate, approver]
source_count: 11
---

## TL;DR

`reviewers_complete` is a fact about the **PIPELINE** (did a trusted reviewer look
at THIS head — harvest exit 0 OR Devin exit 0?), NOT about the code's quality. The
recurring, dangerous error is promoting "my own trace is clean AND CI is green" into
"the review is complete". A clean self-trace feels like rigor — but it is *your*
rigor, and the approval contract does not accept it as a review signal. "Investigation
can only add caution, never upgrade a doc's verdict toward approval."

Core rules:

- **Bot-authored PRs depend entirely on Devin.** Production `claude-pr-review.yml` and
  CodeRabbit skip bot/fixer branches by design, so exit 20 there is correct — decide
  from Devin (do NOT round to ABSTAIN just because there's no primary bot review).
  But when Devin *also* fails (timeout/stale), it is `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`,
  full stop — a real infra gap, not a code judgment.
- **A transient absence is retryable; a structural one is not.** A Devin timeout is a
  fact about your patience, not the world — one bounded retry flipped a
  NO_REVIEW_SIGNAL abstain into a BLOCK. ABSTAIN is the one state with no second
  reviewer (it skips the critique gate), so it needs the *highest* evidence bar on its
  inputs, not the lowest.
- **A review 🔴 mandates BLOCK — mechanically.** Assessing the bug a false positive is
  NOT grounds to downgrade to the milder ABSTAIN (that is an upgrade-toward-approval,
  and it bypasses the critique gate that BLOCK requires). Put the false-positive read
  in the challenger field for the human join.
- **Calibration joins must be weighted by whether the review gate fired.** A self-merge
  past an unfulfilled review request is a LOW-INFORMATION join; "0 human reviews" is a
  claim about ONE of three GitHub surfaces. A synchronize that lands the substantive
  commit after the bot's last review strands the head with no signal.

Confirmed calibration: on clean bot-authored PRs, a Devin-only WOULD_APPROVE and a
NO_REVIEW_SIGNAL abstain both merged byte-identical to the decided head — the abstain
cost a signal, not a catch, motivating a longer Devin deadline for the Devin-only tier.

## The self-review temptation — reviewers_complete is about the pipeline

The sharpest statement is slang-rhi#836: the change was small, clean, maintainer-
authored, directionally correct on an independent trace, and all 19 CI configs were
green — "that combination is seductive; it makes WOULD_APPROVE feel obviously right".
But CodeRabbit had reviewed only the old head, its status `success` meant "Review rate
limited" (it punted), and Devin timed out — so no head-current bot review of the
substantive commit existed. "The approver's own code reading + green CI are NOT a
substitutable review signal — treating them as one is the self-review the hard rules
forbid" → `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` [slang-rhi synchronize mid-review strands the head with NO head-current review signal](../learnings/1786609068048-approver-infra-abstain-slang-rhi-synchronize-mid-r.md).
The DECISION_REVIEW critique caught the same author having set
`reviewers_complete=true` from a self-trace + green CI even though the prose *honestly*
stated CodeRabbit reviewed the old head and Devin timed out — "the structured
completeness field contradicted my own provenance narrative". The mechanical check
before writing `reviewers_complete:true`: "which artifact is the head-current review,
harvest exit 0 or Devin exit 0? If the answer is 'my own trace' or 'CI', it is false" —
and "when a decision FEELS obvious because my trace is clean, that is the trigger to
re-check the review-signal precondition, not to skip it" [DECISION_REVIEW caught reviewers_complete=true set from a self-trace + green CI](../learnings/1786609084892-approver-critique-mustfix-decision-review-caught-r.md).

## Bot-authored PRs: the Devin single-point-of-failure

Bot-authored PRs are the systematic contributor to the infra-abstain rate. On
slang#12468 (a genuine one-line SPIRV fix a human had APPROVED) the pipeline produced
*zero* review signal: harvest exit 20 (production + CodeRabbit both skip bot branches
by design — the author-bot's own COMMENTED review is not a production review), and
Devin exit 3 (30-min timeout). "No bot review AND no Devin ⇒ `reviewers_complete:false`
⇒ Step 2 short-circuits to ABSTAIN_INFRA — this is the WHOLE ballgame for bot-authored
PRs: they depend entirely on Devin, so any Devin timeout is an automatic infra abstain".
Do NOT let a clean challenger read or a pre-existing human APPROVE tempt a WOULD_APPROVE
[bot-authored PR + Devin timeout = automatic NO_REVIEW_SIGNAL](../learnings/1786559968567-approver-infra-abstain-bot-authored-pr-devin-timeo.md).
The same on the docs-tooling PR slang#12511: all 6 clauses passed, CI green, a human
had approved, yet zero *review* signal — "CI-green is a clause input, not a Step-2
verdict prior; with no prior there is nothing to carry into the challenger", so the
abstain is mandatory even on a change that reads clean [bot-authored docs PR: production skips + Devin 30m timeout = NO_REVIEW_SIGNAL](../learnings/1786606687196-approver-infra-abstain-bot-authored-docs-pr-produc.md).

The calibration joins confirm both directions are sound. slang#12491 (bot-authored,
Devin ran clean 0/0) merged byte-identical to the WOULD_APPROVE head — "confirms the
Devin-only fallback tier is a sound basis for WOULD_APPROVE on a bot-authored PR, not a
reason to abstain; only 'no bot review AND no Devin signal' is NO_REVIEW_SIGNAL"
[Devin-only WOULD_APPROVE on bot-authored PR #12491 merged unchanged — tier calibration confirmed](../learnings/1786608082569-approver-confirmed-devin-only-would-approve-on-bot.md).
And slang#12511's NO_REVIEW_SIGNAL abstain *also* merged clean at the decided head —
"the abstain was procedurally correct and the clean merge confirms the code was
approvable; the abstain cost a signal, not a catch", the confirming data point for
raising `devin-fetch.sh --max-minutes` on the Devin-only tier so these convert to real
WOULD_APPROVE signals rather than being lost [Join confirmed: bot-authored docs-tooling PR NO_REVIEW_SIGNAL merged clean at decided head](../learnings/1786609517895-approver-infra-abstain-join-confirmed-bot-authored.md).
The calibration note on slang#12468 R2 (once Devin completed, 0 bugs/0 flags →
WOULD_APPROVE) gives the technique for clearing the two informational notes a reviewer
raises on an unwrap-before-classify fix: a **monotonicity argument** (each classifier
flag can only move false→true toward the CORRECT opcode, so "the failure direction does
not exist" — you need the *sign* of every possible change, not an enumeration of every
attributed shape), and a "sibling site still attribute-blind" note clears as a missed
optimization if the fallthrough opcode is already valid [Devin-only clean-review WOULD_APPROVE on a bot-authored unorm/snorm SPIRV fix](../learnings/1786610332673-approver-challenger-calibration-devin-only-clean-r.md).

## The transient-retry bar and the BLOCK mandate

Because ABSTAIN is the one state with no second reviewer, its inputs need the highest
bar. On slang-rhi#826 the first Devin run returned exit 3 (timeout) → the author derived
NO_REVIEW_SIGNAL; one bounded retry of the identical command returned exit 0 with a live
review carrying four named findings → the correct decision was BLOCK. "A timeout is a
statement about my waiting window, not whether the artifact exists; recording the strong
claim from the weak evidence converts a transient into a permanent verdict — and because
ABSTAIN_* skips the critique gate, nothing downstream would have caught it." Distinguish
**structural absence** (`found:false`/exit 20 because the repo has no such pipeline —
retrying is pointless) from **transient absence** (timeout/rate-limit/never-settled —
always retry once), and bind the retry to the decision point [a Devin timeout is a fact about my patience — ONE bounded retry flipped NO_REVIEW_SIGNAL into a verified BLOCK](../learnings/1786385970118-approver-infra-abstain-a-devin-timeout-is-a-fact-a.md).

The BLOCK mandate is mechanical and asymmetric. On slang#12465 Devin filed a 🔴, the
author read the source and found it a genuine false positive, and recorded
`ABSTAIN_POLICY:CHALLENGER_CONCERN` reasoning "can't clear a 🔴 into approval but can't
BLOCK a bug I disproved". That is wrong twice: Step 2 short-circuits ("any 🔴 ⇒ BLOCK",
Step 3 never runs, so a Step-3 reason code is procedurally impossible), and downgrading
a mandated BLOCK to the *milder* ABSTAIN is itself an upgrade-toward-approval that the
skill forbids — plus ABSTAIN_* is gate-relaxed, so the mislabel bypassed the critique
gate. "A BLOCK with `reason_code=RED_BUG:<file:line>` is the correct output even when
you're confident the flagged bug is not real; put the false-positive assessment in the
challenger/context field for the human join" [a review 🔴 mandates BLOCK — assessing it a false positive is not grounds to downgrade to ABSTAIN](../learnings/1786482488457-approver-critique-mustfix-a-review-mandates-block-.md).

## Weighting the calibration join

A terminal "merged" state is not automatically a full-strength APPROVED-equivalent. On
slang-rhi#827 the PR merged at the pinned head 13 min after opening, but `mergedBy ==
author`, `bmillsNV` was still in `reviewRequests`, `reviewDecision=REVIEW_REQUIRED` was
bypassed, and the only review row was `coderabbitai COMMENTED` — **zero human reviews**.
"A self-merge past an unfulfilled review request satisfies the mapping's form while
carrying none of its evidence; score it full-strength and you train the loop to relax on
exactly the changes that got the least scrutiny." Classify the join STRONG (a non-author
human APPROVED) vs WEAK before scoring, record the disagreement either way, and note a
post-merge Devin capture is valid *corroboration* but invalid as the *sole* basis for
upgrading severity [a self-merge is a LOW-INFORMATION join — "merged" can measure author confidence rather than review](../learnings/1786442119950-approver-human-disagreement-a-self-merge-is-a-low-.md).
And "0 human reviews" is a claim about ONE of three surfaces: on slangpy#1050 the mode
derivation ran `gh pr view --json reviews` only, invisible to a reviewer who leaves only
inline (`pulls/N/comments`) or conversation (`issues/N/comments`) comments — "the
conclusion survived; the method did not; I was right by luck of this PR's composition".
Derive `mode` from the union of all three, filter `login not ending in [bot]`, and judge
harvest staleness by **commit distance, never timestamp age** (an actively-developed
branch runs a persistent one-revision review lag) [ "0 human reviews" is a claim about ONE GitHub surface — reviews, review_comments and issue_comments are three](../learnings/1786442894571-approver-clause-gap-0-human-reviews-is-a-claim-abo.md).

**Source learnings (11):**

- [a Devin timeout is a fact about my patience — ONE bounded retry flipped NO_REVIEW_SIGNAL into a verified BLOCK](../learnings/1786385970118-approver-infra-abstain-a-devin-timeout-is-a-fact-a.md) — distinguish structural (don't retry) from transient (always retry once) absence; ABSTAIN skips the critique gate so its inputs need the highest bar.
- [a self-merge is a LOW-INFORMATION join — "merged" can measure author confidence rather than review](../learnings/1786442119950-approver-human-disagreement-a-self-merge-is-a-low-.md) — classify a join STRONG vs WEAK by whether the review gate fired; a post-merge artifact is valid corroboration, invalid as the sole severity-upgrade basis.
- ["0 human reviews" is a claim about ONE GitHub surface — reviews, review_comments and issue_comments are three](../learnings/1786442894571-approver-clause-gap-0-human-reviews-is-a-claim-abo.md) — derive mode from the union of all three surfaces; judge staleness by commit distance not timestamp age.
- [a review 🔴 mandates BLOCK — assessing it a false positive is not grounds to downgrade to ABSTAIN](../learnings/1786482488457-approver-critique-mustfix-a-review-mandates-block-.md) — Step 2 short-circuits so a Step-3 reason code is impossible; ABSTAIN is milder than BLOCK so downgrading is an upgrade-toward-approval and it bypasses the gate.
- [bot-authored PR + Devin timeout = automatic NO_REVIEW_SIGNAL](../learnings/1786559968567-approver-infra-abstain-bot-authored-pr-devin-timeo.md) — production + CodeRabbit skip bot branches by design; a clean challenger read or human APPROVE does not license WOULD_APPROVE; poll the file/PID not the subagent's summary.
- [bot-authored docs PR: production skips + Devin 30m timeout = NO_REVIEW_SIGNAL](../learnings/1786606687196-approver-infra-abstain-bot-authored-docs-pr-produc.md) — CI-green is a clause input, not a Step-2 verdict prior; with no prior there is nothing to carry into the challenger; the human approve is the backstop, shadow mode never auto-approves.
- [Devin-only WOULD_APPROVE on bot-authored PR #12491 merged unchanged — tier calibration confirmed](../learnings/1786608082569-approver-confirmed-devin-only-would-approve-on-bot.md) — exit 20 on a bot-authored PR → decide from Devin, do NOT round to ABSTAIN; only "no bot review AND no Devin" is NO_REVIEW_SIGNAL.
- [slang-rhi synchronize mid-review strands the head with NO head-current review signal → NO_REVIEW_SIGNAL](../learnings/1786609068048-approver-infra-abstain-slang-rhi-synchronize-mid-r.md) — a green CodeRabbit status doesn't imply it reviewed the head (read the footer range); the approver's own trace + green CI is not a substitutable signal.
- [DECISION_REVIEW caught reviewers_complete=true set from a self-trace + green CI](../learnings/1786609084892-approver-critique-mustfix-decision-review-caught-r.md) — the completeness field contradicted the honest provenance narrative; the mechanical check is "which artifact is the head-current review?"; the clean-trace-plus-green-CI combo is a false-safe generator.
- [Join confirmed: bot-authored docs-tooling PR NO_REVIEW_SIGNAL merged clean at decided head](../learnings/1786609517895-approver-infra-abstain-join-confirmed-bot-authored.md) — the abstain cost a signal not a catch; confirming data point for raising the Devin deadline; the merge does not retroactively justify self-review.
- [Devin-only clean-review WOULD_APPROVE on a bot-authored unorm/snorm SPIRV fix](../learnings/1786610332673-approver-challenger-calibration-devin-only-clean-r.md) — a monotonicity argument (every flag flip selects the correct opcode) clears an unwrap-before-classify fix without a build; "sibling still attribute-blind" clears as a missed optimization if the fallthrough is valid.
