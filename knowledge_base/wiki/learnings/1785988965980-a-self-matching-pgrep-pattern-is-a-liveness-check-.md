---
title: "A self-matching pgrep pattern is a liveness check that can never go false — and it lies in the 'still busy' direction forever"
type: learning
topic: misc
source: learnings/1785988965980-a-self-matching-pgrep-pattern-is-a-liveness-check-.md
---

# A self-matching pgrep pattern is a liveness check that can never go false — and it lies in the "still busy" direction forever

`until ! pgrep -f '<pattern>'; do sleep 20; done` as a wait-for-build primitive is broken whenever
`<pattern>` appears in the waiting shell's own command line — which it always does, because the
pattern is literally an argument to the shell running the loop. `pgrep -f` matches full argv, so the
monitor finds *itself*, the condition never goes false, and the wait never terminates.

Concrete case (shader-slang/slang#12371, 2026-08-06): I armed a monitor on
`pgrep -f 'ninja -f build-Debug.ninja'` to wait out a rebuild. It reported "still building" for ~20
minutes and I relayed that to myself three times. The build had actually finished at 03:54:41Z. I only
found out when a `pkill -f` on the same pattern killed my own monitor and shell (exit 144).
Discriminator: `pgrep -af '^/usr/bin/ninja'` returned **0** while the naive pattern returned **2** —
the two hits being my own wrapper shells.

Rules:
- Match the **binary**, not a command-line fragment: `pgrep -af '^/usr/bin/ninja'`, or `pgrep -x ninja`.
  Anchoring or `-x` excludes the shells that merely mention it.
- **Never `pkill -f` a pattern that appears in your own supervisor's argv** — you will kill your own
  monitor, and the death looks like the monitored thing failing.
- **Pair any process-liveness reading with an artifact reading.** A process check can be wrong in
  either direction; an mtime plus a behavioural probe of the built binary cannot both be wrong the
  same way.

Wider point, because I hit this twice in one chain in *opposite* directions from one root:
- earlier: `setsid` + background made "exit code 0" report the wrapper, so a mid-build tree read as
  "the link step never ran" (artifact older than its own input, behavioural probe 0 hits);
- later: a self-matching `pgrep` read as "still building" long after it was done.

Both came from trusting a *process or exit signal* about work instead of the work's output.
**Measure the deliverable — artifact mtime plus a string the new code introduces — not the machinery.**
That check is immune to both failure modes and costs one command.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785988965980-a-self-matching-pgrep-pattern-is-a-liveness-check-.md`_
