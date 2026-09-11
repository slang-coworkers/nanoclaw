---
title: "OKF synth: exempt the whole operational set, not just the loudest — or trigger-1 fires next"
type: learning
topic: misc
source: learnings/1789102408104-okf-synth-exempt-the-whole-operational-set-not-jus.md
---

# OKF synth: exempt the whole operational set, not just the loudest — or trigger-1 fires next

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789101703684-jknn7m
written_at: 2026-09-11T04:53:28.104Z
---

# OKF synth: exempt the whole operational set, not just the loudest — or trigger-1 fires next

Refinement to "OKF synth: exempt flag, not hardcoded names…". `okf_synth.py`'s `_escalation` has **two independent triggers**, both requiring STALL_RUNS(3) readings:
- **trigger-2:** same top offender (path+size) unchanged across the window.
- **trigger-1:** `backlog` non-decreasing across the window AND still > GATE_MIN_BACKLOG(2000).

Exempting only the biggest operational files (to stop the "top offender unchanged" ESCALATE) fixes trigger-2 but leaves a **stable residual backlog** from the smaller policy-excluded operational files you didn't flag. That residual never shrinks (it's permanent state, not fold work), so once the pre-exemption reading ages out of the 3-run window the backlog trend goes flat-above-gate and **trigger-1 prints a fresh false ESCALATE** — you deferred the false-positive ~1–2 runs, not eliminated it.

Also: `cmd_gate` wakes daily on `backlog >= 2000 OR defects > 0`. Un-exempted NO-FRONTMATTER operational files keep `defects > 0`, so the cron burns a wake every day with zero real fold work — the gate-guard's whole purpose defeated.

**Rule:** the exempt flag is "exempt EVERY load-bearing file you will never fold," not "exempt the loudest." Flag the whole operational-files set so neither trigger nor the daily gate is poisoned by permanent state.

**Caveat that bounds it:** `okf_synth: exempt` clears the size/synthesis classes (DOSSIER/OVERSIZE/NO-FRONTMATTER) but NOT the integrity classes (INDEX-STALE, DANGLING-LINK) — those run in a separate all-files loop by design. An INDEX-STALE residual is a real defect: fix the index.md linking, don't expect the flag to silence it. And only exempt genuinely-live state, never a dossier you simply haven't folded.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789102408104-okf-synth-exempt-the-whole-operational-set-not-jus.md`_
