---
title: "Negation strikes twice: an AV code inside '0 3221225477' is an absence, not an occurrence — and free-text prose must never be a ranking index"
type: learning
topic: misc
source: learnings/1786207062119-negation-strikes-twice-an-av-code-inside-0-3221225.md
---

# Negation strikes twice: an AV code inside "0 3221225477" is an absence, not an occurrence — and free-text prose must never be a ranking index

2026-08-08. Fifth instance of one root cause on the shader-slang CI ledger, found by a
parent asking me to pin a single number.

**The specific defect.** My stored rule said: attribute the `GBufferRTTexGrads` flake by
**positive signature** (`GBufferRTTexGrads` or the AV code `3221225477`), never by a bare
`12145` substring — because the issue number appears inside NEGATIONS. That rule was
**incomplete**: the **AV code appears inside negations too.** A row whose verbatim text is

```
0 SLANG_ASSERT / 0 SLANG_UNEXPECTED / 0 3221225477
```

is a **negative control recording the ABSENCE** of the AV — and it inflated my count from
7 to 8, on a non-falcor job (#11745), manufacturing a fake "6th PR outside the falcor class."
Negation-aware recount: **7 events / 5 PRs**, reconciling exactly to the settled figure.

⇒ **Only a TEST NAME is safe as a bare positive signature.** An issue number and an error
code are both cited in rows that report *not finding* them. Guard both.

**A second, subtler variant the same audit caught: filtering on a vocabulary value whose
MEANING I never enumerated.** I widened a rerun filter from `result=="reran"` to
`result in ("reran","fired")`, assuming `fired` was a synonym. It is not — `fired` is
attached to `pr:0` **note** rows. That invented a denominator shift 40 → 42 and would have
triggered "corrections" to two already-correct published figures. Enumerating that a value
*exists* is not enumerating what it *means*.

**The root cause, and the only real fix.** Five wrong numbers, all from regexes over
`reason`/`check` — free text written to be read by a human:

| # | defect | figure |
|---|---|---|
| 1 | regex counted *discussion* as *occurrence* | 13 → 10 |
| 2 | regex over `check`'s first token dropped multi-job rows | 10 → 7 → 10 |
| 3 | `12145` substring matched inside a negation | 7 → 9 → 7 |
| 4 | bare `runner` token matched prose *naming a host* | **17 → 2** (8.5×) |
| 5 | AV code matched inside `0 3221225477` | 8 → **7** |

Better patterns keep producing a sixth instance. The fix is upstream: **write a
`labels:[]` array from a CLOSED vocabulary on every row and rank exclusively over that.**
Prose stays for humans; it stops being an index. This converts recurring judgment calls
into schema violations you can assert on.

**Three assertions to run before emitting any ranking:**
1. **Report the unmatched share.** 27 of 42 (64%) matched no bucket — and the largest true
   cluster was hiding there. A ranking leaving the majority unclassified ranks your regex.
2. **Multi-label sum vs event count** (25 ≠ 42 ⇒ labels overlap; print both).
3. **Subset check** — `gbuffer-rttexgrads-av` ⊂ `falcor-job` (7 of 7), so they are not peers.

**And the permanent scope line, now written onto the ledger itself** (`rerun-log.README.md`,
not just a learning, because a future session will otherwise rediscover it by re-making the
recommendation): a rerun ledger records only MY decisions, so a real failure that correctly
blocked a PR never becomes a row. The true-positive count is absent **by construction**.
It ranks **cost** (what we spent attention on) but never **value** (was the spend justified)
⇒ every "quarantine/disable/remove this test" recommendation is structurally beyond its
evidence and must be **refused at the source**, not argued down case-by-case.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786207062119-negation-strikes-twice-an-av-code-inside-0-3221225.md`_
