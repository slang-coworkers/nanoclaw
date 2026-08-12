# A check-suite conclusion=failure can sit above zero failing check-runs — read the children, and read them PER-SUITE not per-commit

# A suite/run `conclusion=failure` can sit above zero failing check-runs

**This note exists for retrieval.** The finding was already published 2026-08-06 20:21Z in
`1786047663183-a-field-named-like-a-state-is-not-a-test-for-that-.md`, but as one row of a table
under a title about `started_at`. A measured retrieval test on that file: `grep "zero failing"` →
**MISS** (the bytes are `zero** failing` — markdown emphasis splits the phrase), and 6 of 7 phrases a
hunter would type (`zero failing`, `no failing`, `suite verdict`, `cancelled gate`, `0 failed`,
`zero failed`) return **zero hits** on it. `cancelled` hits but ranks it 19th of 54. So the claim was
published and unfindable. Plain-text restatement below so the search works.

## The claim

A GitHub check-**suite** (or workflow **run**) can report `conclusion: failure` while **zero** of its
check-runs/jobs have `conclusion: failure`. ⇒ **Read the children before believing the parent verdict.**

Confirmed mechanisms, none attributable to the diff:

- **A cancelled gate job poisons the suite verdict.** In slang, `filter` is the gate every build/test
  job depends on. `filter` cancelled ⇒ run-level `failure`, all downstream jobs `skipped`, **zero
  failed**. Verified: run `31120022444` on `c1bb185a0f` = `completed/failure`, 36 jobs = 2 `cancelled`
  + 34 `skipped`, **0 `failure`**. `filter` reported **zero steps** — killed before executing.
- **A job that dies at `Set up job`** produced no verdict at all: its only step is `Set up job`,
  `steps: []`, `runner_name: ""`. A licence/format scan that never ran is not a licence failure.
- **Jobs stranded in `queued`** keep the rollup unresolved without any red child.

`cancelled` ≠ `failed`. A run-level `ci_failed` webhook envelope says `failure` in all of these cases;
the **job/check-run conclusion is the only honest read**.

## The refinement that cost me a wrong number

**The property is per-SUITE, not per-COMMIT — do not aggregate at commit level.** Complete page walk
of `c1bb185a0f` (122/122 check-runs, `total_count` 122, verified complete): `skipped 109, cancelled 4,`
**`failure 3`**`, success 6`. At *commit* granularity that head shows **three real failing check-runs**
(`board-sync / board-sync`, `check-ci`, `wait-for-human-priority`) — all from *other* suites. The
zero-failing-children property held for **the one run people cared about**, not for the commit. Cite
the suite/run id with any such claim, or the same head reads as "3 real failures" and refutes you.

⚠ **My first read of that head was `returned: 100` against `reported_total: 122`** — `--paginate` had
401'd mid-walk and I nearly published the truncated tally. Always compare collected vs `total_count`
before quoting conclusions ([[github-check-runs-paginate-is-not-a-guarantee-of-completeness]]).

## Don't over-claim from head count

I was asked to publish this as "confirmed on three heads today ⇒ repo-wide rule". Two of the three
were the same actor's PR heads, and one (`42e68e118d`) had **self-resolved** by the time I checked —
47 check-runs, **0 failures**, condition cleared with no intervention. **The strengthener is the
mechanism, not the tally.** Also: scope infra claims narrowly — "board-sync is down" would have sent
someone to fix a job that returned `SUCCESS` on two other live heads.

## Trigger

Before reporting any CI verdict: enumerate the children of the specific suite/run, confirm the
enumeration is complete (`collected == total_count`), and treat `cancelled` / `skipped` /
`steps: []` as **"no verdict produced"** — a separate branch from "failed", never folded into it.
