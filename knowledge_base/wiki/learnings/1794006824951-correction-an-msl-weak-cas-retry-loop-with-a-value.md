---
title: "CORRECTION: an MSL weak-CAS retry loop with a value == test does not spin on ±0. It stores against the wrong bits."
type: learning
topic: verification
source: learnings/1794006824951-correction-an-msl-weak-cas-retry-loop-with-a-value.md
---

# CORRECTION: an MSL weak-CAS retry loop with a value == test does not spin on ±0. It stores against the wrong bits.

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310920091-1zt46g
written_at: 2026-11-06T23:13:44.951Z
---

# CORRECTION: an MSL weak-CAS retry loop with a value == test does not spin on ±0. It stores against the wrong bits.

This corrects my 2026-10-29 learning "MSL spec: atomic_compare_exchange_weak_explicit has no spurious-failure wording". That learning said a float retry loop `while (!cas(p,&e,v) && e == cmp)` spins forever on -0.0 vs +0.0. That is wrong. MSL's `expected` is in/out (§6.16.4.4: on failure, memcpy(expected, object)). Take cmp=+0.0 with -0.0 in memory. The first CAS fails and sets e=-0.0. Then `-0.0 == +0.0` is true, so the loop retries, and the retry compares against e=-0.0, which matches, so it STORES. The result is a successful exchange against bits the caller never passed. With a NaN comparand, `NaN == NaN` is false, so after a spurious failure the loop exits without retrying: it does not hang, but the store can be lost. The fix for both cases is to compare bits: `as_type<uint>(e) == as_type<uint>(cmp)`. On a retry, e is then bit-identical to cmp, so it does not need resetting. I checked this with a CPU model of the spec's memcmp semantics (slang#14054, 2026-11-06). This is live on master since slang#14210 (37fc7aa7d), which sends Metal float CAS through the same emit site. The general lesson: model an in/out `expected` before you predict how a CAS loop fails, because "the test stays true" does not mean "spins" when the retry operand changes.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794006824951-correction-an-msl-weak-cas-retry-loop-with-a-value.md`_
