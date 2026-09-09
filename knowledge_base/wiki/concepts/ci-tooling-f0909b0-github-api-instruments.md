---
title: Reading GitHub/CI state without false zeros — gh API/CLI instrument defects
type: concept
group: ci-tooling
tags: [github-api, gh-cli, ci, false-zero, pagination, forks, auth-token, logs]
source_count: 17
---

## TL;DR

Almost every `gh api` / `gh` CLI call used to read CI or PR state has a silent failure
mode that returns a *plausible* value (usually `0`, `[]`, or a short list) instead of an
error — and that value is indistinguishable from a true negative. The dangerous direction
is always **absence**: a false zero makes you conclude "no PR / no failure / no coverage /
label doesn't exist" and drop work.

The recurring shapes:

- **Fork blindness.** `pulls?head=owner:branch`, `search/code`, and `/branches/{name}`
  all lie on fork PRs. Index `head.ref` over the full open-PR list, or resolve via
  `commits/{sha}/pulls`; `search/code` is *dead* (not weak) on any fork.
- **Wrong object set.** The legacy combined-status endpoint (`commits/{sha}/status`)
  cannot see GitHub Actions check-runs; check-runs cannot see cross-repo statuses. Read
  BOTH.
- **Truncation.** `check-runs` and `compare/.files` cap silently (30/page, 300 files).
  Assert `total_count == fetched`; blob-SHA files directly for a no-change conclusion.
- **Empty-body / error-in-data-column.** Escape-sequence logs, `-f per_page` flipping GET
  to POST, `gh run view --log` outside a git repo, and expired logs all produce 0 bytes or
  an error body that greps to `0`. Assert the artifact is non-empty and shape-correct
  BEFORE scoring it, with a **must-hit control drawn from a different source**.
- **Auth false negatives.** `gh auth status` / `gh api user` fail for the bot's App
  installation token, but repo reads and writes (push, PR create, labels, comments) work.
  Test the exact endpoint you need, never `/user`.
- **Record the exact producing command beside every hash / count** — a hash identifies a
  representation, not a resource, so two authentic fetches of one log give different md5s.

Standing rule: a control drawn from the same possibly-empty fetch as the measurement
cannot discriminate "not there" from "nothing fetched." Sanity-check magnitude, too — an
implausible count ("3 labels for this repo") is cheaper to notice than any single wrong 0.

## Forks defeat the name-based lookups

Three separate instruments silently mislead the moment a PR is fork-headed, and all fail
toward hiding work. `gh api pulls?head=shader-slang:<branch>` returns an empty array with
exit 0 because the `head=` filter matches the *head repo's* owner — a contributor's fork,
not the upstream org — so fork PRs read as "no open PR → out of scope"
([gh pulls?head is blind to fork PRs](../learnings/1786357027931-gh-pulls-head-owner-branch-is-blind-to-fork-prs-in.md)).
Build the index once (`byref[p["head"]["ref"]]`) or resolve through the commit
(`commits/<sha>/pulls`), and guard `p["head"]["repo"] == None` for deleted forks.

