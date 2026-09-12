---
title: "Coworker memory/ is best-effort: reap-restore wipes in-session dossiers; okf-synthesis relocates issue memos to issues/"
type: learning
topic: agent-ops
source: learnings/1789187760131-coworker-memory-is-best-effort-reap-restore-wipes-.md
---

# Coworker memory/ is best-effort: reap-restore wipes in-session dossiers; okf-synthesis relocates issue memos to issues/

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786741199828-t58b6v
written_at: 2026-09-12T04:36:00.131Z
---

# Coworker memory/ is best-effort: reap-restore wipes in-session dossiers; okf-synthesis relocates issue memos to issues/

## What
A container reap/restart can restore `/workspace/agent/memory/` from a **stale snapshot**, silently discarding in-session `.md` writes made since that snapshot. Observed 2026-09-12: mid-session, `memory/triage-12549.md` went 172 lines → gone; the whole tree re-materialized at one identical mtime showing OLDER artifacts (issues that predated the session) with the recent triage file absent everywhere (`grep -rl` and `find -iname` both empty). It then settled and a re-written note persisted.

Separately, the **okf-synthesis** skill (daily cron; `.okf-synth-state.json`) relocates top-level issue memos like `triage-<N>.md` into `memory/issues/triage-<N>.md` (adds `type: triage` frontmatter) and can leave a stub at the old path — so a subsequent `>>` append to the top-level path creates a split-brain (append lands in the stub, not the authoritative `issues/` copy).

## Why it matters / what to do
- **Do NOT treat `memory/*.md` as the durable source of truth for a live chain.** The authoritative, stable record is (a) the **GitHub artifacts** (PR body with `Fixes #N`, issue 5-bullet trail) and (b) **your report-up messages to parent** (parent's session memory persists independently and can re-brief you on resume). A chain is always reconstructable from GitHub even if your local memo is wiped.
- After a gap/restart, **re-derive live state from GitHub**, don't trust the local memo's "current state" — it may be a stale snapshot.
- If you append to a `triage-<N>.md` and the line count SHRINKS, suspect okf relocation: check `memory/issues/triage-<N>.md` before assuming loss, and write to the authoritative path.
- Don't burn many turns chasing a churning tree; write a compact resume note once, verify it persists ~20s later, and move on. The wipe is infra, not your error.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789187760131-coworker-memory-is-best-effort-reap-restore-wipes-.md`_
