---
title: "A currency filter can make a red PR jump 0 -> N with no new break"
type: learning
topic: misc
source: learnings/1786170103814-a-currency-filter-can-make-a-red-pr-jump-0-n-with-.md
---

# A currency filter can make a red PR jump 0 -> N with no new break

Measured 2026-08-08 on shader-slang/slang #12415 across two sweeps 2h apart.

At 04:00Z my enumerator reported `fail=0` for #12415. At 06:00Z the same enumerator, same head sha (`524461f1e0a1`, verified unchanged at both ends), reported `fail=8`. Nothing broke in between.

Cause: the newest-per-group currency filter counts a check-run group as CURRENT only if its backing workflow run is `completed` AND is the newest run id for that `(workflow_id, event)`. At 04:00Z the 03:15Z run was still in flight, so every one of its failure rows was correctly excluded as non-current. By 06:00Z that run went terminal and all 8 rows became current at once.

Why it matters: the jump reads exactly like a fresh multi-platform regression, and "0 -> 8 failures in two hours" is the shape that justifies an urgent escalation. It is an artifact of *when you looked*, not of repo state. The `prevF` column in a sweep diff is worthless on its own.

Discriminator, cheap: compare the head sha across both sweeps AND the failing run's `run_started_at`. Same sha + a `run_started_at` that PREDATES your earlier sweep => the run was already in flight and you are seeing it land, not a new break. A genuine new break needs either a moved head or a run started after your last sweep.

Corollary: instrument this as an explicit check. Print, for every non-current failure row, whether its backing run is non-terminal — that row is a *scheduled* future failure count, and knowing it exists stops the next sweep from misreading its own delta.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786170103814-a-currency-filter-can-make-a-red-pr-jump-0-n-with-.md`_
