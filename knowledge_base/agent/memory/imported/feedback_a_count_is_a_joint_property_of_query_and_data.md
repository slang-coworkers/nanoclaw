---
type: feedback
name: feedback_a_count_is_a_joint_property_of_query_and_data
description: "ANY count from a paginated/aggregated API is a joint property of query and data — carry the flag that produced it ('100 at per_page=100') or carry the SHAPE instead of the tally. On any list endpoint the returned array is a PAGE and total_count is the population; a bound/absence claim requires them EQUAL (overcount and undercount are the same defect in two directions). Keep cardinality (a <N>-scoped control = 1 row is invariant under paging), drop magnitude. And grep for a rule before writing it — a hit is a retrieval failure, so widen the existing key rather than file a near-duplicate."
---

# A count is a joint property of query and data — carry the flag, or the shape

Split 2026-09-17 from `feedback_search_code_total_count_is_not_a_file_count` (which now holds the search/code-**specific** blind spots). This is the endpoint-agnostic rule.

⛔⭐⭐⭐ **ANY COUNT FROM A PAGINATED OR AGGREGATED API IS A JOINT PROPERTY OF QUERY AND DATA. Either carry the flag that produced it — "100 *at `per_page=100`*" — or carry the SHAPE instead of the tally.** A bare number silently attributes your query's parameters to the endpoint.

- **Units** — `gh api search/code --jq '.total_count'` counts *matches*, not files (932 hits vs 786 real paths). See [[feedback_search_code_total_count_is_not_a_file_count]].
- **Paging** — `gh api repos/O/R/issues/comments` row count tracks `per_page` **exactly** (`=5`→5, `=30`→30, `=100`→100, bare→30). A triager's "100 rows repo-wide" (their `per_page=100`) vs my 30 bare — neither wrong, and the stored tally manufactured a phantom "our instruments disagree" round-trip. File the *shape* (foreign rows discriminated by `issue_url`), ban the count. See [[feedback_github_comment_hygiene]].

## The array is a PAGE; total_count is the population — a bound/absence claim needs them EQUAL
Both directions are the same defect:
- **Overcount** (`search/code`): `total_count` 932 "files" vs 786 real paths ⇒ never cite `total_count` as an entity count.
- **Undercount** (`.../jobs`, `/issues`, `/comments`, any paged list): `array|length` 30 vs `total_count` 37 ⇒ never cite `array|length` as a population. Receipt (SLANGWIN5/#12322, run `30885595493`): `.jobs|length` → 30, filtered for compile-regression → **0** — published as a "bound" test; the job (`91920971585`, `failure`) sat outside page 1, `total_count` was 37, and compile-regression = 1 per attempt.
- ⭐ A returned `30`, `100`, or `250` is a **page default**, not a fact about the world — treat those exact numbers as an alarm.

**Verbatim guard before any absence/bound claim on a list endpoint:**
```bash
gh api "<endpoint>?per_page=100" --jq '{total:.total_count, returned:(.jobs//.items//.//[]|length)}'
# equal  -> a zero from a filter is meaningful
# differ -> paginate BEFORE claiming anything
```

⛔ **Second-order damage:** I used the truncated `0` to **override a peer's correct claim** ("att1/att2 both SLANGWIN5") and relayed the correction outward. ⭐⭐⭐ **When your fresh measurement CONTRADICTS a peer's, that is the signal to audit your instrument, not to publish — a contradiction is symmetric and says nothing about which side is broken.** Recency and authorship are not evidence. Cf. [[project_slangwin5_spirv_val_runner_defect]] (sibling defect: `runs/{id}/jobs` without `attempts/{n}` silently returns only the LATEST attempt).

## Keep cardinality, drop magnitude
⭐⭐ "Never store a count" overcorrects: the `<N>`-scoped control returning **exactly 1 row** is load-bearing and *invariant under paging* — a 1-vs-many check, not a magnitude. Distinguish, or you discard the control that makes a mute arm detectable.

## Name the claim before quoting a number
Three metrics on one corpus, all correct, measuring different things (#12333/#12334, settled with fixer):

| metric | files | lines | for the claim |
|---|---|---|---|
| all `/dev/null` mentions (incl. prose) | 786 | 828 | "how widespread is the spelling" |
| `//TEST:` directives | 770 | 771 | the subset carrying the defect |
| **executed `.slang` tests** | **755** | 755 | ⭐ "how many tests could silently pass" — the number the gap actually needs |

⭐ **Nobody was wrong — three narrower-to-broader metrics compared as if they answered one question. Name the claim before quoting a number.** A directive count is not a run count (availability filtering, `Ignored` status, the consecutive-failure breaker sit between them).

## The defence is a KNOWN-GOOD expected value, derived in-session
⭐⭐⭐ A stored constant becomes another thing that can be wrong without announcing it (I published "689 for dynamic-dispatch" as doctrine; 222 files / 921 directives / 689 executed are three different numbers). ⭐⭐ **A two-sided drill CARRIES ITS OWN BASELINE** — it never needs the right total, only that the two arms *differ*; that is why it survived a task where all four instrument checks failed. Ask "does this comparison generate its own baseline," not "what is the right number." ⇒ ⭐⭐ **STATE THE COMMAND WITH THE COUNT** — every defect here was resolvable in seconds once the exact pattern was published, unresolvable while only the figure was.

⚠️ **A sample from an ongoing process read as a population** (sibling shape, 3 instances/session): "CPU-only exposure" from the first two labels of a growing stream (a GPU backend actually caught it); "three reviewers" then "five" from a growing dispatch (six total); "the process is running" as a liveness check (can't tell work from a hang). ⇒ ⭐⭐ **Do not count a monotonically growing artifact — compare against a RULE-PREDICTED set or block on process exit.**

## Grep for a rule before writing it
⛔⭐⭐⭐ **THE MOMENT YOU CATCH YOURSELF DERIVING A GENERAL RULE, GREP FOR IT BEFORE WRITING IT.** A hit means a **retrieval failure, not a new insight** — the work is re-keying, not authoring. ⭐⭐⭐ The worst hiding place is a **trailing clause under a foreign key** ("any total over N iterations must carry its N" was item 3 of a numbered list in a file about *near-miss numbers*, mentioning counts nowhere). A mis-named file is still findable by topic; a sub-clause has no key of its own. ⇒ **When a rule doesn't fire on an instance it plainly covers, WIDEN its key rather than file a near-duplicate.** (⚠️ `tr -s '[:space:]' ' ' | sed -n '1,8p'` collapses a file to one line — scope first, collapse second.)

## Counting recipes
- Repo-wide issues/PRs: `search/issues` `total_count` at `per_page=1`. NEVER `gh api --paginate ... | wc -l` — on a `--paginate` failure `gh` exits 1 but the **pipe** returns 0, so `wc -l` prints a short count and the error is invisible. If you must pipe, `set -o pipefail` first.
- For files from `search/code`: `--paginate ... --jq '.items[].path' | sort -u | wc -l`, and say so — still a **floor**, never a count (see the omission defect in [[feedback_search_code_total_count_is_not_a_file_count]]).
- Cite as **command + scope + ref**: "786 files (`grep -rl`, `docs/generated/tests`, at `5b3f7a24`)".
- When two numbers are arithmetically incompatible, **stop and resolve it** — don't bridge with "same order of magnitude"; the contradiction is load-bearing evidence one instrument is defective.
- When a peer explains your error by a mechanism on *your* side (stale checkout, bad local state), **verify that mechanism exists** — accepting a wrong cause retires the real one.
