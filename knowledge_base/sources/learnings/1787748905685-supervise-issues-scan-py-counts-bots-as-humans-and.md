---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-26T12:55:05.685Z
---

# supervise-issues scan.py counts bots as humans and disposition-posted as owed

**Measured 2026-08-26 (supervisor Tick 189).** scan.py emitted `must_nudge=228` across 477 open chains — an absurd figure vs. a normal handful. Auditing every limb against live GitHub reduced it to **0 genuine nudges**:

- **"human spoke last" (160 rows): 80 were BOT-last.** scan.py's bot set misses `coderabbitai`, `nv-slang-bot`, `github-actions`, `CLAassistant` (CLA bot), and — critically — `pr-board-sync-assignment` **"do not reply to this comment"** auto-notices authored under a human login (jhelferty-nv etc.). All of these read as "human spoke last, unanswered by us."
- **"fixer owns, silent" (51 rows): 51/51 already had an nv-slang-bot triage DISPOSITION comment posted** → that's the resumable artifact (R3), so the chain is `awaiting_human`, not owed. The fixer carve-out is meant for *no-disposition* silence only.
- **"bounced container" (`last_outbound_error_class` transient/unknown, 5 rows):** all resolved to open PRs, posted dispositions, or live human design-debate. The error-class flag is stale metadata from old sessions, not a current stall.
- **169/228 flagged were already at 2+ prior nudges** — Step 3 mandates escalate, not a 3rd nudge. ~74 of those are genuine-human-last but are maintainer deferrals/design debates (jkwak-work, tangent-vector, kaizhangNV) re-flagged every tick (nudge counts 9, 8, 8).

**Why:** the SKILL's fails-loudly rule (`sent != must_nudge` → violation) is designed to catch UNDER-nudging real dead sessions. It does not distinguish an over-flagging instrument. A raw `must_nudge` in the dozens+ is the tell to AUDIT the limbs against live GitHub before firing, not to blast messages.

**How to apply:** before acting on scan.py's `must_nudge`, recompute ball-direction yourself from `chains[t].comments[-1].author.login` with the full bot set above (incl. `pr-board-sync` "do not reply" notices and CLA bots), drop chains with a posted nv-slang-bot disposition, and drop chains already at 2+ nudges (escalate those instead). If the genuine set is tiny and `must_nudge` is huge, the instrument is broken — send 0, escalate the breakage + the over-nudge backlog to the operator, never flood. Range-check the figure first (memory ANCHOR G, [[feedback_a_stored_claim_re_shipped_as_a_live_finding]]).
