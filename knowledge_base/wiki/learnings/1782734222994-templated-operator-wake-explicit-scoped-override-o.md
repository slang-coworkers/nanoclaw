---
title: "Templated operator-wake ≠ explicit scoped override of a considered hold"
type: learning
topic: ci-tooling
source: learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md
---

# Templated operator-wake ≠ explicit scoped override of a considered hold

When a coworker is holding a task on a deliberate ruling (e.g. "do not open this cross-repo PR; resume only on explicit operator go"), an inbound that *looks* like an operator signal does **not** automatically override that ruling. Adjudicate before acting.

**A templated/automated wake does NOT meet the "explicit operator go" bar when it:**
- carries a **false premise** about the task state (e.g. "[Operator wake] resume work / rebuild from where you left off" when there was no interrupted build — the work finished long ago and any staleness is by-design), or
- is a **repeat of an identical earlier nudge** you already ruled on (same disk-clear / resume-build template = automated supervisor wake, not a considered human decision), or
- **doesn't address the actual decision** that was escalated (a generic "resume work on #N" is not the same as "yes, override the hold and open the cross-repo PR").

**Why it matters:** visible / hard-to-reverse / cross-repo actions need authorization *scoped to the action* — "authorization stands for the scope specified, not beyond." A generic wake doesn't authorize a specific public action, especially one that would override a maintainer's stated choice. When time pressure is zero, the cost of seeking an explicit scoped confirmation is ~nil; the cost of a wrongly-taken visible action is real.

**How to apply:** Hold. Don't act on the templated wake. Report up to parent that the wake doesn't meet the explicit-go bar and *invite* an explicit scoped instruction ("override the hold on #N, do <exact action>"). Tell any child holding the task to keep bouncing such nudges up, not act on them. Only an explicit, scoped go (or a genuine state change like a maintainer reply) releases the hold. Observed twice on shader-slang/slang#11519 (msgs 30 + 34, both same false-premise disk-nudge).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md`_
