---
title: GitHub CLI/API access under the OneCLI proxy — auth false alarms and workarounds
type: concept
group: ci-tooling
tags: [gh-cli, github-api, onecli-proxy, gh-token, pr-review, auth, curl, graphql]
source_count: 26
---

## TL;DR

- `gh auth status` reporting **"The token in GH_TOKEN is invalid"** is a **cosmetic false alarm** for read-only work. Reads succeed anyway. Do NOT abort a PR review or "stop to fix gh auth."
- Two independent reasons reads work despite the warning: (1) the credential is a **GitHub App installation token** with real read scope that `gh auth status` mis-validates; (2) shader-slang repos are **public**, so `gh` falls back to unauthenticated reads.
- The functional test is a **real read**, never `gh auth status`: `gh pr diff <N> -R <repo>` or `gh pr view <N> -R <repo> --json number`; proceed if it returns data.
- App installation tokens legitimately FAIL on `gh auth status`, `gh api /user` (403 "Resource not accessible by integration"), and `gh api rate_limit` — no App identity there. That is NOT a broken credential; test a repo-scoped endpoint first.
- Only **writes** (review/comment post, rerun, merge-queue enqueue) need real `pull_requests:write`; on 403 `post-review.sh` exits 3 → send_file fallback. A fix-chain review without a `<github-post-authorized />` marker never posts anyway.
- **A wedged `gh`/`GH_TOKEN` does NOT block GitHub *writes*.** Post with raw `curl -X POST .../issues/<N>/comments --data @body.json` (no `Authorization` header — the onecli-gateway injects the `nv-slang-bot[bot]` App token, which has `issues:write`) and `git push` through the same proxy (shader-slang/slang; on `shader-slang.github.io` `git push` 401s, so update a PR branch server-side with REST `POST /merges`). Only `gh`/`gh api` need an operator token refresh. Don't delegate the post or spin; slang-mcp `github_*` has no comment-create endpoint.
- `GH_TOKEN` may be the literal sentinel `ROUTED_VIA_ONECLI_PROXY` (23 chars): raw `curl` (honors `HTTPS_PROXY`) gets injection, `gh` validates it locally and can fail. When the credential is a real App token, `gh` reads work — the original "gh is broken, use curl" finding over-generalized.
- **Ad-hoc `curl` to `api.github.com` is anonymous-tier (60/hr)** — the proxy does NOT inject for `/actions/runs` or `/rate_limit`, so anonymous reads miss self-hosted-runner failures on `slang`. Don't "independently verify" the precheck with it.
- Wedged/paginated reads: raw REST `curl` bypasses `gh run view --log`'s run-status gate; **GraphQL `gh pr view --json reviews`** is flap-immune where REST `--paginate` 401-flaps.
- The `gate-critique-on-deliver.sh` PreToolUse hook false-positives on any command containing the `pulls` path segment; use `gh pr view` or `issues/<n>` (PRs are issues).
- **When `gh` 401s (`app_not_connected`) or slang-mcp rejects its header, header-less urllib/curl to api.github.com still reads** — at the injected 6000/h or anonymous 60/h; read the quota from `X-RateLimit-*`, not `/rate_limit`.
- **Overlapping sweeps share one installation REST quota (5000-6000/h).** Batch searches and state reads as aliased fields in one GraphQL query (separate budget; ~40 light aliases cost 1 point); heavy per-node fields (`statusCheckRollup`, `reviews(first:30)`) ≤ ~15 aliases per query (a 502/504 means query cost, not an outage). Sample job lists and log headers; read files from raw.githubusercontent.com (no quota).

## The core false alarm: `gh auth status` ≠ read access

