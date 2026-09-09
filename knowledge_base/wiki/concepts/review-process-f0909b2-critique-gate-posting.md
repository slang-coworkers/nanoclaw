---
title: Critique-gate mechanics, delivery gates, and GitHub posting authorization
type: concept
group: review-process
tags: [approver, critique-gate, codex, decision-review, output-review, comment-hygiene, delivery-gate, posting-gate, github-authorized, timeline-actor]
source_count: 6
---

## TL;DR

The approver's decision message is guarded by a codex critique gate (DECISION_REVIEW +
OUTPUT_REVIEW) and a separate outbound message-delivery gate. Several sharp edges:

- **Scope the comment-hygiene clause to YOUR deliverable, not the reviewed PR's source.**
  Codex's "a comment that restates the adjacent line is must-fix" is written for
  code-authoring roles that own the diff. For the approver — whose deliverable is a
  DECISION, and the PR diff is *evidence* — a must-fix on the author's source comments can
  DEADLOCK a substantively-sound WOULD_APPROVE indefinitely (the approver cannot edit it).
  This is a filed procedure bug; the maintainer often does not share the must-fix.
- **ABSTAIN still needs both critique stages to DELIVER.** The `record_decision` gate is
  relaxed for ABSTAIN rows, but the message-delivery gate keys on the `[Approval Decision]`
  marker + recorded critique rounds and enforces DECISION_REVIEW + OUTPUT_REVIEW=approve
  regardless of decision state — so budget for both rounds even on a clean policy abstain.
- **codex-reply re-verify prompts must NOT contain the literal token `STAGE:`** — the
  track-critique hook parses it and applies reviewer-instruction-pinning that a reply
  cannot satisfy, silently failing to record the approve. Refer to "the output review."
  Direct new-stage calls DO need `STAGE: <NAME>` + the verbatim developer-instructions.
- **A convention-consistent commented attribute (e.g. `// [ForceInline]`) is advisory,
  not a per-PR blocker** — refute a DECISION_REVIEW "dead code" must-fix by grepping the
  sibling count, but verify the convention in source and count occurrences precisely.
- **Don't record a "clean / would-approve" substantive claim before ALL review inputs
  land** — even when a Step-1 clause fail short-circuits the decision, a positive
  narrative a human may act on must reconcile bot ✅ vs Devin 🔴, or caveat "Devin pending."
- **Posting authorization: answering a formal human review = post; volunteering commentary
  = hold.** A substantive reply to REQUEST_CHANGES / maintainer review questions is
  pre-authorized; bare acks / status posts need explicit `<github-post-authorized />`.
- **`requested_reviewers` populated on a bot PR says nothing about who populated it** —
  read the actor-stamped `review_requested` timeline event, don't infer from authorship.

## The comment-hygiene scope bug and delivery mechanics

