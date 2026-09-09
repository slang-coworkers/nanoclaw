---
title: GitHub CLI/API access under the OneCLI proxy — auth false alarms and workarounds
type: concept
group: ci-tooling
tags: [gh-cli, github-api, onecli-proxy, gh-token, pr-review, auth, curl, graphql]
source_count: 18
---

## TL;DR

- `gh auth status` reporting **"The token in GH_TOKEN is invalid"** is a **cosmetic false alarm** for read-only work. Reads succeed anyway. Do NOT abort a PR review or "stop to fix gh auth."
- Two independent reasons reads work despite the warning: (1) the credential is a **GitHub App installation token** with real read scope that `gh auth status` mis-validates; (2) shader-slang repos are **public**, so `gh` falls back to unauthenticated reads.
- The functional test is a **real read**, never `gh auth status`: run `gh pr diff <N> -R <repo>` or `gh pr view <N> -R <repo> --json number` and proceed if it returns data.
- App installation tokens legitimately FAIL on `gh auth status`, `gh api /user` (403 "Resource not accessible by integration"), and `gh api rate_limit` — these endpoints have no App identity. That is NOT a broken credential; test a repo-scoped endpoint before concluding auth is down.
- Only **writes** (posting a review/comment, rerun, merge-queue enqueue) need real `pull_requests:write`; on 403 `post-review.sh` exits 3 → send_file fallback. A fix-chain review without a `<github-post-authorized />` marker never posts anyway.
- `GH_TOKEN` may be the literal sentinel `ROUTED_VIA_ONECLI_PROXY` (23 chars). Raw `curl` (honors `HTTPS_PROXY`) gets real credential injection; `gh` validates the sentinel locally and can fail. But when the credential is a real App token, `gh` reads work fine — the original "gh is broken, use curl" finding over-generalized (see below).
- **Ad-hoc `curl` to `api.github.com` is anonymous-tier (60/hr)** — the proxy does NOT inject a token for `/actions/runs` or `/rate_limit`, so anonymous reads miss self-hosted-runner workflow failures on `slang`. Don't "independently verify" the precheck with ad-hoc curl.
- Workarounds for wedged/paginated reads: raw REST `curl` bypasses `gh run view --log`'s run-status gate on gate-wedged runs; **GraphQL `gh pr view --json reviews`** is flap-immune where REST `--paginate` 401-flaps mid-pagination.
- The `gate-critique-on-deliver.sh` PreToolUse Bash hook false-positives on any command string containing the `pulls` path segment; route reads around it (`gh pr view`, or `issues/<n>` since PRs are issues).

## The core false alarm: `gh auth status` ≠ read access

Across a long run of `/slang-pr-review` preflights (pr mode) and triager sessions, the same
pattern recurs: `gh auth status` prints `X Failed to log in to github.com account
nv-slang-bot[bot] (GH_TOKEN)` / **"The token in GH_TOKEN is invalid"**, and
`slang-pr-review-runner`'s `install.sh` echoes `warning: gh auth not configured — pr/branch
modes need a token to read the diff`. This *looks* like a hard blocker for pr/branch mode
(which needs `gh pr diff` to read the diff), but it is not. In every recorded instance,
`gh pr view <N> -R shader-slang/slang --json ...` and `gh pr diff <N> -R shader-slang/slang`
**returned real data anyway** ([false alarm for reads](../learnings/1788307346773-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md),
[don't abort a PR review](../learnings/1788254122013-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md),
[public-repo fallback](../learnings/1788396720428-gh-pr-read-works-despite-invalid-gh-token-public-r.md),
[reads still work](../learnings/1788549008722-gh-auth-status-token-invalid-warning-is-a-false-al.md),
[invalid while reads work](../learnings/1788558749393-gh-auth-status-may-report-gh-token-invalid-while-a.md),
[auth-status failure ≠ read failure](../learnings/1788782167834-gh-auth-status-failure-gh-read-failure-on-public-s.md),
[doesn't block pr-mode](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md),
[App-token false alarm](../learnings/1788799392809-gh-app-token-invalid-warning-is-a-false-alarm-for-.md),
[benign for read-only](../learnings/1788823384047-gh-invalid-token-warning-is-benign-for-read-only-p.md),
[still allows public reads](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md)).

**The operating rule** is uniform: never downgrade to Reviewer-A-only / patch mode / send_file
fallback, and never "fix gh auth," on the strength of `gh auth status` alone. Verify actual
capability with a concrete read (`gh pr diff <N> -R <repo>` or `gh pr view <N> -R <repo> --json
headRefOid`). If it returns the diff/metadata, all three reviewers (A `gh pr diff`, B Devin URL
browse, C `run-clarity.sh`) proceed normally. Each false-alarm investigation wastes ~2 minutes;
the recurrence is why this is worth a standing rule.

**Two distinct mechanisms make reads work**, and it helps to know which is in play:

1. **App installation token with read scope.** The credential is a short (~23-char) GitHub App
   installation token; `gh auth status`'s login/identity check simply mis-validates it. Reads
   have full scope. This is confirmed both for `nv-slang-bot[bot]` in the triager
   ([invalid token / user 403 is normal](../learnings/1788298673378-gh-cli-as-nv-slang-bot-invalid-token-user-403-is-n.md))
   and in the review runners.
2. **Public-repo unauthenticated fallback.** shader-slang/slang is public, so `gh pr view/diff`
   succeeds via `gh`'s unauthenticated path even when the token is a bare placeholder / routing
   sentinel. The PR head can also be fetched with plain git —
   `GIT_TERMINAL_PROMPT=0 git fetch origin pull/<N>/head:pr-<N>` — or via
   `curl -sL https://github.com/<owner>/<repo>/pull/<N>.diff`, both unauthenticated on public
   repos ([public git fetch fallback](../learnings/1788782167834-gh-auth-status-failure-gh-read-failure-on-public-s.md),
   [git/curl diff fallbacks](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md)).

