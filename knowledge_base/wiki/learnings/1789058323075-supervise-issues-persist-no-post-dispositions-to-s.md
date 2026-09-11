---
title: "supervise-issues: persist no-post dispositions to state; read-only roles are awaiting_us false-positives"
type: learning
topic: agent-ops
source: learnings/1789058323075-supervise-issues-persist-no-post-dispositions-to-s.md
---

# supervise-issues: persist no-post dispositions to state; read-only roles are awaiting_us false-positives

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-10T16:38:43.075Z
---

# supervise-issues: persist no-post dispositions to state; read-only roles are awaiting_us false-positives

**Context:** Supervisor tick 216 (2026-09-10) reported 129 needs_nudge / 32 escalate on 548 open chains — a pathological over-flag, not real work. Root causes, both durable:

1. **Dispositions agreed in-chat/memo but never written to `supervisor-state.json` get re-flagged every tick.** Five slang chains (#12942/12945/12946/12947/12948) were deliberately closed at triage on 2026-09-08 (core-team-owned perf-epic #12941 sub-tasks, 0-comment by design). The decision lived in the triager's `triage-*.md` memos + a prior session's chat, **not** as a `disposition` key. `scan.py`'s human-owned park (`classify()` checks `HUMAN_OWNED_DISPOSITION` before the ball/silence branches) only fires if the token is IN the state file, and `pull-universe.sh` rehydrates `disposition` from prior state each tick. **Rule:** when a chain is dispositioned (parked/non-actionable/handed-off), write `disposition` (containing a recognized token: `advisory`, `maintainer-driving`, `stood-down`, `awaiting-pickup`, `external-pr`, `human-debate`, `closed-by-us`) to `supervisor-state.json` **that tick** — a memo is not a substitute.

2. **Read-only / never-post roles (e.g. `slang-pr-approver`) are structural `awaiting_us` false-positives.** The pr-approver's output is a ledger decision; it never posts to GitHub by design, so "human spoke last, unanswered by us" is *always* true for it (confirmed on #12389: human PR, last GH actor = coderabbitai bot, flagged awaiting_us). `scan.py` should exclude read-only roles from `awaiting_us`.

3. **R3 "0 comments = no artifact" is a false-positive for maintainer-self-assigned PM/tracking tasks.** Core-team reporter + no reproducer + self-assigned planning issue → a bot triage comment is noise on their tracker. The disposition + internal memo is the resumable artifact; don't force a public comment.

**Operational rule at scale:** never fire 100+ nudges or 32 blocking `ask_user_question` escalations mechanically. Check prior `nudgedAt` (skill: nudged twice → escalate, not a 3rd nudge) and prior-tick nudge cadence (if the last real nudge was days ago, a full blast is a spike, not "resuming"). Act on the genuinely-fresh delta; report the `sent_nudges ≠ must_nudge` invariant honestly and escalate the *systemic* condition once.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789058323075-supervise-issues-persist-no-post-dispositions-to-s.md`_
