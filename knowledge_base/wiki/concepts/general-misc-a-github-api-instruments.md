---
title: "GitHub & platform API instrument traps (gh api, REST/GraphQL, Discord, rate limits)"
type: concept
group: general
tags: [github-api, gh-cli, rest, graphql, pagination, discord, rate-limit, instruments]
source_count: 10
---

## TL;DR

Platform APIs return well-formed, plausible, confidently-wrong answers with no error. The
recurring shapes and their fixes:

- **`gh api -F/-f` without `-X GET` silently switches to POST** → 404 whose JSON body flows
  into your pipeline as fake data. Always pass `-X GET`, or use a query string.
- **Per-file arrays truncate on every endpoint** (zeroed counts *or* dropped rows); use
  server-computed PR-level scalars for sizes, list endpoints for paths.
- **`search/code` is not a counting instrument** — it silently omits files and indexes only
  the default branch. Use `git grep` at an explicit ref.
- **The `issues/{N}/comments` endpoint serves PRs too**, and dropping `{N}` fails LOUD for a
  single comment but SILENT (repo-wide) for a list.
- **Re-derive page counts every sweep**; a hardcoded loop bound silently truncates.
- **Unauthenticated quota is per-IP and `/rate_limit` misreports it** — cache bodies to
  `/tmp` instead of budgeting.
- **Discord forum channels return `[]` from `/messages`** (posts are threads).

The meta-rule across all of these: **when an API path can name two different objects, query
both and compare — do not reason about which one you got.**

## gh api silently POSTs when -F/-f is passed without -X GET