The fork-audit trap compounds: `commits/{full_sha}/pulls` can return `rows 0` while the
owning PR exists (an empty sub-resource is not an absence), and `/branches/{name}` on the
upstream answers HTTP 200 about a *different* branch that happens to share the name — a
name collision, not an identity
([fork-PR CI rows: sha/pulls returns 0 and branch is a name collision](../learnings/1786382020324-fork-pr-ci-rows-commits-sha-pulls-returns-0-and-br.md)).
Resolve run identity through the artifact that OWNS the run (its PR's `head.sha`), then use
`/compare/{old}...{head}` to prove `ahead` vs `diverged`. Most severe:
[gh search/code is DEAD on a fork](../learnings/1786370596653-gh-search-code-is-dead-on-a-fork-every-query-retur.md)
returns `total_count: 0` for *every* query — including a can't-miss term on the default
branch in a 1.5 KB file — because GitHub does not index forks for code search. Since
`slang-coworkers/*` are all forks, `search/code` there carries zero bits; use git-tree +
`contents?ref=<sha>` or a local clone. The wording lesson: a "weak-instrument" warning
invites a discounted retry, a "dead-instrument" warning forbids the call — state which one
you measured.

## Truncation and wrong-object-set: the two ways "CI green" lies at the API layer

The `commits/{sha}/check-runs` endpoint pages at 30 even though `.total_count` sits in the
same response, and nothing warns you — a page-1 tally is a tally of 30-of-N, not the matrix
([check-runs returns 30 of N, truncated AND scoped wrong](../learnings/1786437428830-gh-api-check-runs-returns-30-of-n-the-ci-green-ins.md)).
Detector, free and by construction: assert `total_count == (check_runs|length)`, or
`--paginate`. That same atom carries a candid **retraction** worth heeding: the author
attributed a hidden red Windows build to truncation when the row was actually still running
at read time — the discrepancy was *staleness*, not truncation. A defect in an instrument
licenses no claim about which specific row it hid; name the hidden row and prove
`completed_at ≤ read_time`. Truncation is a defect in *kind*, staleness a defect in *time* —
real distinction, but don't cross-attribute them.

The compare endpoint has an analogous cap:
[gh compare .files caps at 300](../learnings/1787161784502-gh-compare-files-array-caps-at-300-0-files-changed.md)
means a file that genuinely changed but sorts past position 300 (buried behind a big
master-merge) is simply absent — "0 source files changed" off that array is a false zero.
For any "did file X change between A and B?" negative, blob-SHA the specific files directly
(`contents/<path>?ref=<sha> --jq .sha`); identical SHA = byte-identical, independent of the
cap. (The combined-status-vs-check-runs "wrong object set" defect is the same instrument
family but is treated in depth in the CI-green-carries-zero-bits page.)

For reusable workflows, `actions/workflows/<id>/runs` returns `total_count: 0` because a
`workflow_call`-only workflow is never independently dispatched
([reusable workflow has zero runs at its own endpoint](../learnings/1786992411941-reusable-workflow-ci-falcor-test-yml-has-zero-runs.md)).
Query the CALLER (`ci.yml`) runs, then drill each run's `jobs?per_page=100` (the Falcor job
paginates out of the default page on 40+-job runs) and filter job names by `contains("alcor")`.

## Empty bodies and error-in-the-data-column: the false-zero generators

A cluster of log-fetch defects all produce a 0-byte file or an error body that every grep
reads as `0`, and — lethally — so does your zero control:

- `gh api .../jobs/<id>/logs` exits **rc=1 with 0 bytes** when the log contains terminal
  escape sequences, with the reason only on stderr; under `2>/dev/null` you get a clean
  silent `0` ([gh api job logs 0 bytes on escape sequences](../learnings/1786433135964-gh-api-job-logs-returns-0-bytes-on-escape-sequence.md)).
  Use `gh run view <id> --repo O/R --job <id> --log` (no flag needed — it sanitizes escapes).
- `gh run view --log` **outside a git repo** writes zero-byte logs because it can't resolve
  the default repo — a subagent built a complete, internally consistent CI table entirely
  from empty files ([gh run view --log outside a git repo writes zero bytes](../learnings/1786459337890-gh-run-view-log-outside-a-git-repo-writes-zero-byt.md)).
  Always pass explicit `--repo owner/name`.
- `gh api repos/O/R/labels -f per_page=100` flips the request to **POST** (the label-CREATE
  endpoint) and returns a 3-line 422 body, so `wc -l` reports "3 labels" and every label
  reads as nonexistent ([gh api -f per_page returns a 422 that reads as an empty list](../learnings/1786456057714-a-gh-api-list-call-with-f-per-page-returns-a-422-c.md)).
  Use `-X GET -f k=v`, and `jq -e 'type=="array"'` to assert shape.
- `gh api contents/<path>` 404s silently when the path prefix is wrong (`generated/tests/`
  needs a `docs/` prefix); a `while read` loop then reports `0` for every file, contradicting
  a manual spot-check ([gh api contents path-prefix mismatch → silent false-negative](../learnings/1787993108357-gh-api-contents-path-prefix-mismatch-caused-a-sile.md)).
  When a bash loop flatly contradicts a manual check on the same input, suspect a systematic
  path/prefix bug and verify the fetch succeeded (non-empty content) first.

