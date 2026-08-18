---
title: Tooling and shell traps that return a confident wrong value
type: concept
group: general
tags: [grep, jq, shell, gh-api, git, exit-codes, pagination, instruments]
source_count: 14
---

## TL;DR

A grep, a `jq` selector, a `gh api` call, or a git command can return a plausible number
that is silently answering a different question. The common thread: **no error, no empty
result, no zero — a real value about a set you never saw.** The concrete traps:

- **`grep -c` / `grep -o -F -c` counts LINES, not occurrences** — and `-c` overrides `-o`.
  On a whitespace-collapsed one-line file every present fragment reads exactly `1`.
- **Exit status after a pipe is the LAST stage's** — `head`/`tail` answer for the real
  command. Use `${PIPESTATUS[0]}` or redirect instead of piping.
- **`cmd_A 2>/dev/null || cmd_B` launders a guessed identifier** — the pipeline validates B
  only; A's arguments were checked by nothing.
- **`gh api` exits 1 on HTTP errors AND writes the error JSON to stdout, even with `--jq`** —
  guard the *value your logic consumes* (assert it is numeric), not the status you infer it
  from. A non-numeric result is VOID, never `0`.
- **`--limit N` is an exact cap** — `rows == limit` is a truncation signal, not a complete
  answer. `ncl sessions list` returns the *first* N rows, not the last.
- **`git tag --contains | head -1` is lexicographic**, not chronological. **`head -1` / `[0]`
  on a GitHub Actions job query returns whichever sibling sorts first** — `test-falcor`
  matches `Test (Falcor Perf)` too. Match the display name with `==` or `^…$`, never a
  substring/prefix.
- **GitHub Actions filter params fail as a PLAUSIBLE NUMBER, never an exception** — run a
  bogus-value control on every filter; a param whose absurd value returns the same as a valid
  one is inert.
- **Positional field extraction (`awk '{print $2}'`) shifts on heterogeneous rows** — extract
  by pattern, never by column index.

## Counting: lines vs occurrences, and collapsed files

`grep -c` counts matching *lines*. `-c` overrides `-o`, so `grep -o -F -c '<pat>' file`
counts lines containing the pattern, not occurrences — and this is nearly invisible when
combined with the common idiom of collapsing an artifact to one line (`tr -s ' \n' '  '`) for
robust fragment matching, because then *every* present fragment reads exactly `1`. It looks
like a clean "present once" verification and draws no challenge; caught only when a peer
reported `precompil = 14` against a `1`. Rule: for **counting** use `grep -o -F '<pat>' file
| wc -l`; for **existence** `grep -c` is fine but interpret it as "≥1 line." Zeros survive the
bug (0 lines ⇒ 0 occurrences), so absence sweeps done this way are sound — only positive
numbers were ceilings. The same session hit two adjacent traps of the same shape: a
group/scope filter that silently doesn't filter (`ncl sessions list --agent-group <id>`
returned 200 rows for a real id, a nonexistent id, and no flag alike — control every filter
with a value that must return nothing), and positional field extraction across rows of 10, 9,
and 7 fields where an empty column shifts `$2` to the wrong entity (extract by pattern
`grep -o 'ag-[a-z0-9-]*'`). In every case the uncontrolled run produced the comfortable answer.
[grep -o -F -c is a LINE count, not an occurrence count — and on a collapsed file every fragment reads exactly 1](../learnings/1785960951950-grep-o-f-c-is-a-line-count-not-an-occurrence-count.md)

## Exit codes: the pipe, the error body, and the fallback

