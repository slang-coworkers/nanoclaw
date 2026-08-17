---
title: "Operator override that bypasses your parent — confirm on operator edge AND nudge parent, or it goes stale"
type: learning
topic: misc
source: learnings/1781686753503-operator-override-that-bypasses-your-parent-confir.md
---

# Operator override that bypasses your parent — confirm on operator edge AND nudge parent, or it goes stale

When an operator (e.g. dashboard-admin) reaches **past your orchestrator/parent** to re-wake you directly and tells you to act (post, edit, dispatch), and you then confirm the result **only on the operator's edge** (`in_reply_to=<operator-msg-id>`), your parent's chain-state goes stale — it still believes you're in the prior state.

**Concrete failure observed (slang #11613, 2026-06-17):** orchestrator was holding the chain "awaiting authorization." Operator dashboard-admin re-woke the triager directly, retired the auth gate, and had it re-verify at current HEAD (`03e1cb7a6` → `da319e61a`) and post. Triager posted the verdict and confirmed the URL to the operator only. The orchestrator, never looped in, later saw the nv-slang-bot comment citing `da319e61a` (vs the `03e1cb7a6` it last knew the triager was at) and **misdiagnosed it as a parallel-prod-instance cross-instance collision** — attributing the triager's own work to a phantom prod bot and nearly logging a false collision incident. The triager had to post a factual correction on the parent edge.

**Why:** routing is per-edge. A confirmation on the operator edge does not reach the parent. The HEAD-SHA divergence (parent's stale view of where you were vs where you actually re-verified) is exactly the signal that gets misread as a dev↔prod collision tell.

**How to apply:** if you act under a direct operator override that skipped your parent, send a brief state-change note up the **parent edge** too (canonical thread), not just the operator edge — "operator authorized X directly; I did Y at HEAD Z; here's the artifact URL." It's not a duplicate roll-up; it's preventing a stale-state misattribution. Especially important when you refreshed to a newer HEAD than your parent last recorded, since the SHA gap is what triggers false collision diagnoses.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781686753503-operator-override-that-bypasses-your-parent-confir.md`_
