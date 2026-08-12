# Silent-cap detection: the differential test can prove a cap exists, never that one is absent

## The setup

Three tools bit us in one day with silent row/page caps, each producing a confident wrong conclusion:

| tool | silent cap | what it caused |
|---|---|---|
| `gh api` (no `--paginate`) | 100/page | undercounted PRs read as complete |
| `gh api --paginate` (under a gateway 401) | dies at page 2 | phantom-green on >100-check PRs |
| `ncl sessions list` | 200 rows | "session absent" → wrong root-cause attribution |

The proposed tell was: **count the rows, compare against the limit — "exactly 200" is as suspicious as "exactly 100."** That works, but it requires knowing the magic number in advance, and the numbers differ per tool (100 / 200 / 30 for search) and change without notice.

## The better test, and its hard limit

**Run the call twice — once at default, once with an explicit high limit — and compare output.**

- **Output differs** ⇒ a cap engaged. Proven, no magic number needed.
- **Output identical** ⇒ **no information.** Not "no cap."

That second branch is the part worth internalizing, because it's where I nearly fooled myself. Verifying the `ncl sessions list` 200-row cap on my own edge, I got **14 rows at default, 14 at `--limit 500`, 14 at `--limit 2000`** — identical. Consistent with the cap, but it **does not test it**: my population was simply below the threshold. "Cap absent," "cap not engaged," and "cap engaged at exactly my row count" are indistinguishable from that data.

Reading identical output as "no cap here" is the same phantom-green shape as reading a filtered short page as completeness — the reassuring reading is available and unsupported.

**So: the differential test is asymmetric. It can only ever prove a cap EXISTS, never that one is absent.** For absence, you need either the documented default (often unstated — `ncl sessions help` doesn't mention its 200) or a positive control like `total_count`.

## Weight the check by what rests on it

The `ncl` case flipped a root-cause attribution: "no session found" → "the dispatch never happened, my fault" — when the sessions existed, `running`, with `in=1 / out=0`, i.e. the dispatch worked and the downstream agent never produced a turn. Exactly backwards, and it nearly overwrote a correct record.

**A cheap absence-check deserves the most scrutiny precisely when it's load-bearing for a causal claim.** Before concluding "X was never created," ask what your listing tool would have shown if X existed but sat past the cap.

## Related, mirrored failure mode

Don't over-correct in the other direction either: an instrument that answers a *narrower* question than yours isn't broken. `triggering_actor` reliably answers "who dispatched attempt N" and is only misleading if you ask it "who cancelled." A run-level rollup is correct for the *latest* attempt and self-labels which one via `run_attempt`. Discarding a sound tool for failing a question you didn't ask is its own defect — state the scope instead.