The unifying fix
([an expired CI job log still has its run artifact](../learnings/1786396604746-an-expired-ci-job-log-still-has-its-run-artifact-a.md)):
an expired log is not an absent log — check the byte count, pair every count with a **must-hit
control from a different source**, and when the log is empty go for the run *artifact*
(`actions/runs/$RUN/artifacts` → `/zip`), which often outlives the log and carries more
structure. That atom also holds the deep lesson that reproducing a described failure is not
confirming its framing (the cuda twins were `ignored` in CI, not failing; the assert was
Debug-only). And a control whose own baseline fails (`-o /dev/null` erroring, `grep -c '-g3'`
= "invalid option") carries zero information — write to a real file, and use `grep -cFe` for
flag-shaped needles.

## Hashes, versions, and tool-shape drift

A hash identifies a *representation*, not a resource:
[a hash identifies a representation, not a resource](../learnings/1786364370792-a-hash-identifies-a-representation-not-a-resource-.md)
shows one CI log yielding two different md5s from two authentic fetch commands (CRLF vs LF,
real ESC vs literal `^[`), so after the log expires the mismatch reads as tampering. Rule:
**record the exact producing command beside every hash**, and prefer representation-independent
fallbacks (line count, grep-signature counts). That atom originally claimed `gh >= 2.97`
*refuses* escape-sequence bodies and needs `--allow-escape-sequences` — a claim
**retracted/narrowed** by
[gh run view --log-failed on 2.97.0](../learnings/1786689812806-gh-run-view-log-failed-flag-on-2-97-0-allow-escape.md):
the flag does not exist on `gh run view` at all (only on `gh api`), flagless `--log-failed`
works fine, and the version-upgrade cause was never actually established (mtime is a build
date, apt logs describe a rebuilt container). Capture `<tool> --version` at probe time in
the record — a container rebuild erases the evidence needed to attribute a behavior change.

## Auth: the App-token false negative

Four atoms converge on one rule: `gh auth status` and `gh api user` returning 403 "Resource
not accessible by integration" is a **false negative**, not a dead token. `GH_TOKEN` is a
GitHub App installation token for `nv-slang-bot[bot]`, and App tokens can never access the
user-scoped `/user` endpoint that those probes hit
([gh CLI shows App token as invalid — false negative](../learnings/1787310650484-gh-cli-shows-app-installation-token-as-invalid-fal.md),
[gh auth status shows 'invalid token' but repo endpoints work](../learnings/1787614393812-gh-auth-status-shows-invalid-token-for-the-bot-app.md)).
Public REST reads (`actions/runs`, `pulls/<n>`, `pulls/<n>/reviews`, `contents`,
`search/issues`) and the writes that matter (comment POST, label add, GraphQL `updateIssue`,
push, `pr create`, `pr edit`, `workflow run`) all succeed
([GH_TOKEN 403 blocks only authenticated endpoints](../learnings/1786868224532-gh-token-403-blocks-only-authenticated-gh-endpoint.md),
[gh token user-scope can be dead while PR-create/push/label work](../learnings/1787621377379-gh-token-user-scope-can-be-dead-while-pr-create-pu.md)).
Never report "blocked — dead token" off `auth status`; test the specific write you need. One
genuine caveat: from the maintainer seat, `jobs/<id>/logs` and `check-runs` are auth-gated on
some paths — you may see WHICH step failed but not the log body, so say "unconfirmed, human
should read the step log" rather than guess the infra-vs-code classification.

**Source learnings (17):**

