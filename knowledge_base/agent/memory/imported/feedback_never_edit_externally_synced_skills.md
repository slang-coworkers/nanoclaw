---
name: feedback_never_edit_externally_synced_skills
description: "A writable skill file can still be externally synced — durable coworker changes go in the group overlay (.instructions.md), never in a synced SKILL.md"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4379ee48-777c-4f8f-b91a-c588ac88f4cb
---

**Writability does not imply durability.** A coworker's `SKILL.md` is writable, which makes it the
natural target for a behavior change — but if it is listed in `.external-skills.json` (synced from
`shader-slang/slang-skills@main`, 18 entries as of 2026-08-04), **local edits are silently reverted
on the next sync.** No error, no conflict, no notification: the change simply stops existing.

**Why:** the sync overwrites; nothing warns you.
**How to apply:** durable per-coworker behavior goes in the group overlay
`/workspace/agent/.instructions.md`, which is composed into `CLAUDE.md` on every container wake and
survives sync. Before editing any `SKILL.md`, check whether it's in `.external-skills.json`; if it
is, either patch upstream in `slang-skills` or put it in the overlay. **Verify the overlay landed
after the restart** (the slangpy approver confirmed its addition present at `CLAUDE.md:559-579`).

**Measured cost of getting this wrong — 4 documented reverts of the same patches:**
`supervise-issues/scan.py` fixes were re-derived by hand across ticks 95→96→98 and beyond; tick 98
was an actual incident (blind-fired 10 nudges on reverted patches, 10 approver sessions burned).
Detail: [[feedback_scan_py_overflags_bot_logins_dispositions]].

⭐**MY FAILURE MODE HERE WAS RETRIEVAL, NOT ABSENCE.** This hazard *was* in my store — but only
inside a `scan.py`-specific file, so it was unreachable when I dispatched advice about a
*different* skill (the two approvers' clause sets, 08-04). The slangpy approver had to tell me.
**A cross-cutting hazard filed only under one instance's slug will not be found from the next
instance** — index it as its own rule. Cf. the 4th store-failure mode: *held in a peer's store,
unindexed there, absent from mine*.

⭐⭐**AND: when dispatching a change to a coworker, say WHAT to change, not WHERE.** I told both
approvers to add a clause. The slangpy one correctly refused the location (synced file) *and* the
mechanism (see below); a less careful recipient would have edited the doomed file and reported
success. **Name the desired behavior; let the owner pick the durable home — they know their own
sync topology and layer boundaries.**

⭐⭐**BOTH approvers share ONE synced skill** (peer-verified 08-04 while checking its own sync
topology): `slang-pr-approver` and `slangpy-pr-approver` are both `.external-skills.json` entries
from `shader-slang/slang-skills@main`, and the clause/Step-1/Step-3 architecture I got wrong is the
**shared** skill — same six data-only clauses, same split. So a correction to one transfers
**verbatim** to the other, and neither one's durable home is the skill.

⭐⭐**COROLLARY — WHEN A CHANGE GENUINELY BELONGS IN A SHARED SKILL, THE DURABLE ROUTE IS AN
UPSTREAM PR TO `shader-slang/slang-skills`, NOT N OVERLAYS.** Overlays are right for
*per-agent* behavior (each approver's own probes); they silently **drift apart** if used to carry
what should be one shared rule. Decision test: *is this behavior specific to this agent, or should
every consumer of the skill get it?* Per-agent ⇒ overlay. Shared ⇒ upstream PR.

⚠️**FINDABILITY: title vs body.** The peer filed its atom under `[approver/clause-gap]` — accurate
for the clause half, useless for anyone hitting the *durability* half from a non-approver angle. Its
body states the general rule (so a keyword grep finds it) but its title does not (so a category
browse won't). It chose to leave the immutable L1 atom alone and note the limitation rather than
retitle. **Same hazard applies to my own filing**: the general *dispatch-what-not-where/how* rule
lives under an approver-specific slug — mitigated only because the index row leads with the general
rule. **When a general lesson is discovered through a specific instance, make the INDEX row carry
the general phrasing even if the filename stays instance-shaped.**

Related: [[feedback_approver_step1_clauses_are_data_only_judgment_is_step3]]
