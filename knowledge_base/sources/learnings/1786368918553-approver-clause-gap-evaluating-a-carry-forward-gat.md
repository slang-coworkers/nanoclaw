---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786366895972-aw1q2m
written_at: 2026-08-10T13:35:18.553Z
---

# [approver/clause-gap] Evaluating a carry-forward gate means testing its PREMISE, not enforcing the remedy you prescribed

Measured on shader-slang/slang-rhi#823 @`d0964b150b9c`, 2026-08-10 — the PR my own
prior gate was written to catch.

## The setup

Reviewing #821 I cleared a real race (separately-locked lookup at `device.cpp:292`
and insert at `:347`, so two callers could both miss, both compile, and overwrite)
**only because its trigger was unreachable** — nothing ran pipeline compilation
concurrently at that commit. I wrote a standing gate: the next PR in the series
must land **per-key in-flight state** (one caller creates, others wait) **plus a
concurrent same-key regression test**, or `ABSTAIN_POLICY:OPEN_GAP`.

#823 is that PR. It introduces the worker threads. It lands **neither** remedy.

## The trap

The gate, read literally, fires: no per-key in-flight state, no same-key
concurrency test ⇒ OPEN_GAP. That would have been wrong-reasoned even though the
final verdict was also ABSTAIN (for an unrelated gap) — a right answer via a broken
derivation is the kind that survives and mislead the next reader.

The design closes the window a **different** way: `resolve()` takes a device-wide
`m_pipelineResolutionMutex` for the whole resolution, so lookup (`collectRequests`)
and publication (`finalize`) both run single-threaded; only `compileEntryPoint` on
pre-prepared, disjoint records runs in parallel. The both-miss-and-overwrite window
is closed by **serialization**, not by per-key in-flight state.

## The lesson

**A carry-forward gate names an invariant; the remedy I sketched was one way to
satisfy it, not the definition of satisfying it.** When the gate fires, re-derive:

1. What was the *failure* the clearance depended on being unreachable?
2. Is it still unreachable, or now prevented — by any mechanism?
3. Only if neither holds does the gate bite.

Enforcing the prescribed remedy over the protected invariant is substituting my own
design preference for a review finding. It reads as rigour (the gate *did* fire) and
produces false OPEN_GAPs on correct designs — the mirror image of a false-safe, and
the one my incentives don't punish.

## How to write the gate so it survives this

State the **invariant + trigger**, and mark the remedy as one sufficient option:

> When worker threads reach pipeline compilation, resolution must be atomic per key
> — no two callers may both create and one silently overwrite. *Sufficient:* per-key
> in-flight state, **or** serializing lookup+publication under one lock. Verify which
> and say so.

And record the outcome explicitly as **"gate satisfied by different means"** — never
drop it silently, because a silently-dropped gate and an evaluated one look the same
in the next reader's grep.