The load-bearing procedure failure is that codex's comment-hygiene clause, written for
code-authoring roles, gets applied to the *reviewed PR's* author source. On slang-rhi#846 a
WOULD_APPROVE that codex itself validated as substantively sound stayed blocked for 3 rounds
over two narration-only comments in `src/staging-heap.cpp` the approver had no power to fix;
the soft-cap escalation timed out (~2 days) and the PR went terminal — the gate blocked a sound
approve indefinitely over cosmetic comments. The fix is to scope comment-hygiene / scope-shrinkage
clauses to "the deliverable the critiqued agent authored"; until fixed, expect these stalls and
don't let the deadlock masquerade as a code problem
[Critique comment-hygiene rule can DEADLOCK an approval on the PR's own source](../learnings/1787963434624-approver-critique-mustfix-critique-comment-hygiene.md).
The delivery gate is a *separate* enforcement point: on a clean bot-authored ABSTAIN the skill
says skip DECISION_REVIEW/OUTPUT_REVIEW, and `record_decision` succeeds — but
`gate-critique-on-deliver.sh` then REFUSES the outbound `[Approval Decision]` message
("required critique stages are missing"), because it reads only the marker text + recorded
rounds, not the decision state. So in practice both `/codex-critique` stages must run to ship
ANY approval message, ABSTAIN included; this atom also reiterates synthesizing the Devin-only
review doc BEFORE eval-clauses so `commit_match` passes, and wording Devin freshness
conservatively when `devin-commit-status.txt` is `unknown`
[ABSTAIN still needs both critique stages to pass the message-delivery gate](../learnings/1788850479837-approver-procedure-abstain-still-needs-both-critiq.md).

## Two hook traps clearing the gate, and reconciling late inputs

Two non-obvious mechanics cost round-trips on a WOULD_APPROVE (slang#12913). First, on a
`mcp__codex__codex-reply` re-verify, if the prompt text literally contains "STAGE: OUTPUT_REVIEW"
the `track-critique.sh` hook parses a non-empty STAGE and then demands the canonical
developer-instructions sentinels a reply cannot carry — so the reply's approve is silently NOT
recorded, leaving the last verdict = must-fix and the delivery gate shut; refer to it as "the
output review" instead. Second, DECISION_REVIEW reviews the PR code too and flagged a
`// [ForceInline]` commented attribute as "dead code" must-fix, when it is an established house
convention (11 identical sibling markers) — refute by grepping the sibling count and noting the
production reviewer accepted it, but verify the convention in source and count "total including
the new line" vs "pre-existing siblings" precisely, because codex will catch an off-by-one in
your own audit
[Critique-gate mechanics: STAGE-token pitfall + convention-consistent commented attribute](../learnings/1788576785263-approver-critique-mustfix-critique-gate-mechanics-.md).
On late-input reconciliation: on slang#12690 R3 a Step-1 `head_provenance` fail short-circuited the
decision, but the recorded substantive-context claimed "cleanest revision / would plausibly be
WOULD_APPROVE" sourced from only the primary bot's ✅ — then Devin returned ~95s later with a 🔴
the bot missed. A short-circuit licenses not blocking on Devin for the *decision*, but not an
over-confident positive narrative a human may act on; confirm all review inputs landed and
reconcile bot ✅ vs Devin 🔴 (divergence is itself high-value signal) before writing "clean," and
when a late input contradicts an append-only recorded claim, correct it in artifacts and report
upward
[Don't record a 'clean / would-approve' claim before ALL review inputs land](../learnings/1788290996343-approver-critique-mustfix-don-t-record-a-clean-wou.md).

## Posting authorization and reading timeline provenance

On a bot-authored PR the operator-gated GitHub-write set is narrower than "all comments." The
rule from the orchestrator: **answering a formal human review verdict** (REQUEST_CHANGES /
CHANGES_REQUESTED, or a maintainer's explicit review questions) with a substantive reply is
**pre-authorized** — post directly, don't hold; over-gating (stalling the chain on the operator
for something already authorized) is as much a failure as under-gating. Discretionary chatter —
bare thanks/ack, narrating a bot mention, unsolicited status — is HELD pending an explicit
`<github-post-authorized />`. (Code pushes to your own `fix/*` branch are always allowed; the
gated set is user-facing writes.)
[Answering a formal human review is pre-authorized; discretionary chatter is held](../learnings/1788247484430-gating-answering-a-formal-human-review-verdict-is-.md).
Provenance must be read from actor-stamped events, not inferred: on slang-rhi#812 (bot-authored,
draft) a maintainer pushed back on "requesting human review of AI code," which tempted the read
that the bot violated the "never request reviewers" rule — but the `review_requested` timeline
events both had `actor: jhelferty-nv` (the maintainer), so the bot broke no rule. `requested_reviewers`
being populated says nothing about who populated it; and a `github.pr_mention` webhook fires
because the event is on a PR you own (via `pr_session_mappings`), not because the bot was
@-mentioned — read the `body` for the actual `@target` and don't post a bot reply into a
human-to-human process discussion
[A bot-authored PR with human reviewers requested — check the timeline actor](../learnings/1788186584286-a-bot-authored-pr-with-human-reviewers-requested-d.md).

**Source learnings (6):**
- [Critique comment-hygiene rule can DEADLOCK an approval on the PR's own source](../learnings/1787963434624-approver-critique-mustfix-critique-comment-hygiene.md) — scope comment-hygiene to the approver's own deliverable; slang-rhi#846 stalled a sound WOULD_APPROVE to a terminal timeout.
- [Don't record a 'clean / would-approve' claim before ALL review inputs land](../learnings/1788290996343-approver-critique-mustfix-don-t-record-a-clean-wou.md) — reconcile bot ✅ vs late Devin 🔴 even on a short-circuited abstain; correct append-only claims in artifacts + report up.
- [Critique-gate mechanics: STAGE-token pitfall + commented-attribute must-fix](../learnings/1788576785263-approver-critique-mustfix-critique-gate-mechanics-.md) — no literal "STAGE:" in codex-reply; grep sibling count to refute a convention-consistent `// [ForceInline]` must-fix.
- [ABSTAIN still needs both critique stages to pass the message-delivery gate](../learnings/1788850479837-approver-procedure-abstain-still-needs-both-critiq.md) — record gate ≠ delivery gate; run both /codex-critique rounds even for a clean abstain; synthesize doc before clauses.
- [Answering a formal human review is pre-authorized; discretionary chatter is held](../learnings/1788247484430-gating-answering-a-formal-human-review-verdict-is-.md) — post substantive replies to REQUEST_CHANGES directly; hold acks/status for `<github-post-authorized />`.
- [A bot-authored PR with human reviewers requested — check the timeline actor](../learnings/1788186584286-a-bot-authored-pr-with-human-reviewers-requested-d.md) — read actor-stamped `review_requested`; a pr_mention webhook ≠ an @-mention; don't reply into a human process thread.
