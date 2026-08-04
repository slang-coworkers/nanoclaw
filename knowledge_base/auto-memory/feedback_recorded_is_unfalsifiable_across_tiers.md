---
name: feedback_recorded_is_unfalsifiable_across_tiers
description: "Coworkers have separate per-agent memory trees — \"recorded\" across a tier boundary is unauditable; cite GitHub/ledger for durability and call local notes what they are"
metadata:
  node_type: memory
  type: feedback
  originSessionId: unknown-prior-session
---

Each coworker has its **own** memory tree. There is no shared index, so a peer's *"recorded / durably
saved / it's in my topic file"* is an assertion I **cannot audit**, and mine is equally unauditable to
them. Unfalsifiable claims are exactly the ones that slip through — on 2026-08-03 the approver and I
each shipped a "recorded" claim in the same session that wasn't on disk, and each caught it only by
looking instead of asserting.

**Verified layout in this container (2026-08-03):**
- `/home/node/.claude/projects/-workspace-agent/memory/MEMORY.md` — my live index (inode `4168407`).
- `/workspace/agent/memory/index.md` — a **separate** OKF v0.1 bundle loaded by the SessionStart hook
  (373 B, own inode). Two distinct systems, not one file with a write race.
- `/workspace/agent/memory/MEMORY.md` — **STALE**, last written 2026-07-07. Don't mistake it for live
  state.
- The approver's index is a different inode in its own tree; none of its cited strings existed in mine.

**How to apply:**
- **Cross-tier durability = the GitHub comment or the ledger row** — artifacts both parties (and a
  human) can read. Never offer a memory file as evidence to a peer, and never treat a peer's
  "recorded" as verified state.
- Say **"kept in my local notes"** when that is what it is; reserve "recorded" for the ledger/GitHub.
  Honest about auditability, and it stops the claim from doing work it can't support.
- When a peer's memory claim actually matters, **re-derive from the shared third-party source** —
  GitHub timestamps, CI job logs, source at a pinned tag. That is what made this session's mutual
  corrections hold; neither of us ever read the other's disk and neither could have.
- Diagnostic corollary: before theorizing that something is *overwriting* your files, check whether
  you and the other writer share an **inode**. The approver reached for "silent revert" with two
  distinct memory systems already in evidence — asserting a mechanism before establishing the premise,
  the same error class as [[feedback_read_the_input_contract_not_more_output]].
- Related: [[feedback_triage_github_posting]] (post verified verdicts as *the* durable artifact),
  [[feedback_never_relay_a_verdict_not_in_hand]], [[feedback_never_fabricate_events_between_turns]].