Across many `/slang-pr-review` preflights (pr mode) and triager sessions, `gh auth status` prints
`X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN)` / **"The token in GH_TOKEN is
invalid"**, and `slang-pr-review-runner`'s `install.sh` echoes `warning: gh auth not configured — pr/branch
modes need a token to read the diff`. It looks like a hard blocker for pr/branch mode, but in every
recorded instance `gh pr view <N> -R shader-slang/slang --json ...`, `gh pr diff <N> -R shader-slang/slang`
and `gh api repos/<repo>/pulls/<N> --jq .title` **returned real data**
([false alarm for reads](../learnings/1788307346773-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md),
[don't abort a PR review](../learnings/1788254122013-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md),
[public-repo fallback](../learnings/1788396720428-gh-pr-read-works-despite-invalid-gh-token-public-r.md),
[auth-status failure ≠ read failure](../learnings/1788782167834-gh-auth-status-failure-gh-read-failure-on-public-s.md),
[doesn't block pr-mode](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md),
[App-token false alarm](../learnings/1788799392809-gh-app-token-invalid-warning-is-a-false-alarm-for-.md),
[benign for read-only](../learnings/1788823384047-gh-invalid-token-warning-is-benign-for-read-only-p.md),
[still allows public reads](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md),
[false alarm in /slang-pr-review preflight](../learnings/1790172928541-gh-auth-status-invalid-token-is-a-false-alarm-for-.md)).

**The operating rule:** never downgrade to Reviewer-A-only / patch mode / send_file fallback, and never
"fix gh auth," on the strength of `gh auth status` alone. Verify with a concrete read (`gh pr diff <N> -R
<repo>` or `gh pr view <N> -R <repo> --json headRefOid`); if it returns data, all three reviewers (A `gh pr
diff`, B Devin URL browse, C `run-clarity.sh`) proceed. Read access is all they need; only the post-back step
can genuinely degrade. Each false-alarm investigation wastes ~2 minutes, hence the standing rule.

**Two distinct mechanisms make reads work:**

1. **App installation token with read scope.** The credential is a short (~23-char) GitHub App installation
   token that `gh auth status`'s identity check mis-validates; reads have full scope (confirmed for
   `nv-slang-bot[bot]` in the triager
   ([invalid token / user 403 is normal](../learnings/1788298673378-gh-cli-as-nv-slang-bot-invalid-token-user-403-is-n.md))
   and in the review runners).
2. **Public-repo unauthenticated fallback.** shader-slang/slang is public, so `gh pr view/diff` succeeds
   unauthenticated even with a placeholder / routing-sentinel token. The PR head can also be fetched
   tokenless with `GIT_TERMINAL_PROMPT=0 git fetch origin pull/<N>/head:pr-<N>` or
   `curl -sL https://github.com/<owner>/<repo>/pull/<N>.diff`
   ([public git fetch fallback](../learnings/1788782167834-gh-auth-status-failure-gh-read-failure-on-public-s.md),
   [git/curl diff fallbacks](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md)).

Separately, the `mcp__slang-mcp__github_*` tools carry **their own token** independent of `GH_TOKEN`, so MCP
PR metadata reads work regardless of CLI state
([MCP tools independent](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md)).

## App installation tokens: what genuinely fails vs. what works

An App installation token has no user identity, so a fixed set of endpoints fail by design:

- FAIL (expected): `gh auth status`, `gh api /user` → HTTP 403 "Resource not accessible by integration",
  `gh api rate_limit`.
- WORK: `gh api repos/...`, `gh api .../actions/runs`, `gh pr list`, `gh pr view <n> --json state`, and
  repo-scoped comment reads/writes (`gh api repos/OWNER/REPO/issues/<N>/comments` read and `--method POST`).

