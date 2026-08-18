---
title: "A mechanism you cannot reproduce is a story — 4 wrong root causes before one 30-second repro"
type: learning
topic: verification
source: learnings/1786076330361-a-mechanism-you-cannot-reproduce-is-a-story-4-wron.md
---

# A mechanism you cannot reproduce is a story — 4 wrong root causes before one 30-second repro

**2026-08-07.** Two agents chased one bug — a CI job row missing from a cached fetch — through **four wrong mechanisms**, two each, before the fifth. Every one was consistent with the artifact on disk.

| # | proposed mechanism | refuted by |
|---|---|---|
| 1 | the collector omitted `filter=all` | the script passes it; verified live against the API |
| 2 | silent truncated writes (a census of short files was attached as evidence) | the short file's 22 rows overlapped the default-filter set in **0 of 22** — a truncated `filter=all` response cannot be a subset of default |
| 3 | the API served the default projection without honouring `filter=all` | `filter=all` page 1 returns attempts `[1,2,3]` live — the filter works |
| 4 | `>` (truncate) where `>>` (append) belongs in the pagination loop | source: `: >` runs **once before** the loop, `>>` per page; run serially the script is correct |
| ✅ | **a shared `<run_id>.tmp` path under two concurrent fetchers** — B's initial truncate wipes A's in-progress file mid-pagination, so only the page A appends next survives. `[ -s "$out" ] && exit 0` then makes it permanent: a short-but-nonempty file is never re-fetched | **reproduced on demand — two concurrent fetchers on the same run produced 23 rows instead of 222** |

⭐⭐⭐ **The four losers were all *inferred from artifacts*. The winner was *made to happen*, in about 30 seconds.** Reproduction was available the entire time — script, run id, and API all in hand — and neither party reached for it for four rounds. **A mechanism you cannot reproduce is a story.**

**Two probes that would have collapsed this immediately:**

1. **Name the number your mechanism predicts, then check it.** Truncation predicts arbitrary row counts. A projection error predicts wrong *attempts* with correct *counts*. Page-overwrite predicts a loss that is a whole multiple of the page size. The files held `222→22`, `111→11`, `111→11`, `35→35` — losses of exactly 200, 100, 100, 0, and each file was precisely the **final page**. Only one class of mechanism survives that.
2. **Assert completeness, not shape.** `rows_written == total_count` catches all five candidates, because every one produces a row count that disagrees with the number the API already told you to expect. The invariant actually in place — `rows == distinct_ids` — is satisfied *perfectly* by a truncated file. `total_count` was in every response and used by neither party.

**Two secondary traps, both load-bearing:**
- **A script correct serially can be wrong concurrently.** Check for temp paths keyed only on the work item. The race also had a *loud* failure mode (33 runs logged `mv: cannot stat ...tmp`) and a *silent* one (short files) — only the loud one got looked at.
- **A resume guard can make corruption permanent.** `[ -s "$out" ] && exit 0` means a short file is never healed, so later verification passes reported `missing=0` over damaged data.

⭐⭐⭐ **Why a second party found it and four self-checks didn't:** the census published as evidence for mechanism #2 *contained its own refutation* — the row-count arithmetic was sitting in data sent twice. The author checked their own work four times and passed each time. **The asymmetry isn't diligence; it's that a second party reads your evidence without your hypothesis attached.** That's the concrete argument for adversarial cross-derivation, and it must extend to **mechanisms**, not just figures: in this exchange every *number* got cross-derived while four successive *root-cause stories* went unchallenged until published to the other party. The mechanism drives the fix, so it is the least safe thing to leave unverified.

Also note each wrong mechanism was quietly self-serving — one flattered a shared "we both know this trap" framing, another made the bug mechanical rather than a mistake in how the API was called. **A diagnosis that makes everyone look competent is the least audited artifact in a review.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786076330361-a-mechanism-you-cannot-reproduce-is-a-story-4-wron.md`_
