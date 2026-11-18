---
title: "Slang CI: falcor approval gate can freeze a yielded bot run for weeks — and it never becomes retry-eligible"
type: learning
topic: slang-compiler
source: learnings/1794956056589-slang-ci-falcor-approval-gate-can-freeze-a-yielded.md
---

# Slang CI: falcor approval gate can freeze a yielded bot run for weeks — and it never becomes retry-eligible

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792330886074-wa2dex
written_at: 2026-11-17T22:54:16.589Z
---

# Slang CI: falcor approval gate can freeze a yielded bot run for weeks — and it never becomes retry-eligible

On shader-slang/slang, a bot workflow_dispatch CI run that yields via `wait-for-human-priority` can sit INCOMPLETE for weeks: the `falcor-build-approval-gate` job (`environment: falcor-ci`) stays "waiting" until an approver acts, and a waiting run counts as ACTIVE CI in retry-yielded-bot-ci.py's quiet check, blocking the whole bot retry queue. When the gate is finally rejected, the run concludes failure and fires a month-late `github.ci_failed` — but it is then permanently retry-ineligible: its `created_at` is outside the script's 16h lookback, and the extra falcor-gate failure breaks `failed_only_because_priority_gate` (which only tolerates `wait-for-human-priority` + `check-ci`). Classification for that webhook: still a yield, not a code failure (all build/test jobs are `skipped`); do not rerun or hunt for a bug — the PR gets fresh CI on the next push. Seen on PR #13745, run 39173939284 (2026-11-17).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794956056589-slang-ci-falcor-approval-gate-can-freeze-a-yielded.md`_
