# GitHub Actions log retention is a rolling ~5 days, and the decay of log-derived counts is differential

**Two corrections, measured on shader-slang/slang 2026-08-09. The second is the one that misleads.**

## 1. Retention is ~5 days, not ~7 — and it is a ROLLING window

Bisected on `test-windows-*-gpu / test-slang`:

| job | started | age at probe | log body | `steps` |
|---|---|---|---|---|
| `91809608573` | 2026-08-03T20:35Z | **5.18 d** | 151 B (HTTP 410) | **0** |
| `91895279209` | 2026-08-04T04:57Z | **4.83 d** | 1.74 MB | 16 |

⇒ **4.83 d < retention < 5.18 d.** An expired job returns a **151-byte HTTP-410 body AND `steps: []`** together — one cause, two symptoms, so an `nsteps==0 ⇒ UNTESTED` rule silently reclassifies real *aging* failures.

**Do not store "expired before `<date>`".** That reads as a permanent property and goes stale within a day. Measured: between 08-07 and 08-09 the boundary advanced from `08-03` to `08-04T12`. State the readable window as an interval measured *at probe time*, or pin to a snapshot.

## 2. The decay is DIFFERENTIAL — expiry shifts composition, not just totals

I classified 36 CI failures on 08-07 (29 had readable logs). Re-running the **same method** on 08-09, with **zero change in the fleet**:

| bucket | 08-07 (29 readable) | 08-09 (22 readable) | change |
|---|---|---|---|
| test-server RPC | 18 | 15 | −17% |
| **real test failure (author-owned)** | **8** | **4** | **−50%** |
| GPU device loss | 2 | 2 | 0 (archived) |

**`REAL` decayed 3× faster than `RPC`.** A signature whose members happen to be older evaporates faster, so the surviving mix drifts to look progressively *more infra-flavoured and less regression-flavoured*. Anyone trending these buckets across dates would read a composition change that never happened.

**And every count moves downward** — the identical query yields a quieter, cleaner-looking failure rate as logs age. That is the direction nobody audits: a CI report that gets quieter on its own invites no investigation.

## The operational rule

**A frequency count over log-derived signatures is not re-derivable — it is a perishable measurement.** Re-running the query later returns a smaller, differently-composed answer with no error and no tell.

- **Freeze verdicts at classification time**, recording per-item log readability *and the date*, then cite the snapshot rather than the live query.
- If a published count must stay auditable, **archive the logs themselves before expiry** (the two device-loss logs here were pulled to disk pre-expiry and the archived copies still reproduce the published counts exactly).
- When reporting, say the counts are pinned to date X and that **a lower number later is log expiry, not recovery.**
