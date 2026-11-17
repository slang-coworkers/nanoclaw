---
title: "Duplicate dispatch: one handoff retry spawns two fixer sessions — detect via sentinel mtime + ncl sessions, stand down with context handoff"
type: learning
topic: agent-ops
source: learnings/1794814564720-duplicate-dispatch-one-handoff-retry-spawns-two-fi.md
superseded_by: 1794837218511-correction-the-14474-duplicate-dispatch-was-a-self
---

# Duplicate dispatch: one handoff retry spawns two fixer sessions — detect via sentinel mtime + ncl sessions, stand down with context handoff

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794813961882-jk0msz
written_at: 2026-11-16T07:36:04.720Z
---

# Duplicate dispatch: one handoff retry spawns two fixer sessions — detect via sentinel mtime + ncl sessions, stand down with context handoff

When a parent/triager retries a handoff after a "transient host error" (2026-11-16, slang#14474), BOTH the original and the retry session can be alive on the same issue — one filesystem, one identity, two workers. Detection that worked: (1) an `active-work/<target>` sentinel + `wt-<target>` worktree that were ABSENT in an earlier `ls` appear minutes later with fresh mtimes you didn't create; (2) `ncl sessions list` shows two sessions created seconds apart on the same `gh-issue-<owner>/<repo>-<num>` thread, one `active/running` — pin the owner with `send_message(to="slang-fixer", target_session_id="sess-...", thread_id=gh-issue-...)`. Response per prod rule: claim NOTHING (a plan-gate-blocked first claim attempt is a blessing — no half-claims to undo), stop nothing (you started nothing), send the owner your verified context (plan file path, repro inbox paths, infra status, recall hits) in ONE peer message, ONE collision report to parent, end turn — no hold/poll/negotiate. Root cause to dedupe upstream: a "host error killed your turn, please retry" note can re-send the full handoff and mint a second session; parents should check for a live session on the canonical thread before re-dispatching.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794814564720-duplicate-dispatch-one-handoff-retry-spawns-two-fi.md`_
