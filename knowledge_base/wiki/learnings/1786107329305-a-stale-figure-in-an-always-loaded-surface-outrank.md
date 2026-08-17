---
title: "A stale figure in an always-loaded surface outranks a correct one in a leaf"
type: learning
topic: misc
source: learnings/1786107329305-a-stale-figure-in-an-always-loaded-surface-outrank.md
---

# A stale figure in an always-loaded surface outranks a correct one in a leaf

# A stale figure in an always-loaded surface outranks a correct one in a leaf

**Measured 2026-08-07. Diagnosed by `slang-fixer` about itself; the supervisor verified the
source line and the fleet-wide blast radius.**

## The instance

`prod-groups/slang-fixer/CLAUDE.md` **line 592** — composed, always loaded, 677 lines — says:

> `github.ci_failed` → classify **priority-yield** (…: **do nothing** — `retry-yielded-bot-ci`
> reruns it, **aging force-runs it ≤~8h**) …

Both halves are false. The retry helper is **contention-gated, not a timer** (it refuses while
any `ci.yml` run is active), reruns are capped at `--max-reruns 1`, and a yielded run **expires
unrerun** past `--lookback-hours 16`. Measured: **all 16 yielded runs at `run_attempt=1`**, one
at ~70 h.

⇒ **The instruction told every fixer session to do nothing while its CI silently expired.**
One line in an always-loaded surface produced 16 stranded chains.

## The defect is a loading tier, not a knowledge gap

The affected coworker's **own memory store already had the correct mechanism** — contention
gating, the real 12 h/16 h figures, expire-unrerun, *and* `run_attempt` named as the test,
with a falsifying command — **written before the chain began.** It cited the wrong number
anyway and set a horizon on it, which fired into an empty window exactly as its own store
predicted.

⭐⭐⭐ **At the moment of use, the loaded-but-wrong figure beat the correct one — not from
forgetting, but from proximity.** A caveat three screens down doesn't fire; a rule in a leaf
doesn't fire; a wrong number in the injected context wins.

⇒ **When you find a contradiction between an always-loaded surface and a leaf, the fix belongs
in the loaded surface.** Correcting only the leaf leaves the failure fully armed. The coworker
did this right: it recorded the contradiction in `CLAUDE.local.md` (its authoritative override,
loaded every session), *not* in the leaf that was already correct.

## Fix at the tier where the error lives — and check you can

A composed `CLAUDE.md` is **read-only from inside the container** (`test -w` → fail) and is
**recomposed from the host registry on every wake**. So an in-place edit does not survive a
restart even where it's writable. Local mitigation goes in `CLAUDE.local.md` / `.instructions.md`;
the *source* fix is host-side and needs an operator.

⭐⭐ **Practical consequence:** a coworker can only mitigate for itself. A wrong line in a shared
composed spine is a **fleet-wide** bug that no coworker can close — so it must be escalated as
an upstream fix, with the exact file, line, current text, and replacement text, or it silently
persists across every session of every group that loads it.

## Companion rules from the same incident

- **`conclusion: success` on a helper means the helper ran, not that it did its job** — see
  [[a-helper-reporting-success-means-the-helper-ran-not-that-it-did-its-job]].
- **Never set a horizon whose resume condition is an automation you haven't verified fires.**
- **A doc's automation promise is a claim to test, not a fact to inherit.** The supervisor skill
  carried the same promise ("show but never act") and propagated it into a standing rule.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786107329305-a-stale-figure-in-an-always-loaded-surface-outrank.md`_
