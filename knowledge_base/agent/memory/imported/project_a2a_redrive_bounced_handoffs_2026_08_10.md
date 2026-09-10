---
name: project_a2a_redrive_bounced_handoffs_2026_08_10
title: a2a bounce / redrive — the wedged-session storm + supervisor rulings (2026-08-10 → 08-25)
description: "Distilled chronicle of the a2a-handoff bounce storm and the supervisor rulings around it. The host redrive notice (2× bounced-unknown, 'will not self-recover') is the deployed fix #901 lacked; it surfaces bounces but not their CONTENT. Durable rules: a burst is ONE incident, re-drive all victims; verify-before-recover (terminal deliverable → don't re-drive, ANCHOR F); a wedged session re-bounces forever, so at N≥3 isolated bounces escalate the SESSION not the chain; escalate to the OPERATOR edge, never the failing session's inbox; re-driving a message you cannot read = ASK, don't repeat; a coincidence claim needs its BASE RATE; last_active moves on wake/inbound, NOT outbound; three pin-failure modes → fresh-session fallback is not optional. Plus reusable rulings: bot-PR ready-flip = NO by default; don't self-sync an APPROVED PR's branch."
metadata:
  node_type: memory
  type: project
  originSessionId: ae9ebb4b-ce3f-4ec1-ba66-0eb834d293af
---

# a2a bounce / redrive — the wedged-session storm

**Terminal / historical.** Distilled 2026-08-31 from a 140 KB wake-by-wake chronicle
(2026-08-10 → 08-25). The dated per-burst narrative and point-in-time operator-queue
items (cost_decision-handler-missing, fixer disk-pressure, bot-PR program-quality signal
— all escalated at the time and now resolved/superseded) are pruned; what remains is the
mechanism, the durable operational rules it produced, and how each was corrected.

## Mechanism

A2a handoffs began **bouncing** (`bounced 2x on transient/unknown provider errors =
bounced-unknown`, `NOT delivered`). The host now emits a `[a2a-redrive]` notification per
bounce, naming the original message id and stating explicitly *"it will not
self-recover."*

⇒ ✅ **This is the deployed mechanism the supervisor skill said was missing.** Its Step-3
`[MUST]` cites the **#12097** miss — a bounced handoff parked as *"queued; self-heals"*
when it does not — noting the remedy exists only *"unless the host redrive is deployed."*
It is deployed: the host detects the 2× bounce, refuses to silently drop it, and hands
over the exact ids to re-drive. The old per-tick inference
(`last_outbound_error_class ∈ transient|unknown` + container `stopped` + no PR) is now a
push notification for the common case.

⚠️ **What the notice does NOT carry: the bounced message's CONTENT.** So a re-drive must
restate the issue's freshly-looked-up GitHub state and **ask** for status — never re-issue
an instruction you never read.

## Durable rules (each earned by a correction on this chain)

- ⭐⭐⭐ **A burst of bounces is ONE incident with N victims, not N coincidences.** Multiple
  `bounced-unknown` in one ~minute across groups = a single provider-side outage. Re-drive
  all of them on their canonical `gh-issue-<owner>/<repo>-<num>` threads; do NOT diagnose
  each chain's silence separately (that manufactures N unrelated stories for one cause).

- ⭐⭐⭐ **A coincidence claim REQUIRES its base rate.** The 08-10 "three sessions froze at
  identical `01:11:11` = one event" was **fabricated** — refuted next morning when one
  session had moved while two still read the old stamp. The 08-11 "clustered in one second
  across 3 groups" claim survived *because* it was checked against the base rate (of 79
  sessions across 69 seconds, only two second-buckets held ≥3). Both looked like "N
  sessions share a timestamp"; only one asked how often that happens by chance.
  Cf. [[feedback_control_the_instrument_not_the_reasoning]].

- ⭐⭐⭐ **`last_active` advances on WAKE / INBOUND-DELIVERY, not on OUTBOUND.** The entire
  "shared freeze-timestamp cohort" analysis was built on this misread instrument (a redrive
  attempt itself touches `last_active`); two operator claims were retracted. To judge
  whether a session is producing, read its **last outbound row**, not `last_active`.

- ⭐⭐⭐ **A wedged session re-bounces forever; its row looks re-drivable indefinitely.**
  Re-driving it is the "repair keyed on looks-unfinished" trap (ANCHOR F / spent one-shot).
  At **N≥3 isolated bounces** on one session while its siblings are `running` and producing
  outbound, stop the loop and escalate the **SESSION as the fault**, not the chain.
  Discriminator: sibling sessions in the same group healthy at the same wall-clock.

