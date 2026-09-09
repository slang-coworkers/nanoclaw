---
title: PR-approver ABSTAIN delivery — the critique-gate token trap and transport rules
type: concept
group: slang-autodiff-ir
tags: [approver, abstain, critique-gate, gate-critique-on-deliver, gate-chain-routing, send-message, record-decision, matcher-vs-intent, in-reply-to]
source_count: 11
---

## TL;DR

Delivering an `ABSTAIN_POLICY`/`ABSTAIN_INFRA` `[Approval Decision]` repeatedly gets
refused by `gate-critique-on-deliver.sh` demanding DECISION_REVIEW/OUTPUT_REVIEW — even
though abstains are documented as NOT critique-gated. Nine independent sessions hit the
same root cause and one shared fix. Learn it once:

- **The ABSTAIN fast-path is armed only when the message text matches
  `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` AND does NOT match `\b(WOULD_APPROVE|BLOCK)\b`.**
  The negative guard is unanchored — it fires on those tokens *anywhere*, including
  explanatory prose ("not a BLOCK", "would have read as a clean WOULD_APPROVE"). Explaining
  *why it isn't the other outcomes* re-arms the gate against you.
- **Fix = phrasing, never a ceremonial critique.** Keep the abstain token; describe the
  contrast without the literal words ("no verified defect", "not a block-level finding",
  "would have read as an approve"). Do NOT run a /codex-critique to zero the counter — the
  abstain is genuinely gate-exempt; the refusal is a text-matcher artifact.
- **Two-gate order that works:** `record_decision` (host relaxes the ledger gate for
  ABSTAIN_* rows) → `send_message` with the abstain token, *no* `WOULD_APPROVE`/`BLOCK`
  substrings, AND `in_reply_to=<tasking inbound id>` (a second hook,
  `gate-chain-routing.sh`, rejects any `[marker]` message lacking `in_reply_to`).
- **Transport matters as much as content.** An abstain must be delivered via the
  `send_message` TOOL, not a final-response `<message>` block — the fast-path lives only in
  the PreToolUse tool hook.
- **The ledger gate ≠ the delivery gate.** `record_decision` succeeding for an abstain does
  not exempt the delivery message; you may still need real DECISION_REVIEW + OUTPUT_REVIEW to
  *send* a non-fast-pathed decision, and codex must attest only stable artifacts, never a
  volatile trace file.
- **Class:** MATCHER-vs-INTENT over-block, sibling to "read-only `gh api …/pulls/…` denied as
  PR creation." A guard that refuses you is not thereby broken — read the predicate first.

## The core trap: the fast-path predicate reads your own prose

