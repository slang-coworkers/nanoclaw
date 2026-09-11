---
title: "record_decision Ledger-Write Trap: Success String vs Denied Append"
type: concept
group: misc
tags: [approver, record_decision, approval-ledger, infra-abstain, mcp-tools, verification, two-channel]
source_count: 12
---

## TL;DR

The `mcp__nanoclaw__record_decision` MCP tool returns a past-tense success string
(`Decision recorded: <repo>#<pr>@<sha> = <verdict>`) **even when the host refuses the
ledger append**. The tool acknowledges the *call*; the host runs the
`APPROVAL_LEDGER_WRITERS` capability check *afterward* and reports the denial on a
**separate channel** — an out-of-band `<system-notification>` that arrives seconds later,
after the success string, and can land after you have already moved on or reported upstream.

When `APPROVAL_LEDGER_WRITERS` is unset (the default across this install — shipped
commented-out in `.env.example`, "UNSET MEANS NO CONTAINER MAY WRITE"), **every** append
from **every** approver group is refused, silently and totally. This was observed on at
least a dozen consecutive PRs (slangpy #925/#1050/#1096/#1097/#1098, slang
#12437/#12448/#12451, slang-rhi #819/#821/#823×2/#824/#825) — it is the steady state on
this container, not a flake.

Operating rules distilled across all instances:

- **The success string is not the write.** Treat the returned row as UNWRITTEN until an
  independent, host-side confirmation appears. A component reporting on its own success is
  the weakest witness; when two channels disagree about your side effect, the one you did
  not author wins.
- **Read the deny string — it tells you whose problem it is.** "no approval-ledger writers
  are configured" = host-wide outage (nothing you can do; escalate). "…does not hold the
  approval-ledger writer capability" = your group specifically.
- **Write `work/<pr>-<sha12>/decision.md` (or `.json`) unconditionally, before the call**,
  with the full field set (repo, pr, commit_sha, decision, reason_code, mode,
  policy_version, review_diff_hash, ts, clauses + challenger summaries) and a BACKFILL
  banner. On this install it is the *only* record.
- **Do not retry** — the denial is deterministic until an operator sets the var.
- **Report "derived, not recorded"** and state the full verdict INLINE upstream; never
  "recorded in the ledger, see there" — that sentence points at nothing here.
- The verdict itself never changes because the append failed — a config gap describes the
  plumbing, not the PR. Don't downgrade `ABSTAIN_POLICY` to `ABSTAIN_INFRA` over it.

## Why the trap is dangerous, and its mechanism

The whole point of the shadow-mode approver is that the `approval_decisions` ledger row is
the single durable, auditable deliverable per (repo, pr, commit) — it is what later gets
joined against the human outcome to score accuracy. A denied append with a success-shaped
reply converts the ledger into "the record, minus whatever was silently dropped," and the
gap is invisible from inside the session that produced it
[first observed on slangpy#1096](../learnings/1786364518139-approver-infra-abstain-record-decision-returns-dec.md).

The root cause is a **two-channel boundary**. One approver verified the caller side
first-hand in the running image: the handler at `/app/src/mcp-tools/core.ts:604` type-checks
args, queues a `kind:'system'` action into `messages_out`, and returns
`ok("Decision recorded: …")` — **no capability check, no wait on a host verdict**.
Authorization happens later in delivery, so the reply confirms *queueing of intent*, never a
committed row
[verified line in the live image](../learnings/1786377128231-approver-infra-abstain-the-record-decision-deny-st.md).
The refusal comes back through the host's notification channel with different timing; the
optimistic message answers first and sits in the tool-result slot a careful reader treats as
authoritative
[slangpy#1097 instance](../learnings/1786381662397-approver-infra-abstain-record-decision-returns-dec.md),
[slangpy#1100, install-wide when APPROVAL_LEDGER_WRITERS is unset](../learnings/1786463030860-approver-infra-abstain-record-decision-returns-a-s.md).

By the third and fourth confirmations the class was understood as steady-state, not a flake:
both revisions of slang-rhi#823 reported success and were both denied
[#823 twice, steady state](../learnings/1786369667069-approver-infra-abstain-a-tool-that-returns-decisio.md);
the same pattern held across #821/#822/#824 in one sweep
[3/3 confirmation](../learnings/1786371728382-approver-infra-abstain-record-decision-returns-a-f.md),
and again on slang#12451 and slangpy#1050 with an added distinction between a host-wide
config gap and a group-scoped capability denial
[slang#12451, distinct root cause from a group denial](../learnings/1786374558104-approver-infra-abstain-record-decision-returns-a-s.md),
[slangpy#1050, silent and total when unset](../learnings/1786376591107-approver-infra-abstain-record-decision-returns-a-s.md).

## Reading the deny string, and verifying emission

The deny string discriminates *whose problem it is*, and collapsing the two into "the append
failed" loses the only bit that decides your next action. Per an orchestrator source read of
nanoclaw's `src/modules/approval-ledger/capability.ts`, the empty-allowlist branch emits "no
approval-ledger writers are configured" (host-wide; escalate as a measurement-pipeline
blocker), while a membership failure emits "…does not hold the … capability" (scoped to your
group); fail-closed on unset is deliberate. The same note flags that
`record_human_verdict` is **deliberately not registered** — the host stamps the human
verdict from the GitHub webhook, keyed by delivery id — so the `slangpy-pr-approver/SKILL.md`
instructions to "call `record_human_verdict`" are stale; on a join, do the `append_learning`
half instead
[deny-string discrimination + record_human_verdict unregistered](../learnings/1786377128231-approver-infra-abstain-the-record-decision-deny-st.md).

`env | grep APPROVAL_LEDGER` inside the container shows nothing either way (the var is
host-side), so a local check cannot pre-empt this
[env grep is not evidence](../learnings/1786384635280-approver-infra-abstain-record-decision-returns-a-s.md),
[slang#12450 recurrence](../learnings/1786388048797-approver-infra-abstain-record-decision-returned-de.md).
What you *can* verify is emission at your own outbox boundary: query `messages_out` for a
row whose content contains `record_decision`, the PR number, SHA, decision, and
`policy_version` — proving the *content* left intact. Trap: `processing_ack` is INBOUND-only,
so "NOT ACKED" on an outbound row proves nothing
[verify emission via outbox on slangpy#1097](../learnings/1786381662397-approver-infra-abstain-record-decision-returns-dec.md),
[state persistence as its own report bullet on slangpy#1098](../learnings/1786386167554-approver-infra-abstain-record-decision-returning-d.md).

## The retroactive correction to earlier verdict stamps

This trap also explained a prior mystery: on 2026-08-05 only 1 of 57 workspaces retained a
`record-payload.json` and the `approval_decisions` table was unreadable — earlier attributed
to workspace cleanup. **A missing writer permission fits the evidence better than cleanup
does.** The same session found `record_human_verdict` returns `No such tool available`, so
the two "Human verdict recorded" stamps reported for #918/#1002 must be downgraded from
"issued, effect unverifiable" to "unconfirmed — the tool is not present today"
[BLOCK on slangpy#925 + the record_human_verdict discovery](../learnings/1786367856109-approver-infra-abstain-record-decision-returned-de.md).

## The transferable rule

A **past-tense claim about a state you did not open** — "recorded," "saved," "posted,"
"cleaned up" — is a claim to verify, and it is *most* dangerous when the claimant is your own
instrument reporting on its own success, because that is the direction you are least likely
to check: it tells you your work is done. A write is not done until something that is not the
writer confirms it; a capability-gated write needs confirmation from the *enforcing* side, or
an inline copy of the payload that survives the denial.

**Source learnings (12):**

- [record_decision returns "recorded" while the host denies the append (slangpy#1096)](../learnings/1786364518139-approver-infra-abstain-record-decision-returns-dec.md) — first filing of the success-string-vs-write trap; "requested ≠ recorded."
- [BLOCK on slangpy#925 recorded-then-denied; record_human_verdict absent; retroactively explains the 1-of-57 payload retention](../learnings/1786367856109-approver-infra-abstain-record-decision-returned-de.md) — the trap firing live plus downgrade of two Aug-5 human-verdict stamps.
- [A tool returning "Decision recorded" can still have had its write DENIED (slang-rhi#823)](../learnings/1786369667069-approver-infra-abstain-a-tool-that-returns-decisio.md) — both revisions denied ⇒ steady state; capability.ts:33 empty-allowlist branch.
- [False success string, host denies separately — 3rd consecutive confirmation (slang-rhi#824)](../learnings/1786371728382-approver-infra-abstain-record-decision-returns-a-f.md) — write decision.md before the call, unconditionally.
- [Success string while host denies — APPROVAL_LEDGER_WRITERS unset drops every row (slang#12451)](../learnings/1786374558104-approver-infra-abstain-record-decision-returns-a-s.md) — distinguishes host-wide unset from a group-capability denial.
- [record_decision returns a success string even when the host denies (slangpy#1050)](../learnings/1786376591107-approver-infra-abstain-record-decision-returns-a-s.md) — silent and total when unset; read-the-artifact-not-the-framing, framing emitted by the tool itself.
- [The deny string discriminates host-wide config from wrong-group; record_human_verdict is unregistered](../learnings/1786377128231-approver-infra-abstain-the-record-decision-deny-st.md) — caller verified at core.ts:604; stale SKILL.md instruction to call record_human_verdict.
- [Success STRING while host denies (slangpy#1100) — install-wide when APPROVAL_LEDGER_WRITERS unset](../learnings/1786463030860-approver-infra-abstain-record-decision-returns-a-s.md) — state the full verdict INLINE upstream; reply is advertising, not evidence.
- [Returns "Decision recorded" while host denies (slangpy#1097) — read the notification, verify emission](../learnings/1786381662397-approver-infra-abstain-record-decision-returns-dec.md) — verify the outbox row; processing_ack is inbound-only; never downgrade the verdict over the append.
- [Success string while host denies — APPROVAL_LEDGER_WRITERS unset (slang#12437)](../learnings/1786384635280-approver-infra-abstain-record-decision-returns-a-s.md) — an over-claim can originate in my TOOLS, not just my prose.
- [Returning "Decision recorded" is NOT proof the row exists (slangpy#1098)](../learnings/1786386167554-approver-infra-abstain-record-decision-returning-d.md) — state ledger persistence as its own report bullet; confirmation must come from the host.
- [Returned "Decision recorded" while host DENIED the write (slang#12450)](../learnings/1786388048797-approver-infra-abstain-record-decision-returned-de.md) — a write is not done until something other than the writer confirms it.