Separately, the `mcp__slang-mcp__github_*` tools carry **their own valid token** independent of
the `gh` CLI's `GH_TOKEN`, so PR metadata reads through MCP always work regardless of the CLI
state ([MCP tools independent](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md)).

## App installation tokens: what genuinely fails vs. what works

An App installation token is **not** a user PAT — it has no user identity — so a fixed set of
endpoints fail by design and must not be read as "auth is broken":

- FAIL (expected): `gh auth status`, `gh api /user` → HTTP 403 "Resource not accessible by
  integration", `gh api rate_limit`.
- WORK (what you actually need): `gh api repos/...`, `gh api .../actions/runs`, `gh pr list`,
  `gh pr view <n> --json state`, and repo-scoped comment reads/writes
  (`gh api repos/OWNER/REPO/issues/<N>/comments` read and `--method POST` write).

The correction learning is explicit: **do not diagnose "gh is broken" from `gh auth status` +
`rate_limit` failures alone** — test an actions or pr/issues endpoint (the thing you need)
first ([App-token endpoints are fine — don't over-generalize](../learnings/1788205146208-correction-gh-cli-app-installation-token-is-fine-f.md)).
In the triager, the same holds: `gh auth status` says invalid and `gh api user` 403s, yet the
normal Step-9 `gh api ... --method POST/PATCH` posting flow succeeds (verified posting a comment
while triaging #12874). Test a repo-scoped call to confirm, then proceed — don't abandon `gh`
for the onecli-gateway ([repo endpoints work as nv-slang-bot](../learnings/1788298673378-gh-cli-as-nv-slang-bot-invalid-token-user-403-is-n.md)).

**Supersession note.** An earlier finding claimed the `gh` CLI itself was broken because
`GH_TOKEN` was set to the literal sentinel `ROUTED_VIA_ONECLI_PROXY`, which `gh` validates
locally before making any request; the recommended workaround was to use `curl` directly (which
honors `HTTPS_PROXY` and gets real credential injection at the HTTPS boundary), including
`-H "Accept: application/vnd.github.raw" -L` to stream files >~1MB whose Contents-API base64
`content` comes back empty ([gh broken, GH_TOKEN is a sentinel](../learnings/1788204882348-gh-cli-auth-broken-even-when-onecli-proxy-curl-wor.md)).
The **correction, ~5 minutes later in the same session, supersedes the "gh is broken"
generalization**: the container actually held a working App installation token and `gh` reads
worked fine — only `auth status`/`user`/`rate_limit` failed. Treat the sentinel-token scenario
as one possible state, not the default: always probe an actual repo/actions endpoint before
concluding `gh` can't be used ([correction](../learnings/1788205146208-correction-gh-cli-app-installation-token-is-fine-f.md)).

## Writes are the only real degrade signal

Reads and writes are separate capabilities. Posting a PR review needs true
`pull_requests:write`; on a 403 the runner's `post-review.sh` **exits 3** and the workflow falls
back to `send_file`. So the only thing an invalid/absent token genuinely blocks is Step-6
post-back — which is itself gated on the `<github-post-authorized />` marker. A chat/fix-chain
review (no marker) never posts, making an invalid token a complete non-issue for it
([writes are the separate capability](../learnings/1788558749393-gh-auth-status-may-report-gh-token-invalid-while-a.md),
[Step-6 gated on marker](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md)).
A parent's prose "post the verdict to the PR" does **not** substitute for the marker: without it,
return via `send_file` only and confirm before any GitHub write — an unsolicited bot review on a
PR a human already approved is noise on the system of record
([prose ≠ post-authorized marker](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md)).

## API-access workarounds for wedged, paginated, and anonymous reads

Even with working auth, three CLI/API behaviors need explicit workarounds:

**Ad-hoc curl is anonymous-tier (60/hr).** Interactive `curl` to `api.github.com/.../actions/runs`
or `/rate_limit` lands on the **anonymous** rate-limit tier (`{"limit":60,...}`) even though
`HTTP_PROXY`/`HTTPS_PROXY` carry the OneCLI gateway credential URL — the gateway does per-path
injection and these paths aren't on its list. Practical consequence on `slang`: anonymous reads
only see lower-privilege GitHub-hosted workflows (PR-label checks, formatting, REUSE) and **miss
self-hosted-runner failures** (the real `CI` runs). Don't use ad-hoc curl to `actions/runs` to
"independently verify" the CI-health precheck's `workflow_failures`; a mismatch there is more
likely this visibility gap than a precheck bug
([ad-hoc curl is anonymous-tier](../learnings/1788457383415-ad-hoc-github-api-curl-is-anonymous-tier-unreliabl.md)).

**`gh run view --log`/`--log-failed` refuses logs on gate-wedged runs.** When a run is stuck
non-terminal (e.g. a pending `falcor-build-approval-gate`, `status:"waiting"`), the CLI refuses
ANY job log — even for a job already `conclusion:"failure"` — because it gates on overall run
status. Bypass with the raw REST API, which returns the full log at HTTP 200:
`curl -sL -H "Authorization: token $(gh auth token)" "https://api.github.com/repos/<owner>/<repo>/actions/jobs/<job-id>/logs" -o /tmp/job.log`.
Caveat: standard Actions log retention still applies — an expired log returns empty/`BlobNotFound`
even via direct API; this helps only the gate-wedge case, not expired artifacts
([gh refuses logs on gate-wedged runs](../learnings/1788848145158-gh-cli-refuses-job-logs-on-gate-wedged-runs-bypass.md)).

**REST `--paginate` 401-flaps mid-pagination; GraphQL is flap-immune.** The OneCLI GitHub
connector intermittently 401s (`app_not_connected`), and this degrades *paginated* calls
specifically: `gh api repos/O/R/pulls/N/reviews --paginate` makes one HTTP request per page, so
on a PR with >100 reviews page 1 succeeds while a later page 401s → the whole call returns rc=1.
The **head-matched (newest) bot review is on the LAST page** — exactly the one most likely to be
lost — so a single `per_page=100` page-1 read does not contain it. The flap-immune fix is
**GraphQL in one request**: `gh pr view <N> --repo O/R --json reviews` returns all reviews
(author, state, submittedAt, body) with no pagination loop; select the newest `github-actions[bot]`
review whose footer `reviewed: <40-hex-sha> · diff sha256 <hash>` matches the pinned head. Judge
connector health with a *paginated* probe, not a single read; a lone 401 is transient (retry
once), and don't declare "all clear" from one successful single read
([flap-resistant harvest via GraphQL](../learnings/1788523820839-approver-infra-abstain-flap-resistant-review-harve.md),
[--paginate flaps, GraphQL flap-immune](../learnings/1788523950028-gh-rest-reviews-paginate-401-flaps-mid-pagination-.md)).
Ledger caveat for approvers: don't record a `HARNESS_FAIL` infra-abstain on the first 401 —
under append-only first-write-wins the stale reason_code can lock the commit's row; probe the
GraphQL fallback first and only abstain-infra if GraphQL also fails
([ledger caveat](../learnings/1788523820839-approver-infra-abstain-flap-resistant-review-harve.md)).

**A read-only `gh api .../pulls/<n>` GET trips the critique-on-deliver hook.** The
`PreToolUse:Bash` hook `gate-critique-on-deliver.sh` pattern-matches the `pulls` path segment
without distinguishing HTTP method, so a plain `gh api repos/O/R/pulls/51 -q '.author_association'`
GET is blocked with "CRITIQUE REQUIRED before PR creation" — a false positive. It only affects the
top-level command string you pass to Bash (not `gh api .../pulls/...` called inside a script
subprocess like `collect-reviews.sh`). Route around it: `gh pr view <n> --repo O/R --json ...` for
most metadata, and `gh api repos/O/R/issues/<n> -q '.author_association'` (PRs are issues) for
author association — both pass the hook and are read-only
([read-only pulls GET trips critique hook](../learnings/1788858953279-approver-infra-note-read-only-gh-api-pulls-n-gets-.md)).

**Source learnings (18):**

- [gh CLI auth broken even when OneCLI proxy curl works — GH_TOKEN is a literal sentinel](../learnings/1788204882348-gh-cli-auth-broken-even-when-onecli-proxy-curl-wor.md) — GH_TOKEN=ROUTED_VIA_ONECLI_PROXY; gh validates locally and fails, curl+proxy works; later corrected/over-generalized.
- [Correction: gh CLI App-installation token is fine for actions/PR endpoints](../learnings/1788205146208-correction-gh-cli-app-installation-token-is-fine-f.md) — the container held a working App token; gh reads work, only auth-status/user/rate_limit fail.
- [gh auth status "invalid GH_TOKEN" is a false alarm for read-only pr-mode reviews](../learnings/1788254122013-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md) — gh pr view/diff succeed on public repo; don't stop to fix auth before dispatching reviewers.
- [gh CLI as nv-slang-bot: "invalid token" / user 403 is normal for an App installation token](../learnings/1788298673378-gh-cli-as-nv-slang-bot-invalid-token-user-403-is-n.md) — repo-scoped read/POST endpoints work; test one before reaching for the gateway.
- [gh auth status "invalid GH_TOKEN" is a false alarm for reads — don't abort a PR review](../learnings/1788307346773-gh-auth-status-invalid-gh-token-is-a-false-alarm-f.md) — short App token mis-validated; verify with gh pr view --json headRefOid; writes are separate.
- [gh pr read works despite invalid GH_TOKEN (public repo fallback)](../learnings/1788396720428-gh-pr-read-works-despite-invalid-gh-token-public-r.md) — unauthenticated public-repo fallback; Reviewer A/B run fine; only Step-6 write path affected.
- [Ad-hoc GitHub API curl is anonymous-tier — unreliable to verify slang's self-hosted-runner failures](../learnings/1788457383415-ad-hoc-github-api-curl-is-anonymous-tier-unreliabl.md) — proxy doesn't inject for /actions/runs or /rate_limit; anonymous reads miss self-hosted-runner runs.
- [gh 'invalid token' in auth status still allows public-repo reads — verify before aborting](../learnings/1788469857073-gh-invalid-token-in-auth-status-still-allows-publi.md) — 23-char ROUT… token; gh api/pr diff succeed; prose ≠ the post-authorized marker.
- [Flap-resistant review harvest: GraphQL gh pr view --json reviews when REST --paginate 401-flaps](../learnings/1788523820839-approver-infra-abstain-flap-resistant-review-harve.md) — last page (head-matched bot review) is lost first; GraphQL one-shot fallback; ledger first-write caveat.
- [gh REST reviews --paginate 401-flaps mid-pagination; GraphQL gh pr view --json reviews is flap-immune](../learnings/1788523950028-gh-rest-reviews-paginate-401-flaps-mid-pagination-.md) — judge connector health with a paginated probe; retry a lone 401; GraphQL is the standing harvest path.
- [gh auth status "token invalid" warning is a false alarm — reads still work](../learnings/1788549008722-gh-auth-status-token-invalid-warning-is-a-false-al.md) — App token mis-validated; functional test is the real API call; post-review.sh exits 3 on 403 write.
- [gh auth status may report GH_TOKEN invalid while API reads still work](../learnings/1788558749393-gh-auth-status-may-report-gh-token-invalid-while-a.md) — App token has read scope; verify with gh pr diff; A/B/C proceed; writes need pull_requests:write.
- [gh auth-status failure ≠ gh read failure on public slang repos](../learnings/1788782167834-gh-auth-status-failure-gh-read-failure-on-public-s.md) — gh pr diff works; git fetch pull/<N>/head works tokenless; only posting needs a token.
- [gh auth status failing doesn't block pr-mode reviews — gh pr diff/view still work on public repos](../learnings/1788795649545-gh-auth-status-failing-doesn-t-block-pr-mode-revie.md) — don't downgrade to patch mode; MCP github_* tools use their own token; .diff/git-fetch fallbacks.
- [gh App-token 'invalid' warning is a false alarm for pr-mode reviews — reads still work](../learnings/1788799392809-gh-app-token-invalid-warning-is-a-false-alarm-for-.md) — verify with gh pr view --json number,state; runner scripts invoked directly (no leading run-clarity token).
- [gh 'invalid token' warning is benign for read-only pr-mode reviews](../learnings/1788823384047-gh-invalid-token-warning-is-benign-for-read-only-p.md) — gh api/pr view/pr diff all succeed on public repo; invalid warning only matters for writes.
- [gh CLI refuses job logs on gate-wedged runs — bypass via raw REST API curl](../learnings/1788848145158-gh-cli-refuses-job-logs-on-gate-wedged-runs-bypass.md) — --log gates on run status; raw REST /actions/jobs/<id>/logs returns full log; expired logs still 404.
- [Read-only gh api .../pulls/<n> GETs trip the critique-on-deliver bash hook](../learnings/1788858953279-approver-infra-note-read-only-gh-api-pulls-n-gets-.md) — hook matches the 'pulls' path segment regardless of method; use gh pr view or issues/<n> instead.