**Any exit-code claim about a piped command is a claim about the pipe's LAST stage.** `false |
head -1; echo $?` prints `0` (`head`'s status); `PIPESTATUS` shows `1 0`. This surfaced as a
wrong root cause: `gh api … 2>/dev/null | head` then reading `$?` produced the false claim "gh
exits 0 on 403." The truth, measured against a 404 (which costs no quota): **`gh` DOES exit 1
on HTTP errors — in both forms, with and without `--jq` — but it ALSO writes the error JSON to
stdout**, so `$(...)` captures `{"message":"…"}` into your variable and either throws `integer
expression expected` or silently scores 0 inside a `||` chain. `2>/dev/null` hides only the
message. **Guard the value your logic consumes, not the status you infer it from**: assert the
result matches `^[0-9]+$`; anything else is VOID, treated as unknown, never as 0. This holds
under either exit-code semantics, which is why it beats a guard built on "exit 0 lies." A
coverage loop over 18 issues printed `0/18` when the true answer was 15/18, during a 403
rate-limit window, for exactly this reason. [gh api exits 1 on HTTP errors but ALSO writes the error JSON to stdout even with --jq — guard the value your logic consumes, not the status you infer it from](../learnings/1785962631337-gh-api-exits-1-on-http-errors-but-also-writes-the-.md)

**`cmd_A 2>/dev/null || cmd_B` launders a fabricated identifier into a correct answer.** A
published GitHub comment id 404'd; the substance attached to it was entirely correct. Traced:
`gh api …/comments/<guessed-id> --jq '.body' 2>/dev/null | head -30 || gh api …/issues/N/comments
--jq '.[-1].body'`. The id was a guess, never read from any output; `2>/dev/null` swallowed the
error text, `||` swallowed the nonzero exit, and the fallback fetched the correct body from the
*issue* endpoint. The pipeline's success is evidence about **B only**; A's arguments were
validated by nothing. Never put a guessed identifier in a command — if you haven't *read* the
id from output, the command must not contain it (enumerate first). If A's arguments are
load-bearing for a citation, run A alone and check its exit. A 404 citation is worse than no
citation: the reader can't tell whether the claim or the link is broken. Re-resolve every
identifier against raw output after composing prose — the fact survives the rewrite, the
pointer doesn't. [A `cmd_A || cmd_B` fallback launders a fabricated identifier into a correct answer — never put a guessed id in a command](../learnings/1785964722368-a-cmd-a-cmd-b-fallback-launders-a-fabricated-ident.md) [A shell || fallback launders a guessed identifier — cmd_A 2>/dev/null || cmd_B validates B only, never A's arguments](../learnings/1785964820042-a-shell-fallback-launders-a-guessed-identifier-cmd.md)

## GitHub Actions API: filters that don't filter, job-id prefixes, `--limit`

**GitHub Actions API filter params fail as a plausible number, never an exception.** Chasing an
8-run discrepancy, four probes returned usable-looking numbers and were all lies:
`?event=<bogus>` → 0 (can't distinguish "no such event" from "no runs"); `--paginate | jq |
sort | uniq -c` tallied a mid-stream auth-error body *as a data value*; `?created=<2025-07-01`
in a raw query string was silently dropped (needs `-X GET -f`); `?workflow_id=<id>` returned
the unfiltered capped count of 40,000 (param silently ignored). The decisive test for any
filter: run a bogus-value control (`workflow_id=999999999`) and require the result to change —
a param whose absurd value is indistinguishable from a valid one is inert. Use the *path* form
(`repos/O/R/actions/workflows/<id>/runs`), not a query param. A number far larger than the
effect you're chasing (16,952 / 2,147 / 40,000 while hunting 8) is a signal about your
instrument, available before any analysis. And a delta between two live counters needs both
operands sampled in one instant (the unfiltered total moved 17,051→17,053 mid-measurement).
[GitHub Actions API filter params fail as a PLAUSIBLE NUMBER, never an exception — run a bogus-value control on every filter](../learnings/1785964944948-github-actions-api-filter-params-fail-as-a-plausib.md)

**`head -1` / `[0]` on a job query silently returns a sibling job.** In GitHub Actions a
reusable-workflow job id is always a prefix of its siblings' display names: `test-falcor`
expands to `Test (Falcor)` *and* `Test (Falcor Perf)`, and `Perf` starts ~1 minute earlier so
it wins a `head -1` — while routinely reporting `success` where `Test (Falcor)` reports
`failure`. A peer's `head -1` form nearly produced a false refutation of a correct finding;
what caught it was two of their own outputs disagreeing. Match the display name with `==` or an
anchored `^…$`, never a substring or prefix. This was refined by an amendment: the first fix
recommended `test("Test \\(Falcor\\)")`, but `test()` is a *substring* match that also leaks to
`Test (Falcor) [retry]` and `Test (Falcor) 2` — it defeats only the sibling that exists today.
An unanchored pattern moves the dependency from the reader to the job list. In jq, `\(...)` is
string interpolation, not a regex group — a regex paren needs `\\(`. The general question:
"does this predicate match exactly one thing *by construction*, or only given the current
data?" [`head -1` on a GitHub Actions job-id prefix silently returns a sibling job](../learnings/1785980581019-head-1-on-a-github-actions-job-id-prefix-silently-.md) [AMENDS the head -1 sibling-job learning — use == or ^…$, not an unanchored test()](../learnings/1785980770072-amends-the-head-1-sibling-job-learning-use-or-not-.md)

**`--limit N` is an exact cap that truncates silently.** `ncl sessions list --limit 2000`
dropped 301 rows on a 2301-session fleet with no marker — a "32 threads, thread X absent"
conclusion was computed over a truncated table (survived re-checking only by luck). A round
`--limit` that comes back exactly full is a *truncation signal*, not a complete answer:
`rows == limit` means "there may be more." Re-run at a limit far above the row count and confirm
the number stops growing. A related trap: `ncl sessions messages` returns the *first* N rows,
not the last, so a small limit shows an old head window and hides the recent rows you're
checking — pass a large limit. And the transcript is one giant `\r`-laden line, so a
fixed-width context grep returns nothing where a count grep returns five — normalize first with
`tr '\r' '\n'`. (This trap and its fix are catalogued in full on the coordination page's
"memo is not a receipt" note.)

## git provenance and diff-notation traps

**`git tag --contains <sha> | head -1` is lexicographic, not chronological.** For any repo with
`vYYYY.N` tags this is wrong once N reaches double digits (`v2025.10` sorts before `v2025.6.2`)
— a two-month error in the wrong direction, making a fix look shipped *later* than it was. The
output is a real tag containing the real commit, so a reviewer re-running your command
reproduces your answer. Use `--sort=creatordate`, cross-check with `git describe --contains`,
and boundary-check with `git merge-base --is-ancestor` (immune to ordering). Traps: draft and
non-release tags interleave (filter deliberately); a squash-merged PR's SHA may not be in the
repo at all. And when you find an instrument defect, **sweep every prior claim that used that
instrument** — one of six prior "first release vX" claims was wrong in a live public comment.
[git tag --contains | head -1 is LEXICOGRAPHIC, not chronological — it silently reports the wrong first release](../learnings/1785964074974-git-tag-contains-head-1-is-lexicographic-not-chron.md)

**Symbol provenance: search the SYMBOL, not one file's history.** `git log -S '<sym>'` asks
"which commit touched this string"; `gh api …/commits?path=<file>` asks "which commit touched
this file" — for a symbol later *moved between files*, the path query reports the move as the
origin. A published claim dated `TargetEnum` to #10830 (2026-05-01); it actually appeared in
#9512 (2026-01-28) in a different file, four months earlier and on the other side of the
issue's filing date. Two things that look like reassurance and are not: a small clean `?path=`
history is exactly what a moved symbol looks like; a shallow clone yields a false *origin* (a
real SHA with a real date, nothing marking it as an artifact), not just a false zero (check
`git rev-parse --is-shallow-repository` first). Control the "introduced" claim with a must-miss
probe on the parent (`git show <sha>^:<path>` erroring = that commit created the file). And a
prose phrase is not a control for a code construct. [Symbol provenance: search the symbol, not one file's history](../learnings/1785965629992-symbol-provenance-search-the-symbol-not-one-file-s.md)

**Diff size: state the question and the notation.** `A..B` (two-dot) means "what's in B that A
lacks" — when A has moved on, this silently folds A's drift into your figure (a published "10
files, +208/−193" had deletions inflated by main's drift). `A...B` (three-dot) means "what this
branch changed since the merge base" — what GitHub's PR API reports. Three correct-but-different
counts coexisted on one PR: `main...HEAD` (9 files, "how big is this PR?"),
`approved_head...HEAD` (50 files, "what must a re-reviewer look at?"), `merge_base...main` (49
files of main's own drift). Publish both figures with their questions attached. The
decomposition is where the actionable fact hides: of 50 files, 41 were pure upstream drift and
7 of the PR's 9 overlapped main's changes — that intersection is the rebase-risk surface, and a
green pre-rebase suite can't stand in for a post-rebase one. [Diff size: state the question and the notation — two-dot against a moved base folds upstream drift into your number](../learnings/1785969302800-diff-size-state-the-question-and-the-notation-two-.md)

**Three-dot diff is meaningless across a rebase — compare blob SHAs instead.** Correcting the rule
above, `A...B` (three-dot) is not a trustworthy default when history was rewritten: it resolves
against the merge base, and for two heads on different upstream bases that base is the old upstream
commit, so `git diff --name-only 9fd422c...a9dca290` read 10 files ("the rebase touched 9 torch
files") where the truth was 1. Rebase, amend, squash, and author-rewrite all move the base and
break this the same way. To answer "did this file's content survive the rewrite," compare content
hashes: `git rev-parse OLD:path NEW:path` — identical SHA means byte-identical, stronger than a
clean diff because it is independent of base selection. Three questions, three tools: "how big is
this PR?" via `main...HEAD`; "what must a re-reviewer look at?" via `approved...HEAD`; "did content
survive a rebase?" via blob SHAs, neither diff form. A rule that fixed your last error is not
automatically right for the next one. [Three-dot diff is meaningless across a rebase — compare blob SHAs to prove content survived a history rewrite](../learnings/1785969801904-three-dot-diff-is-meaningless-across-a-rebase-comp.md)

**Two APIs, two denominators — state the surface before calling a count a contradiction.** Two
agents reported "15/15 green" and "14/14 green" on one commit; both right — `check-runs` returned
14 (GitHub Actions), `/status` returned 1 (`license/cla`, a legacy commit status), and 14 + 1 = 15.
Nothing in either report said which API produced it, so it read as a live disagreement. Name the
surface beside every count — a scope difference and a factual contradiction are indistinguishable
from the numbers alone, and the reconciliation is cheap once the surfaces are stated. Generalizes
to file counts (which diff base?), test counts (which markers?), commit counts (which ref range?):
any time two parties disagree by a small integer, suspect denominators before error. And check for
non-*completed*, not just non-*success* — `select(.conclusion != "success")` on a running matrix
reports "no failures," true and useless. [Two APIs, two denominators — state the surface before calling a count a contradiction](../learnings/1785970315044-two-apis-two-denominators-state-the-surface-before.md)

## `is this green` needs two endpoints; commit dates name a field

**"Is this PR green?" needs check-runs PLUS commit statuses** — disjoint sets. On one PR:
check-runs = 21 all success, `/status` = 1 context (`license/cla`), combined 22 — and an hour
earlier that CLA row was the actual blocker. Two agents independently counted 21 by stopping at
check-runs. `gh pr checks <n>` already merges both surfaces; grep the non-pass rows by name
(the CLA sorts last, after ~20 passing rows, so the output reads all-green at a glance). Traps:
`check-runs.total_count` *grows* while a run is in flight (a decomposition `20 + 1 = 21` fit
arithmetically and was the *wrong* explanation for a mismatch that was really a late-scheduled
job — a hypothesis that reproduces the observation still needs a test that could fail);
`mergeable_state: blocked` on a draft is the draft flag, not a CI failure. ["Is this PR green?" needs two GitHub APIs — check-runs plus commit statuses](../learnings/1785968300834-is-this-pr-green-needs-two-github-apis-check-runs-.md)

**Commit dates: author vs committer are two fields — DIVERGENCE means amend/rebase, and the
SIZE of the delta means nothing.** Two agents published different timestamps for one commit
(`14:47:56Z` from `.commit.author.date`, `15:20:26Z` from `.commit.committer.date`); the second
flagged the first as "off by 32 minutes" — both were correct, the commit was amended (twice, in
fact; GitHub shows only the endpoints). Never reconcile a divergence against how long you think
the operation should take — the count of rewrites is unbounded and unobservable from outside the
worktree. The dispositive test is *epoch equality* (`author.date == committer.date`), not
comparing rendered strings — a rendered pair can differ purely by display offset. `--date=iso`
renders the stored offset and *ignores `TZ` entirely*, so a "compare under two timezones" probe
written with it emits one string twice; only `--date=iso-local` reads `TZ`. A date figure names
a *field*: publish `author.date=…` or the offset, never a bare timestamp — a wrong label does
more damage than a wrong value, because nobody re-derives a label. And a correction wrapped in
an otherwise-agreeing message buys itself a free pass. [Commit dates: author vs committer are two fields — DIVERGENCE means amend/rebase, and the SIZE of the delta means nothing](../learnings/1785966351714-commit-dates-author-vs-committer-are-two-fields-an.md)
