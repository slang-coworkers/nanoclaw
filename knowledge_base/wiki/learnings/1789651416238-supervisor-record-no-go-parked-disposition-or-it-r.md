---
title: "Supervisor: record NO-GO/parked disposition or it re-pages the fixer as false-positive-silent"
type: learning
topic: agent-ops
source: learnings/1789651416238-supervisor-record-no-go-parked-disposition-or-it-r.md
---

# Supervisor: record NO-GO/parked disposition or it re-pages the fixer as false-positive-silent

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-17T13:23:36.238Z
---

# Supervisor: record NO-GO/parked disposition or it re-pages the fixer as false-positive-silent

**Context:** supervise-issues Tick 229 (2026-09-17). scan.py's fixer-owned carve-out (root cause of slang#12002) classifies any *fixer-owned, no-PR, silent* chain as `awaiting_us → needs_nudge`, on the principle that a silent no-PR fixer chain is "a promise we still owe." Correct for genuinely-dropped work, but it fires a **false positive** on chains the fixer has *deliberately parked* (NO-GO, defer-to-self-assigned-maintainer, closed-at-triage-infra-only).

**What happened:** 5 no-PR chains (#13140/#13142/#13143/#13145/#13148) had `disposition:''` in `supervisor-state.json` — the fixer had confirmed NO-GO on each in prior handoffs, but the disposition was never written back to state. So scan.py saw "fixer-owned + no-PR + silent + no human-owned disposition" and nudged all 5. Every woken session replied within ~1 min: "held by design, not stalled — suggest excluding confirmed-NO-GO/parked issues from stuck-time nudges" (fixer msgs 336542, 336548 said this explicitly).

**The fix (durable, done this tick):** the disposition IS the R3 resumable artifact. When a fixer confirms a no-PR chain is parked (NO-GO / assignee-owned / needs-info-external / infra-only), **write that `disposition` string into `supervisor-state.json` immediately.** scan.py treats a human-owned disposition (`stood-down:*`, `advisory:*`, `assignee-owned`, `needs-info-external`) as `awaiting_human → action='none'`, so the carve-out no longer trips and the chain stops paging. Board rows already carrying such dispositions (e.g. #13061, #13128) correctly classify awaiting_human and are never nudged — the only difference was the missing state write.

**Rule:** a fixer-owned no-PR chain is only a "promise we owe" while it has **no recorded disposition**. The instant the owning tier reports a parked/NO-GO verdict, record it to state — don't leave it blank and let the next tick re-nudge. Blank disposition on a fixer-owned no-PR chain = "unaccounted," not "parked."

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789651416238-supervisor-record-no-go-parked-disposition-or-it-r.md`_
