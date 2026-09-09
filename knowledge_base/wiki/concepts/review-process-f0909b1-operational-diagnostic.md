---
title: Operational and epistemic discipline around the review loop — claims, probes, dark turns, supervisor false-flags
type: concept
group: review-process
tags: [epistemic-discipline, claim-about-a-state, provenance, dark-turn, supervisor-scan, requested-reviewers, maintainer-reframe, absence-probe]
source_count: 6
---

## TL;DR

A cluster of cross-cutting disciplines that surround the PR-review/approver loop rather than sit
inside a single stage. The common genus: an assertion about an artifact, a state, a provenance, or
an absence is a CLAIM that must be made true (or verified) at the moment it is published — not
inferred, not carried from memory, not read off a truncated preview.

- **"I corrected X above" is a claim about another artifact — edit the target first, then publish
  the sentence that references it.** And a maintainer's reframe of a bug is a checkable claim to
  reconcile, not an order to accept: confirm the mechanism from source, then check their conclusion
  across every shape you hold.
- **Don't assert an absence you didn't run the probe for.** A truncated grep preview is not the
  population; a "no GPU here" claim needs an actual `nvidia-smi`. Run the probe to completion and
  read its FULL output before writing "there is no X."
- **Verify a "you confabulated / merged X and Y" hypothesis against the actual transcript** — trace
  provenance to the originating message; the simpler explanation (the accuser forgot their own
  prior message) often beats the elaborate one.
- **A dark turn (agent emitted nothing) has distinguishable causes** — a genuine empty model return
  triggers the host's canonical fallback notice; separate it from a scratchpad-only turn or a
  tag-leak using the message log + JSONL transcripts.
- **Supervisor `awaiting_us` scans over-flag** — board-sync notices from human logins, bot tails
  that miss the bot_logins set, and closed/deleted issues are the recurring false-positives; the
  real per-tick actionable count is 0–2.
- **Never set `requested_reviewers` on a bot-authored PR** — a hard operator-level MUST NOT a peer
  ruling cannot waive; @-mention in the PR body instead.

## Claims about artifacts and states

The archetype: "I've corrected the cause in my verdict comment above" was posted while the verdict
itself was never edited (the session stopped mid-work), leaving a live comment pointing readers up to
a correction that wasn't there — WORSE than posting nothing, because it advertises a fix that doesn't
exist. A sentence like "corrected above / fixed in the PR / updated the doc" is a claim about the
state of another artifact: edit the target first (or same turn), then publish the pointer, and verify
with the platform's own metadata (`updated_at` changed, comment count unchanged for an edit). The same
atom carries a review-discipline lesson: a maintainer's reframe of a root cause is RIGHT to reconcile
but still needs adversarial review — confirm the mechanism from source, then check whether their
conclusion holds across every SHAPE you have (a different shape can hide a genuinely separate bug), and
pose the residual as a question to the authority rather than an assertion over them
(["I corrected X above" is a claim about an artifact — make it true before publishing; a maintainer reframe still needs adversarial review](../learnings/1786682865644-i-corrected-x-above-is-a-claim-about-an-artifact-m.md)).

The absence-probe discipline is the same genus applied to negatives. On PR #12598 two false-negative
claims survived only until the critique gate forced a re-read: "no `_setmode`/`_O_BINARY` in Slang's
own source" was concluded from a 2KB TRUNCATED preview of a 31KB grep result (the PAGE ≠ POPULATION
trap — in-tree hits existed); and "no GPU here" was written without running `nvidia-smi` (there IS an
L40S in the container). Before writing "there is no X," run the probe to completion and read its FULL
output — re-run a truncated grep with `output_mode=count` or a tighter path, and a hardware-absence
claim needs the actual `nvidia-smi`/`vulkaninfo`
([don't assert an absence you didn't run the probe for — truncated grep and skipped nvidia-smi both produced false negatives](../learnings/1787049086568-don-t-assert-an-absence-you-didn-t-run-the-probe-f.md)).

Provenance is a claim too. When a peer hypothesizes "you must have confabulated / merged X and Y"
about your own past output, don't just verify whether you said the quoted words — check WHO originated
the content. On the #12489 idle-trigger case, pulling the actual session transcript showed the trigger
was proposed by the PARENT'S OWN message, and the agent's replies just echoed it back; the simpler
explanation (the hypothesis-proposer forgot their prior message) beat the elaborate confabulation
theory
([verify a "confabulation" hypothesis against the actual transcript before accepting it](../learnings/1786782250406-verify-a-confabulation-hypothesis-against-the-actu.md)).

## Diagnosing a dark turn and filtering supervisor false-flags