`gh api <path> -F per_page=40` on a GET endpoint returns **404** — `gh` switches the HTTP
method to POST as soon as any `-F`/`-f` is present without `-X`, sending the params as a JSON
*body*. Not Actions-specific; any GET endpoint. Worse than a normal error: the 404 body is
valid JSON, so `--jq '.workflow_runs[]' > f; wc -l < f` counts the **4 lines of the
pretty-printed error object** and reads as "4 runs". Stacked with `2>/dev/null`, it produces a
0-row output file that reads as a genuine finding. Always pass `-X GET` with `-F`/`-f` on a
read endpoint, or put params in the query string (`?per_page=100` — cannot be re-methoded).
The tell: a row count that is a small number like 4 (the error object's line count). Note `gh
api` has **no `--arg` flag**. [gh api silently switches to POST when -F/-f is passed without -X GET](wiki/learnings/1785896229451-gh-api-silently-switches-to-post-when-f-f-is-passe.md)

The related raw-`>` trap: `gh api "…?created=>2026-08-04"` is an HTTP 400, and `%3E` is
silently *dropped* by the API (returns a clean 0). Use `gh api -X GET <path> -f 'k=>=v'` so gh
does the URL-encoding. (See [Two independent channels launder a shell failure: 2>/dev/null kills the message, a pipe kills the exit status](wiki/learnings/1785867928996-two-independent-channels-launder-a-shell-failure-2.md).)

## Per-file arrays truncate on every endpoint — use PR-level scalars

A size-eligibility check summing per-file `additions`/`deletions` read 58% low. "Use a
different endpoint" is **not a fix for a representational limit** — every per-file array
inherits it, in two different shapes: `compare/...` zeros 47 rows to `+0/-0`; `gh pr view
--json files` drops rows at a silent 100-cap; `pulls/{n}/files` zeros 27 rows. All read
*smaller than truth*, toward `pass`, so a measurement failure is indistinguishable from a
small diff. Fixes: **never derive a size from a per-file array** — use the server-computed
`changed_files`/`additions`/`deletions` from `pulls/{n}`; cross-check any `len(files)` against
`changed_files` in the same payload (disagreement = you hold a page); the **path list**
survives where counts don't (`gh pr diff --name-only`), so get paths from a list source and
sizes from scalars and never let one endpoint serve both. Leave a comment at the site or a
future refactor reaching for a per-file array reintroduces it.
[GitHub per-file arrays truncate on EVERY endpoint — three measured on one PR; only the PR-level scalars are trustworthy for size](wiki/learnings/1785865684637-github-per-file-arrays-truncate-on-every-endpoint-.md)

## search/code under-reports and indexes only the default branch

Three tiers produced three counts (12, 11, 10) for one token; unpicking why found two defects.
**Wrong artifact**: two tiers measured the tree *without the PR in it* — a flawless measurement
of the wrong object; measure anything about a PR at the PR's SHA (`git show <sha>:<path>`), and
note the ambient checkout is not stable across turns (a sibling session refreshes the shared
clone). **`search/code` under-reports**: same object, same token, `git grep -l` → 11 vs
`search/code` → 10, silently omitting the single most important consumer, with no
`incomplete_results` flag; it also indexes only the default branch (blind to PR-added lines)
and can't see `.lua` declarations spelling the opcode differently. Use `git grep` at an
explicit ref for any load-bearing count. **Publish the enumeration, never the bare count** —
four readers with four instruments produce four numbers. Agreement between two parties is
evidence only about their *independence*, and a correction traveling *down*-tier is the
least-guarded direction. [gh search/code is not a counting instrument — it silently omitted the most important file, and measure anything about a PR at the PR's SHA](wiki/learnings/1785867313688-gh-search-code-is-not-a-counting-instrument-it-sil.md)

## The issues endpoint serves PRs; the same typo fails loud one way, silent the other

`GET /repos/{o}/{r}/issues/{N}/comments` serves pull requests too (a PR is an issue) — so
querying `issues/12348/comments` returns the *PR's* surface, not the linked issue's. A reviewer
read 0 and reported "nothing owed publicly" while the linked issue had 2 comments; acting on it
would have duplicated a comment on an issue that already had its trail. The full 2×2, measured:
a single-comment read *with* `{N}` 404s (loud); *without* `{N}` succeeds. But a **list** read
*without* `{N}` (`issues/comments`) returns **100 repo-wide rows, no error** (silent, corrupting)
— and that broken spelling is the natural guess because the list form directly above it *does*
take the issue number. Rule: when one arm of a URL-shape typo 404s, probe the other arm before
filing the lesson — the error is the *lucky* outcome. The surfaces: PR reviews →
`pulls/{N}/reviews`; PR conversation → `issues/{N}/comments` (N = the PR); PR inline →
`pulls/{N}/comments`; the linked issue → `issues/{M}/comments` (M ≠ the PR). Cheap
discriminator: fetch the object and check for a `pull_request` field.
[GitHub's issues endpoint serves PRs too — a plausible zero from the wrong surface; when a path can name two objects, query both](wiki/learnings/1785885193519-github-s-issues-endpoint-serves-prs-too-a-plausibl.md) [gh issue-comment endpoints: the issue number belongs to the LIST form, not the single-comment form — and the same typo fails LOUD one way, SILENT the other](wiki/learnings/1785941175137-gh-issue-comment-endpoints-the-issue-number-belong.md)

## Re-derive page counts every sweep

`search/issues` reported 75 non-draft open PRs; enumerating via `pulls?state=open&per_page=100`
with a carried-over `for p in 1 2` loop returned 74 — missing a real PR, because the `pulls`
endpoint pages over *all* open PRs including 235 drafts, spread across 3 pages. The
draft-filtered count tells you nothing about pages to fetch; the *unfiltered* count does. Get
the page count from the `Link:` header, or read `total_count` and paginate until `got ==
total_count`. What caught it: enumerating the population with **two independent instruments**
and diffing both directions (`comm -23` / `comm -13`) — a single instrument ships 74 as "all"
with no error signal. A count that is merely self-consistent is not complete.
[Re-derive gh API page counts per sweep — a hardcoded page count silently truncates the population](wiki/learnings/1785903383576-re-derive-gh-api-page-counts-per-sweep-a-hardcoded.md)

## Unauthenticated quota is per-IP; /rate_limit misreports it

Do NOT pre-flight `GET /rate_limit` and budget N calls — a reading is not a reservation, and
the counter is self-contradictory (reported 32 remaining while requests were 403ing). Request
*size* is not the discriminator: `per_page=1` failed where `per_page=100` to the same endpoint
succeeded seconds later. The 60/hr budget is per **egress IP** (the 403 names an IP, not an
account), pooled across everything behind the NAT — a peer coworker drains it between two of
your own calls. Fix: **cache every response body to `/tmp` on first fetch and re-parse locally**
— caching beats budgeting when the budget isn't yours to spend. Capture `%{http_code}` (plain
`curl -sf` swallows a 403 into an empty string, then `jq` fails with "Cannot iterate over
null"). A number a system reports about its own state is a *claim*, not a measurement.
[Unauthenticated GitHub API quota is shared per-IP and /rate_limit misreports it](wiki/learnings/1785900642585-unauthenticated-github-api-quota-is-shared-per-ip-.md)

## Discord forum channels return 0 from /messages

For four consecutive days a daily report called three Discord support channels "empty" and
escalated a suspected read-permission gap — while 16 live threads sat invisible. Those channels
are **forum channels (`type: 15`)**, which have no messages of their own — every post is a
*thread* with `parent_id` = the forum. So `GET /channels/{id}/messages` correctly returns `[]`
with HTTP 200, indistinguishable from a quiet text channel unless you check the type. It
survived because re-running the same call shape on a second client (MCP → REST) returned 0 too:
**corroborating a suspicious empty result only works if the second path differs in *kind*, not
just in client.** Read a forum via `guilds/{id}/threads/active` (guild-scoped, all forums in
one call, filter by `parent_id`) + `/threads/archived/public`, then read each thread id as a
channel. Sort threads by the snowflake, not list order. Before believing an emptiness, ask "am
I querying the right *kind* of object at all?" [Discord forum channels return 0 from /messages — read threads instead (4-day false-empty)](wiki/learnings/1785917748422-discord-forum-channels-return-0-from-messages-read.md)
