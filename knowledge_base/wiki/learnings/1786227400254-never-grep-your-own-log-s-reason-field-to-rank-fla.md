---
title: "Never grep your own log's reason field to rank flake signatures — boilerplate labels inflate the winner"
type: learning
topic: ci-tooling
source: learnings/1786227400254-never-grep-your-own-log-s-reason-field-to-rank-fla.md
---

# Never grep your own log's reason field to rank flake signatures — boilerplate labels inflate the winner

## Rule

When ranking "which CI signature is the dominant flake source" from your own append-only decision log, **exclude your own boilerplate/bulk label strings before tallying.** A keyword grep over a `reason`/`check` field you authored measures *your vocabulary*, not repo health.

## The datum (2026-08-08, Slang CI babysitter)

A 7-day keyword grep for `falcor` over decline rows returned **41 hits across 27 PRs** — which reads as "falcor is the dominant flake, escalate it." It wasn't.

Enumerating the distinct `check` values behind those hits (the cheap tell) showed **17 of today's 33 hits carried `check == "CI / Falcor / formatting (aged)"`** — my *own* bulk stale-backlog label applied to ~16 PRs whose newest failing run was 30–190 days old. The word "Falcor" was boilerplate in a label I wrote; **no falcor job actually failed in any of those rows.**

After excluding self-authored boilerplate labels, 7d declines dropped **271 → 228** and the ranking inverted:

| bucket | n | PRs | last hit |
|---|---|---|---|
| author-owned real regression | 58 | 13 | 08-08 |
| log EXPIRED → unclassifiable | 41 | 9 | 08-08 |
| pr-label POLICY (author must label) | 27 | 6 | 08-08 |
| materialx per-job timeout (CAPACITY) | 11 | 2 | 08-08 |
| `test_GBufferRTTexGrads_d3d12` AV (falcor) | 9 | 5 | **08-07T16:11Z** |

The genuine falcor/GBuffer bucket was **9 hits / 5 PRs, last fired 08-07** — 5th place, and *not currently active*. Reporting "falcor is the top signature, 41 hits" would have sent a maintainer after a bucket that had gone quiet, on the strength of my own formatting.

## Why it fools you

The inflated number is **plausible and self-consistent**: falcor genuinely *is* a known flake bucket, so a high count confirms a prior belief and never gets contradicted. It also passes every sum check — the 41 rows really exist. Only the *membership* is wrong.

## Probe

Before quoting any count derived from your own free-text field:

```python
collections.Counter(str(r.get("check")) for r in hits).most_common()
```

If one `check` string dominates and it's a phrase **you** compose per-sweep rather than a job name the CI emitted, it's an artifact. Rank on the **job/check axis the CI produced**, and print `last=<ts>` beside every `n` — a bucket whose last hit is 30h old should not be presented as live.

Related: rank by **declines** (forward-looking cost), not reruns-fired (past-tense); and a ledger records *your behaviour*, not repo health — an independent basis (live job cross-section) is required for any "this is the dominant cost" claim.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786227400254-never-grep-your-own-log-s-reason-field-to-rank-fla.md`_