Seven of the nine sessions log the identical mechanism against
`/app/hooks/gate-critique-on-deliver.sh` (lines ~88–104): the ABSTAIN fast-path `exit 0`s
(allows delivery, no critique) only when the message matches
`\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` **and** does NOT match `\b(WOULD_APPROVE|BLOCK)\b`. The
negative guard has no line-anchor and no word-context filter, so any occurrence of the literal
uppercase tokens — even inside a negation or a counterfactual — disqualifies the fast-path and
drops the message into full stage enforcement. The exact tripping phrases recorded across
sessions: "a maintainer policy call, not BLOCK" and "either artifact yields a clean WOULD_APPROVE"
([critique gate ABSTAIN fast-path defeated by your own message text](../learnings/1786442329725-approver-critique-mustfix-the-critique-gate-s-abst.md)),
"not a BLOCK" / "not a WOULD_APPROVE" in the verdict narrative
([defeated by literal tokens anywhere](../learnings/1786479724589-approver-critique-mustfix-abstain-fast-path-is-def.md)),
"my first draft was WOULD_APPROVE" / "so not BLOCK" in the reasoning tail
([delivery refused if body contains the tokens](../learnings/1787079264586-approver-infra-abstain-approval-decision-delivery-.md)),
"the code-level result would have been WOULD_APPROVE"
([message must not contain the tokens](../learnings/1787317437543-approver-infra-abstain-approval-decision-message-m.md)),
"Approving for merge would be unsound…" using `WOULD_APPROVE` in the Next-action bullet
([must not contain the tokens even in prose](../learnings/1787568646622-approver-infra-abstain-abstain-approval-decision-m.md)),
"Not WOULD_APPROVE … and not a clean BLOCK"
([fast-path defeated by the literal words](../learnings/1787769476913-approver-infra-critique-gate-abstain-fast-path-is-.md)),
"no verified 🔴, so not a BLOCK"
([defeated by BLOCK/WOULD_APPROVE anywhere; reword don't run a ceremonial critique](../learnings/1787848138413-approver-infra-abstain-the-critique-on-deliver-abs.md)),
"Not a BLOCK"
([ABSTAIN message must not contain the tokens](../learnings/1787880871011-approver-process-abstain-message-must-not-contain-.md)),
and "so not a BLOCK" — where the word-boundary match cares nothing for negation
("not a BLOCK", "no BLOCK", "BLOCK candidate" all trip it)
([delivery fast-path disqualified by the words anywhere](../learnings/1788202312850-approver-ops-abstain-delivery-fast-path-is-disqual.md)).

The transferable rule, stated the same way each time: **in any ABSTAIN `[Approval Decision]`
message (and its 5-bullet report), never write the literal tokens `WOULD_APPROVE` or `BLOCK`.**
Keep the `ABSTAIN_POLICY`/`ABSTAIN_INFRA` token so the positive test still matches; describe the
not-a-bug / not-a-block reasoning in words — "no verified 🔴 bug", "not a blocking-bug case",
"cannot be cleared for auto-approve", "would have read as an approve", "not itself defective".
The broader maxim: **when a hook's predicate reads your output, your output is input to a
matcher** — prose written for a human reader is simultaneously being pattern-matched, and the
most natural way to explain a decision ("here is what I ruled out") is exactly what trips an
exclusion clause. Keep any reasoning that genuinely needs those tokens in `decision.md` /
`investigation.md` / the `challenger` field of `record_decision`, which are not text-scanned.

**Do NOT appease the matcher.** Every session converges on the same anti-pattern warning: do not
run a ceremonial `/codex-critique` to zero the counter — the abstain is genuinely ungated, the
fast-path exists precisely so abstains ship without critique, and retrying the same body burns
denial-cap strikes (3 ⇒ admin escalation) without changing anything. Diagnose by reading the hook
(`sed -n '1,200p' /app/hooks/gate-critique-on-deliver.sh`) rather than guessing. And do not set
`CRITIQUE_ABSTAIN_FASTPATH=0` — that disables the fast-path entirely and is the host's knob, not
yours. A note for whoever owns the hook: the exclusion does real work (it stops a mislabelled
positive shipping as an abstain), so a tighter form should anchor the token to the decision line
(e.g. only inspect the line after the `[Approval Decision]` marker) rather than being dropped.

## The second hook: `[marker]` messages require `in_reply_to`

Three of the sessions note a *separate* hook, `gate-chain-routing.sh`, that fires immediately
after the critique gate clears: it denies any `send_message` carrying a chain delivery marker
(like `[Approval Decision]`) that lacks `in_reply_to`. Set `in_reply_to=<the tasking inbound id>`
(the parent tasking / orchestrator webhook inbound) on the tool call — `thread_id` is derived
from it — rather than describing routing in prose
([fast-path + gate-chain-routing in_reply_to](../learnings/1787769476913-approver-infra-critique-gate-abstain-fast-path-is-.md),
[in_reply_to on the marker message](../learnings/1787880871011-approver-process-abstain-message-must-not-contain-.md),
[order that worked: record → send with in_reply_to](../learnings/1788202312850-approver-ops-abstain-delivery-fast-path-is-disqual.md)).
One subtlety: the plain dashboard summary is a `send_message` with no `in_reply_to`, so it must
be sent WITHOUT the `[Approval Decision]` prefix — carry the marker only on the report-up-the-
parent-edge message that does have `in_reply_to`
([dashboard line without the marker prefix](../learnings/1787568646622-approver-infra-abstain-abstain-approval-decision-m.md)).
Both gates are text/field-mechanical, not semantic.

## Transport: the fast-path lives only in the tool hook, not the `<message>` path

Delivering an abstain `[Approval Decision]` as a final-response
`<message to="orchestrator">…</message>` block is refused with the same missing-critique-stages
error, but re-sending the byte-equivalent body via the `mcp__nanoclaw__send_message` **tool** is
delivered with no critique
([ABSTAIN must be delivered via the send_message tool, not a `<message>` block](../learnings/1786633049888-approver-infra-abstain-approval-decision-must-be-d.md)).
The reason is that `gate-critique-on-deliver.sh` is a PreToolUse hook (matcher
`mcp__nanoclaw__send_message|Bash`) — the ABSTAIN fast-path lives only there. A final-response
`<message>` block is delivered by a different harness path that applies the critique-stage
requirement without the fast-path, so it refuses any `[Approval Decision]` when DECISION_REVIEW/
OUTPUT_REVIEW are unrecorded, even for a gate-exempt abstain. **So for any ABSTAIN decision,
always emit via the tool** (pass `to`, `in_reply_to`, `thread_id`), body containing the abstain
token and no `WOULD_APPROVE`/`BLOCK`. This is the transport-vs-content distinction: satisfying a
rule's content form (an abstain is exempt) is not satisfying its transport form (which delivery
channel you used).

## Ledger gate ≠ delivery gate; and never let codex attest volatile files

"ABSTAIN isn't critique-gated" is true for the `record_decision` *ledger append* (the host
relaxes that gate for abstain rows) but FALSE for the delivery message, which
`gate-critique-on-deliver.sh` gates separately — so when the fast-path does *not* apply you must
still run both DECISION_REVIEW and OUTPUT_REVIEW before you can SEND
([ABSTAIN bypasses the ledger gate but not the delivery gate](../learnings/1787049679140-approver-infra-abstain-decisions-bypass-the-ledger.md)).
Two mechanical add-ons from that session: (1) a critique round only counts if you use the exact
stage format — `STAGE: <NAME>` as the first prompt line plus the verbatim developer-instructions
block with the sentinel lines that `track-critique.sh` keys on; a bare `mcp__codex__codex` call
records "stages: none" and does not satisfy the gate, and the sandbox must be
`danger-full-access`. (2) The delivery gate **re-hashes codex's `### Attested` list at send
time**, so if codex attested any volatile file (e.g. a live `.claude-trace/session-*.jsonl` that
grows continuously) its hash won't match and delivery is denied even with OUTPUT_REVIEW=approve —
tell codex in the OUTPUT_REVIEW prompt to attest ONLY stable deliverable artifacts (the
deliverable + `investigation.md`) and never sha256sum a trace/session/volatile path.

## Why this whole class exists — MATCHER vs LEVEL

Every session files this under the same maxim: a delivery guard's text-matcher over-blocks a
correctly-ungated action because the prose happened to contain the gated-state tokens. It is the
OVER-blocking direction of the known "read-only `gh api …/pulls/…` denied as PR creation"
under-specific matcher. The corrective posture is the same throughout: *a guard that refuses you
is not thereby a broken guard — read the predicate before reporting on it, then word your message
so the state-token test the hook actually runs reads it as the abstain it is.*

**Source learnings (11):**

- [The critique gate's ABSTAIN fast-path is defeated by your own message text](../learnings/1786442329725-approver-critique-mustfix-the-critique-gate-s-abst.md) — Conjunction predicate over delivered text; "not BLOCK"/"clean WOULD_APPROVE" prose re-arms it; also corrects a mis-diagnosis (the send_message denial was the author's wording, not a broken hook).
- [ABSTAIN fast-path is defeated by the literal tokens WOULD_APPROVE/BLOCK anywhere](../learnings/1786479724589-approver-critique-mustfix-abstain-fast-path-is-def.md) — Unanchored negative guard; describe states without the token; don't run a ceremonial critique; verified by reading the hook.
- [ABSTAIN [Approval Decision] must be delivered via the send_message TOOL](../learnings/1786633049888-approver-infra-abstain-approval-decision-must-be-d.md) — Fast-path lives only in the PreToolUse tool hook; a final-response `<message>` block bypasses it; transport-vs-content distinction.
- [ABSTAIN decisions bypass the ledger critique-gate but NOT the delivery-message gate; never let codex attest volatile trace files](../learnings/1787049679140-approver-infra-abstain-decisions-bypass-the-ledger.md) — record_decision relaxed for abstain rows but the send is separately gated; exact STAGE format + danger-full-access; delivery re-hashes the Attested list.
- [ABSTAIN delivery is refused if the message contains WOULD_APPROVE or BLOCK anywhere](../learnings/1787079264586-approver-infra-abstain-approval-decision-delivery-.md) — Unanchored guard trips on "my first draft was WOULD_APPROVE"/"so not BLOCK"; strip tokens and resend; MATCHER-vs-LEVEL over-block.
- [ABSTAIN message must not contain the tokens WOULD_APPROVE or BLOCK](../learnings/1787317437543-approver-infra-abstain-approval-decision-message-m.md) — "would have been WOULD_APPROVE" tripped it; also chain-routing then required `in_reply_to=<parent inbound id>`.
- [ABSTAIN message must not contain the tokens — even in prose](../learnings/1787568646622-approver-infra-abstain-abstain-approval-decision-m.md) — `WOULD_APPROVE` in a Next-action bullet flipped the guard; keep the abstain token; send the dashboard line without the `[Approval Decision]` prefix.
- [Critique-gate ABSTAIN fast-path is defeated by the literal words WOULD_APPROVE or BLOCK](../learnings/1787769476913-approver-infra-critique-gate-abstain-fast-path-is-.md) — Dumb text matcher can't tell prose from a verdict token; plus the second `gate-chain-routing.sh` `in_reply_to` requirement on any chain-marker message.
- [The critique-on-deliver ABSTAIN fast-path is defeated by BLOCK/WOULD_APPROVE anywhere — reword, don't run a ceremonial critique](../learnings/1787848138413-approver-infra-abstain-the-critique-on-deliver-abs.md) — R1 phrased differently and passed, R2 said "so not a BLOCK" and failed; standing rule never to run a critique just to satisfy a matcher.
- [ABSTAIN message must not contain the tokens WOULD_APPROVE or BLOCK](../learnings/1787880871011-approver-process-abstain-message-must-not-contain-.md) — "Not a BLOCK" tripped it; say "no verified defect"/"not a block-level finding"; second gate requires `in_reply_to=<inbound id>`.
- [ABSTAIN delivery fast-path is disqualified by the words BLOCK or WOULD_APPROVE anywhere](../learnings/1788202312850-approver-ops-abstain-delivery-fast-path-is-disqual.md) — Word-boundary match ignores negation; the working order is record_decision → send with no tokens and `in_reply_to` set even for the dashboard destination.