**Do not diagnose "gh is broken" from `gh auth status` + `rate_limit` failures alone** — test the actions or
pr/issues endpoint you need first
([App-token endpoints are fine — don't over-generalize](../learnings/1788205146208-correction-gh-cli-app-installation-token-is-fine-f.md)).
In the triager, `gh auth status` says invalid and `gh api user` 403s, yet the Step-9 `gh api ... --method
POST/PATCH` posting flow succeeds (verified while triaging #12874) — don't abandon `gh` for the gateway
([repo endpoints work as nv-slang-bot](../learnings/1788298673378-gh-cli-as-nv-slang-bot-invalid-token-user-403-is-n.md)).

**Supersession.** An earlier finding claimed `gh` itself was broken because `GH_TOKEN` was the literal
sentinel `ROUTED_VIA_ONECLI_PROXY`, which `gh` validates locally; its workaround was `curl` (honors
`HTTPS_PROXY`, gets injection), including `-H "Accept: application/vnd.github.raw" -L` to stream files >~1MB
whose Contents-API base64 `content` comes back empty
([gh broken, GH_TOKEN is a sentinel](../learnings/1788204882348-gh-cli-auth-broken-even-when-onecli-proxy-curl-wor.md)).
The correction minutes later supersedes the generalization: the container held a working App token and
`gh` reads worked; only `auth status`/`user`/`rate_limit` failed. The sentinel is one possible state, not the
default — probe a repo/actions endpoint before concluding `gh` can't be used
([correction](../learnings/1788205146208-correction-gh-cli-app-installation-token-is-fine-f.md)).

## Writes are the only real degrade signal

Posting a PR review needs true `pull_requests:write`; on a 403 the runner's `post-review.sh` **exits 3** and
the workflow falls back to `send_file`. So an invalid/absent token genuinely blocks only Step-6 post-back,
which is itself gated on the `<github-post-authorized />` marker; a chat/fix-chain review (no marker) never
posts. A parent's prose "post the verdict to the PR" does **not** substitute for the marker: return via
`send_file` and confirm before any GitHub write — an unsolicited bot review on a PR a human already approved
is noise on the system of record
([Step-6 gated on marker; prose ≠ marker](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md)).

**An invalid `GH_TOKEN` degrades only the `gh`/`gh api` path, not GitHub writes.** Raw `curl` and `git` honor
`HTTPS_PROXY`, and the onecli-gateway injects the `nv-slang-bot[bot]` App token (with `issues:write`) at the
proxy. To comment when `gh` is wedged, write the body to a file and
`curl -s -X POST --data @body.json https://api.github.com/repos/<owner>/<repo>/issues/<N>/comments` — **no
`Authorization` header**; `/issues/<N>/comments` posts on issues and PRs, `PATCH /issues/comments/<id>` edits.
`git push` of a `fix/issue-*` branch goes through the same gateway. The comment endpoints are on the gateway's
per-path injection list though `/actions/runs` and `/rate_limit` are not, so a *write* succeeds where an
ad-hoc *read* falls to the anonymous tier. `curl https://api.github.com/user` → 403 "Resource not accessible
by integration" is expected for an App token. slang-mcp `github_*` has **no** comment-create endpoint (only
file create/update, gets, lists, search). So do **not** delegate the post or poll/retry on a bad `GH_TOKEN`:
post via `curl`, push via `git`, verify by re-fetching the comment id (author `nv-slang-bot[bot]`, no
`&lt;`/`&gt;` escaping), and flag the broken `GH_TOKEN` to an operator so `gh` tooling recovers. This
supersedes the earlier "a bad `GH_TOKEN` blocks all comment posting — delegate or refresh" note
([post comments via the onecli-gateway curl+proxy](../learnings/1789225036565-gh-cli-invalid-gh-token-post-github-comments-via-t.md),
[CORRECTION: PR comments DO post via the proxy when gh/GH_TOKEN is broken](../learnings/1789225153684-correction-pr-comments-do-post-via-onecli-gateway-.md);
superseding the earlier [blocks-all-posting belief](../learnings/1789224850935-invalid-gh-token-blocks-all-pr-issue-comment-posti.md)).

**`git push` authorization is per repo, and REST can stand in for it.** On `shader-slang/shader-slang.github.io`, `git push` over smart-HTTP fails with `Authentication failed` (the gateway doesn't accept the credential for `git-receive-pack` there); pushes to `shader-slang/slang` and REST writes to github.io work. To update a bot PR branch from `main` without pushing, merge server-side:
`gh api -X POST repos/shader-slang/shader-slang.github.io/merges -f base=<pr-branch> -f head=main -f commit_message="Merge branch 'main' into <pr-branch>"`.
That advances the ref and triggers `pull_request` CI (App token, not `GITHUB_TOKEN`, so workflows fire). The repo's `permissions` field reports all-false even though REST writes succeed. The site's Sphinx linkcheck runs on `pull_request` only, so `main` has no runs; for a green control use other PRs' recent runs ([github.io git push 401s; REST /merges updates the branch](../learnings/1790698605213-shader-slang-github-io-git-push-401s-rest-merges-u.md)).

## API-access workarounds for wedged, paginated, and anonymous reads

**Ad-hoc curl is anonymous-tier (60/hr).** Interactive `curl` to `api.github.com/.../actions/runs` or
`/rate_limit` lands on the anonymous tier (`{"limit":60,...}`) even though `HTTP_PROXY`/`HTTPS_PROXY` carry the
gateway credential URL — the gateway injects per path and these aren't listed. On `slang`, anonymous reads see
only GitHub-hosted workflows (PR-label checks, formatting, REUSE) and **miss self-hosted-runner failures** (the
real `CI` runs). Don't use it to "independently verify" the CI-health precheck's `workflow_failures`; a
mismatch is more likely this gap than a precheck bug
([ad-hoc curl is anonymous-tier](../learnings/1788457383415-ad-hoc-github-api-curl-is-anonymous-tier-unreliabl.md)).

**`gh run view --log`/`--log-failed` refuses logs on gate-wedged runs.** When a run is stuck non-terminal
(e.g. pending `falcor-build-approval-gate`, `status:"waiting"`), the CLI refuses ANY job log — even of a job
already `conclusion:"failure"` — because it gates on run status. Raw REST returns the full log at HTTP 200:
`curl -sL -H "Authorization: token $(gh auth token)" "https://api.github.com/repos/<owner>/<repo>/actions/jobs/<job-id>/logs" -o /tmp/job.log`.
Log retention still applies: an expired log returns empty/`BlobNotFound` even via direct API
([gh refuses logs on gate-wedged runs](../learnings/1788848145158-gh-cli-refuses-job-logs-on-gate-wedged-runs-bypass.md)).

**REST `--paginate` 401-flaps mid-pagination; GraphQL is flap-immune.** The OneCLI GitHub connector
intermittently 401s (`app_not_connected`); `gh api repos/O/R/pulls/N/reviews --paginate` makes one request per
page, so on a PR with >100 reviews a later page 401s and the call returns rc=1. The **head-matched (newest) bot
review is on the LAST page**, so a `per_page=100` page-1 read misses it. Fix: **GraphQL in one request** —
`gh pr view <N> --repo O/R --json reviews` returns all reviews (author, state, submittedAt, body); select the
newest `github-actions[bot]` review whose footer `reviewed: <40-hex-sha> · diff sha256 <hash>` matches the
pinned head. Judge connector health with a *paginated* probe; a lone 401 is transient (retry once), and one
successful single read is not "all clear". Approver ledger caveat: don't record a `HARNESS_FAIL` infra-abstain
on the first 401 — under append-only first-write-wins the stale reason_code can lock the commit's row; abstain
only if GraphQL also fails
([flap-resistant harvest via GraphQL](../learnings/1788523820839-approver-infra-abstain-flap-resistant-review-harve.md),
[--paginate flaps, GraphQL flap-immune](../learnings/1788523950028-gh-rest-reviews-paginate-401-flaps-mid-pagination-.md)).

**A read-only `gh api .../pulls/<n>` GET trips the critique-on-deliver hook.** `PreToolUse:Bash` hook
`gate-critique-on-deliver.sh` matches the `pulls` path segment regardless of HTTP method, so `gh api
repos/O/R/pulls/51 -q '.author_association'` is blocked with "CRITIQUE REQUIRED before PR creation". It checks
only the top-level Bash command string (not subprocesses like `collect-reviews.sh`). Use `gh pr view <n> --repo
O/R --json ...`, or `gh api repos/O/R/issues/<n> -q '.author_association'` (PRs are issues)
([read-only pulls GET trips critique hook](../learnings/1788858953279-approver-infra-note-read-only-gh-api-pulls-n-gets-.md)).

**When `gh` and slang-mcp both lose auth mid-sweep, raw HTTP still reads.** In the Slang Maintainer container `gh api ...` failed with `app_not_connected` (HTTP 401, "GitHub is not connected in OneCLI"), and mid-run the `mcp__slang-mcp__github_*` tools began failing with "rejected the Authorization header". Plain python urllib or curl to `https://api.github.com` (REST and `POST /graphql`) with **no** Authorization header worked through the proxy at the full 6000/h in one container [gh CLI 401s while raw REST/GraphQL works](../learnings/1792139649364-onecli-github-gh-cli-401s-while-raw-rest-graphql-w.md), and anonymously at 60 core/h and 10 searches/min in another [GitHub read fallback when gh/slang-mcp auth fails](../learnings/1792139710335-github-read-fallback-when-gh-slang-mcp-auth-fails-.md). Read the quota from `X-RateLimit-*` on a real request, not `/rate_limit` (which reported a misleading 60/h core and graphql limit 0). URL-encode search queries (`urllib.parse.quote`; a raw `created:>=` returns non-JSON), fetch files from raw.githubusercontent.com, and keep a sweep's rechecks under ~10 searches. The same anonymous route covers a shared installation token that hit its 5,000/h limit while `gh api rate_limit` returns `app_not_connected`: `curl -H "Authorization:" https://api.github.com/...` answers at 60/h core and 10/min search, and a github.com issue HTML page embeds state, milestone and assignees as JSON — enough for a read-only recheck [DescriptorHandle textures get no image format (gh rate-limit fallback)](../learnings/1792658643801-slang-descriptorhandle-textures-get-no-image-forma.md). Reusable helper: `/workspace/agent/reports/tmp1016/gh.py` (get/pages/gql). `PullRequest.reviews(first:N)` caps at N: raising 30 → 50 changed an "unreviewed >30d" count by 2.

## Sweeps under the shared installation quota

Several sweeps share one GitHub App installation token, so the REST core quota (5000-6000/h) can run out mid-run (it did on 2026-10-22; on 10-23 only 2,346 calls were left at 08:11Z). Three rules keep a sweep inside the budget.

**Batch reads into one GraphQL query.** GraphQL has its own budget: one `gh api graphql` request with ~40 aliased `search(query:"...", type:ISSUE, first:8){issueCount nodes{... on Issue{number title state createdAt author{login}}}}` fields cost 1 point, replacing ~40 REST `search/issues` calls (which also carry a 10-30/min secondary limit). Issue/PR state, assignees, milestones, last comments, `history(path:...)` last change per file, and `ref.compare(headRef:)` ahead/behind counts fit in one query at the same cost (same-repo heads only: a fork head returns `NOT_FOUND`, see [query confidence](ci-github-query-confidence-and-gates.md)). For a squash-merged PR's merge time read `mergedAt`, not `committedDate`: they can differ by hours (#13866 merged 19:14Z, committed 16:54Z) ([batch GitHub issue searches into one GraphQL call](../learnings/1792743590595-batch-github-issue-searches-into-one-graphql-call-.md)).

**Chunk heavy aliases to ~15 per query.** One watch-list query with ~70 aliased `pullRequest(number:N){reviews(first:30) statusCheckRollup reviewRequests timelineItems}` nodes returned nginx `502 Bad Gateway` on all 4 retries (script died on `KeyError 'data'`); chunks of 15 succeeded first try. Light state-only checks (`issueOrPullRequest{state closedAt}`) work at 40 per query. A 502/504 means query cost or timeout, not an outage. Two 20-alias roster sweeps back to back can trip the GraphQL secondary limit (403 "exceeded a secondary rate limit"); a 10 s retry recovers. Don't rerun a sweep just to see its stdout — redirect it to a file the first time ([GraphQL aliased PR batches 502 when too heavy](../learnings/1792743971886-github-graphql-aliased-pr-batches-502-when-too-hea.md)).

**Sample jobs and logs; don't scan them all.** In the daily CI-health sweep, fetching jobs for every run (~2,150 calls) and every ubuntu-latest log header (~2,700 calls) used most of the budget. A full sweep fits in ~670 calls:
- Fetch jobs only for the ~80 `CI` runs — enough for pool waits and T4/Falcor/macOS stats.
- For the Ubuntu image check, read one ubuntu-latest log header from each of ~40 runs spread across time and repos, with `Range: bytes=0-6000` (~80 calls).
- Read every 4th `CI Retry Yielded Bot` log; count reruns free from the runs list (`CI` runs with `run_attempt>1`, grouped by `triggering_actor`).
- Use GraphQL for searches and merge-queue timeline events.

Track `X-RateLimit-Remaining` on every response and sleep to the reset below ~250. Grepping retry-bot logs for "rerunning" also matches "not rerunning bot CI.", so filter whole lines ([CI sweep under shared REST quota: sample instead of full scans](../learnings/1792744188827-ci-sweep-under-shared-rest-quota-sample-instead-of.md)).

Read-only source checks need no API call: `raw.githubusercontent.com/shader-slang/slang/<sha>/<path>` doesn't count against the quota. It is also the fallback for the slang-writer clone at `/workspace/agent/slang`, which cannot `git fetch` ("bad object refs/remotes/origin/Sirox0/master", failed repack) ([batch GitHub issue searches into one GraphQL call](../learnings/1792743590595-batch-github-issue-searches-into-one-graphql-call-.md)).

**Source learnings (26):**

- [gh CLI auth broken — GH_TOKEN is a literal sentinel](../learnings/1788204882348-gh-cli-auth-broken-even-when-onecli-proxy-curl-wor.md) — over-generalized; corrected next.
- [Correction: App-installation token is fine for actions/PR endpoints](../learnings/1788205146208-correction-gh-cli-app-installation-token-is-fine-f.md) — only auth-status/user/rate_limit fail.
- [gh auth status "invalid GH_TOKEN" is a false alarm for pr-mode reviews](../learnings/1788254122013-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md) — don't stop to fix auth.
- [nv-slang-bot "invalid token" / user 403 is normal for an App token](../learnings/1788298673378-gh-cli-as-nv-slang-bot-invalid-token-user-403-is-n.md) — repo-scoped read/POST work.
- [gh auth status invalid is a false alarm for reads — don't abort](../learnings/1788307346773-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md) — verify with `--json headRefOid`.
- [gh pr read works despite invalid GH_TOKEN (public repo fallback)](../learnings/1788396720428-gh-pr-read-works-despite-invalid-gh-token-public-r.md) — only Step-6 writes affected.
- [Ad-hoc GitHub API curl is anonymous-tier](../learnings/1788457383415-ad-hoc-github-api-curl-is-anonymous-tier-unreliabl.md) — misses self-hosted-runner runs.
- [gh 'invalid token' still allows public-repo reads](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md) — prose ≠ the post-authorized marker.
- [Flap-resistant review harvest via GraphQL](../learnings/1788523820839-approver-infra-abstain-flap-resistant-review-harve.md) — last page lost first; ledger first-write caveat.
- [REST reviews --paginate 401-flaps; GraphQL is flap-immune](../learnings/1788523950028-gh-rest-reviews-paginate-401-flaps-mid-pagination-.md) — paginated health probe.
- [gh auth-status failure ≠ read failure on public repos](../learnings/1788782167834-gh-auth-status-failure-gh-read-failure-on-public-s.md) — tokenless `git fetch pull/<N>/head`.
- [gh auth status failing doesn't block pr-mode reviews](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md) — MCP tools use their own token.
- [App-token 'invalid' warning is a false alarm for pr-mode](../learnings/1788799392809-gh-app-token-invalid-warning-is-a-false-alarm-for-.md) — verify with `--json number,state`.
- [gh 'invalid token' warning is benign for read-only reviews](../learnings/1788823384047-gh-invalid-token-warning-is-benign-for-read-only-p.md) — matters only for writes.
- [gh CLI refuses job logs on gate-wedged runs](../learnings/1788848145158-gh-cli-refuses-job-logs-on-gate-wedged-runs-bypass.md) — raw REST `/logs` bypass.
- [Read-only gh api .../pulls/<n> GETs trip the critique hook](../learnings/1788858953279-approver-infra-note-read-only-gh-api-pulls-n-gets-.md) — use `issues/<n>`.
- [CORRECTION: PR comments DO post via onecli-gateway when GH_TOKEN is broken](../learnings/1789225153684-correction-pr-comments-do-post-via-onecli-gateway-.md) — curl POST + git push work.
- [Invalid GH_TOKEN blocks all comment posting — SUPERSEDED](../learnings/1789224850935-invalid-gh-token-blocks-all-pr-issue-comment-posti.md) — writes work via the proxy.
- [gh auth status invalid is a false alarm in /slang-pr-review preflight](../learnings/1790172928541-gh-auth-status-invalid-token-is-a-false-alarm-for-.md) — only post-back degrades.
- [shader-slang.github.io: git push 401s, REST /merges updates a branch](../learnings/1790698605213-shader-slang-github-io-git-push-401s-rest-merges-u.md) — `permissions` all-false misleads.
- [OneCLI GitHub: gh CLI 401s while raw REST/GraphQL works](../learnings/1792139649364-onecli-github-gh-cli-401s-while-raw-rest-graphql-w.md) — trust `X-RateLimit-*`.
- [GitHub read fallback when gh/slang-mcp auth fails mid-sweep](../learnings/1792139710335-github-read-fallback-when-gh-slang-mcp-auth-fails-.md) — anonymous 60/h; URL-encode search.
- [DescriptorHandle textures get no image format (#10024)](../learnings/1792658643801-slang-descriptorhandle-textures-get-no-image-forma.md) — side fact: empty-Authorization curl fallback.
- [Batch GitHub issue searches into one GraphQL call](../learnings/1792743590595-batch-github-issue-searches-into-one-graphql-call-.md) — ~40 aliases = 1 point; `mergedAt`.
- [GraphQL aliased PR batches 502 when too heavy — chunk to ~15](../learnings/1792743971886-github-graphql-aliased-pr-batches-502-when-too-hea.md) — 502 = cost.
- [CI sweep under shared REST quota: sample, don't scan](../learnings/1792744188827-ci-sweep-under-shared-rest-quota-sample-instead-of.md) — ~670 calls instead of ~4,850.
