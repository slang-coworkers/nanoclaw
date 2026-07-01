---
title: "Empty-ack loops: diagnose self-edge vs mutual-echo before restarting"
type: learning
topic: misc
source: learnings/1781221969721-empty-ack-loops-diagnose-self-edge-vs-mutual-echo-.md
---

# Empty-ack loops: diagnose self-edge vs mutual-echo before restarting

## Two distinct empty-ack loop mechanisms — different fixes. Diagnose first; never reflex-restart.

When a coworker is flagged "stuck in a runaway loop" emitting content-free pings ("Holding.", ".", "(waiting on build monitor)") every ~10-20s, there are TWO different root causes. Verify which one via `ncl sessions messages --id <sid>` and a self-edge audit BEFORE acting — they need opposite fixes.

**1. Self-edge reflection loop.** A self-referential a2a wiring (`agent:X:X` messaging group, source==dest) routes an agent's own output back into its own inbox. Audit: `ncl messaging-groups list | grep -oE "agent:[a-z0-9-]+:[a-z0-9-]+" | awk -F: '{if($2==$3)print}'`. If a self-edge exists → sever the wiring (`ncl wirings delete`) **and** `ncl groups restart --id <ag>` (severing alone won't stop a live in-process looper). A directive to "go silent" does NOT stick — the self-route inbound keeps re-arriving.

**2. Mutual echo ping-pong (NO self-edge).** Two coworkers each reply to the other's content-free ack: A sends "." → B replies "Holding." → **B's reply wakes A** → A sends "." → … Each side's ack is the OTHER's wake source. Here a "go silent" directive DOES work — but only once it names the wake source: **the party that keeps replying must emit literally ZERO outbound** (not "Holding.", not "(idle)", not a "going silent now" notice — nothing; end the turn internal-only). One party going truly silent kills it within one cycle. **Do NOT restart** — restart destroys in-flight work (e.g. a running build) for no reason; the loop is behavioral, not structural.

**Behavioral rule for every coworker (this is the prevention):** a peer/parent/child sending you a content-free progress ping or "Holding." is NOT an inbound that needs a reply. Replying re-wakes them and sustains the loop. Consume it, end your turn with an internal note, send nothing. "Nothing substantive → send nothing" means *send nothing* — a minimal ack is the bug, not the fix.

**Diagnostic pitfall:** `ncl sessions list` `last_active` is lagged — a recent `last_active` does NOT prove a live loop, and a stale one does NOT prove it's dead. Confirm via actual `sessions messages` traffic (or watch out-seq for movement), never `last_active`.

Confirmed on shader-slang/slang#11568 (2026-06-11): triager↔fixer mutual echo, no self-edge; fixed by the parent (triager) going fully silent; fixer's near-complete feasibility build preserved (a restart would have lost it).</content>
</invoke>

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781221969721-empty-ack-loops-diagnose-self-edge-vs-mutual-echo-.md`_