- ⭐⭐ **Escalate to the OPERATOR edge, never the failing session's inbox.** A seq-18
  "escalation" written into the wedged session's inbound DB reaches no human (dead edge).
  Send to `orchestrator-dashboard`.

- ⭐⭐⭐ **Verify-before-recover cuts both ways (ANCHOR F), and the check is the DELIVERABLE's
  merge state, not issue open/closed.** A merged PR under a still-open issue is terminal for
  the fixer (e.g. #11669→PR#11816 merged, issue open only for a deferred family; #9146→PR
  #12379 merged). Terminal ⇒ do NOT re-drive. Also check for a fixer PR on the branch before
  characterizing a chain as "triage-only / no-PR." The fork is: *did the group process
  anything recently AND is the pending work live?* Both-yes ⇒ re-drive; else stop.

- ⭐⭐⭐ **Re-driving a message you cannot read = ASK, don't repeat.** You never saw the
  bounced body; restate the live GitHub state and point the peer at where the full detail
  already sits (its own queued inbound rows), rather than fabricating the lost instruction.
  A fabricated mechanism already sent to a peer must be **retracted on the same edge that
  received it**.

- ⭐⭐ **Mixed cohort: some wedged sessions hold LIVE required work.** A blanket "known storm,
  drop it" silently loses members — #12428 held a fresh maintainer @-directive; #12401 an
  in-flight fix worktree; #12473/#12549/#12550/#12554 in-flight fixes. Per-bounce
  discrimination is mandatory. The safe operator fix is a **disposition-aware nudger** (stop
  nudging parked/declined/terminal chains) — kills the storm at its source without touching
  any session; blanket-closing sessions is unsafe (`ncl sessions` is read-only anyway).

- ⭐⭐⭐ **Re-dispatching STRANDED-REQUIRED-WORK from a STOPPED session: prefer waking the
  ORIGINAL via `target_session_id` pin over a fresh sub-thread** — a stopped session can wake
  on its own and collide on its own branch (the #12550 two-session deadlock on
  `wt-slang-12550`). **But the pin is not reliable: THREE pin-failure modes, all resolving to
  a FRESH session once diagnosed** — (1) pin wakes → EMPTY TURN (re-armed a dead background
  monitor); (2) pin works → session RE-WEDGES later (hxqt69); (3) pin NEVER LANDS — no wake
  at all (#12405; `send_message` "sent" = accepted-for-routing, NOT woke-the-target). So the
  fresh-session fallback is **not optional**; verify recovery **functionally** (fresh
  outbound / PR on GitHub), never from a "sent" receipt. New harm class (08-17): the flaky
  a2a edge strands live maintainer-authorized fixes by bouncing their
  **background-task-completion wakes** — so a re-dispatched build must run FOREGROUND, not
  arm a background monitor.

- ⭐⭐ **A "complete" claim + a head-filtered PR query returning empty is a FALSE-ZERO, not a
  caught lie.** `github_list_pull_requests head=…:fix/issue-N` can return empty while the PR
  exists (#12713); confirm with `search_issues "<N> in:title,body"` before disputing.

## Adjacent reusable rulings (same chronicle)

- **Bot-PR draft→ready flip = NO by default.** Standing policy: bot PRs stay draft;
  ready-flip + merge are maintainer/operator-gated. Main does not hold durable authorization
  to flip; a draft with an auto-assigned shepherd is flipped in one maintainer click when
  they engage — reversible, harmless to wait. Only the human operator can set a standing
  auto-flip policy. See [[feedback_drafts_only_guardrail]].
- **Do NOT self-sync an APPROVED PR's branch.** A rebase/`merge master` changes the head SHA
  ⇒ can dismiss the fresh approval, which the bot cannot restore (re-requesting review is
  forbidden; branch-protection 403). Irreversible downside, zero upside over the maintainer's
  one-click "Update branch." The correct shape of a bot-holds-for-human decision: a
  capability/authority boundary, not indecision.
- **A ruling addressed to one session does not bind its siblings** (#12281/#12336): same
  shared identity, same branch, no coordination surface. When a ruling depends on preserving
  an approval, it must reach every session on the thread.

## Related concepts

- [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
- [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]]
- [[feedback_control_the_instrument_not_the_reasoning]]
- [[feedback_drafts_only_guardrail]]
- [[technique_keeping_this_store_reachable]]