- [gh pulls?head is blind to fork PRs](../learnings/1786357027931-gh-pulls-head-owner-branch-is-blind-to-fork-prs-in.md) — `head=owner:branch` matches the head repo's owner, so fork PRs read as "no open PR"; index `head.ref` or use `commits/<sha>/pulls`.
- [A hash identifies a representation, not a resource](../learnings/1786364370792-a-hash-identifies-a-representation-not-a-resource-.md) — two authentic gh fetches of one CI log give different md5s (CRLF/ESC); record the exact producing command beside every hash; the gh-2.97 escape-seq cause is unproven.
- [gh search/code is DEAD on a fork](../learnings/1786370596653-gh-search-code-is-dead-on-a-fork-every-query-retur.md) — every query returns total_count 0 on forks (GitHub doesn't index them); a dead instrument forbids the call, unlike a weak one.
- [Fork-PR CI rows: /commits/sha/pulls returns 0, /branches is a name collision](../learnings/1786382020324-fork-pr-ci-rows-commits-sha-pulls-returns-0-and-br.md) — resolve run identity through its PR's head.sha, not a shared branch name; empty sub-resource ≠ absence.
- [An expired CI job log still has its run artifact](../learnings/1786396604746-an-expired-ci-job-log-still-has-its-run-artifact-a.md) — empty log ≠ absent failure; pull the run artifact zip; pair every grep with a must-hit control; a control whose baseline fails carries zero bits.
- [gh api job logs returns 0 bytes on escape sequences](../learnings/1786433135964-gh-api-job-logs-returns-0-bytes-on-escape-sequence.md) — rc=1/0-byte with reason on stderr; the zero control also reads 0; use `gh run view --log`; a log echoing its own parser script matches the parser too.
- [gh api check-runs returns 30 of N — truncated AND scoped wrong](../learnings/1786437428830-gh-api-check-runs-returns-30-of-n-the-ci-green-ins.md) — assert total_count==fetched; includes a retraction that a "hidden" row was staleness not truncation (defect-in-kind vs defect-in-time).
- [A gh api list call with -f per_page returns a 422 that reads as an empty list](../learnings/1786456057714-a-gh-api-list-call-with-f-per-page-returns-a-422-c.md) — `-f` flips GET to POST; use `-X GET -f k=v`; assert response shape with `jq -e type==array`; sanity-check magnitude.
- [gh run view --log outside a git repo writes zero-byte logs](../learnings/1786459337890-gh-run-view-log-outside-a-git-repo-writes-zero-byt.md) — cwd-based repo resolution fails silently; pass explicit `--repo`; a control from the same empty fetch cannot discriminate.
- [gh run view --log-failed flag on 2.97.0 — --allow-escape-sequences absent](../learnings/1786689812806-gh-run-view-log-failed-flag-on-2-97-0-allow-escape.md) — narrows the earlier "gh>=2.97 refuses escape bodies" claim; flagless `--log-failed` works; try flagless first.
- [GH_TOKEN 403 blocks only authenticated gh endpoints; public reads work](../learnings/1786868224532-gh-token-403-blocks-only-authenticated-gh-endpoint.md) — read run history/step names live; but jobs logs / check-runs are auth-gated from that seat, so say infra-vs-code is unconfirmed.
- [Reusable workflow (ci-falcor-test.yml) has zero runs at its own endpoint](../learnings/1786992411941-reusable-workflow-ci-falcor-test-yml-has-zero-runs.md) — query the caller workflow's runs and drill jobs?per_page=100; used to build a time-overlapping sibling control.
- [gh compare .files array caps at 300 — "0 files changed" is a false zero](../learnings/1787161784502-gh-compare-files-array-caps-at-300-0-files-changed.md) — a file past position 300 is absent; blob-SHA files directly for any no-change conclusion; anchor at the last decided head.
- [gh CLI shows App installation token as invalid — false negative](../learnings/1787310650484-gh-cli-shows-app-installation-token-as-invalid-fal.md) — App tokens can't reach /user; issue/label/comment/GraphQL endpoints work; MCP github_* is read-only.
- [gh auth status shows 'invalid token' for the bot App token but repo endpoints work](../learnings/1787614393812-gh-auth-status-shows-invalid-token-for-the-bot-app.md) — test the endpoint you need, not /user; MCP search can false-empty, fall back to gh api.
- [gh token user-scope can be dead while PR-create/push/label still work](../learnings/1787621377379-gh-token-user-scope-can-be-dead-while-pr-create-pu.md) — don't report blocked off auth status; a user-scope 403 says nothing about pull_requests-scope writes.
- [gh api contents/ path prefix mismatch caused a silent false-negative in a bash loop](../learnings/1787993108357-gh-api-contents-path-prefix-mismatch-caused-a-sile.md) — missing `docs/` prefix 404s silently; verify non-empty content before trusting a grep count of 0.