When the host posts "The agent finished its turn without producing any output… please re-send it,"
that string is NanoClaw's canonical host-side fallback, emitted only when the SDK turn returns ZERO
assistant content blocks — distinct from a scratchpad-only turn (an `<internal>` block or bare prose
still shows content blocks, so it does NOT trigger the fallback) and from a tag-leak/transport
truncation (a partial fragment). Investigate via `ncl sessions messages <sess-id>` (the inbound and
fallback appear as adjacent in/out rows; trust seq ordering over the misleading stamp) and the Claude
Code JSONL transcripts (keyed by harness UUID, not the `sess-…` id; a restart mints a fresh UUID file,
and an empty-content turn may have no surviving transcript). Count how many times the fallback fired
and whether subsequent inbounds produced real output — if later inbounds woke the session normally, an
empty return is a one-off, not a dropped-inbound fault (measured baseline: 3 of ~367 transcripts)
([diagnosing a dark turn (agent emitted nothing) from host logs + transcripts](../learnings/1787273633815-diagnosing-a-dark-turn-agent-emitted-nothing-from-.md)).

The supervise-issues scan's `awaiting_us`/`action=nudge` rows are inflated by a standing ball==ours
over-flag bug, so ~184/185 flagged rows are noise and the real per-tick genuine count is 0–2. Three
recurring false-positives to check before nudging: (1) automated board-sync / shepherd-assign comments
posted by a HUMAN login (e.g. `jhelferty-nv`'s "**Automated notice** (PR board sync) — do not reply")
read as "human spoke last" but are not a real ask; (2) `coderabbitai`/`github-actions` bots that miss
the scan's bot_logins set read as human-last — verify the actual last-actor timeline; (3) "silent ≥4h
escalate" rows are often closed/deleted issues or malformed-key phantoms (resolve each with `gh issue
view` AND `gh pr view`; a sub-thread whose base issue is CLOSED → archive). The genuinely actionable
signal that survives all filters: a PR APPROVED by a real human but `mergeStateStatus=BEHIND` with no
fresh workflow_dispatch → a rebase nudge to the fixer
([supervisor scan awaiting_us false-flags: board-sync notices and bot reviewers](../learnings/1787532196124-supervisor-scan-awaiting-us-false-flags-board-sync.md)).

## The requested_reviewers hard MUST NOT

There is a hard operator/dev-team `[MUST NOT]`: never set `requested_reviewers` on a bot-authored
(nv-slang-bot) PR — not via `gh pr edit --add-reviewer`, `gh pr create --reviewer`, nor the API — and
it explicitly includes the issue reporter and any maintainer. This bites triage when a maintainer
EXPLICITLY asks "add me as a reviewer": the request cannot be honored via the reviewer field, and a
peer/triager ruling CANNOT waive an operator-level MUST NOT (only the operator can). The compliant
substitute is an @-mention in the PR body ("cc @maintainer — opened as a draft per your request in
#N"), which on a draft PR is also the more reliable path (GitHub defers review-request notifications
until ready-for-review). Don't preemptively escalate for a waiver just because a maintainer asked — the
@-mention satisfies intent; escalate only if they insist on the formal field after seeing the PR
([never set requested_reviewers on a bot-authored PR (dev-team MUST NOT)](../learnings/1787600504939-never-set-requested-reviewers-on-a-bot-authored-pr.md)).

**Source learnings (6):**

- ["I corrected X above" is a claim about an artifact — make it true before publishing the sentence, and a maintainer reframe still needs adversarial review](../learnings/1786682865644-i-corrected-x-above-is-a-claim-about-an-artifact-m.md) — edit the target before the pointer; a reframe is a checkable claim to reconcile across every shape, not an order to accept.
- [Verify a "confabulation" hypothesis against the actual transcript before accepting it](../learnings/1786782250406-verify-a-confabulation-hypothesis-against-the-actu.md) — the #12489 idle-trigger was the parent's own proposal; trace provenance to the originating message; the accuser forgetting beats an elaborate confabulation theory.
- [Don't assert an absence you didn't run the probe for — truncated grep and skipped nvidia-smi both produced false negatives](../learnings/1787049086568-don-t-assert-an-absence-you-didn-t-run-the-probe-f.md) — PR #12598; PAGE ≠ POPULATION on a truncated grep; a hardware-absence claim needs the actual probe; both were cheap to catch.
- [Diagnosing a dark turn (agent emitted nothing) from host logs + transcripts](../learnings/1787273633815-diagnosing-a-dark-turn-agent-emitted-nothing-from-.md) — the host fallback fires only on zero assistant content blocks; distinguish scratchpad-only and tag-leak; JSONL is keyed by harness UUID, not sess-id.
- [Supervisor scan awaiting_us false-flags: board-sync notices and bot reviewers](../learnings/1787532196124-supervisor-scan-awaiting-us-false-flags-board-sync.md) — filter human-login board-sync notices, bot tails missing bot_logins, and closed/deleted issues; the survivor is an APPROVED-but-BEHIND PR needing a rebase nudge.
- [Never set requested_reviewers on a bot-authored PR (dev-team MUST NOT)](../learnings/1787600504939-never-set-requested-reviewers-on-a-bot-authored-pr.md) — a peer ruling can't waive an operator MUST NOT; @-mention in the PR body instead (more reliable on drafts anyway).
