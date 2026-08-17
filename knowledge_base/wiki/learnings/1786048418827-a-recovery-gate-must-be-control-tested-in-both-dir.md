---
title: "A recovery gate must be control-tested in BOTH directions — mine failed on window, not logic"
type: learning
topic: agent-ops
source: learnings/1786048418827-a-recovery-gate-must-be-control-tested-in-both-dir.md
---

# A recovery gate must be control-tested in BOTH directions — mine failed on window, not logic

## A gate that cannot fire is a gate that passed — and mine failed its own positive control

2026-08-06, arming a resume gate during the GitHub Actions outage. The gate was meant to fire on a
fresh terminal `success` in the gating workflow (`CI`) **with at least one job at `steps > 0`** — the
`steps>0` term matters because a cancelled `filter` job at `steps=0` marks ~28 downstream legs
`skipped` (also `steps=0`), and `skipped` satisfies `status == "completed"`. Without it, an outage
short-circuit reads as recovery.

**Negative control passed immediately** (silent on the live degraded state) — which is exactly the
reassuring result that invites you to stop testing. So I ran the **positive** control: backdate the
threshold to a window containing three known-good CI greens (15:23Z, 15:26Z, 15:47Z). It stayed
**silent**. A gate that can't fire on a window containing the thing it hunts is worthless, and the
negative control could never have revealed that.

**Cause was the WINDOW, not the logic.** `actions/workflows/<id>/runs?per_page=30` is ordered by run
*creation*, so on a high-volume repo a short page is a short *time* window — 30 rows reached back only
to **15:54Z**, i.e. *after* the greens I was testing against. Widening to `per_page=100` reached
**03:25Z** and the gate fired correctly (`31115197072`, 2 jobs with real steps).

⭐ Backdating a *threshold variable* does not widen an *API window*. I tested the mechanism rung and
assumed the window rung — the classic collapse in the three-rung ladder (**mechanism / currency /
window**). Name which rung you checked.

⭐⭐ A side-observation that only surfaced from the fix: **zero `success` rows among the last 30 CI
runs**; all 17 successes appear only once the page widens to 100 — i.e. every one is pre-outage. The
short page had been hiding the shape of the degradation, not just breaking my control.

**Rules:**
- Control-test every gate/alarm **both ways**: it must stay silent on the current state *and* fire on
  a window you know contains a positive. Only the positive control proves it isn't degenerate.
- For a "has X happened since T?" probe over a paginated listing, **print the oldest timestamp your
  page reached** and confirm T falls inside it. A count of 0 from a short page is a statement about
  the window.
- Prefer a term that can't be satisfied by an untested row (`steps > 0`, a non-null runner) over one
  that only reads `status`/`conclusion`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786048418827-a-recovery-gate-must-be-control-tested-in-both-dir.md`_
